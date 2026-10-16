import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * api/health.ts: an uptime monitor reads only the status code, so 200 must
 * mean "Supabase answered" and nothing else, and the body must never leak
 * the keys or the project address.
 */
const { default: handler, TIMEOUT_MS } = await import("../../api/health");

const ANON = "anon-key-test";
const URL_ = "https://staging.example.supabase.co";

function call(method = "GET") {
  const headers: Record<string, string> = {};
  const res: { statusCode?: number; body?: unknown; headers: typeof headers; setHeader: (k: string, v: string) => void; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(b) { this.body = b; return this; },
  };
  return handler({ method } as never, res as never).then(() => res);
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_SUPABASE_URL", URL_);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", ANON);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/health", () => {
  it("is 200 when Supabase answers the anon probe", async () => {
    const fetchMock = vi.fn(async () => new Response("null", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["Cache-Control"]).toBe("no-store");

    // the probe is the guest page's own anon RPC, with the public key only
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL_}/rest/v1/rpc/get_public_wedding`);
    expect((init.headers as Record<string, string>).apikey).toBe(ANON);
    expect(JSON.parse(init.body as string)).toEqual({ p_slug: "__health__" });
  });

  it("is 503 when Supabase returns an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ status: "unavailable" });
  });

  it("is 503 when Supabase can't be reached or times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation timed out.", "TimeoutError"); }));
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(TIMEOUT_MS).toBeLessThanOrEqual(5000);
  });

  it("is 503 without calling anything when it isn't configured", async () => {
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await call();
    expect(res.statusCode).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never puts the key or the project address in the response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("null", { status: 200 })));
    const ok = JSON.stringify((await call()).body);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const down = JSON.stringify((await call()).body);
    for (const body of [ok, down]) {
      expect(body).not.toContain(ANON);
      expect(body).not.toContain("supabase.co");
    }
  });

  it("answers GET and HEAD only", async () => {
    const res = await call("POST");
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, HEAD");
  });
});
