import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { DesignData } from "../../api/_lib/studioDesigns";
import {
  BudgetCategory, CustomTemplate, Guest, Plan, RegistryItem, RsvpEntry, SeatTable, Task, Vendor, Wedding,
  catCommitted, catPaid, configureFormat,
  seedBudget, seedGuests, seedRegistry, seedRsvpLog, seedTables, seedTasks, seedVendors, seedWedding,
  FloorObject, seedVenueObjects,
} from "./data";
import { isSupabaseConfigured } from "./supabase";
import { guestLimit, type Feature } from "./plans";
import { IMAGES, localPhoto } from "./images";
import {
  type Queue, bucketOf, clearQueue, countQueue, emptyQueue, loadQueue, mergeUnder, persistQueue, retryDelay, sendQueue,
} from "./syncQueue";
import {
  EntityKey, acceptPendingInvites, authApi, budgetToRow, createWedding, customTplToRow, fetchFreshRsvps,
  fetchWorkspace, guestToRow, invitationToRow, invitePartner as apiInvitePartner, isUuid, myWeddingId, newId,
  refreshEntitlement as apiRefreshEntitlement, registryToRow, rsvpToRow, syncEntity, tableToRow, taskToRow, venueObjectToRow, websiteToRow,
  versionKey, subscribeToWedding, type RemoteChange, type Versions,
} from "./api";

/* ------------------------------------------------------------------ */

export interface InvitationConfig {
  templateId: string;
  names: string;
  line1: string;
  line2: string;
  venueLine: string;
  rsvp: boolean;
  meal: boolean;
  notes: boolean;
  photo: string | null;
  colors: { bg: string; ink: string; accent: string } | null;
  fontSerif: boolean | null;
  motion: { petals: "off" | "gentle" | "lush"; shimmer: boolean; type: boolean };
  /** uploadUrl: the song's public address in storage (media/<wedding>/music/…), saved as invitation_config.music_url */
  music: { track: "serene" | "golden" | "dance" | "upload"; uploadName: string | null; uploadUrl: string | null };
  /** open to guests. New invitations start closed: guests see "not open yet" until the couple shares it */
  live: boolean;
  /** what the owner's own designs show (dress code, schedule, FAQ...): invitation_config.design_data (0020) */
  designData?: DesignData;
}

export interface WebsiteConfig {
  template: "serene" | "editorial" | "garden";
  sections: Record<string, boolean>;
  bg: string;
  ink: string;
  accent: string;
  serif: boolean;
  heroPhoto: string;
  animations: boolean;
  domain: string;
  published: boolean;
}

export interface Db {
  wedding: Wedding;
  guests: Guest[];
  budget: BudgetCategory[];
  tasks: Task[];
  vendors: Vendor[];
  tables: SeatTable[];
  venueObjects: FloorObject[];
  registry: RegistryItem[];
  plan: Plan;
  invitation: InvitationConfig;
  website: WebsiteConfig;
  customTemplates: CustomTemplate[];
  rsvpLog: RsvpEntry[];
}

export interface Toast {
  id: number;
  title: string;
  desc?: string;
  tone: "success" | "info" | "warn";
}

export interface User { name: string; email: string }

export type SyncStatus = "demo" | "booting" | "saved" | "saving" | "offline" | "error";
export interface SyncState {
  status: SyncStatus;
  lastSaved: number | null;
  pending: number;
  /** false when unsaved edits exist only in memory (storage full or blocked) */
  durable?: boolean;
  /** a change the server keeps rejecting — shown until it saves or is undone */
  problem?: string | null;
}

export type Mode = "demo" | "cloud";

interface AppCtx {
  db: Db;
  setDb: React.Dispatch<React.SetStateAction<Db>>;
  patch: (p: Partial<Db>) => void;
  toast: (title: string, desc?: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  user: User | null;
  signOut: () => void;
  /** goes to the sign-in page, or to "begin your plan" */
  openAuth: (view?: "sign-in" | "begin") => void;
  /** the paid feature the upgrade prompt is explaining, or null when closed */
  upgrade: Feature | null;
  openUpgrade: (f: Feature) => void;
  closeUpgrade: () => void;
  /** opens "begin your plan" with this email already filled in */
  startSignup: (email: string) => void;
  /** consumed by the begin page when it opens; kept out of the URL */
  signupEmail: string | null;
  checkout: Plan | null;
  openCheckout: (p: Plan) => void;
  closeCheckout: () => void;
  mode: Mode;
  sync: SyncState;
  weddingId: string | null;
  booting: boolean;
  needsOnboarding: boolean;
  completeOnboarding: (input: { partnerA: string; partnerB: string; names: string; date: string; venue: string; locale?: string; currency?: string }) => Promise<void>;
  invitePartner: (email: string) => Promise<void>;
  /** Re-reads the server entitlement and applies it. The client never writes plans. */
  refreshEntitlement: () => Promise<Plan | null>;
  /** Try to send every queued edit now. Resolves to how many are still unsaved. */
  saveNow: () => Promise<number>;
}

/* ------------------------------ seeds & factories ------------------------------ */

/** The fully-populated workspace. Demo mode ONLY — real accounts start empty. */
const seedDb: Db = {
  wedding: seedWedding,
  guests: seedGuests,
  budget: seedBudget,
  tasks: seedTasks,
  vendors: seedVendors,
  tables: seedTables,
  venueObjects: seedVenueObjects,
  registry: seedRegistry,
  plan: "celebration",
  invitation: {
    templateId: "tp13",
    names: "Maya & Theo",
    line1: "Together with their families",
    line2: "request the pleasure of your company",
    venueLine: "The Glasshouse · Hudson Yards, New York",
    rsvp: true,
    meal: true,
    notes: true,
    photo: null,
    colors: null,
    fontSerif: null,
    motion: { petals: "gentle", shimmer: true, type: true },
    music: { track: "serene", uploadName: null, uploadUrl: null },
    live: true,
  },
  website: {
    template: "serene",
    sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
    bg: "#f7f2e8",
    ink: "#0f0e0d",
    accent: "#c9a86a",
    serif: true,
    heroPhoto: IMAGES.couple,
    animations: true,
    domain: "",
    published: true,
  },
  customTemplates: [],
  rsvpLog: seedRsvpLog,
};

const defaultInvitation = (names: string, venue: string): InvitationConfig => ({
  templateId: "tp13", names,
  line1: "Together with their families", line2: "request the pleasure of your company",
  venueLine: venue, rsvp: true, meal: true, notes: true,
  photo: null, colors: null, fontSerif: null,
  motion: { petals: "gentle", shimmer: true, type: true },
  music: { track: "serene", uploadName: null, uploadUrl: null },
  live: false,
});

const defaultWebsite = (): WebsiteConfig => ({
  template: "serene",
  sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
  bg: "#f7f2e8", ink: "#0f0e0d", accent: "#c9a86a", serif: true, heroPhoto: "",
  animations: true, domain: "", published: false,
});

export const emptyDb = (wedding: Wedding): Db => ({
  wedding,
  guests: [], budget: [], tasks: [], vendors: [], tables: [], venueObjects: [], registry: [],
  plan: "essential",
  invitation: defaultInvitation(wedding.names, [wedding.venue, wedding.location].filter(Boolean).join(" · ")),
  website: defaultWebsite(),
  customTemplates: [],
  rsvpLog: [],
});

const placeholderDb = (): Db =>
  emptyDb({
    names: "", partnerA: "", partnerB: "",
    date: new Date(Date.now() + 365 * 864e5).toISOString(),
    venue: "", location: "", timezone: "UTC",
    locale: typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US",
    currency: "USD", slug: "",
  });

/* ------------------------------ boot mode ------------------------------ */

/**
 * demo  → the seeded workspace, purely in-memory (?demo=1, the /demo route,
 *         or simply no Supabase env configured)
 * cloud → Supabase is the source of truth; localStorage is an offline cache
 */
function bootMode(): Mode {
  if (typeof window !== "undefined") {
    if (window.location.search.includes("demo=1")) return "demo";
    if (window.location.hash.startsWith("#/demo")) return "demo";
  }
  return isSupabaseConfigured ? "cloud" : "demo";
}

/** Realtime table → the entity the store tracks versions under */
const LIVE_ENTITY: Record<string, EntityKey> = {
  weddings: "wedding", guests: "guests", tables: "tables", venue_objects: "venueObjects",
  budget_categories: "budget", tasks: "tasks", vendors: "vendors", registry_items: "registry",
  custom_templates: "customTemplates", invitation_config: "invitation", website_config: "website",
};

/** whether this planner holds that row (for deletes, which arrive for every wedding) */
function hasRow(db: Db, entity: EntityKey, id: string): boolean {
  const rows: Record<string, { id: string }[] | undefined> = {
    guests: db.guests, tables: db.tables, venueObjects: db.venueObjects, budget: db.budget, tasks: db.tasks,
    vendors: db.vendors, registry: db.registry, customTemplates: db.customTemplates,
  };
  return entity in rows ? (rows[entity] ?? []).some((r) => r.id === id) : true;
}

const cacheKey = (uid: string) => `luma.cache.${uid}`;

function readCache(uid: string): Db | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Db;
    if (!parsed || !parsed.wedding || !Array.isArray(parsed.guests)) return null;
    // A cache written before a collection existed comes back without it.
    // Backfill rather than reject, so a returning couple keeps their offline
    // copy instead of it being silently dropped.
    return {
      ...parsed,
      venueObjects: parsed.venueObjects ?? [],
      // photos chosen before they were self-hosted still hold the old address
      invitation: { ...parsed.invitation, photo: localPhoto(parsed.invitation?.photo ?? null) },
      website: { ...parsed.website, heroPhoto: localPhoto(parsed.website?.heroPhoto ?? "") },
    };
  } catch { return null; }
}

function writeCache(uid: string, db: Db) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(db)); } catch { /* full — Supabase still has it */ }
}

function clearCache(uid: string) {
  try { localStorage.removeItem(cacheKey(uid)); } catch { /* nothing to clear */ }
}

/* ------------------------------ context ------------------------------ */

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mode = useMemo(bootMode, []);

  const [db, setDbState] = useState<Db>(() => (mode === "demo" ? seedDb : placeholderDb()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [user, setUser] = useState<User | null>(() =>
    mode === "demo" ? { name: "Maya & Theo", email: "demo@example.com" } : null);
  const [upgrade, setUpgrade] = useState<Feature | null>(null);
  const openUpgrade = useCallback((f: Feature) => setUpgrade(f), []);
  const closeUpgrade = useCallback(() => setUpgrade(null), []);
  const [signupEmail, setSignupEmail] = useState<string | null>(null);
  const openAuth = useCallback((view: "sign-in" | "begin" = "sign-in") => {
    window.location.hash = view === "begin" ? "/begin" : "/sign-in";
  }, []);
  const startSignup = useCallback((email: string) => { setSignupEmail(email); openAuth("begin"); }, [openAuth]);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: mode === "demo" ? "demo" : "booting", lastSaved: null, pending: 0 });
  const [booting, setBooting] = useState(mode === "cloud");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [weddingId, setWeddingId] = useState<string | null>(null);

  const pendingRef = useRef<Queue>(emptyQueue());
  /** the batch currently on the wire — still unsaved, so still persisted */
  const inflightRef = useRef<Queue | null>(null);
  const flushTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const flushAgain = useRef(false);
  /** consecutive server rejections per row, to tell a bad row from a blip */
  const rejections = useRef<Map<string, number>>(new Map());
  /** the version of every row this tab last loaded or saved (0018) */
  const versionsRef = useRef<Versions>(new Map());
  /** set below, once refreshFromServer exists: reload after a conflict */
  const conflictReload = useRef<() => void>(() => {});
  /** bumped on every local edit, so a background refresh never clobbers one */
  const editSeq = useRef(0);
  /** whose queue this is: the signed-in account, set when their workspace boots */
  const ownerRef = useRef<{ uid: string; email: string } | null>(null);
  const lastRsvpPull = useRef<number>(Date.now());
  /** whose workspace is loaded (or loading): booting again for the same person only paints stale data */
  const bootedUid = useRef<string | null>(null);
  const dbRef = useRef(db); dbRef.current = db;
  const weddingIdRef = useRef(weddingId); weddingIdRef.current = weddingId;
  const userRef = useRef(user); userRef.current = user;
  const modeRef = useRef(mode); modeRef.current = mode;

  /* ------------------------------ toasts ------------------------------ */

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((title: string, desc?: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, title, desc, tone }]);
    window.setTimeout(() => dismissToast(id), 4600);
  }, [dismissToast]);

  /* ------------------------------ write-behind sync ------------------------------ */

  // these read refs only, so they are stable for the provider's lifetime
  const getBucket = useCallback((key: EntityKey) => bucketOf(pendingRef.current, key), []);

  /** everything not yet saved: queued edits plus the batch in flight */
  const unsaved = useCallback((): Queue => {
    const all = emptyQueue();
    mergeUnder(all, pendingRef.current);
    if (inflightRef.current) mergeUnder(all, inflightRef.current);
    return all;
  }, []);
  const countPending = useCallback(() => countQueue(unsaved()), [unsaved]);

  /** write the unsaved queue (and the workspace it produced) to this device */
  const persist = useCallback((snapshot: Db = dbRef.current): boolean => {
    const owner = ownerRef.current;
    const wid = weddingIdRef.current;
    if (!owner || !wid) return false;
    return persistQueue(owner.email, wid, unsaved(), snapshot);
  }, [unsaved]);

  const flush = useCallback(async (): Promise<void> => {
    const wid = weddingIdRef.current;
    if (modeRef.current !== "cloud" || !wid) return;
    if (inflightRef.current) { flushAgain.current = true; return; }
    if (retryTimer.current) { window.clearTimeout(retryTimer.current); retryTimer.current = null; }
    if (pendingRef.current.size === 0) return;

    const batch = pendingRef.current;
    pendingRef.current = emptyQueue();
    inflightRef.current = batch;
    setSync((s) => ({ ...s, status: "saving", pending: countPending() }));

    const online = navigator.onLine;
    const result = await sendQueue(
      batch, (key, upserts, deletes) => syncEntity(key, wid, upserts, deletes), online,
    );
    inflightRef.current = null;
    const { failed } = result;
    // what we just saved has new versions; an edit made to the same row
    // while this batch was on the wire was based on the version we replaced
    for (const [k, v] of result.versions) versionsRef.current.set(k, v);
    for (const [key, b] of pendingRef.current) {
      for (const [id, row] of b.upserts) {
        const v = result.versions.get(versionKey(key, id));
        if (v && row && typeof row === "object") b.upserts.set(id, { ...(row as object), updated_at: v });
      }
    }
    // a partner changed or deleted these since we loaded them: retrying
    // can't succeed, so they were not requeued; reload and say so
    const conflicts = result.failures.filter((f) => f.conflict);
    const failures = result.failures.filter((f) => !f.conflict);
    mergeUnder(pendingRef.current, failed);

    // A row the server rejects three times running while we are online is
    // not a network blip: name it, rather than retrying behind a vague chip.
    for (const [key, b] of batch) {
      for (const id of [...b.upserts.keys(), ...b.deletes]) {
        const k = `${key}:${id}`;
        if (!failures.some((f) => f.key === key && (f.id === id || f.id === "*"))) rejections.current.delete(k);
      }
    }
    let problem: string | null = null;
    if (online) {
      for (const f of failures) {
        const k = `${f.key}:${f.id}`;
        const n = (rejections.current.get(k) ?? 0) + 1;
        rejections.current.set(k, n);
        if (n >= 3 && !problem) problem = `A change to ${f.key} keeps being refused: ${f.message}`;
      }
    }

    const durable = persist();
    if (failures.length === 0) {
      retryAttempt.current = 0;
      const left = countPending();
      setSync({ status: left ? "saving" : "saved", lastSaved: Date.now(), pending: left, durable, problem: null });
      if (!left) {
        const email = ownerRef.current?.email;
        if (email) writeCache(email, dbRef.current);
      }
    } else {
      setSync((s) => ({ ...s, status: online ? "error" : "offline", pending: countPending(), durable, problem }));
      // keep trying on our own: 2s, 5s, 15s, then every 30s
      const delay = retryDelay(retryAttempt.current++);
      retryTimer.current = window.setTimeout(() => { retryTimer.current = null; void flush(); }, delay);
    }

    if (conflicts.length) {
      toast("Your partner changed this", "We've loaded their latest version. Your last edit to it wasn't saved.", "info");
      window.setTimeout(() => conflictReload.current(), 0);
    }

    if (flushAgain.current) { flushAgain.current = false; if (pendingRef.current.size) void flush(); }
  }, [countPending, persist, toast]);

  const scheduleFlush = useCallback(() => {
    setSync((s) => ({ ...s, status: "saving", pending: countPending() }));
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => void flush(), 700);
  }, [flush, countPending]);

  /**
   * Diff prev→next per entity and queue write-behind ops. Ids are normalised
   * to UUIDs so server-side uuid columns stay happy; new guest rows also get
   * an RSVP token minted client-side.
   */
  const scheduleDiff = useCallback((prev: Db, next: Db) => {
    const wid = weddingIdRef.current;
    if (!wid) return;
    const seen = (key: EntityKey, id: string) => versionsRef.current.get(versionKey(key, id)) ?? null;

    const diffRows = <T extends { id: string }>(
      key: EntityKey,
      prevRows: T[],
      nextRows: T[],
      toRow: (r: T, wid: string, sort: number) => unknown,
    ) => {
      const before = new Map(prevRows.map((r) => [r.id, JSON.stringify(r)]));
      const after = new Set(nextRows.map((r) => r.id));
      const bucket = getBucket(key);
      nextRows.forEach((r, i) => {
        if (before.get(r.id) === JSON.stringify(r)) return;
        const row = toRow(r, wid, i);
        // the version this edit was made from, so a stale copy is refused (0018)
        bucket.upserts.set(r.id, key === "rsvpLog" ? row : { ...(row as object), updated_at: seen(key, r.id) });
      });
      prevRows.forEach((r) => { if (!after.has(r.id)) bucket.deletes.add(r.id); });
    };

    diffRows("guests", prev.guests, next.guests, guestToRow);
    diffRows("tables", prev.tables, next.tables, tableToRow);
    diffRows("venueObjects", prev.venueObjects ?? [], next.venueObjects ?? [], venueObjectToRow);
    diffRows("budget", prev.budget, next.budget, budgetToRow);
    diffRows("tasks", prev.tasks, next.tasks, taskToRow);
    diffRows("vendors", prev.vendors, next.vendors, (v) => v);
    diffRows("registry", prev.registry, next.registry, registryToRow);
    diffRows("customTemplates", prev.customTemplates, next.customTemplates, customTplToRow);
    diffRows("rsvpLog", prev.rsvpLog, next.rsvpLog, rsvpToRow);

    if (JSON.stringify(prev.wedding) !== JSON.stringify(next.wedding)) {
      getBucket("wedding").upserts.set("wedding", { ...next.wedding, updated_at: seen("wedding", "wedding") });
    }
    if (JSON.stringify({ ...prev.invitation, music: null }) !== JSON.stringify({ ...next.invitation, music: null }) ||
        prev.invitation.music.track !== next.invitation.music.track ||
        prev.invitation.music.uploadName !== next.invitation.music.uploadName ||
        prev.invitation.music.uploadUrl !== next.invitation.music.uploadUrl) {
      getBucket("invitation").upserts.set("invitation", { ...invitationToRow(next.invitation, wid), updated_at: seen("invitation", "invitation") });
    }
    if (JSON.stringify(prev.website) !== JSON.stringify(next.website)) {
      getBucket("website").upserts.set("website", { ...websiteToRow(next.website, wid), updated_at: seen("website", "website") });
    }

    // durable before the debounce: a refresh inside those 700 ms used to drop it
    editSeq.current++;
    const durable = persist(next);
    setSync((s) => (s.durable === durable ? s : { ...s, durable }));
    scheduleFlush();
  }, [scheduleFlush, getBucket, persist]);

  /** ensures every locally-created row carries a server-legal id (+ guest token) */
  const normalize = useCallback((d: Db): Db => {
    const fix = (id: string) => (isUuid(id) ? id : newId());
    let changed = false;
    const guests = d.guests.map((g) => {
      const id = fix(g.id);
      const token = g.token && isUuid(g.token) ? g.token : newId();
      if (id !== g.id || token !== g.token) { changed = true; return { ...g, id, token }; }
      return g;
    });
    const mapIds = <T extends { id: string }>(rows: T[]) =>
      rows.map((r) => (isUuid(r.id) ? r : ((changed = true), { ...r, id: fix(r.id) })));
    return changed || guests !== d.guests
      ? {
          ...d, guests,
          tables: mapIds(d.tables), budget: mapIds(d.budget), tasks: mapIds(d.tasks),
          vendors: mapIds(d.vendors), registry: mapIds(d.registry), customTemplates: mapIds(d.customTemplates),
        }
      : d;
  }, []);

  const setDb = useCallback<React.Dispatch<React.SetStateAction<Db>>>((action) => {
    setDbState((prev) => {
      const raw = typeof action === "function" ? (action as (d: Db) => Db)(prev) : action;
      // The free plan's guest limit, enforced here so that every way of adding
      // a guest — the form, plus-ones, CSV import, accepting an RSVP — hits it.
      // Only growth past the limit is refused: guests already on the list are
      // never hidden or removed, and edits to them still save.
      if (raw.guests.length > prev.guests.length && raw.guests.length > guestLimit(prev.plan)) {
        queueMicrotask(() => setUpgrade("unlimitedGuests"));
        return prev;
      }
      if (modeRef.current === "cloud") {
        const next = normalize(raw);
        scheduleDiff(prev, next);
        return next;
      }
      return raw;
    });
  }, [normalize, scheduleDiff]);

  const patch = useCallback((p: Partial<Db>) => setDb((d) => ({ ...d, ...p })), [setDb]);

  /* ------------------------------ cloud boot ------------------------------ */

  const bootFor = useCallback(async (uid: string, email: string | null) => {
    bootedUid.current = uid;
    setBooting(true);
    try {
      await acceptPendingInvites().catch(() => {});
      const wid = await myWeddingId();
      if (!wid) {
        setWeddingId(null);
        setNeedsOnboarding(true);
        setDbState(placeholderDb());
        setSync({ status: "saved", lastSaved: null, pending: 0 });
        return;
      }
      setWeddingId(wid);
      weddingIdRef.current = wid;
      if (email) ownerRef.current = { uid, email };
      const cache = email ? readCache(email) : null;
      if (cache && cache.wedding.slug) setDbState(cache);

      // Edits left unsaved last time (tab closed offline, refresh inside the
      // debounce): show them, and send them BEFORE loading server data, or
      // the fresh fetch would paint over them.
      const saved = email ? loadQueue<Db>(email, wid) : null;
      if (saved) {
        pendingRef.current = saved.queue;
        if (saved.snapshot) setDbState(saved.snapshot);
        await flush();
        if (countPending() > 0) return; // still unsaved: keep the local copy, retries continue
      }
      const versions: Versions = new Map();
      const fresh = await fetchWorkspace(wid, uid, versions);
      versionsRef.current = versions;
      setDbState(fresh);
      if (email) writeCache(email, fresh);
      lastRsvpPull.current = Date.now();
      setSync({ status: "saved", lastSaved: Date.now(), pending: 0 });
    } catch {
      setSync({ status: navigator.onLine ? "error" : "offline", lastSaved: null, pending: 0 });
    } finally {
      setBooting(false);
    }
  }, [flush, countPending]);

  useEffect(() => {
    if (mode !== "cloud") return;
    let subscription: { unsubscribe: () => void } | null = null;
    (async () => {
      try {
        const session = await authApi.session();
        if (session?.user) {
          setUser({ name: session.user.email?.split("@")[0] ?? "You", email: session.user.email ?? "" });
          await bootFor(session.user.id, session.user.email ?? null);
        } else {
          setBooting(false);
          setSync({ status: "saved", lastSaved: null, pending: 0 });
        }
        subscription = authApi.onAuthChange((id, email, event) => {
          // a reset link signed them in: the next step is choosing the new password
          if (event === "PASSWORD_RECOVERY") window.location.hash = "/new-password";
          if (id) {
            setUser({ name: email?.split("@")[0] ?? "You", email: email ?? "" });
            // Supabase reports SIGNED_IN / TOKEN_REFRESHED for the same person
            // whenever the tab comes back into view. Booting again repainted the
            // offline copy and then a fetch that could predate an edit just
            // saved, so the screen showed old data. Only a different person
            // (or a first sign-in) loads a workspace; changes made elsewhere
            // arrive through Realtime and the RSVP poll.
            if (id !== bootedUid.current) void bootFor(id, email);
          } else {
            bootedUid.current = null;
            setUser(null);
            setWeddingId(null);
            setNeedsOnboarding(false);
            setDbState(placeholderDb());
            setSync({ status: "saved", lastSaved: null, pending: 0 });
          }
        }).data.subscription;
      } catch {
        setBooting(false);
        setSync({ status: "error", lastSaved: null, pending: 0 });
      }
    })();
    return () => subscription?.unsubscribe();
  }, [mode, bootFor]);

  /* pull RSVPs guests submitted while the planner was open / asleep */
  const pullFreshRsvps = useCallback(async () => {
    const wid = weddingIdRef.current;
    if (modeRef.current !== "cloud" || !wid) return;
    try {
      const fresh = await fetchFreshRsvps(wid, lastRsvpPull.current);
      lastRsvpPull.current = Date.now();
      if (fresh.length === 0) return;
      setDbState((d) => {
        const known = new Set(d.rsvpLog.map((e) => e.id));
        const add = fresh.filter((e) => !known.has(e.id));
        return add.length ? { ...d, rsvpLog: [...add, ...d.rsvpLog] } : d;
      });
      const newest = fresh[0];
      if (newest) toast("New RSVP received", `${newest.name} — ${newest.answer === "yes" ? "they're in!" : "they can't make it."}`);
    } catch { /* transient — next poll will retry */ }
  }, [toast]);

  useEffect(() => {
    if (mode !== "cloud") return;
    const on = () => { void flush(); void pullFreshRsvps(); };
    const off = () => setSync((s) => ({ ...s, status: "offline" }));
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void pullFreshRsvps();
    }, 45000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(poll);
    };
  }, [mode, flush, pullFreshRsvps]);

  /* warn before closing the tab while anything is still unsaved */
  useEffect(() => {
    if (mode !== "cloud") return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if (countPending() === 0) return;
      e.preventDefault();
      e.returnValue = ""; // older browsers need this to show the prompt
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /*
   * Reload from the server: our own edits are sent first, and the reload is
   * skipped while any are still unsaved. Used when a tab comes back after a
   * while (below), after a conflict (0018), and for live updates (0019).
   * Row versions mean a stale tab can no longer overwrite a partner's
   * change; this keeps what each tab shows current.
   */
  /** true when the workspace was reloaded; false when it had to wait (unsaved edits, offline) */
  const refreshFromServer = useCallback(async (): Promise<boolean> => {
    const wid = weddingIdRef.current;
    const owner = ownerRef.current;
    if (modeRef.current !== "cloud" || !wid || !owner) return true;
    await flush();
    if (countPending() > 0) return false; // couldn't save ours: never replace them
    const seq = editSeq.current;
    try {
      const versions: Versions = new Map();
      const fresh = await fetchWorkspace(wid, owner.uid, versions);
      // an edit made while we were fetching wins; try again next time
      if (editSeq.current !== seq || countPending() > 0) return false;
      versionsRef.current = versions;
      const changed = JSON.stringify(fresh) !== JSON.stringify(dbRef.current);
      // raw setter on purpose: the diffing setDb would queue the whole
      // refetch back up as writes
      setDbState(fresh);
      writeCache(owner.email, fresh);
      lastRsvpPull.current = Date.now();
      if (changed) toast("Updated with the latest changes", "Your partner's edits are in.", "info");
      return true;
    } catch { return false; /* offline — the next return will try again */ }
  }, [flush, toast, countPending]);
  conflictReload.current = () => void refreshFromServer();

  /*
   * Live updates (0019): a partner's change reaches this tab within a couple
   * of seconds. Echoes of our own saves are recognised by their version and
   * ignored; a delete only counts if it's a row we have. Bursts are batched
   * into one reload, which goes through refreshFromServer, so our own unsaved
   * edits are sent first and never painted over; if it has to wait, it
   * tries again shortly.
   */
  const liveTimer = useRef<number | null>(null);
  const scheduleLiveReload = useCallback((delay = 1500) => {
    if (liveTimer.current) window.clearTimeout(liveTimer.current);
    liveTimer.current = window.setTimeout(async () => {
      liveTimer.current = null;
      if (!(await refreshFromServer())) scheduleLiveReload(3000);
    }, delay);
  }, [refreshFromServer]);

  const onRemoteChange = useCallback((c: RemoteChange) => {
    const entity = LIVE_ENTITY[c.table];
    if (!entity || !c.id) return;
    const id = entity === "wedding" || entity === "invitation" || entity === "website" ? entity : c.id;
    if (c.type === "DELETE") {
      if (!hasRow(dbRef.current, entity, id)) return; // another wedding's row, or one we already removed
    } else {
      const mine = versionsRef.current.get(versionKey(entity, id));
      if (mine && c.updatedAt && Date.parse(mine) === Date.parse(c.updatedAt)) return; // our own save, echoed back
    }
    scheduleLiveReload();
  }, [scheduleLiveReload]);

  useEffect(() => {
    if (mode !== "cloud" || !weddingId || booting) return;
    let unsubscribe: (() => void) | null = null;
    try { unsubscribe = subscribeToWedding(weddingId, onRemoteChange); } catch { /* no live updates: focus refresh still works */ }
    return () => {
      unsubscribe?.();
      if (liveTimer.current) { window.clearTimeout(liveTimer.current); liveTimer.current = null; }
    };
  }, [mode, weddingId, booting, onRemoteChange]);

  useEffect(() => {
    if (mode !== "cloud") return;
    const AWAY_MS = 2 * 60 * 1000;
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
      if (hiddenAt !== null && Date.now() - hiddenAt > AWAY_MS) void refreshFromServer();
      hiddenAt = null;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mode, refreshFromServer]);

  /* ------------------------------ auth surface ------------------------------ */

  /**
   * Reset the workspace here rather than waiting on the onAuthChange callback:
   * authApi.signOut() can reject (swallowed below), and the previous couple's
   * guests, budget and plan must not survive a failed sign-out. onAuthChange
   * performs the same reset when it does fire, which is harmless.
   */
  const signOut = useCallback(() => {
    bootedUid.current = null;
    if (mode === "cloud") {
      void authApi.signOut().catch(() => {});
      // Drop the queued write-behind batch and its timer first: a pending
      // flush fires ~700ms later and would rewrite the cache entry we clear.
      if (flushTimer.current) { window.clearTimeout(flushTimer.current); flushTimer.current = null; }
      if (retryTimer.current) { window.clearTimeout(retryTimer.current); retryTimer.current = null; }
      pendingRef.current = emptyQueue();
      rejections.current.clear();
      versionsRef.current = new Map();
      // Unsaved edits go with the account, like the offline cache: this device
      // may be shared, so nothing of theirs is left behind.
      const owner = ownerRef.current?.email ?? userRef.current?.email;
      if (owner) clearQueue(owner);
      ownerRef.current = null;
      const email = userRef.current?.email;
      if (email) clearCache(email);
      setWeddingId(null);
      setNeedsOnboarding(false);
      setDbState(placeholderDb());
      setSync({ status: "saved", lastSaved: null, pending: 0 });
    }
    // demo mode keeps its seeded workspace — there is no account to leave
    setUser(null);
  }, [mode]);

  const openCheckout = useCallback((p: Plan) => setCheckout(p), []);
  const closeCheckout = useCallback(() => setCheckout(null), []);

  // formatting (money · dates) follows the wedding record — set once on boot
  // and again whenever the couple edits locale/currency/timezone
  useEffect(() => {
    configureFormat({ locale: db.wedding.locale, currency: db.wedding.currency, timeZone: db.wedding.timezone });
  }, [db.wedding.locale, db.wedding.currency, db.wedding.timezone]);

  const completeOnboarding = useCallback(async (input: { partnerA: string; partnerB: string; names: string; date: string; venue: string; locale?: string; currency?: string }) => {
    setBooting(true);
    try {
      const { weddingId: wid, wedding } = await createWedding(input);
      setWeddingId(wid);
      setDbState(emptyDb(wedding));
      setNeedsOnboarding(false);
      lastRsvpPull.current = Date.now();
      setSync({ status: "saved", lastSaved: Date.now(), pending: 0 });
      toast("Your plan is ready", "An empty canvas, all yours. Start with the guest list.");
    } finally {
      setBooting(false);
    }
  }, [toast]);

  const invitePartner = useCallback(async (email: string) => {
    const wid = weddingIdRef.current;
    if (!wid) throw new Error("No wedding yet");
    await apiInvitePartner(wid, email);
    toast("Invitation sent", `When ${email} signs up, your plan becomes theirs too.`);
  }, [toast]);

  /**
   * Server-authoritative plan refresh. Applies the wedding's plan as the
   * server has it — never an optimistic local write — and returns the
   * caller's own purchased tier (null when there is none / not in cloud mode),
   * which is what tells the checkout-return screen the payment has landed.
   */
  const refreshEntitlement = useCallback(async (): Promise<Plan | null> => {
    if (modeRef.current !== "cloud") return null;
    const wid = weddingIdRef.current;
    if (!wid) return null;
    const { plan, purchased } = await apiRefreshEntitlement(wid);
    if (plan) {
      setDbState((d) => (d.plan === plan ? d : { ...d, plan }));
    }
    return purchased;
  }, []);

  const saveNow = useCallback(async (): Promise<number> => {
    if (modeRef.current !== "cloud") return 0;
    if (flushTimer.current) { window.clearTimeout(flushTimer.current); flushTimer.current = null; }
    await flush();
    return countPending();
  }, [flush, countPending]);

  /* ------------------------------ value ------------------------------ */

  const value = useMemo<AppCtx>(() => ({
    db, setDb, patch, toast, toasts, dismissToast,
    user, signOut,
    openAuth, startSignup, signupEmail,
    upgrade, openUpgrade, closeUpgrade,
    checkout, openCheckout, closeCheckout,
    mode, sync, weddingId, booting, needsOnboarding, completeOnboarding, invitePartner,
    refreshEntitlement, saveNow,
  }), [db, setDb, patch, toast, toasts, dismissToast, user, signOut, openAuth, startSignup, signupEmail, upgrade, openUpgrade, closeUpgrade, checkout, openCheckout, closeCheckout, mode, sync, weddingId, booting, needsOnboarding, completeOnboarding, invitePartner, refreshEntitlement, saveNow]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside AppProvider");
  return ctx;
}

/* ------------------------------ derived ------------------------------ */

export function useStats() {
  const { db } = useApp();
  return useMemo(() => {
    const totalBudget = db.budget.reduce((s, c) => s + c.budget, 0);
    // committed & paid are derived from booked vendor schedules + manual amounts
    const committed = db.budget.reduce((s, c) => s + catCommitted(c, db.vendors), 0);
    const paid = db.budget.reduce((s, c) => s + catPaid(c, db.vendors), 0);
    const remaining = totalBudget - committed;
    const confirmed = db.guests.filter((g) => g.rsvp === "confirmed").length;
    const pending = db.guests.filter((g) => g.rsvp === "pending").length;
    const declined = db.guests.filter((g) => g.rsvp === "declined").length;
    const tasksDone = db.tasks.filter((t) => t.done).length;
    const progressPct = Math.round((tasksDone / Math.max(1, db.tasks.length)) * 100);
    const days = Math.max(0, Math.ceil((new Date(db.wedding.date).getTime() - Date.now()) / 86400000));
    const seated = db.guests.filter((g) => g.table).length;
    const plusOnes = db.guests.filter((g) => g.plusOneOf).length;
    const hosts = db.guests.length - plusOnes;
    // confirmed plates = confirmed guests, plus-ones included (they eat too)
    const confirmedPlates = confirmed;
    return { totalBudget, committed, paid, remaining, confirmed, pending, declined, total: db.guests.length, hosts, plusOnes, confirmedPlates, tasksDone, tasksTotal: db.tasks.length, progressPct, days, seated };
  }, [db]);
}

/* ------------------------------ hooks ------------------------------ */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useCountUp(target: number, duration = 1300) {
  const reduced = usePrefersReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) { setVal(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return val;
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Hello again" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
