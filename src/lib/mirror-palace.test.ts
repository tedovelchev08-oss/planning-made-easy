import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STUDIO_DESIGNS, planAllows, toInvitationData, tracksOf, type PublicWedding } from "../../api/_lib/studioDesigns";

/**
 * Block 18d: Mirror Palace. It shows more than the shared details: five
 * more photos, a gallery, its own wording and its own music.
 */
const mp = STUDIO_DESIGNS.find((d) => d.id === "mirror-palace")!;
const up = (n: string) => `https://abc.supabase.co/storage/v1/object/public/media/w1/photos/${n}.jpg`;

const wedding = (design_data: Record<string, unknown> = {}, photo: string | null = null): PublicWedding => ({
  slug: "ana-boris", names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris", date: "2027-06-12T14:00:00Z",
  venue: "Villa Lago", location: "Lake Como", timezone: "Europe/Rome", locale: "en-GB", plan: "luxe",
  invitation: { template_id: "studio:mirror-palace", photo, collect_rsvp: true, design_data },
});

describe("Mirror Palace: the catalogue", () => {
  it("is part of Luxe", () => {
    expect(planAllows("luxe", mp)).toBe(true);
    expect(planAllows("celebration", mp)).toBe(false);
  });
  it("brings its own three Bach recordings, the Aria first", () => {
    expect(tracksOf(mp).map((t) => t.id)).toEqual(["aria", "prelude-ebm", "prelude-csm"]);
  });
});

describe("Mirror Palace: toInvitationData", () => {
  it("until the couple adds photos, every slot keeps the design's own drawing", () => {
    const d = toInvitationData(wedding(), mp);
    expect(d.heroPhoto).toBe("");
    for (const k of ["storyPhotoOne", "storyPhotoTwo", "storyPhotoTogether", "ceremonyPhoto", "celebrationPhoto"]) expect(d[k]).toBe("");
    expect(d.gallery).toEqual([]);
  });

  it("uses the couple's photos, and only real uploads", () => {
    const d = toInvitationData(wedding({ photos: { storyPhotoOne: up("a"), ceremonyPhoto: "javascript:alert(1)", celebrationPhoto: "http://plain/x.jpg", other: up("x") } }, up("main")), mp);
    expect(d.heroPhoto).toBe(up("main"));
    expect(d.storyPhotoOne).toBe(up("a"));
    expect(d.ceremonyPhoto).toBe("");
    expect(d.celebrationPhoto).toBe("");
    expect(d).not.toHaveProperty("other");
  });

  it("a gallery of up to five, with captions, photos without an address dropped", () => {
    const gallery = [...Array.from({ length: 6 }, (_, i) => ({ photo: up(`g${i}`), caption: `Moment ${i}` })), { caption: "no photo" }];
    const d = toInvitationData(wedding({ gallery }), mp);
    expect((d.gallery as unknown[]).length).toBe(5);
    expect((d.gallery as unknown[])[0]).toEqual({ id: "g-1", photo: up("g0"), caption: "Moment 0" });
  });

  it("the couple's wording, trimmed; generic lines fall back, couple-specific ones stay empty", () => {
    const d = toInvitationData(wedding({ texts: { heroCity: "  Lake Como ", closingMsg: "", rsvpEmailText: "x".repeat(200), unknownKey: "nope" } }), mp);
    expect(d.heroCity).toBe("Lake Como");
    expect(d.closingMsg).toBe("Until We Meet");
    expect(d.heroQuote).toBe(""); // no stock motto: without their own line, there is none
    expect(d.dateCaptionText).toBe("");
    expect(d.celebrationAddress).toBe("");
    expect((d.rsvpEmailText as string).length).toBe(80);
    expect(d).not.toHaveProperty("unknownKey");
  });

  it("plays only its own tracks: another design's choice falls back to silence", () => {
    expect(toInvitationData(wedding({ musicTrack: "prelude-ebm" }), mp).music).toEqual({ enabled: true, track: "prelude-ebm" });
    expect(toInvitationData(wedding({ musicTrack: "nocturne" }), mp).music).toEqual({ enabled: false, track: "aria" });
  });
});

/* ------------------------------ public/designs/mirror-palace/luma.js ------------------------------ */

const LUMA_JS = readFileSync(resolve(__dirname, "../../public/designs/mirror-palace/luma.js"), "utf8");
const MARKUP = `
  <div class="hero-date"><span data-sync="date">12 · 06 · 2027</span> &nbsp;·&nbsp; <span id="heroCity"></span></div>
  <p id="storyText"></p><p id="dateCaptionText"></p><div id="celebrationAddress"></div>
  <img id="ceremonyImg" src="assets/photos/ceremony.svg"><img id="celebrationImg" src="assets/photos/celebration.svg">
  <section id="schedule"></section>
  <div id="rsvpMeta"><span id="rsvpDeadlinePrefix">Kindly respond by</span> <span id="rsvpDeadlineText"></span> &nbsp;·&nbsp; <span id="rsvpEmailText"></span></div>`;

function run(data: Record<string, unknown>) {
  document.body.innerHTML = MARKUP;
  const w = window as unknown as Record<string, unknown>;
  w.invitationData = data;
  w.renderInvitationFromData = vi.fn();
  new Function(LUMA_JS)();
  (w.renderInvitationFromData as () => void)();
}
const shown = (id: string) => document.getElementById(id)!.style.display !== "none";
const text = (sel: string) => document.querySelector(sel)!.textContent!.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

describe("Mirror Palace on Twofold (luma.js)", () => {
  it("leaves out what the couple left empty, separators included", () => {
    run({ story1: "", story2: "", heroCity: "", dateCaptionText: "", celebrationAddress: "", rsvpDeadline: "", rsvpEmailText: "", schedule: [] });
    expect(text(".hero-date")).toBe("12 · 06 · 2027");
    for (const id of ["storyText", "dateCaptionText", "celebrationAddress", "rsvpMeta", "schedule"]) expect(shown(id)).toBe(false);
  });

  it("shows what they wrote, joined properly", () => {
    run({ story1: "We met in Sofia.", story2: "Then Varna.", heroCity: "Lake Como", rsvpDeadline: "1 May 2027", rsvpEmailText: "ana@example.com", schedule: [{}] });
    document.getElementById("heroCity")!.textContent = "Lake Como"; // design.js writes the city itself
    expect(text(".hero-date")).toBe("12 · 06 · 2027 · Lake Como");
    expect(document.getElementById("storyText")!.textContent).toBe("We met in Sofia.\n\nThen Varna.");
    document.getElementById("rsvpDeadlineText")!.textContent = "1 May 2027";
    document.getElementById("rsvpEmailText")!.textContent = "ana@example.com";
    expect(text("#rsvpMeta")).toBe("Kindly respond by 1 May 2027 · ana@example.com");
    expect(shown("schedule")).toBe(true);
  });

  it("a contact without a deadline shows without the 'Kindly respond by' or a stray separator", () => {
    run({ rsvpDeadline: "", rsvpEmailText: "ana@example.com" });
    expect(shown("rsvpDeadlinePrefix")).toBe(false);
    expect(shown("rsvpEmailText")).toBe(true);
    expect(document.getElementById("rsvpMeta")!.innerHTML).not.toContain("·");
  });

  it("puts the couple's ceremony photo in, and keeps the drawing where they have none", () => {
    run({ ceremonyPhoto: "https://x/venue.jpg", celebrationPhoto: "" });
    expect(document.getElementById("ceremonyImg")!.getAttribute("src")).toBe("https://x/venue.jpg");
    expect(document.getElementById("celebrationImg")!.getAttribute("src")).toBe("assets/photos/celebration.svg");
  });
});

/* ------------------------------ public/designs/liquid-gold/luma.js ------------------------------ */

const LG_JS = readFileSync(resolve(__dirname, "../../public/designs/liquid-gold/luma.js"), "utf8");
function runLg(data: Record<string, unknown>) {
  document.body.innerHTML = `<p id="line"><span id="rsvpDeadlinePrefix">Kindly answer before</span> <span id="rsvpDeadlineText">${data.rsvpDeadline ?? ""}</span> <span class="sep">&middot;</span> <span id="rsvpEmailText">${data.rsvpEmailText ?? ""}</span></p>`;
  const w = window as unknown as Record<string, unknown>;
  w.invitationData = data;
  w.renderInvitationFromData = vi.fn();
  w.lumaAfterRender = vi.fn();
  new Function(LG_JS)();
  (w.renderInvitationFromData as () => void)();
  return w.lumaAfterRender as ReturnType<typeof vi.fn>;
}
const visible = (sel: string) => (document.querySelector(sel) as HTMLElement).style.display !== "none";

describe("Liquid Gold on Twofold (luma.js)", () => {
  it("shows the RSVP line's parts only when given, the separator only between two", () => {
    runLg({ rsvpDeadline: "1 May 2027", rsvpEmailText: "" });
    expect([visible("#rsvpDeadlineText"), visible(".sep"), visible("#rsvpEmailText"), visible("#line")]).toEqual([true, false, false, true]);
    runLg({ rsvpDeadline: "1 May 2027", rsvpEmailText: "ana@example.com" });
    expect([visible(".sep"), visible("#rsvpEmailText")]).toEqual([true, true]);
    runLg({ rsvpDeadline: "", rsvpEmailText: "" });
    expect(visible("#line")).toBe(false);
  });

  it("calls the bridge's after-render step", () => {
    expect(runLg({})).toHaveBeenCalled();
  });
});
