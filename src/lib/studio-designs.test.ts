import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  STUDIO_DESIGNS, planAllows, placeholderPhoto, studioDesignOf, studioInviteUrl, toInvitationData, type PublicWedding,
} from "../../api/_lib/studioDesigns";

/**
 * Block 18a: the owner's own designs read a couple's Luma wedding through
 * /api/invitation, shaped as the design's `invitationData`.
 */
const celestial = STUDIO_DESIGNS.find((d) => d.id === "celestial")!;

const wedding = (over: Partial<PublicWedding> = {}): PublicWedding => ({
  slug: "ana-boris",
  names: "Ana & Boris",
  partnerA: "Ana",
  partnerB: "Boris",
  date: "2027-06-12T14:00:00Z",
  venue: "Villa Lago",
  location: "Lake Como, Italy",
  timezone: "Europe/Rome",
  locale: "en-GB",
  plan: "luxe",
  invitation: { template_id: "studio:celestial", photo: null, collect_rsvp: true, music: { track: "serene" }, design_data: {} },
  ...over,
});

describe("studio designs: the catalogue", () => {
  it("reads 'studio:<id>' template ids and nothing else", () => {
    expect(studioDesignOf("studio:celestial")).toBe(celestial);
    expect(studioDesignOf("studio:nope")).toBeNull();
    expect(studioDesignOf("tp3")).toBeNull();
    expect(studioDesignOf(null)).toBeNull();
  });

  it("Celestial needs Luxe", () => {
    expect(planAllows("luxe", celestial)).toBe(true);
    expect(planAllows("celebration", celestial)).toBe(false);
    expect(planAllows("essential", celestial)).toBe(false);
    expect(planAllows(null, celestial)).toBe(false);
  });

  it("Art Deco is part of Celebration (and so of Luxe)", () => {
    const deco = studioDesignOf("studio:art-deco")!;
    expect(deco.name).toBe("Art Deco");
    expect(planAllows("celebration", deco)).toBe(true);
    expect(planAllows("luxe", deco)).toBe(true);
    expect(planAllows("essential", deco)).toBe(false);
  });

  it("The Red Thread is part of Celebration, with its two tracks and its own opening lines", () => {
    const rt = studioDesignOf("studio:red-thread")!;
    expect(planAllows("celebration", rt)).toBe(true);
    expect(planAllows("essential", rt)).toBe(false);
    const d = toInvitationData({ slug: "a", names: "A & B", date: "2027-06-12T14:00:00Z", invitation: { template_id: "studio:red-thread", design_data: { musicTrack: "clairdelune" } } }, rt);
    expect(d.music).toEqual({ enabled: true, track: "clairdelune" });
    expect(d.heroQuote).toMatch(/^An old story says a red thread/);
    expect(d.heroPlace).toBe("");
    expect(d.gallery).toEqual([]);
  });

  it("Riviera is part of Luxe, with a postcard gallery and its contact line", () => {
    const rv = studioDesignOf("studio:riviera")!;
    expect(planAllows("luxe", rv)).toBe(true);
    expect(planAllows("celebration", rv)).toBe(false);
    const d = toInvitationData({ slug: "a", names: "A & B", date: "2027-06-12T14:00:00Z", invitation: { template_id: "studio:riviera", design_data: { texts: { rsvpEmailText: "ana@example.com" } } } }, rv);
    expect(d.rsvpEmailText).toBe("ana@example.com");
    expect(d.heroPlace).toBe("");
    expect((d.heroPhoto as string).startsWith("data:image/svg+xml")).toBe(true);
  });

  it("All In is part of Luxe; the Ace shows the couple's initials until they add a photo", () => {
    const ai = studioDesignOf("studio:all-in")!;
    expect(planAllows("luxe", ai)).toBe(true);
    expect(planAllows("celebration", ai)).toBe(false);
    const d = toInvitationData({ slug: "a", names: "A & B", date: "2027-06-12T14:00:00Z", invitation: { template_id: "studio:all-in" } }, ai);
    expect((d.heroPhoto as string).startsWith("data:image/svg+xml")).toBe(true);
    expect(d.gallery).toEqual([]);
  });

  it("The Glasshouse keeps its own backdrop as the hero; the couple's photo goes in the story frame", () => {
    const gh = studioDesignOf("studio:glasshouse")!;
    expect(planAllows("celebration", gh)).toBe(true);
    const photo = "https://abc.supabase.co/storage/v1/object/public/media/w1/photos/p.jpg";
    const d = toInvitationData({ slug: "a", names: "A & B", date: "2027-06-12T14:00:00Z", invitation: { template_id: "studio:glasshouse", photo, design_data: { choices: { backdrop: "assets/backdrops/backdrop-1.jpg" } } } }, gh);
    expect(d.heroPhoto).toBe("");
    expect(d.storyPhoto).toBe(photo);
    expect(d.backdrop).toBe("assets/backdrops/backdrop-1.jpg");
    expect(d.storyTitle).toBe("How it began.");
  });

  it("a choice outside the design's own options falls back to its first", () => {
    const gh = studioDesignOf("studio:glasshouse")!;
    const d = toInvitationData({ slug: "a", names: "A & B", date: "2027-06-12T14:00:00Z", invitation: { template_id: "studio:glasshouse", design_data: { choices: { backdrop: "https://evil.example/x.jpg" } } } }, gh);
    expect(d.backdrop).toBe("assets/backdrops/backdrop-3.jpg");
    expect(d.storyPhoto).toBe("");
  });

  it("a guest's link keeps the token, the slug and the source", () => {
    expect(studioInviteUrl(celestial, { token: "t-1", src: "whatsapp" })).toBe("/designs/celestial/index.html?token=t-1&src=whatsapp");
    expect(studioInviteUrl(celestial, { slug: "ana-boris" })).toBe("/designs/celestial/index.html?slug=ana-boris");
  });
});

describe("studio designs: toInvitationData", () => {
  it("maps the couple, the day in their own time zone, and the venue", () => {
    const d = toInvitationData(wedding(), celestial);
    expect(d).toMatchObject({
      partner1: "Ana", partner2: "Boris",
      date: "2027-06-12", time: "16:00",
      venueName: "Villa Lago", venueAddress: "Lake Como, Italy",
      rsvpOpen: true, isGuestView: true, gallery: [],
    });
  });

  it("splits 'names' when the partners aren't stored separately", () => {
    const d = toInvitationData(wedding({ partnerA: null, partnerB: null, names: "Mila and Petar" }), celestial);
    expect([d.partner1, d.partner2]).toEqual(["Mila", "Petar"]);
  });

  it("passes the couple's design details, with schedule and FAQ capped at 12", () => {
    const schedule = Array.from({ length: 15 }, (_, i) => ({ time: `${10 + (i % 10)}:00`, title: `Item ${i}` }));
    const d = toInvitationData(wedding({
      invitation: {
        template_id: "studio:celestial", collect_rsvp: true,
        design_data: { dressCode: "Black tie", rsvpDeadline: "1 May 2027", hashtag: "#AnaBoris", story1: "We met in Sofia.", schedule, faq: [{ question: "Kids?", answer: "Adults only." }] },
      },
    }), celestial);
    expect(d).toMatchObject({ dressCode: "Black tie", rsvpDeadline: "1 May 2027", hashtag: "#AnaBoris", story1: "We met in Sofia.", story2: "" });
    expect((d.schedule as unknown[]).length).toBe(12);
    expect((d.schedule as { id: number; icon: string }[])[0]).toMatchObject({ id: 1, icon: "fa-heart", title: "Item 0" });
    expect(d.faq).toEqual([{ id: 1, question: "Kids?", answer: "Adults only." }]);
  });

  it("is silent unless the couple picked a track; an uploaded song wins", () => {
    expect(toInvitationData(wedding(), celestial).music).toEqual({ enabled: false, track: "clairdelune" });
    const picked = wedding({ invitation: { template_id: "studio:celestial", design_data: { musicTrack: "nocturne" } } });
    expect(toInvitationData(picked, celestial).music).toEqual({ enabled: true, track: "nocturne" });
    const uploaded = wedding({ invitation: { template_id: "studio:celestial", music: { track: "upload", url: "https://x.supabase.co/song.mp3", uploadName: "Our waltz" }, design_data: { musicTrack: "nocturne" } } });
    expect(toInvitationData(uploaded, celestial).music).toEqual({ enabled: true, track: "couple", coupleUrl: "https://x.supabase.co/song.mp3", coupleName: "Our waltz" });
  });

  it("never shows a stock photo: the couple's photo, or their initials", () => {
    expect(toInvitationData(wedding({ invitation: { template_id: "studio:celestial", photo: "https://x/p.jpg" } }), celestial).heroPhoto).toBe("https://x/p.jpg");
    const ph = toInvitationData(wedding(), celestial).heroPhoto as string;
    expect(ph.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(ph)).toContain("A &amp; B");
  });

  it("escapes the initials in the placeholder", () => {
    expect(decodeURIComponent(placeholderPhoto(celestial, "<x", "\"y"))).toContain("&lt; &amp; &quot;");
  });

  it("follows the couple's RSVP switch", () => {
    expect(toInvitationData(wedding({ invitation: { template_id: "studio:celestial", collect_rsvp: false } }), celestial).rsvpOpen).toBe(false);
  });
});

/* ------------------------------ api/invitation ------------------------------ */

const { default: handler } = await import("../../api/invitation");
const URL_ = "https://staging.example.supabase.co";
const TOKEN = "0b6f3a52-7d1e-4c55-9a51-2f0f4b1c9e11";

function call(query: Record<string, string>, method = "GET") {
  const headers: Record<string, string> = {};
  const res: { statusCode?: number; body?: unknown; headers: typeof headers; setHeader: (k: string, v: string) => void; status: (n: number) => typeof res; json: (b: unknown) => typeof res } = {
    headers,
    setHeader(k, v) { headers[k] = v; },
    status(n) { this.statusCode = n; return this; },
    json(b) { this.body = b; return this; },
  };
  return handler({ method, query } as never, res as never).then(() => res);
}

/** answers each RPC by name */
function supabase(answers: Record<string, unknown>) {
  const fn = vi.fn(async (url: string) => {
    const name = url.split("/rpc/")[1];
    if (!(name in answers)) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify(answers[name]), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("api/invitation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SUPABASE_URL", URL_);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key-test");
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "site-key-test");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the design's data for an open invitation, never cached", async () => {
    supabase({ get_public_wedding: { ...wedding(), live: true } });
    const res = await call({ slug: "ana-boris" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body).toMatchObject({ status: "live", design: "celestial", slug: "ana-boris", guest: null, turnstileSiteKey: "site-key-test" });
    expect((res.body as { invitation: { partner1: string } }).invitation.partner1).toBe("Ana");
  });

  it("a personal link resolves the guest and their wedding", async () => {
    const fetchMock = supabase({ get_guest_by_token: { name: "Priya Shah", slug: "ana-boris" }, get_public_wedding: { ...wedding(), live: true } });
    const res = await call({ token: TOKEN });
    expect(res.body).toMatchObject({ status: "live", guest: { name: "Priya Shah" } });
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ p_slug: "ana-boris" });
  });

  it("a closed invitation reveals nothing", async () => {
    supabase({ get_public_wedding: { slug: "ana-boris", live: false } });
    const res = await call({ slug: "ana-boris" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "closed" });
  });

  it("is 404 for an unknown wedding or guest", async () => {
    supabase({ get_public_wedding: null, get_guest_by_token: null });
    expect((await call({ slug: "nobody" })).statusCode).toBe(404);
    expect((await call({ token: TOKEN })).statusCode).toBe(404);
  });

  it("is 409 when the wedding uses a Luma design, or its plan doesn't include this one", async () => {
    supabase({ get_public_wedding: { ...wedding({ invitation: { template_id: "tp3" } }), live: true } });
    expect((await call({ slug: "ana-boris" })).body).toEqual({ status: "other-design" });
    supabase({ get_public_wedding: { ...wedding({ plan: "celebration" }), live: true } });
    expect((await call({ slug: "ana-boris" })).statusCode).toBe(409);
  });

  it("rejects bad links and other methods without calling Supabase", async () => {
    const fetchMock = supabase({});
    expect((await call({})).statusCode).toBe(400);
    expect((await call({ slug: "Bad Slug!" })).statusCode).toBe(400);
    expect((await call({ token: "not-a-uuid" })).statusCode).toBe(400);
    expect((await call({ slug: "ana-boris" }, "POST")).statusCode).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is 502 when Supabase fails", async () => {
    supabase({});
    expect((await call({ slug: "ana-boris" })).statusCode).toBe(502);
  });
});
