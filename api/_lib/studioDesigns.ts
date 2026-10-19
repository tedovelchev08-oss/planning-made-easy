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
}

export const STUDIO_DESIGNS: StudioDesign[] = [
  { id: "celestial", name: "Celestial", plan: "luxe", blurb: "The night sky above your venue, drawn from your date", motif: "stars", placeholder: { from: "#0B1026", to: "#1E2650", ink: "#E8C87E" } },
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
const DESIGN_TRACKS: string[] = STUDIO_TRACKS.map((t) => t.id);

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
  const track = DESIGN_TRACKS.includes(dd.musicTrack ?? "") ? dd.musicTrack! : null;

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
      : { enabled: !!track, track: track ?? "clairdelune" },
    // the design's own sample photos are never shown: only the couple's
    gallery: [],
    schedule: (dd.schedule ?? []).slice(0, 12).map((s, i) => ({
      id: i + 1, time: s.time ?? "", icon: s.icon ?? "fa-heart", venue: s.venue ?? "", title: s.title ?? "",
    })),
    faq: (dd.faq ?? []).slice(0, 12).map((f, i) => ({ id: i + 1, question: f.question ?? "", answer: f.answer ?? "" })),
    heroPhoto: w.invitation?.photo || placeholderPhoto(design, partner1, partner2),
    rsvpOpen: w.invitation?.collect_rsvp !== false,
    isGuestView: true,
  };
}
