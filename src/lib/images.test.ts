import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { IMAGES, localPhoto } from "./images";
import vercelJson from "../../vercel.json?raw";

/**
 * The built-in photos are served from our own origin, so loading a page
 * tells no third party who visited, and the CSP no longer allows the old
 * image host or Google Fonts.
 */
const OLD = "https://image.qwenlm.ai/generated-images/491b8b3f-233c-48cf-a774-26c3db982f5f/_result.png";

describe("built-in photos", () => {
  it("are local paths, and every file exists in public/", () => {
    for (const src of Object.values(IMAGES)) {
      expect(src).toMatch(/^\/images\/[a-z-]+\.jpg$/);
      expect(existsSync(`public${src}`)).toBe(true);
    }
  });

  it("an address saved before self-hosting maps to its local copy", () => {
    expect(localPhoto(OLD)).toBe(IMAGES.couple);
  });

  it("leaves every other address alone", () => {
    expect(localPhoto("data:image/jpeg;base64,AAAA")).toBe("data:image/jpeg;base64,AAAA");
    expect(localPhoto(IMAGES.venue)).toBe(IMAGES.venue);
    expect(localPhoto(null)).toBeNull();
    expect(localPhoto("")).toBe("");
  });
});

describe("Content-Security-Policy", () => {
  const csp = (JSON.parse(vercelJson) as { headers: { headers: { key: string; value: string }[] }[] }).headers
    .flatMap((h) => h.headers)
    .find((h) => h.key === "Content-Security-Policy")!.value;

  it("no longer allows the old image host or Google Fonts", () => {
    for (const host of ["image.qwenlm.ai", "fonts.googleapis.com", "fonts.gstatic.com"]) expect(csp).not.toContain(host);
  });

  it("still allows what the app needs", () => {
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://yyznkxfxmwetsmivgpxu.supabase.co");
    expect(csp).toContain("https://jgwombhiovdnketixpkr.supabase.co");
  });
});
