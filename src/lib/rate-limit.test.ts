import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Block 15: /api/report and /api/create-checkout count requests in
 * api_rate (0016). Past the limit, a report is dropped unlogged (still
 * 204) and a checkout gets 429 before any Stripe call. If the counter
 * fails, both carry on as before.
 */
let hits = 1;
let rateError: { message: string } | null = null;
const rpc = vi.fn(async () => ({ data: rateError ? null : hits, error: rateError }));
const sessionsCreate = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }));

vi.mock("stripe", () => ({
  default: class {
    prices = { list: async () => ({ data: [{ id: "price_1" }] }) };
    checkout = { sessions: { create: sessionsCreate } };
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc,
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (t: string) => {
      const row = t === "weddings" ? { plan: "essential" } : { wedding_id: "w1" };
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
      return q;
    },
  }),
}));

const report = await import("../../api/report");
const checkout = await import("../../api/create-checkout");

function res() {
  const r: { statusCode?: number; body?: unknown; status: (n: number) => typeof r; json: (b: unknown) => typeof r; end: () => typeof r; setHeader: () => void } = {
    status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, end() { return this; }, setHeader() {},
  };
  return r;
}

beforeEach(() => {
  hits = 1; rateError = null; rpc.mockClear(); sessionsCreate.mockClear();
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("VERCEL_ENV", "production");
});

describe("/api/report", () => {
  const send = async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = res();
    await report.default({
      method: "POST", headers: { "x-forwarded-for": "203.0.113.9" },
      body: { kind: "error", message: "boom", stack: "", route: "#/" },
    } as never, r as never);
    const logged = log.mock.calls.some((c) => String(c[0]).startsWith("[report:"));
    log.mockRestore();
    return { r, logged };
  };

  it("logs a report within the hourly limit, counted by a hash of the IP", async () => {
    hits = report.REPORTS_PER_HOUR;
    const { r, logged } = await send();
    expect(r.statusCode).toBe(204);
    expect(logged).toBe(true);
    const [fn, args] = rpc.mock.calls[0] as unknown as [string, { p_bucket: string; p_key: string }];
    expect(fn).toBe("api_rate_hit");
    expect(args.p_bucket).toBe("report");
    expect(args.p_key).toMatch(/^[0-9a-f]{64}$/);
    expect(args.p_key).not.toContain("203.0.113.9");
  });

  it("past the limit: still 204, but nothing is logged", async () => {
    hits = report.REPORTS_PER_HOUR + 1;
    const { r, logged } = await send();
    expect(r.statusCode).toBe(204);
    expect(logged).toBe(false);
  });

  it("if the counter fails, the report is logged anyway", async () => {
    rateError = { message: "database unavailable" };
    const { logged } = await send();
    expect(logged).toBe(true);
  });
});

describe("/api/create-checkout", () => {
  const start = async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = res();
    await checkout.default({
      method: "POST", headers: { authorization: "Bearer jwt", origin: checkout.SITE_URL },
      body: { tier: "celebration", wedding_id: "w1", currency: "eur" },
    } as never, r as never);
    return r;
  };

  it("within the limit, a session is created; counted per account", async () => {
    hits = checkout.CHECKOUTS_PER_HOUR;
    const r = await start();
    expect(r.statusCode).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    expect((rpc.mock.calls[0] as unknown as [string, { p_bucket: string }])[1].p_bucket).toBe("checkout");
  });

  it("past the limit: 429 and no Stripe call", async () => {
    hits = checkout.CHECKOUTS_PER_HOUR + 1;
    const r = await start();
    expect(r.statusCode).toBe(429);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("if the counter fails, checkout still works", async () => {
    rateError = { message: "database unavailable" };
    const r = await start();
    expect(r.statusCode).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
  });
});
