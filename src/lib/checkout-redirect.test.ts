import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * api/create-checkout.ts: Stripe's success/cancel URLs used to be built from
 * the caller's Origin (or Referer) header, so a curl with a fake Origin got a
 * genuine Luma payment link that ended on any site. The base is now chosen
 * from an allowlist.
 */
const sessionsCreate = vi.fn(async () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }));
vi.mock("stripe", () => ({
  default: class {
    prices = { list: async () => ({ data: [{ id: "price_1" }] }) };
    checkout = { sessions: { create: sessionsCreate } };
  },
}));

const tables: Record<string, unknown> = {
  wedding_members: { wedding_id: "w1" },
  weddings: { plan: "essential" },
};
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (t: string) => {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: tables[t], error: null }) };
      return q;
    },
  }),
}));

const { default: handler, checkoutBase, SITE_URL } = await import("../../api/create-checkout");

const PREVIEW = "https://planning-made-easy-git-fix-checkout-one-man-army-eaf1.vercel.app";
const prod = { VERCEL_ENV: "production", VITE_PUBLIC_SITE_URL: SITE_URL };
const preview = { VERCEL_ENV: "preview", VERCEL_URL: "planning-made-easy-abc123-one-man-army-eaf1.vercel.app" };

describe("checkoutBase", () => {
  it("production keeps its own site", () => {
    expect(checkoutBase(SITE_URL, prod)).toBe(SITE_URL);
    expect(checkoutBase(`${SITE_URL}/`, prod)).toBe(SITE_URL);
  });

  it("production never returns to a preview or anywhere else", () => {
    for (const o of [PREVIEW, "https://evil.example", "http://localhost:5173", undefined]) {
      expect(checkoutBase(o, prod)).toBe(SITE_URL);
    }
  });

  it("a preview returns to this project's previews", () => {
    expect(checkoutBase(PREVIEW, preview)).toBe(PREVIEW);
    expect(checkoutBase(`https://${preview.VERCEL_URL}`, preview)).toBe(`https://${preview.VERCEL_URL}`);
  });

  it("a preview sends anything else back to itself, not to the caller's site", () => {
    const self = `https://${preview.VERCEL_URL}`;
    for (const o of [
      "https://evil.example",
      "https://planning-made-easy.vercel.app.evil.com",
      "https://planning-made-easy-x-one-man-army-eaf1.vercel.app.evil.com",
      "https://planning-made-easy-x-other-team.vercel.app",
      "http://planning-made-easy-git-x-one-man-army-eaf1.vercel.app",
      "null",
      undefined,
    ]) {
      expect(checkoutBase(o, preview)).toBe(self);
    }
  });

  it("localhost only when not running on Vercel at all", () => {
    expect(checkoutBase("http://localhost:5199", {})).toBe("http://localhost:5199");
    expect(checkoutBase("http://localhost:5199", preview)).toBe(`https://${preview.VERCEL_URL}`);
  });

  it("a custom domain set as the site URL is honoured", () => {
    expect(checkoutBase("https://luma.example", { VERCEL_ENV: "production", VITE_PUBLIC_SITE_URL: "https://luma.example" })).toBe("https://luma.example");
  });
});

describe("the handler hands Stripe only allowed return URLs", () => {
  const LUMA = "https://planning-made-easy.vercel.app";
  beforeEach(() => {
    sessionsCreate.mockClear();
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VITE_PUBLIC_SITE_URL", LUMA);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  async function checkout(headers: Record<string, string>) {
    const res: { statusCode?: number; body?: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res; setHeader: () => void } = {
      status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, setHeader() {},
    };
    await handler({
      method: "POST",
      headers: { authorization: "Bearer test-jwt", ...headers },
      body: { tier: "celebration", wedding_id: "w1", currency: "eur" },
    } as never, res as never);
    return res;
  }

  it("a forged Origin still returns the buyer to Luma", async () => {
    const res = await checkout({ origin: "https://evil.example" });
    expect(res.statusCode).toBe(200);
    const args = (sessionsCreate.mock.calls[0] as unknown as [{ success_url: string; cancel_url: string }])[0];
    expect(args.success_url).toBe(`${LUMA}/#/planner?checkout=success`);
    expect(args.cancel_url).toBe(`${LUMA}/#/planner?checkout=cancelled`);
  });

  it("a Referer is no longer used at all", async () => {
    await checkout({ referer: "https://evil.example/landing" });
    const args = (sessionsCreate.mock.calls[0] as unknown as [{ success_url: string }])[0];
    expect(args.success_url.startsWith(`${LUMA}/`)).toBe(true);
  });

  it("sessions expire after 30 minutes, so an abandoned tab can't be paid later", async () => {
    const now = Math.floor(Date.now() / 1000);
    await checkout({ origin: LUMA });
    const args = (sessionsCreate.mock.calls[0] as unknown as [{ expires_at: number }])[0];
    expect(args.expires_at).toBeGreaterThanOrEqual(now + 30 * 60);
    expect(args.expires_at).toBeLessThanOrEqual(now + 30 * 60 + 5);
  });
});
