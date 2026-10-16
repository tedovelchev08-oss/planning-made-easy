import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { captureError, redactToken } from "./report";

/**
 * A guest's personal link is #/invite?token=<uuid>. That token alone lets
 * anyone read and answer the invitation, so an error on that page must
 * never send it to the log.
 */
const TOKEN = "3f2b9c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b";

describe("redactToken", () => {
  it("hides the token in a hash route, keeping the rest", () => {
    expect(redactToken(`#/invite?token=${TOKEN}&src=whatsapp`)).toBe("#/invite?token=[redacted]&src=whatsapp");
  });
  it("hides it in a full URL and inside JSON", () => {
    expect(redactToken(`https://x.app/#/invite?token=${TOKEN}`)).not.toContain(TOKEN);
    expect(redactToken(JSON.stringify({ at: `#/invite?token=${TOKEN}` }))).not.toContain(TOKEN);
  });
  it("leaves the public slug link alone", () => {
    expect(redactToken("#/invite?slug=ana-and-ben-7k3q&src=link")).toBe("#/invite?slug=ana-and-ben-7k3q&src=link");
  });
});

describe("captureError on a guest's personal link", () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    window.location.hash = `#/invite?token=${TOKEN}&src=email`;
  });
  afterEach(() => { window.location.hash = ""; fetchMock.mockClear(); });

  it("sends the route with the token redacted", async () => {
    captureError(new Error("invitation render failed"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    expect(body).not.toContain(TOKEN);
    expect(JSON.parse(body).route).toBe("#/invite?token=[redacted]&src=email");
  });
});

describe("api/report: the server redacts too (old clients, stray tokens)", () => {
  it("logs no token from route, message or context", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { default: handler } = await import("../../api/report");
    const res = { setHeader() {}, status() { return this; }, end() { return this; }, json() { return this; } };
    await handler({
      method: "POST",
      headers: {},
      body: {
        kind: "error",
        message: `failed to load #/invite?token=${TOKEN}`,
        stack: "",
        ctx: { at: `https://x.app/#/invite?token=${TOKEN}` },
        route: `#/invite?token=${TOKEN}`,
      },
    } as never, res as never);
    const line = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(line).toContain("[report:error]");
    expect(line).not.toContain(TOKEN);
    log.mockRestore();
  });
});
