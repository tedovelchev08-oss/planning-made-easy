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

  // most designs run the shared engine; a few (Map) are standalone pages with their own renderer
  const engine = html.includes('src="../_shared/wedding-core.js');

  it("loads the bridge before whatever draws the page", () => {
    const bridge = html.indexOf('src="../_shared/luma-bridge.js');
    const drawer = engine ? html.indexOf('src="../_shared/wedding-core.js') : html.search(/src="luma-[a-z]+\.js/);
    expect(bridge).toBeGreaterThan(0);
    expect(drawer).toBeGreaterThan(bridge);
  });

  it("asks nothing of other hosts (only a credit link may point out)", () => {
    const refs = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]);
    expect(refs.filter((u) => u !== "https://www.freepik.com")).toEqual([]);
    expect(html).not.toMatch(/url\(\s*["']?https?:/);
  });

  it("starts empty and guest-only, with no stock photo or sample story", () => {
    if (engine) expect(html).toContain("isGuestView: true");
    expect(html).not.toMatch(/unsplash|pexels/i);
    expect(html).not.toMatch(/<p id="story-text-[12]"[^>]*>\s*[^<\s]/);
    expect(html).not.toContain('id="builder-bar"');
  });

  // the template's stock lines, which read as generated rather than written
  it("carries none of the template's stock lines", () => {
    expect(html).not.toMatch(/Counting Down to Forever|The Celebration Schedule|Frequently Asked Questions|A Few Favorite Moments|Eleanor &(amp;)? James|Joyfully Accepts|Regretfully Declines|"We can't wait to celebrate with you\."|Warm in December/);
  });
});

/*
 * Designs with their own RSVP handler (patched for Luma) must read the form
 * BEFORE disabling its fields: disabled fields are left out of FormData, so
 * the answer would arrive empty (it did, once, in Riviera's first patch).
 */
const HANDLERS = ["design.js", "page.js"];
const own = STUDIO_DESIGNS.flatMap((d) =>
  HANDLERS.filter((f) => {
    const js = resolve(__dirname, `../../public/designs/${d.id}/${f}`);
    return existsSync(js) && readFileSync(js, "utf8").includes("reply goes to /api/rsvp");
  }).map((f) => [d.id, f]),
);

describe.each(own)("public/designs/%s/%s: its own RSVP handler", (id, file) => {
  const js = readFileSync(resolve(__dirname, `../../public/designs/${id}/${file}`), "utf8");
  const block = js.slice(js.indexOf("reply goes to /api/rsvp"));

  it("reads the answers before disabling the fields", () => {
    const read = block.search(/new FormData\(\w+\)/);
    const disable = block.indexOf(".disabled = true");
    expect(read).toBeGreaterThan(0);
    expect(disable).toBeGreaterThan(read);
  });

  it("waits for the answer instead of confirming regardless", () => {
    expect(block).toMatch(/\.then\(function\s*\(res\)/);
    expect(block).toMatch(/res\.ok/);
  });
});
