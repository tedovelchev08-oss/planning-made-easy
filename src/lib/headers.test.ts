import { describe, it, expect } from "vitest";
import vercelJson from "../../vercel.json?raw";

/**
 * The planner shows the studio designs live in an iframe of its own origin,
 * so /designs/ may be framed by the app itself; nothing else may be framed.
 */
type Rule = { source: string; headers: { key: string; value: string }[] };
const rules = (JSON.parse(vercelJson) as { headers: Rule[] }).headers;
const header = (source: string, key: string) =>
  rules.find((r) => r.source === source)?.headers.find((h) => h.key === key)?.value ?? "";

describe("framing headers", () => {
  it("lets the app frame its own invitation designs, and only those", () => {
    expect(header("/designs/(.*)", "X-Frame-Options")).toBe("SAMEORIGIN");
    expect(header("/designs/(.*)", "Content-Security-Policy")).toContain("frame-ancestors 'self'");
  });

  it("keeps every other page unframeable", () => {
    expect(header("/((?!designs/).*)", "X-Frame-Options")).toBe("DENY");
    expect(header("/((?!designs/).*)", "Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });
});
