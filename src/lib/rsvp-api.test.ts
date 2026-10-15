import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * api/rsvp.ts: the order of the gates matters. A request that fails the
 * Turnstile check must never reach the database, and one over the
 * per-visitor limit must never be submitted.
 */
const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

const { default: handler, parseRsvp, hashIp, clientIp, statusFor, PER_VISITOR_LIMIT } = await import("../../api/rsvp");
import vercelJson from "../../vercel.json?raw";

function call(body: unknown, headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) {
  const res: { statusCode?: number; body?: unknown; setHeader: () => void; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
    setHeader: () => {},
    status(n) { this.statusCode = n; return this; },
    json(b) { this.body = b; return this; },
  };
  return handler({ method: "POST", body, headers } as never, res as never).then(() => res);
}

const good = { slug: "maya-theo-7k3q", name: "Priya Desai", answer: "yes", source: "whatsapp", turnstile: "XXXX.DUMMY.TOKEN.XXXX" };
let turnstileOk = true;

beforeEach(() => {
  rpc.mockReset();
  turnstileOk = true;
  vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: turnstileOk }))));
});

describe("api/rsvp — the gates, in order", () => {
  it("refuses a body without a Turnstile token before anything else runs", async () => {
    const res = await call({ ...good, turnstile: "" });
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a failed Turnstile check without touching the database", async () => {
    turnstileOk = false;
    const res = await call(good);
    expect(res.statusCode).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends Cloudflare the secret, the token and the client IP", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await call(good);
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    const form = new URLSearchParams(String((init as RequestInit).body));
    expect(form.get("response")).toBe(good.turnstile);
    expect(form.get("remoteip")).toBe("203.0.113.7");
  });

  it("stops a visitor over the per-visitor limit before submitting", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    const res = await call(good);
    expect(res.statusCode).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("rsvp_rate_hit");
  });

  it("rate-limits on a hash of the IP, never the IP itself", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await call(good);
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain("203.0.113.7");
    expect(args.p_limit).toBe(PER_VISITOR_LIMIT);
  });

  it("submits a good answer through the server-only verified path", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const res = await call(good);
    expect(res.statusCode).toBe(200);
    expect(rpc.mock.calls[1][0]).toBe("submit_rsvp_verified");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_slug: good.slug, p_name: "Priya Desai", p_answer: "yes", p_source: "whatsapp" });
  });

  it("turns database refusals into statuses and words a guest can act on", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: null, error: { code: "P0006", message: "not open" } });
    const res = await call(good);
    expect(res.statusCode).toBe(403);
    expect((res.body as { error: string }).error).toMatch(/isn't open/);
  });

  it("refuses to run unconfigured rather than accepting unchecked answers", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const res = await call(good);
    expect(res.statusCode).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("parseRsvp", () => {
  it("accepts a well-formed answer", () => {
    expect(parseRsvp(good)).toMatchObject({ slug: good.slug, token: null, meal: null, note: null });
  });
  it("needs a link, a real name, a yes/no and a known source", () => {
    expect(parseRsvp({ ...good, slug: undefined })).toMatch(/link/);
    expect(parseRsvp({ ...good, name: "x" })).toMatch(/name/);
    expect(parseRsvp({ ...good, name: "x".repeat(121) })).toMatch(/name/);
    expect(parseRsvp({ ...good, answer: "maybe" })).toMatch(/yes or no/);
    expect(parseRsvp({ ...good, source: "tiktok" })).toMatch(/source/);
  });
  it("bounds every free-text field", () => {
    expect(parseRsvp({ ...good, note: "x".repeat(1001) })).toMatch(/too long/);
    expect(parseRsvp({ ...good, meal: "x".repeat(81) })).toMatch(/too long/);
    expect(parseRsvp({ ...good, plusOne: "x".repeat(121) })).toMatch(/too long/);
    expect(parseRsvp({ ...good, note: 42 })).toMatch(/too long/);
  });
  it("ignores a malformed token instead of passing it on", () => {
    expect(parseRsvp({ ...good, token: "not-a-uuid" })).toMatchObject({ token: null });
  });
});

describe("helpers", () => {
  it("hashIp is stable per visitor and different per key", () => {
    expect(hashIp("1.2.3.4", "k")).toBe(hashIp("1.2.3.4", "k"));
    expect(hashIp("1.2.3.4", "k")).not.toBe(hashIp("1.2.3.5", "k"));
    expect(hashIp("1.2.3.4", "k")).not.toBe(hashIp("1.2.3.4", "other"));
  });
  it("clientIp takes the first forwarded address", () => {
    expect(clientIp({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } } as never)).toBe("203.0.113.7");
    expect(clientIp({ headers: {} } as never)).toBe("unknown");
  });
  it("statusFor maps every 0011 error code", () => {
    expect(statusFor("P0001").status).toBe(404);
    expect(statusFor("P0002").status).toBe(429);
    expect(statusFor("P0003").status).toBe(400);
    expect(statusFor("P0006").status).toBe(403);
    expect(statusFor("XX000").status).toBe(500);
  });
});

describe("the CSP lets Turnstile load", () => {
  const csp = String(vercelJson).match(/"Content-Security-Policy",\s*"value":\s*"([^"]+)"/)?.[1] ?? "";
  it("in script-src and frame-src", () => {
    expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
    expect(csp).toMatch(/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
  });
});
