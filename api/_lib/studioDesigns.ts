/**
 * The owner's own invitation designs ("studio designs", Block 18), and how a
 * couple's Luma wedding becomes the `invitationData` those designs read.
 *
 * Each design is a static page under public/designs/<id>/ running the
 * shared wedding-core engine. It asks /api/invitation for its data, which
 * returns toInvitationData(...) below, so the mapping lives in one place for
 * guests and for the couple's preview in the planner.
 *
 * Files starting with "_" under api/ are not routes.
 */

export type StudioPlan = "celebration" | "luxe";

export interface StudioDesign {
  /** stored as invitation_config.template_id = "studio:<id>" */
  id: string;
  name: string;
  /** the plan a wedding needs for guests to see this design */
  plan: StudioPlan;
  /** one line for the planner's gallery */
  blurb: string;
  /** colours for the photo placeholder, matching the design */
  placeholder: { from: string; to: string; ink: string };
  /** the planner's card: a starfield, or a fine double frame */
  motif: "stars" | "frame";
  /** the design's own music; the shared STUDIO_TRACKS when absent */
  tracks?: readonly StudioTrack[];
  /** until the couple adds a photo: their initials, or the design's own drawn plate */
  heroPlaceholder?: "initials" | "design";
  /** where the couple's main photo goes (default heroPhoto); a design whose hero is its own material puts it elsewhere */
  mainPhotoKey?: string;
  /** what this design shows beyond the shared details */
  extras?: {
    /** photos besides the main one (invitation_config.photo), by invitationData key */
    photos: { key: string; label: string; hint?: string }[];
    /** how many gallery photos, with captions (0: none) */
    gallery: number;
    /** wording only this design has; `fallback` is shown when left empty, otherwise it's hidden */
    texts: { key: string; label: string; max: number; placeholder: string; multiline?: boolean; fallback?: string }[];
    /** a pick from the design's own options (e.g. a backdrop); the first is the default */
    choices?: { key: string; label: string; options: { value: string; label: string }[] }[];
  };
}

export interface StudioTrack { id: string; name: string; composer: string }

export const STUDIO_DESIGNS: StudioDesign[] = [
  { id: "celestial", name: "Celestial", plan: "luxe", blurb: "The night sky above your venue, drawn from your date", motif: "stars", placeholder: { from: "#0B1026", to: "#1E2650", ink: "#E8C87E" } },
  {
    id: "mirror-palace", name: "Mirror Palace", plan: "luxe", motif: "frame", heroPlaceholder: "design",
    blurb: "Gilt, candlelight and mirrors, opening like palace doors",
    placeholder: { from: "#0A0A0A", to: "#1D1B1F", ink: "#C6B89C" },
    tracks: [
      { id: "aria", name: "Aria, Goldberg Variations", composer: "Bach" },
      { id: "prelude-ebm", name: "Prelude in E-flat minor", composer: "Bach" },
      { id: "prelude-csm", name: "Prelude in C-sharp minor", composer: "Bach" },
    ],
    extras: {
      photos: [
        { key: "storyPhotoOne", label: "A portrait of one of you", hint: "The two portraits slide together as guests scroll" },
        { key: "storyPhotoTwo", label: "A portrait of the other" },
        { key: "storyPhotoTogether", label: "The two of you", hint: "Appears as the portraits meet" },
        { key: "ceremonyPhoto", label: "The ceremony venue" },
        { key: "celebrationPhoto", label: "The celebration" },
      ],
      gallery: 5,
      texts: [
        { key: "heroCity", label: "City", max: 40, placeholder: "Florence" },
        { key: "heroQuote", label: "Opening lines", max: 120, multiline: true, placeholder: "Two lives. One reflection.", fallback: "Two lives. One reflection.\nOne beautiful beginning." },
        { key: "dateCaptionText", label: "A line about the day", max: 300, multiline: true, placeholder: "One afternoon in late August, we ask you to stand beside us…" },
        { key: "celebrationPlace", label: "The celebration", max: 60, placeholder: "Dinner · Music · Dancing", fallback: "Dinner · Music · Dancing" },
        { key: "celebrationAddress", label: "Where it is", max: 120, placeholder: "The Orangery, Villa Cora" },
        { key: "rsvpEmailText", label: "Contact for questions", max: 80, placeholder: "An email or phone number, if you'd like" },
        { key: "closingMsg", label: "Closing words", max: 40, placeholder: "Until We Meet", fallback: "Until We Meet" },
      ],
    },
  },
  {
    id: "red-thread", name: "The Red Thread", plan: "celebration", motif: "frame",
    blurb: "A red thread draws itself down the page and ties the two of you together",
    placeholder: { from: "#F6EFE1", to: "#E3D7BF", ink: "#9E2B3A" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
    ],
    extras: {
      photos: [],
      gallery: 4,
      texts: [
        { key: "heroPlace", label: "Where, in a few words", max: 60, placeholder: "Villa Serrano, Lake Como" },
        { key: "heroQuote", label: "Opening lines", max: 200, multiline: true, placeholder: "An old story says a red thread ties those who are meant to meet…", fallback: "An old story says a red thread ties those who are meant to meet. It may stretch. It may tangle. It never breaks." },
      ],
    },
  },
  {
    id: "riviera", name: "Riviera", plan: "luxe", motif: "frame",
    blurb: "Rien ne va plus: guests spin a roulette wheel that lands on your wedding day",
    placeholder: { from: "#2F5D6A", to: "#9FB7B0", ink: "#F3EEE2" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
    ],
    extras: {
      photos: [],
      gallery: 4,
      texts: [
        { key: "heroPlace", label: "Where, in a few words", max: 60, placeholder: "Portovenere, Liguria" },
        { key: "rsvpEmailText", label: "Contact for questions", max: 80, placeholder: "An email or phone number, if you'd like" },
      ],
    },
  },
  {
    id: "all-in", name: "All In", plan: "luxe", motif: "frame",
    blurb: "Your invitation is dealt: the two of you as Queen and King, your photo on the Ace",
    placeholder: { from: "#C0303A", to: "#8E2230", ink: "#F4ECDC" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
    ],
    extras: {
      photos: [],
      gallery: 4,
      texts: [
        { key: "heroPlace", label: "Where, in a few words", max: 60, placeholder: "Villa Aurelia, Rome" },
        { key: "rsvpEmailText", label: "Contact for questions", max: 80, placeholder: "An email or phone number, if you'd like" },
      ],
    },
  },
  {
    id: "glasshouse", name: "The Glasshouse", plan: "celebration", motif: "frame", heroPlaceholder: "design", mainPhotoKey: "storyPhoto",
    blurb: "A morning under glass: palms, ferns and warm light, with your names over the canopy",
    placeholder: { from: "#DFE7E0", to: "#B9C9BD", ink: "#2E4A3A" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
    ],
    extras: {
      photos: [],
      gallery: 4,
      choices: [{
        key: "backdrop", label: "The glasshouse",
        options: [
          { value: "assets/backdrops/backdrop-3.jpg", label: "Palm canopy" },
          { value: "assets/backdrops/backdrop-1.jpg", label: "Misted panes" },
          { value: "assets/backdrops/backdrop-2.jpg", label: "Deep planting" },
        ],
      }],
      texts: [
        { key: "storyTitle", label: "Story heading", max: 80, placeholder: "It started with a plant neither of us could keep alive.", fallback: "How it began." },
        { key: "heroQuote", label: "Opening lines", max: 200, multiline: true, placeholder: "A glasshouse is where things are kept growing out of season…", fallback: "A glasshouse is where things are kept growing out of season. Come and stand in ours for an evening." },
        { key: "rsvpEmailText", label: "Contact for questions", max: 80, placeholder: "An email or phone number, if you'd like" },
      ],
    },
  },
  {
    id: "liquid-gold", name: "Liquid Gold", plan: "luxe", motif: "frame", heroPlaceholder: "design",
    blurb: "Molten gold on black: your names cast like a ring, the story rising line by line",
    placeholder: { from: "#0B0907", to: "#2A2116", ink: "#D4AF6A" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
      { id: "pavane", name: "Pavane", composer: "Ravel" },
    ],
    extras: {
      photos: [],
      gallery: 5,
      texts: [
        { key: "heroQuote", label: "Opening line", max: 80, placeholder: "Two lives. One promise.", fallback: "Two lives. One promise." },
        { key: "storyStatements", label: "The rising lines, one per line", max: 200, multiline: true, placeholder: "It started with two\nTwo lives\nOne unexpected moment\nAnd now\nUs", fallback: "It started with two\nTwo lives\nOne unexpected moment\nAnd now\nUs" },
        { key: "rsvpEmailText", label: "Contact for questions", max: 80, placeholder: "An email or phone number, if you'd like" },
      ],
    },
  },
  {
    id: "cinema", name: "The Picture House", plan: "luxe", motif: "frame", heroPlaceholder: "design",
    blurb: "Your wedding as a film: velvet curtains, a three-act story and a ticket to tear",
    placeholder: { from: "#120E0B", to: "#2A2018", ink: "#C99B4C" },
    tracks: [
      { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
      { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
      { id: "pavane", name: "Pavane", composer: "Ravel" },
    ],
    extras: {
      photos: [
        { key: "storyPhotoOne", label: "A portrait of one of you", hint: "\"Starring\" in Act I" },
        { key: "storyPhotoTwo", label: "A portrait of the other" },
        { key: "storyPhotoTogether", label: "The two of you" },
      ],
      gallery: 6,
      texts: [
        { key: "heroEyebrow", label: "The opening slate", max: 60, placeholder: "Scene 01 — Ext. Lake Como — Dusk", fallback: "Scene 01 — The Wedding" },
      ],
    },
  },
  { id: "art-deco", name: "Art Deco", plan: "celebration", blurb: "Palm fronds and fine gilded lines, in sage and ivory", motif: "frame", placeholder: { from: "#F5F9F6", to: "#DDEBE2", ink: "#4E8A6C" } },
];

export const STUDIO_PREFIX = "studio:";

export function studioDesignOf(templateId: string | null | undefined): StudioDesign | null {
  if (!templateId || !templateId.startsWith(STUDIO_PREFIX)) return null;
  return STUDIO_DESIGNS.find((d) => d.id === templateId.slice(STUDIO_PREFIX.length)) ?? null;
}

const RANK: Record<string, number> = { essential: 0, celebration: 1, luxe: 2 };
/** whether a wedding on `plan` may show `design` to its guests */
export const planAllows = (plan: string | null | undefined, design: StudioDesign) => (RANK[plan ?? "essential"] ?? 0) >= RANK[design.plan];

/** the page itself, named in full: Vercel's SPA rewrite must never get a say */
export const designPath = (design: StudioDesign) => `/designs/${design.id}/index.html`;

/** a guest's link to a studio design: the same token, slug and source as Luma's own invitation link */
export function studioInviteUrl(design: StudioDesign, link: { token?: string | null; slug?: string | null; src?: string | null }): string {
  const q = new URLSearchParams();
  if (link.token) q.set("token", link.token);
  if (link.slug) q.set("slug", link.slug);
  if (link.src) q.set("src", link.src);
  return `${designPath(design)}?${q.toString()}`;
}

/* ------------------------------ the mapping ------------------------------ */

/** What get_public_wedding returns for an open invitation (the parts used here). */
export interface PublicWedding {
  slug: string;
  names: string;
  partnerA?: string | null;
  partnerB?: string | null;
  date: string;
  venue?: string | null;
  location?: string | null;
  timezone?: string | null;
  locale?: string | null;
  plan?: string | null;
  invitation?: {
    template_id?: string | null;
    photo?: string | null;
    collect_rsvp?: boolean | null;
    music?: { track?: string | null; uploadName?: string | null; url?: string | null } | null;
    design_data?: DesignData | null;
  } | null;
}

/** The couple's details for a studio design (invitation_config.design_data). */
export interface DesignData {
  hashtag?: string;
  dressCode?: string;
  dressCodeNote?: string;
  rsvpDeadline?: string;
  /** "How we met": up to two short paragraphs */
  story1?: string;
  story2?: string;
  /** one of the design's own tracks, or "none"; ignored when the couple uploaded a song */
  musicTrack?: string;
  /** the design's extra photos (extras.photos), by key: public addresses of uploads */
  photos?: Record<string, string>;
  /** the design's own wording (extras.texts), by key */
  texts?: Record<string, string>;
  /** the design's gallery (extras.gallery) */
  gallery?: { photo?: string; caption?: string }[];
  /** the design's choices (extras.choices), by key */
  choices?: Record<string, string>;
  schedule?: { time?: string; title?: string; venue?: string; icon?: string }[];
  faq?: { question?: string; answer?: string }[];
}

/** the designs' own music (public domain / CC0, see public/designs/_shared/audio/CREDITS.txt) */
export const STUDIO_TRACKS = [
  { id: "clairdelune", name: "Clair de lune", composer: "Debussy" },
  { id: "nocturne", name: "Nocturne in E-flat", composer: "Chopin" },
  { id: "gnossienne", name: "Gnossienne No. 1", composer: "Satie" },
  { id: "traumerei", name: "Träumerei", composer: "Schumann" },
  { id: "pavane", name: "Pavane", composer: "Ravel" },
] as const;

/** the music a design offers */
export const tracksOf = (design: StudioDesign): readonly StudioTrack[] => design.tracks ?? STUDIO_TRACKS;

/** a photo address a guest's browser may load: uploads (https) and the planner's own preview copies (blob:) */
const photoUrl = (v: unknown): string => (typeof v === "string" && /^(https:\/\/|blob:)/.test(v) ? v : "");

/** what the couple can write for a studio design: the editor's limits, well inside 0020's 32 KB */
export const DESIGN_LIMITS = {
  hashtag: 40, dressCode: 60, dressCodeNote: 80, rsvpDeadline: 40, story: 600,
  items: 12, time: 20, title: 60, venue: 80, question: 120, answer: 500,
} as const;

function partners(w: PublicWedding): [string, string] {
  if (w.partnerA || w.partnerB) return [w.partnerA ?? "", w.partnerB ?? ""];
  const [a = "", b = ""] = (w.names ?? "").split(/\s*(?:&|and|и)\s*/i);
  return [a, b];
}

/** the wedding's day and time, in the couple's own time zone and language */
function dayAndTime(iso: string, timezone?: string | null, locale?: string | null): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso.slice(0, 10), time: "" };
  const tz = timezone || "UTC";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let time: string;
  try {
    time = new Intl.DateTimeFormat(locale || "en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    // an unknown locale tag: fall back rather than fail the invitation
    time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  }
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time };
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));

/**
 * Until the couple uploads a photo: a quiet placeholder in the design's own
 * colours with their initials. Never a stock photograph (licensing).
 */
export function placeholderPhoto(design: StudioDesign, a: string, b: string): string {
  const first = (n: string) => escapeXml((n.trim()[0] ?? "").toUpperCase());
  const initials = `${first(a)} &amp; ${first(b)}`;
  const { from, to, ink } = design.placeholder;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="800" height="1000" fill="url(#g)"/><circle cx="400" cy="500" r="170" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width="2"/><text x="400" y="525" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="78" fill="${ink}" letter-spacing="4">${initials}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The design's `invitationData`, built from the couple's Luma wedding. */
export function toInvitationData(w: PublicWedding, design: StudioDesign): Record<string, unknown> {
  const [partner1, partner2] = partners(w);
  const { date, time } = dayAndTime(w.date, w.timezone, w.locale);
  const dd = w.invitation?.design_data ?? {};
  const music = w.invitation?.music ?? {};
  const uploaded = music.url && music.track === "upload";
  // silent unless the couple picked one of the design's tracks (as the designs ship)
  const track = tracksOf(design).some((t) => t.id === dd.musicTrack) ? dd.musicTrack! : null;

  return {
    partner1,
    partner2,
    hashtag: dd.hashtag ?? "",
    date,
    time,
    venueName: w.venue ?? "",
    venueAddress: w.location ?? "",
    dressCode: dd.dressCode ?? "",
    dressCodeNote: dd.dressCodeNote ?? "",
    rsvpDeadline: dd.rsvpDeadline ?? "",
    story1: dd.story1 ?? "",
    story2: dd.story2 ?? "",
    music: uploaded
      ? { enabled: true, track: "couple", coupleUrl: music.url, coupleName: music.uploadName ?? "Our song" }
      : { enabled: !!track, track: track ?? tracksOf(design)[0].id },
    // the design's own sample photos are never shown: only the couple's
    gallery: [],
    schedule: (dd.schedule ?? []).slice(0, 12).map((s, i) => ({
      id: i + 1, time: s.time ?? "", icon: s.icon ?? "fa-heart", venue: s.venue ?? "", title: s.title ?? "",
    })),
    faq: (dd.faq ?? []).slice(0, 12).map((f, i) => ({ id: i + 1, question: f.question ?? "", answer: f.answer ?? "" })),
    // the couple's own photo; until then their initials, or the design's own drawn plate
    heroPhoto: (design.mainPhotoKey ?? "heroPhoto") !== "heroPhoto" ? ""
      : photoUrl(w.invitation?.photo) || (design.heroPlaceholder === "design" ? "" : placeholderPhoto(design, partner1, partner2)),
    ...(design.mainPhotoKey && design.mainPhotoKey !== "heroPhoto" ? { [design.mainPhotoKey]: photoUrl(w.invitation?.photo) } : {}),
    ...extrasOf(design, dd),
    rsvpOpen: w.invitation?.collect_rsvp !== false,
    isGuestView: true,
  };
}

/** a design's own photos, gallery and wording, each declared in its extras and nothing else */
function extrasOf(design: StudioDesign, dd: DesignData): Record<string, unknown> {
  const x = design.extras;
  if (!x) return {};
  const out: Record<string, unknown> = {};
  for (const slot of x.photos) out[slot.key] = photoUrl(dd.photos?.[slot.key]);
  for (const t of x.texts) {
    const v = typeof dd.texts?.[t.key] === "string" ? dd.texts[t.key].trim().slice(0, t.max) : "";
    out[t.key] = v || t.fallback || "";
  }
  for (const c of x.choices ?? []) {
    const v = dd.choices?.[c.key];
    out[c.key] = c.options.some((o) => o.value === v) ? v : c.options[0].value;
  }
  if (x.gallery > 0) {
    out.gallery = (dd.gallery ?? [])
      .map((g) => ({ photo: photoUrl(g.photo), caption: typeof g.caption === "string" ? g.caption.slice(0, 60) : "" }))
      .filter((g) => g.photo)
      .slice(0, x.gallery)
      .map((g, i) => ({ id: `g-${i + 1}`, ...g }));
  }
  return out;
}
