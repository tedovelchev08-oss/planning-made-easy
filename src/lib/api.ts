/* ============================================================
 * Luma · data layer
 * Typed CRUD against Supabase + the anonymous RPC surface.
 * All functions assume a configured client (store gates on mode).
 * ============================================================ */

import { requireSb } from "./supabase";
import type { Database, GuestRow, WeddingRow } from "./db-types";
import {
  BudgetCategory, CustomTemplate, Guest, Plan, RegistryItem, RsvpEntry, SeatTable, Task, Vendor, Wedding, slugify, toDayKey,
} from "./data";
import type { Db, InvitationConfig, WebsiteConfig } from "./store";

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

export const rowToTable = (r: { id: string; name: string; shape: SeatTable["shape"]; capacity: number; x: number; y: number }): SeatTable => ({
  id: r.id, name: r.name, shape: r.shape, capacity: r.capacity, x: Number(r.x), y: Number(r.y),
});

export const tableToRow = (t: SeatTable, weddingId: string, sort: number) => ({
  id: t.id, wedding_id: weddingId, name: t.name, shape: t.shape, capacity: t.capacity, x: t.x, y: t.y, sort,
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
  motion: c.motion as never, music: { ...c.music, uploadData: null } as never,
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

/** Loads the couple's whole plan in one round of parallel selects. */
export async function fetchWorkspace(weddingId: string, userId: string): Promise<Db> {
  const s = requireSb();
  const [wedding, guests, tables, budget, tasks, vendors, registry, invitation, website, custom, rsvps, entitlement] =
    await Promise.all([
      s.from("weddings").select("*").eq("id", weddingId).single(),
      s.from("guests").select("*").eq("wedding_id", weddingId).order("sort"),
      s.from("tables").select("*").eq("wedding_id", weddingId).order("sort"),
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
  for (const r of [guests, tables, budget, tasks, vendors, registry, custom, rsvps, entitlement]) {
    if (r.error) throw r.error;
  }
  if (invitation.error || website.error) throw invitation.error ?? website.error;

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
    budget: (budget.data ?? []).map(rowToBudget),
    tasks: (tasks.data ?? []).map(rowToTask),
    vendors: (vendors.data ?? []).map(rowToVendor as never) as Vendor[],
    registry: (registry.data ?? []).map((r) => ({
      id: r.id, name: r.name, store: r.store, price: Number(r.price), url: r.url, purchased: r.purchased,
    })),
    plan: (entitlement.data?.plan ?? wedding.data.plan ?? "essential") as Plan,
    invitation: {
      templateId: inv?.template_id ?? "tp13",
      names: w.names,
      line1: inv?.line1 ?? "Together with their families",
      line2: inv?.line2 ?? "request the pleasure of your company",
      venueLine: inv?.venue_line ?? `${w.venue} · ${w.location}`,
      rsvp: inv?.collect_rsvp ?? true,
      meal: inv?.collect_meal ?? true,
      notes: inv?.collect_notes ?? true,
      photo: inv?.photo ?? null,
      colors,
      fontSerif: inv?.font_serif ?? null,
      motion: motion ?? { petals: "gentle", shimmer: true, type: true },
      // uploaded song data is never fetched into the workspace (kept server-side
      // for the guest page); the couple re-uploads to change it.
      music: music ? { ...music, uploadData: null } : { track: "serene", uploadName: null, uploadData: null },
    },
    website: {
      template: (web?.template ?? "serene") as WebsiteConfig["template"],
      sections: (web?.sections ?? {}) as WebsiteConfig["sections"],
      bg: web?.bg ?? "#FFF8F0",
      ink: web?.ink ?? "#332B31",
      accent: web?.accent ?? "#D4AF37",
      serif: web?.serif ?? true,
      heroPhoto: web?.hero_photo ?? "",
      animations: web?.animations ?? true,
      domain: web?.domain || `${w.slug}.luma.love`,
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
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const res = await s.from("weddings").insert({
      owner_id: userId, slug: candidate, partner_a: input.partnerA, partner_b: input.partnerB,
      names: input.names, date: input.date, venue: input.venue, location: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      locale: input.locale || (typeof navigator !== "undefined" && navigator.language) || "en-US",
      currency: input.currency || "USD", plan: "essential",
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
      music: { track: "serene", uploadName: null, uploadData: null },
    }, weddingId)),
    s.from("website_config").insert(websiteToRow({
      template: "serene",
      sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
      bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true, heroPhoto: "",
      animations: true, domain: `${w.slug}.luma.love`, published: false,
    }, weddingId)),
  ]);

  return { weddingId, wedding: w };
}

/* ------------------------------ write-behind ------------------------------ */

export type EntityKey =
  | "wedding" | "guests" | "tables" | "budget" | "tasks" | "vendors"
  | "registry" | "customTemplates" | "rsvpLog" | "invitation" | "website";

/**
 * Applies one entity's pending diff. Collection entities are upserted /
 * deleted by id; vendors also replace their payment schedule; the two config
 * tables upsert their single row keyed on wedding_id.
 */
export async function syncEntity(
  key: EntityKey,
  weddingId: string,
  upserts: unknown[],
  deletes: string[],
): Promise<void> {
  const s = requireSb();
  const run = async (p: PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    const r = await p;
    if (r.error && r.error.code !== "PGRST116") throw new Error(r.error.message);
  };

  switch (key) {
    case "wedding":
      if (upserts[0]) await run(s.from("weddings").update(weddingToRow(upserts[0] as Wedding)).eq("id", weddingId));
      return;
    case "guests":
      if (deletes.length) await run(s.from("guests").delete().in("id", deletes));
      if (upserts.length) await run(s.from("guests").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "tables":
      if (deletes.length) await run(s.from("tables").delete().in("id", deletes));
      if (upserts.length) await run(s.from("tables").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "budget":
      if (deletes.length) await run(s.from("budget_categories").delete().in("id", deletes));
      if (upserts.length) await run(s.from("budget_categories").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "tasks":
      if (deletes.length) await run(s.from("tasks").delete().in("id", deletes));
      if (upserts.length) await run(s.from("tasks").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "vendors": {
      if (deletes.length) await run(s.from("vendors").delete().in("id", deletes));
      for (const v of upserts as Vendor[]) {
        const { payments, ...row } = v as Vendor & { payments?: Vendor["payments"] };
        await run(s.from("vendors").upsert({
          id: v.id, wedding_id: weddingId, category: v.category, company: v.company,
          contact: v.contact, email: v.email, phone: v.phone, price: v.price,
          status: v.status, contract: v.contract, notes: v.notes, budget_id: v.budgetId, sort: 0,
        } as never, { onConflict: "id" }));
        void row;
        // replace the schedule wholesale — payment rows carry no client ids
        await run(s.from("vendor_payments").delete().eq("vendor_id", v.id));
        if (payments?.length) {
          await run(s.from("vendor_payments").insert(
            payments.map((p, i) => ({ id: newId(), vendor_id: v.id, label: p.label, amount: p.amount, due: p.due, paid: p.paid, sort: i })),
          ));
        }
      }
      return;
    }
    case "registry":
      if (deletes.length) await run(s.from("registry_items").delete().in("id", deletes));
      if (upserts.length) await run(s.from("registry_items").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "customTemplates":
      if (deletes.length) await run(s.from("custom_templates").delete().in("id", deletes));
      if (upserts.length) await run(s.from("custom_templates").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "rsvpLog":
      if (deletes.length) await run(s.from("rsvps").delete().in("id", deletes));
      if (upserts.length) await run(s.from("rsvps").upsert(upserts as never, { onConflict: "id" }));
      return;
    case "invitation":
      if (upserts[0]) await run(s.from("invitation_config").upsert(upserts[0] as never, { onConflict: "wedding_id" }));
      return;
    case "website":
      if (upserts[0]) await run(s.from("website_config").upsert(upserts[0] as never, { onConflict: "wedding_id" }));
      return;
  }
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
    music: { track: "serene" | "golden" | "dance" | "upload"; uploadName: string | null; uploadData: string | null };
  };
  website: {
    template: "serene" | "editorial" | "garden";
    sections: Record<string, boolean>;
    bg: string; ink: string; accent: string; serif: boolean;
    hero_photo: string; animations: boolean; published: boolean; domain: string;
  };
  custom: { id: string; name: string; dataUrl: string | null; html: string | null } | null;
  registry: { name: string; store: string }[];
}

export async function getPublicInvitation(slug: string): Promise<PublicInvitation | null> {
  const { data, error } = await requireSb().rpc("get_public_wedding", { p_slug: slug });
  if (error) throw error;
  return (data as PublicInvitation | null) ?? null;
}

export async function getGuestByToken(token: string): Promise<{ id: string; name: string; slug: string } | null> {
  const { data, error } = await requireSb().rpc("get_guest_by_token", { p_token: token });
  if (error) throw error;
  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

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
}): Promise<void> {
  const { error } = await requireSb().rpc("submit_rsvp", {
    p_token: p.token,
    p_slug: p.slug,
    p_name: p.name,
    p_answer: p.answer,
    p_meal: p.meal ?? null,
    p_note: p.note ?? null,
    p_source: p.source ?? "link",
    p_plus_one: p.plusOne ?? null,
    p_plus_one_meal: p.plusOneMeal ?? null,
  });
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

export const authApi = {
  signUp: (email: string, password: string) =>
    requireSb().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }),
  signIn: (email: string, password: string) =>
    requireSb().auth.signInWithPassword({ email, password }),
  magicLink: (email: string) =>
    requireSb().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }),
  reset: (email: string) =>
    requireSb().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }),
  signOut: () => requireSb().auth.signOut(),
  onAuthChange: (cb: (userId: string | null, email: string | null) => void) =>
    requireSb().auth.onAuthStateChange((_e, session) =>
      cb(session?.user?.id ?? null, session?.user?.email ?? null)),
  session: async () => (await requireSb().auth.getSession()).data.session,
};
