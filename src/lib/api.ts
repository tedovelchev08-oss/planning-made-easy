/* ============================================================
 * Luma · data layer
 * Typed CRUD against Supabase + the anonymous RPC surface.
 * All functions assume a configured client (store gates on mode).
 * ============================================================ */

import { requireSb } from "./supabase";
import type { Database, GuestRow, WeddingRow } from "./db-types";
import {
  BudgetCategory, CustomTemplate, FloorObject, Guest, Plan, RegistryItem, RsvpEntry, SeatTable, Task,
  Vendor, Wedding, slugify, toDayKey,
} from "./data";
import type { Db, InvitationConfig, WebsiteConfig } from "./store";
import type { Currency } from "./plans";
import { localPhoto } from "./images";

export const isUuid = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

/* ------------------------------ mappers ------------------------------ */

export const rowToWedding = (r: WeddingRow): Wedding => ({
  names: r.names, partnerA: r.partner_a, partnerB: r.partner_b, date: r.date,
  venue: r.venue, location: r.location, timezone: r.timezone,
  locale: r.locale ?? "en-US", currency: r.currency ?? "USD", slug: r.slug,
});

export const weddingToRow = (w: Wedding) => ({
  names: w.names, partner_a: w.partnerA, partner_b: w.partnerB, date: w.date,
  venue: w.venue, location: w.location, timezone: w.timezone,
  locale: w.locale, currency: w.currency, slug: w.slug,
});

export const rowToGuest = (r: GuestRow): Guest => ({
  id: r.id, name: r.name, party: r.party, rsvp: r.rsvp, meal: r.meal,
  table: r.table_id, seat: r.seat, plusOneOf: r.plus_one_of, dietary: r.dietary,
  notes: r.notes, token: r.rsvp_token,
});

export const guestToRow = (g: Guest, weddingId: string, sort: number): GuestRow => ({
  id: g.id, wedding_id: weddingId, name: g.name, party: g.party, rsvp: g.rsvp,
  meal: g.meal, table_id: g.table, seat: g.seat, plus_one_of: g.plusOneOf,
  dietary: g.dietary, notes: g.notes, rsvp_token: g.token ?? newId(), sort,
});

export const rowToTable = (r: { id: string; name: string; shape: SeatTable["shape"]; capacity: number; x: number; y: number; skin?: string | null }): SeatTable => ({
  id: r.id, name: r.name, shape: r.shape, capacity: r.capacity, x: Number(r.x), y: Number(r.y),
  skin: (r.skin as SeatTable["skin"]) ?? "linen",
});

export const rowToVenueObject = (r: {
  id: string; kind: FloorObject["kind"]; label: string; x: number; y: number; w: number; h: number;
}): FloorObject => ({
  id: r.id, kind: r.kind, label: r.label ?? "",
  x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h),
});

export const venueObjectToRow = (o: FloorObject, weddingId: string, sort: number) => ({
  id: o.id, wedding_id: weddingId, kind: o.kind, label: o.label, x: o.x, y: o.y, w: o.w, h: o.h, sort,
});

export const tableToRow = (t: SeatTable, weddingId: string, sort: number) => ({
  id: t.id, wedding_id: weddingId, name: t.name, shape: t.shape, capacity: t.capacity, x: t.x, y: t.y,
  skin: t.skin ?? "linen", sort,
});

export const rowToBudget = (r: { id: string; name: string; budget: number; manual_committed: number; manual_paid: number; color: string }): BudgetCategory => ({
  id: r.id, name: r.name, budget: Number(r.budget), manualCommitted: Number(r.manual_committed), manualPaid: Number(r.manual_paid), color: r.color,
});

export const budgetToRow = (b: BudgetCategory, weddingId: string, sort: number) => ({
  id: b.id, wedding_id: weddingId, name: b.name, budget: b.budget, manual_committed: b.manualCommitted, manual_paid: b.manualPaid, color: b.color, sort,
});

export const rowToTask = (r: { id: string; title: string; phase: Task["phase"]; done: boolean; assignee: Task["assignee"]; due: string | null; week: boolean }): Task => ({
  id: r.id, title: r.title, phase: r.phase, done: r.done, assignee: r.assignee,
  ...(r.due ? { due: toDayKey(r.due) } : {}), week: r.week,
});

export const taskToRow = (t: Task, weddingId: string, sort: number) => ({
  id: t.id, wedding_id: weddingId, title: t.title, phase: t.phase, done: t.done,
  assignee: t.assignee, due: t.due ?? null, week: t.week ?? false, sort,
});

type VendorRowDb = Database["public"]["Tables"]["vendors"]["Row"] & {
  vendor_payments?: Database["public"]["Tables"]["vendor_payments"]["Row"][];
};

export const rowToVendor = (r: VendorRowDb): Vendor => ({
  id: r.id, category: r.category, company: r.company, contact: r.contact,
  email: r.email, phone: r.phone, price: Number(r.price), status: r.status,
  contract: r.contract, notes: r.notes, budgetId: r.budget_id,
  payments: (r.vendor_payments ?? [])
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ label: p.label, amount: Number(p.amount), due: p.due, paid: p.paid })),
});

export const registryToRow = (r: RegistryItem, weddingId: string, sort: number) => ({
  id: r.id, wedding_id: weddingId, name: r.name, store: r.store, price: r.price,
  url: r.url, purchased: r.purchased, sort,
});

export const customTplToRow = (c: CustomTemplate, weddingId: string, sort: number) => ({
  id: c.id, wedding_id: weddingId, name: c.name, data_url: c.dataUrl ?? null, html: c.html ?? null, sort,
});

export const rsvpToRow = (e: RsvpEntry, weddingId: string) => ({
  id: e.id, wedding_id: weddingId, guest_id: null as string | null, name: e.name,
  answer: e.answer, meal: e.meal, note: e.note,
  plus_one: e.plusOne ?? null, plus_one_meal: e.plusOneMeal ?? null, source: e.source,
  at: new Date(e.at).toISOString(), synced: e.synced ?? false,
});

export const rowToRsvp = (r: Database["public"]["Tables"]["rsvps"]["Row"]): RsvpEntry => ({
  id: r.id, name: r.name, answer: r.answer, meal: r.meal, note: r.note ?? "",
  plusOne: r.plus_one, plusOneMeal: r.plus_one_meal,
  at: new Date(r.at).getTime(), source: r.source as RsvpEntry["source"], synced: r.synced,
});

export const invitationToRow = (c: InvitationConfig, weddingId: string) => ({
  wedding_id: weddingId, template_id: c.templateId, line1: c.line1, line2: c.line2,
  venue_line: c.venueLine, collect_rsvp: c.rsvp, collect_meal: c.meal, collect_notes: c.notes,
  photo: c.photo, colors: c.colors as unknown as null, font_serif: c.fontSerif,
  // the song's address lives in its own column; the music blob keeps only what to play and its name
  motion: c.motion as never, music: { track: c.music.track, uploadName: c.music.uploadName } as never,
  music_url: c.music.uploadUrl,
  is_live: c.live,
});

export const websiteToRow = (w: WebsiteConfig, weddingId: string) => ({
  wedding_id: weddingId, template: w.template, hero_photo: w.heroPhoto, bg: w.bg,
  ink: w.ink, accent: w.accent, serif: w.serif, animations: w.animations,
  sections: w.sections as never, domain: w.domain, published: w.published,
});

/* ------------------------------ workspace ------------------------------ */

export async function myWeddingId(): Promise<string | null> {
  const { data, error } = await requireSb()
    .from("wedding_members")
    .select("wedding_id, weddings(id)")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.wedding_id ?? null;
}

/**
 * The version (updated_at) of every row this tab loaded, keyed
 * "<entity>:<id>" — "wedding:wedding", "invitation:invitation" and
 * "website:website" for the single rows. Sent back with each save so the
 * database can refuse one based on a stale copy (0018).
 */
export type Versions = Map<string, string>;
export const versionKey = (key: EntityKey, id: string) => `${key}:${id}`;

/** A save refused because a partner changed or deleted the row since this tab loaded it. */
export class ConflictError extends Error {
  readonly code = "P0409";
}

/**
 * Loads the couple's whole plan in one round of parallel selects. Pass a
 * map to also receive every row's version.
 */
export async function fetchWorkspace(weddingId: string, userId: string, versions?: Versions): Promise<Db> {
  const s = requireSb();
  const [wedding, guests, tables, venueObjects, budget, tasks, vendors, registry, invitation, website, custom, rsvps, entitlement] =
    await Promise.all([
      s.from("weddings").select("*").eq("id", weddingId).single(),
      s.from("guests").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("tables").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("venue_objects").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("budget_categories").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("tasks").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("vendors").select("*, vendor_payments(*)").eq("wedding_id", weddingId).order("sort"),
      s.from("registry_items").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("invitation_config").select("*").eq("wedding_id", weddingId).maybeSingle(),
      s.from("website_config").select("*").eq("wedding_id", weddingId).maybeSingle(),
      s.from("custom_templates").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("rsvps").select("*").eq("wedding_id", weddingId).order("at", { ascending: false }),
      s.from("entitlements").select("*").eq("user_id", userId).maybeSingle(),
    ]);

  if (wedding.error) throw wedding.error;
  for (const r of [guests, tables, venueObjects, budget, tasks, vendors, registry, custom, rsvps, entitlement]) {
    if (r.error) throw r.error;
  }
  if (invitation.error || website.error) throw invitation.error ?? website.error;

  if (versions) {
    const v = (r: unknown) => (r as { updated_at?: string } | null)?.updated_at;
    const add = (key: EntityKey, rows: unknown[] | null) =>
      (rows ?? []).forEach((r) => { const ver = v(r); if (ver) versions.set(versionKey(key, (r as { id: string }).id), ver); });
    add("guests", guests.data); add("tables", tables.data); add("venueObjects", venueObjects.data);
    add("budget", budget.data); add("tasks", tasks.data); add("vendors", vendors.data);
    add("registry", registry.data); add("customTemplates", custom.data);
    for (const [key, row] of [["wedding", wedding.data], ["invitation", invitation.data], ["website", website.data]] as const) {
      const ver = v(row);
      if (ver) versions.set(versionKey(key, key), ver);
    }
  }

  const w = rowToWedding(wedding.data);
  const inv = invitation.data;
  const web = website.data;
  const colors = (inv?.colors ?? null) as InvitationConfig["colors"];
  const motion = (inv?.motion ?? null) as InvitationConfig["motion"] | null;
  const music = (inv?.music ?? null) as InvitationConfig["music"] | null;

  return {
    wedding: w,
    guests: (guests.data ?? []).map(rowToGuest),
    tables: (tables.data ?? []).map(rowToTable),
    venueObjects: (venueObjects.data ?? []).map(rowToVenueObject),
    budget: (budget.data ?? []).map(rowToBudget),
    tasks: (tasks.data ?? []).map(rowToTask),
    vendors: (vendors.data ?? []).map(rowToVendor as never) as Vendor[],
    registry: (registry.data ?? []).map((r) => ({
      id: r.id, name: r.name, store: r.store, price: Number(r.price), url: r.url, purchased: r.purchased,
    })),
    plan: wedding.data.plan as Plan,
    invitation: {
      templateId: inv?.template_id ?? "tp13",
      names: w.names,
      line1: inv?.line1 ?? "Together with their families",
      line2: inv?.line2 ?? "request the pleasure of your company",
      venueLine: inv?.venue_line ?? `${w.venue} · ${w.location}`,
      rsvp: inv?.collect_rsvp ?? true,
      meal: inv?.collect_meal ?? true,
      notes: inv?.collect_notes ?? true,
      photo: localPhoto(inv?.photo ?? null),
      colors,
      fontSerif: inv?.font_serif ?? null,
      motion: motion ?? { petals: "gentle", shimmer: true, type: true },
      // an uploaded song is a file in storage; music_url is its public address
      music: {
        track: music?.track ?? "serene",
        uploadName: music?.uploadName ?? null,
        uploadUrl: inv?.music_url ?? null,
      },
      // rows from before 0011 have no flag to read: they were live, as is any wedding without a row
      live: inv?.is_live ?? true,
    },
    website: {
      template: (web?.template ?? "serene") as WebsiteConfig["template"],
      sections: (web?.sections ?? {}) as WebsiteConfig["sections"],
      bg: web?.bg ?? "#FFF8F0",
      ink: web?.ink ?? "#332B31",
      accent: web?.accent ?? "#D4AF37",
      serif: web?.serif ?? true,
      heroPhoto: localPhoto(web?.hero_photo ?? ""),
      animations: web?.animations ?? true,
      domain: web?.domain ?? "",
      published: web?.published ?? false,
    },
    customTemplates: (custom.data ?? []).map((c) => ({
      id: c.id, name: c.name, dataUrl: c.data_url, html: c.html, addedAt: new Date(c.added_at).getTime(),
    })),
    rsvpLog: (rsvps.data ?? []).map(rowToRsvp),
  };
}

/** Creates the wedding, the owner membership and default configs. */
export async function createWedding(input: {
  partnerA: string; partnerB: string; names: string; date: string; venue: string;
  locale?: string; currency?: string;
}): Promise<{ weddingId: string; wedding: Wedding }> {
  const s = requireSb();
  const { data: userData } = await s.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  let weddingId: string | null = null;
  const slug = slugify(input.names) || "our-wedding";
  let weddingRow: WeddingRow | null = null;

  for (let attempt = 0; attempt < 4 && !weddingId; attempt++) {
    // A random ending: "maya-theo" alone could be guessed from first names.
    // Existing addresses are never changed — guests already have them.
    const candidate = `${slug}-${slugSuffix()}`;
    const res = await s.from("weddings").insert({
      owner_id: userId, slug: candidate, partner_a: input.partnerA, partner_b: input.partnerB,
      names: input.names, date: input.date, venue: input.venue, location: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      locale: input.locale || (typeof navigator !== "undefined" && navigator.language) || "en-US",
      currency: input.currency || "USD",
    }).select().single();
    if (res.error) {
      if (res.error.code === "23505") continue; // slug taken — try the next
      throw res.error;
    }
    weddingRow = res.data;
    weddingId = res.data.id;
  }
  if (!weddingId || !weddingRow) throw new Error("Could not reserve a wedding address — try different names");

  const member = await s.from("wedding_members").insert({ wedding_id: weddingId, user_id: userId, role: "owner" });
  if (member.error) throw member.error;

  const w = rowToWedding(weddingRow);
  await Promise.all([
    s.from("invitation_config").insert(invitationToRow({
      templateId: "tp13", names: w.names,
      line1: "Together with their families", line2: "request the pleasure of your company",
      venueLine: `${w.venue} · ${w.location}`.replace(/ · $/, ""), rsvp: true, meal: true, notes: true,
      photo: null, colors: null, fontSerif: null,
      motion: { petals: "gentle", shimmer: true, type: true },
      music: { track: "serene", uploadName: null, uploadUrl: null },
      live: false, // closed until the couple chooses to share it
    }, weddingId)),
    s.from("website_config").insert(websiteToRow({
      template: "serene",
      sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
      bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true, heroPhoto: "",
      animations: true, domain: "", published: false,
    }, weddingId)),
  ]);

  return { weddingId, wedding: w };
}

/* ------------------------------ write-behind ------------------------------ */

export type EntityKey =
  | "wedding" | "guests" | "tables" | "venueObjects" | "budget" | "tasks" | "vendors"
  | "registry" | "customTemplates" | "rsvpLog" | "invitation" | "website";

/**
 * Applies one entity's pending diff. Collection entities are upserted /
 * deleted by id; vendors go through save_vendor (one transaction with their
 * payment schedule); the two config tables upsert their single row keyed on
 * wedding_id. Rows carry the version they were edited from (updated_at);
 * the new versions come back keyed by id ("wedding", "invitation" and
 * "website" for the single rows). A row a partner changed or deleted since
 * throws ConflictError.
 */
export async function syncEntity(
  key: EntityKey,
  weddingId: string,
  upserts: unknown[],
  deletes: string[],
): Promise<Record<string, string>> {
  const s = requireSb();
  const fail = (e: { message: string; code?: string }) =>
    e.code === "P0409" ? new ConflictError(e.message) : Object.assign(new Error(e.message), { code: e.code });
  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const r = await p;
    if (r.error && r.error.code !== "PGRST116") throw fail(r.error);
  };
  const versions: Record<string, string> = {};
  /** upsert rows by `conflict`, reading back each row's new version */
  const upsertRows = async (table: string, rows: unknown[], conflict: "id" | "wedding_id", idOf: (r: Record<string, string>) => string) => {
    const { data, error } = await s.from(table as never).upsert(rows as never, { onConflict: conflict }).select(`${conflict}, updated_at`);
    if (error) throw fail(error);
    for (const r of (data ?? []) as Record<string, string>[]) versions[idOf(r)] = r.updated_at;
  };
  const collection = async (table: string) => {
    if (deletes.length) await run(s.from(table as never).delete().in("id", deletes));
    if (upserts.length) await upsertRows(table, upserts, "id", (r) => r.id);
  };

  switch (key) {
    case "wedding": {
      const w = upserts[0] as (Wedding & { updated_at?: string | null }) | undefined;
      if (w) {
        const { data, error } = await s.from("weddings")
          .update({ ...weddingToRow(w), updated_at: w.updated_at ?? null } as never).eq("id", weddingId).select("updated_at");
        if (error) throw fail(error);
        const ver = (data as { updated_at: string }[] | null)?.[0]?.updated_at;
        if (ver) versions.wedding = ver;
      }
      return versions;
    }
    case "guests": await collection("guests"); return versions;
    case "tables": await collection("tables"); return versions;
    case "venueObjects": await collection("venue_objects"); return versions;
    case "budget": await collection("budget_categories"); return versions;
    case "tasks": await collection("tasks"); return versions;
    case "vendors": {
      if (deletes.length) await run(s.from("vendors").delete().in("id", deletes));
      // one call per vendor: the vendor and its whole payment schedule are
      // saved in a single transaction (0015), so a failure can't leave the
      // vendor with its old payments deleted and the new ones missing
      for (const v of upserts as (Vendor & { updated_at?: string | null })[]) {
        const { data, error } = await s.rpc("save_vendor", {
          p_wedding: weddingId,
          p_vendor: {
            id: v.id, category: v.category, company: v.company, contact: v.contact, email: v.email,
            phone: v.phone, price: v.price, status: v.status, contract: v.contract, notes: v.notes,
            budget_id: v.budgetId, updated_at: v.updated_at ?? null,
          },
          p_payments: (v.payments ?? []).map((p) => ({ label: p.label, amount: p.amount, due: p.due, paid: p.paid })),
        });
        if (error) throw fail(error);
        if (typeof data === "string") versions[v.id] = data;
      }
      return versions;
    }
    case "registry": await collection("registry_items"); return versions;
    case "customTemplates": await collection("custom_templates"); return versions;
    case "rsvpLog":
      // guests' answers: not versioned (they're written by the RSVP function)
      if (deletes.length) await run(s.from("rsvps").delete().in("id", deletes));
      if (upserts.length) await run(s.from("rsvps").upsert(upserts as never, { onConflict: "id" }));
      return versions;
    case "invitation":
      if (upserts[0]) await upsertRows("invitation_config", [upserts[0]], "wedding_id", () => "invitation");
      return versions;
    case "website":
      if (upserts[0]) await upsertRows("website_config", [upserts[0]], "wedding_id", () => "website");
      return versions;
  }
  return versions;
}

/* ------------------------------ live updates ------------------------------ */

/** A change to one of the wedding's rows, as Realtime reports it (0019). */
export interface RemoteChange {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  id: string | null;
  updatedAt: string | null;
}

/** table → the column that ties its rows to a wedding */
const LIVE_TABLES: Record<string, string> = {
  weddings: "id", guests: "wedding_id", tables: "wedding_id", venue_objects: "wedding_id",
  budget_categories: "wedding_id", tasks: "wedding_id", vendors: "wedding_id",
  registry_items: "wedding_id", custom_templates: "wedding_id",
  invitation_config: "wedding_id", website_config: "wedding_id",
};

/**
 * Listens for changes to this wedding's planner rows. Inserts and updates
 * are filtered to the wedding (and RLS-checked by Realtime); deletes can't
 * be filtered, so every delete on these tables arrives with only its id and
 * the caller decides whether it's one of ours. Returns the unsubscribe.
 */
export function subscribeToWedding(weddingId: string, onChange: (c: RemoteChange) => void): () => void {
  const s = requireSb();
  const channel = s.channel(`wedding:${weddingId}`);
  const emit = (table: string) => (p: { eventType: RemoteChange["type"]; new: Record<string, unknown>; old: Record<string, unknown> }) => {
    const row = p.eventType === "DELETE" ? p.old : p.new;
    const key = LIVE_TABLES[table] === "id" ? "id" : table.endsWith("_config") ? "wedding_id" : "id";
    onChange({
      type: p.eventType,
      table,
      id: (row?.[key] as string | undefined) ?? null,
      updatedAt: (p.new?.updated_at as string | undefined) ?? null,
    });
  };
  for (const [table, col] of Object.entries(LIVE_TABLES)) {
    const filter = `${col}=eq.${weddingId}`;
    channel.on("postgres_changes" as never, { event: "INSERT", schema: "public", table, filter }, emit(table) as never);
    channel.on("postgres_changes" as never, { event: "UPDATE", schema: "public", table, filter }, emit(table) as never);
    channel.on("postgres_changes" as never, { event: "DELETE", schema: "public", table }, emit(table) as never);
  }
  channel.subscribe();
  return () => { void s.removeChannel(channel); };
}

/** Rows newer than `since` that the couple hasn't seen yet. */
export async function fetchFreshRsvps(weddingId: string, since: number): Promise<RsvpEntry[]> {
  const { data, error } = await requireSb()
    .from("rsvps").select("*")
    .eq("wedding_id", weddingId)
    .gt("at", new Date(since).toISOString())
    .order("at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToRsvp);
}

/* ------------------------------ anonymous surface ------------------------------ */

export interface PublicInvitation {
  slug: string;
  /** 0011: always true here; a closed invitation comes back as ClosedInvitation */
  live?: true;
  names: string;
  partnerA: string;
  partnerB: string;
  date: string;
  venue: string;
  location: string;
  timezone: string;
  locale: string;
  currency: string;
  plan: Plan;
  invitation: {
    template_id: string; line1: string; line2: string; venue_line: string;
    collect_rsvp: boolean; collect_meal: boolean; collect_notes: boolean;
    photo: string | null;
    colors: { bg: string; ink: string; accent: string } | null;
    font_serif: boolean | null;
    motion: { petals: "off" | "gentle" | "lush"; shimmer: boolean; type: boolean };
    /** url: the uploaded song's public address (0013), present only when one was uploaded */
    music: { track: "serene" | "golden" | "dance" | "upload"; uploadName?: string | null; url?: string | null };
  };
  website: {
    template: "serene" | "editorial" | "garden";
    sections: Record<string, boolean>;
    bg: string; ink: string; accent: string; serif: boolean;
    hero_photo: string; animations: boolean; published: boolean; domain: string;
  };
  custom: { id: string; name: string; dataUrl: string | null; html: string | null } | null;
  /** Absent until the site is published: get_public_wedding drops the key
   *  (and reduces `website` to { published: false }) for unpublished sites. */
  registry?: { name: string; store: string }[];
}

/** What get_public_wedding returns for an invitation the couple hasn't opened yet (0011). */
export interface ClosedInvitation { slug: string; live: false }

export async function getPublicInvitation(slug: string): Promise<PublicInvitation | ClosedInvitation | null> {
  const { data, error } = await requireSb().rpc("get_public_wedding", { p_slug: slug });
  if (error) throw error;
  return (data as PublicInvitation | ClosedInvitation | null) ?? null;
}

export async function getGuestByToken(token: string): Promise<{ id: string; name: string; slug: string } | null> {
  const { data, error } = await requireSb().rpc("get_guest_by_token", { p_token: token });
  if (error) throw error;
  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

/** four characters from a 32-letter alphabet without look-alikes (no i, l, o, u): about a million endings */
export function slugSuffix(random: () => number = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32): string {
  const alphabet = "abcdefghjkmnpqrstvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return out;
}

/**
 * Sends a guest's answer through api/rsvp.ts, which checks the Turnstile
 * token and a per-visitor limit before it reaches the database. The direct
 * anonymous RPC is being retired: one visitor could exhaust it for everyone.
 */
export async function submitRsvp(p: {
  token: string | null;
  slug: string;
  name: string;
  answer: "yes" | "no";
  meal?: string | null;
  note?: string | null;
  source?: string;
  plusOne?: string | null;
  plusOneMeal?: string | null;
  turnstile: string;
}): Promise<void> {
  const res = await fetch("/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: p.token, slug: p.slug, name: p.name, answer: p.answer,
      meal: p.meal ?? null, note: p.note ?? null, source: p.source ?? "link",
      plusOne: p.plusOne ?? null, plusOneMeal: p.plusOneMeal ?? null,
      turnstile: p.turnstile,
    }),
  });
  if (!res.ok) {
    let msg = "Your RSVP couldn't be sent. Please try again.";
    try { const j = (await res.json()) as { error?: string }; if (j.error) msg = j.error; } catch { /* keep the default */ }
    throw new Error(msg);
  }
}

/* ------------------------------ checkout & entitlements ------------------------------ */

/**
 * Deletes the signed-in account (api/delete-account.ts). `confirmEmail` is
 * what the person typed; the server compares it with their real address.
 */
export async function deleteAccount(confirmEmail: string): Promise<void> {
  const { data: session } = await requireSb().auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("You need to be signed in to delete your account.");
  const res = await fetch("/api/delete-account", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmEmail }),
  });
  if (!res.ok) {
    let msg = "Your account couldn't be deleted just now. Please try again.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
}

/**
 * Starts a one-time Stripe Checkout session for a tier.
 * The server verifies the caller's JWT, mints the session and returns only
 * `{ url }` — the client redirects and NEVER writes entitlements itself.
 */
export async function createCheckoutSession(tier: Plan, weddingId: string, currency: Currency): Promise<string> {
  const s = requireSb();
  const { data: session } = await s.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("You need to be signed in to purchase.");
  const res = await fetch("/api/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tier, wedding_id: weddingId, currency }),
  });
  if (!res.ok) {
    let msg = "Checkout could not be started.";
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  const j = (await res.json()) as { url?: string };
  if (!j.url) throw new Error("Checkout returned no redirect URL.");
  return j.url;
}

/**
 * Re-reads the server's view after a checkout.
 *  · plan      — the wedding's plan, the one the planner shows. Authoritative,
 *                and how a partner's purchase reaches the owner.
 *  · purchased — the caller's own entitlement row, or null. Only the webhook
 *                writes it, so it is the signal that THIS purchase arrived.
 */
export async function refreshEntitlement(
  weddingId: string,
): Promise<{ plan: Plan | null; purchased: Plan | null }> {
  const s = requireSb();
  const { data: session } = await s.auth.getSession();
  const uid = session.session?.user?.id;
  const [wedding, own] = await Promise.all([
    s.from("weddings").select("plan").eq("id", weddingId).maybeSingle(),
    uid
      ? s.from("entitlements").select("plan").eq("user_id", uid).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (wedding.error) throw wedding.error;
  if (own.error) throw own.error;
  return {
    plan: (wedding.data?.plan as Plan | undefined) ?? null,
    purchased: (own.data?.plan as Plan | undefined) ?? null,
  };
}

/* ------------------------------ uploaded music ------------------------------ */

/** What the media bucket accepts for songs (0008 sets the same list on the bucket). */
export const MUSIC_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
  "audio/aac": "aac", "audio/wav": "wav", "audio/ogg": "ogg",
};
/** under the bucket's 10 MB cap, and small enough to start playing quickly */
export const MUSIC_MAX_BYTES = 8 * 1024 * 1024;

/** Why a song can't be uploaded, or null when it can. */
export function musicFileProblem(file: { type: string; size: number }): string | null {
  if (!(file.type in MUSIC_TYPES)) return "That isn't a song we can play. MP3, M4A, AAC, WAV or OGG work.";
  if (file.size > MUSIC_MAX_BYTES) return "That song is over 8 MB. Try an MP3 of it.";
  return null;
}

/** media/<wedding>/music/<random>.<ext>: the only folder shape the storage policies (0008) allow. */
export const musicPath = (weddingId: string, type: string, id: string = crypto.randomUUID()) =>
  `${weddingId}/music/${id}.${MUSIC_TYPES[type] ?? "mp3"}`;

/** The storage path inside the media bucket for a public URL, if it is one of this wedding's songs. */
export function musicPathFromUrl(url: string | null | undefined, weddingId: string): string | null {
  const marker = "/storage/v1/object/public/media/";
  const i = url ? url.indexOf(marker) : -1;
  if (!url || i < 0) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return path.startsWith(`${weddingId}/music/`) ? path : null;
}

/** Upload a song for the guest page and return its public address. */
export async function uploadMusic(weddingId: string, file: File): Promise<string> {
  const problem = musicFileProblem(file);
  if (problem) throw new Error(problem);
  const s = requireSb();
  const path = musicPath(weddingId, file.type);
  const { error } = await s.storage.from("media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return s.storage.from("media").getPublicUrl(path).data.publicUrl;
}

/** Delete a song this wedding uploaded, so replaced and removed songs don't pile up. */
export async function deleteMusic(weddingId: string, url: string | null | undefined): Promise<void> {
  const path = musicPathFromUrl(url, weddingId);
  if (!path) return; // not one of ours: nothing to delete
  const { error } = await requireSb().storage.from("media").remove([path]);
  if (error) throw new Error(error.message);
}

/* ------------------------------ partner invites ------------------------------ */

export async function invitePartner(weddingId: string, email: string): Promise<void> {
  const { error } = await requireSb().rpc("invite_partner", { p_wedding: weddingId, p_email: email });
  if (error) throw new Error(error.message);
}

/** Claims invites addressed to the signed-in account's email. */
export async function acceptPendingInvites(): Promise<number> {
  const { data, error } = await requireSb().rpc("accept_pending_invite", {});
  if (error) throw error;
  return Number((data as { claimed?: number } | null)?.claimed ?? 0);
}

/* ------------------------------ auth ------------------------------ */

/**
 * Every call that can create an account or send an email carries the
 * Turnstile token. Supabase Auth checks it once its captcha setting is on
 * (Authentication → Attack Protection), and ignores it before that.
 */
export const authApi = {
  signUp: (email: string, password: string, captchaToken?: string) =>
    requireSb().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, captchaToken } }),
  signIn: (email: string, password: string, captchaToken?: string) =>
    requireSb().auth.signInWithPassword({ email, password, options: { captchaToken } }),
  magicLink: (email: string, captchaToken?: string) =>
    requireSb().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin, captchaToken } }),
  reset: (email: string, captchaToken?: string) =>
    requireSb().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin, captchaToken }),
  signOut: () => requireSb().auth.signOut(),
  onAuthChange: (cb: (userId: string | null, email: string | null) => void) =>
    requireSb().auth.onAuthStateChange((_e, session) =>
      cb(session?.user?.id ?? null, session?.user?.email ?? null)),
  session: async () => (await requireSb().auth.getSession()).data.session,
};
