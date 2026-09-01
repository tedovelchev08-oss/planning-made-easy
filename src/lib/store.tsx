import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BudgetCategory, CustomTemplate, Guest, Plan, RegistryItem, RsvpEntry, SeatTable, Task, Vendor, Wedding,
  catCommitted, catPaid, configureFormat,
  seedBudget, seedGuests, seedRegistry, seedRsvpLog, seedTables, seedTasks, seedVendors, seedWedding, slugify,
} from "./data";
import { isSupabaseConfigured } from "./supabase";
import {
  EntityKey, acceptPendingInvites, authApi, budgetToRow, createWedding, customTplToRow, fetchFreshRsvps,
  fetchWorkspace, guestToRow, invitationToRow, invitePartner as apiInvitePartner, isUuid, myWeddingId, newId,
  registryToRow, rsvpToRow, syncEntity, tableToRow, taskToRow, websiteToRow, weddingToRow,
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
  music: { track: "serene" | "golden" | "dance" | "upload"; uploadName: string | null; uploadData: string | null };
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
export interface SyncState { status: SyncStatus; lastSaved: number | null; pending: number }

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
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
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
    music: { track: "serene", uploadName: null, uploadData: null },
  },
  website: {
    template: "serene",
    sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
    bg: "#FFF8F0",
    ink: "#332B31",
    accent: "#D4AF37",
    serif: true,
    heroPhoto: "https://image.qwenlm.ai/generated-images/491b8b3f-233c-48cf-a774-26c3db982f5f/_result.png",
    animations: true,
    domain: "maya-theo.luma.love",
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
  music: { track: "serene", uploadName: null, uploadData: null },
});

const defaultWebsite = (slug: string): WebsiteConfig => ({
  template: "serene",
  sections: { hero: true, story: true, details: true, schedule: true, venue: true, travel: true, registry: true, gallery: true, rsvp: true, music: false },
  bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true, heroPhoto: "",
  animations: true, domain: `${slug}.luma.love`, published: false,
});

export const emptyDb = (wedding: Wedding): Db => ({
  wedding,
  guests: [], budget: [], tasks: [], vendors: [], tables: [], registry: [],
  plan: "essential",
  invitation: defaultInvitation(wedding.names, [wedding.venue, wedding.location].filter(Boolean).join(" · ")),
  website: defaultWebsite(wedding.slug),
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

/** Public share link for the couple's invitation page. */
export const inviteLink = (slugOrNames: string) => `https://luma.love/i/${slugify(slugOrNames)}`;

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

const cacheKey = (uid: string) => `luma.cache.${uid}`;

function readCache(uid: string): Db | null {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Db;
    return parsed && parsed.wedding && Array.isArray(parsed.guests) ? parsed : null;
  } catch { return null; }
}

function writeCache(uid: string, db: Db) {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(db)); } catch { /* full — Supabase still has it */ }
}

/* ------------------------------ context ------------------------------ */

const Ctx = createContext<AppCtx | null>(null);

interface Bucket { upserts: Map<string, unknown>; deletes: Set<string> }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const mode = useMemo(bootMode, []);

  const [db, setDbState] = useState<Db>(() => (mode === "demo" ? seedDb : placeholderDb()));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [user, setUser] = useState<User | null>(() =>
    mode === "demo" ? { name: "Maya & Theo", email: "demo@luma.love" } : null);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: mode === "demo" ? "demo" : "booting", lastSaved: null, pending: 0 });
  const [booting, setBooting] = useState(mode === "cloud");
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [weddingId, setWeddingId] = useState<string | null>(null);

  const pendingRef = useRef<Map<EntityKey, Bucket>>(new Map());
  const flushTimer = useRef<number | null>(null);
  const lastRsvpPull = useRef<number>(Date.now());
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

  const getBucket = (key: EntityKey): Bucket => {
    let b = pendingRef.current.get(key);
    if (!b) { b = { upserts: new Map(), deletes: new Set() }; pendingRef.current.set(key, b); }
    return b;
  };

  const countPending = () => {
    let n = 0;
    pendingRef.current.forEach((b) => { n += b.upserts.size + b.deletes.size; });
    return n;
  };

  const flush = useCallback(async () => {
    const wid = weddingIdRef.current;
    if (modeRef.current !== "cloud" || !wid || pendingRef.current.size === 0) return;
    setSync((s) => ({ ...s, status: "saving", pending: countPending() }));
    const batch = pendingRef.current;
    pendingRef.current = new Map();
    try {
      for (const [key, b] of batch) {
        await syncEntity(key, wid, [...b.upserts.values()], [...b.deletes]);
      }
      setSync({ status: "saved", lastSaved: Date.now(), pending: countPending() });
      const uid = userRef.current?.email;
      if (uid) writeCache(uid, dbRef.current);
    } catch {
      // merge the failed batch back underneath anything queued since
      for (const [key, b] of batch) {
        const live = getBucket(key);
        for (const [id, row] of b.upserts) if (!live.upserts.has(id)) live.upserts.set(id, row);
        for (const id of b.deletes) live.deletes.add(id);
      }
      setSync((s) => ({ ...s, status: navigator.onLine ? "error" : "offline", pending: countPending() }));
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    setSync((s) => ({ ...s, status: "saving", pending: countPending() }));
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(() => void flush(), 700);
  }, [flush]);

  /**
   * Diff prev→next per entity and queue write-behind ops. Ids are normalised
   * to UUIDs so server-side uuid columns stay happy; new guest rows also get
   * an RSVP token minted client-side.
   */
  const scheduleDiff = useCallback((prev: Db, next: Db) => {
    const wid = weddingIdRef.current;
    if (!wid) return;

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
        if (before.get(r.id) !== JSON.stringify(r)) bucket.upserts.set(r.id, toRow(r, wid, i));
      });
      prevRows.forEach((r) => { if (!after.has(r.id)) bucket.deletes.add(r.id); });
    };

    diffRows("guests", prev.guests, next.guests, guestToRow);
    diffRows("tables", prev.tables, next.tables, tableToRow);
    diffRows("budget", prev.budget, next.budget, budgetToRow);
    diffRows("tasks", prev.tasks, next.tasks, taskToRow);
    diffRows("vendors", prev.vendors, next.vendors, (v) => v);
    diffRows("registry", prev.registry, next.registry, registryToRow);
    diffRows("customTemplates", prev.customTemplates, next.customTemplates, customTplToRow);
    diffRows("rsvpLog", prev.rsvpLog, next.rsvpLog, rsvpToRow);

    if (JSON.stringify(prev.wedding) !== JSON.stringify(next.wedding)) getBucket("wedding").upserts.set("wedding", next.wedding);
    if (JSON.stringify({ ...prev.invitation, music: null }) !== JSON.stringify({ ...next.invitation, music: null }) ||
        prev.invitation.music.track !== next.invitation.music.track ||
        prev.invitation.music.uploadName !== next.invitation.music.uploadName ||
        Boolean(prev.invitation.music.uploadData) !== Boolean(next.invitation.music.uploadData)) {
      getBucket("invitation").upserts.set("invitation", invitationToRow(next.invitation, wid));
    }
    if (JSON.stringify(prev.website) !== JSON.stringify(next.website)) {
      getBucket("website").upserts.set("website", websiteToRow(next.website, wid));
    }

    scheduleFlush();
  }, [scheduleFlush]);

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
      const cache = email ? readCache(email) : null;
      if (cache && cache.wedding.slug) setDbState(cache);
      const fresh = await fetchWorkspace(wid, uid);
      setDbState(fresh);
      if (email) writeCache(email, fresh);
      lastRsvpPull.current = Date.now();
      setSync({ status: "saved", lastSaved: Date.now(), pending: 0 });
    } catch {
      setSync({ status: navigator.onLine ? "error" : "offline", lastSaved: null, pending: 0 });
    } finally {
      setBooting(false);
    }
  }, []);

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
        subscription = authApi.onAuthChange((id, email) => {
          if (id) {
            setUser({ name: email?.split("@")[0] ?? "You", email: email ?? "" });
            void bootFor(id, email);
          } else {
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

  /* ------------------------------ auth surface ------------------------------ */

  const signOut = useCallback(() => {
    if (mode === "cloud") void authApi.signOut().catch(() => {});
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

  /* ------------------------------ value ------------------------------ */

  const value = useMemo<AppCtx>(() => ({
    db, setDb, patch, toast, toasts, dismissToast,
    user, signOut,
    authOpen, setAuthOpen,
    checkout, openCheckout, closeCheckout,
    mode, sync, weddingId, booting, needsOnboarding, completeOnboarding, invitePartner,
  }), [db, setDb, patch, toast, toasts, dismissToast, user, signOut, authOpen, checkout, openCheckout, closeCheckout, mode, sync, weddingId, booting, needsOnboarding, completeOnboarding, invitePartner]);

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
