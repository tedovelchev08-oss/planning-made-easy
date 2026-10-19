import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STUDIO_DESIGNS } from "../../api/_lib/studioDesigns";

/**
 * Block 18c: every design in the catalogue has a guest page, wired to Luma
 * the same way, with nothing fetched from outside Luma and no sample couple
 * or stock photo in its markup.
 */
const page = (id: string) => resolve(__dirname, `../../public/designs/${id}/index.html`);

describe.each(STUDIO_DESIGNS.map((d) => [d.id]))("public/designs/%s", (id) => {
  const html = existsSync(page(id)) ? readFileSync(page(id), "utf8") : "";

  it("exists", () => expect(html).not.toBe(""));

  it("loads the bridge before the shared engine", () => {
    const bridge = html.indexOf('src="../_shared/luma-bridge.js');
    const core = html.indexOf('src="../_shared/wedding-core.js');
    expect(bridge).toBeGreaterThan(0);
    expect(core).toBeGreaterThan(bridge);
  });

  it("asks nothing of other hosts (only a credit link may point out)", () => {
    const refs = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
    expect(refs.filter((u) => u !== "https://www.freepik.com")).toEqual([]);
    expect(html).not.toMatch(/url\(\s*["']?https?:/);
  });

  it("starts empty and guest-only, with no stock photo or sample story", () => {
    expect(html).toContain("isGuestView: true");
    expect(html).not.toMatch(/unsplash|pexels/i);
    expect(html).not.toMatch(/<p id="story-text-[12]"[^>]*>\s*[^<\s]/);
    expect(html).not.toContain('id="builder-bar"');
  });
});
