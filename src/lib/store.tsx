import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BudgetCategory, CustomTemplate, Guest, Plan, RegistryItem, RsvpEntry, SeatTable, Task, Vendor, Wedding,
  seedBudget, seedGuests, seedRegistry, seedRsvpLog, seedTables, seedTasks, seedVendors, seedWedding, slugify,
} from "./data";

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

interface User { name: string; email: string }

interface AppCtx {
  db: Db;
  setDb: React.Dispatch<React.SetStateAction<Db>>;
  patch: (p: Partial<Db>) => void;
  toast: (title: string, desc?: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  user: User | null;
  signIn: (u: User) => void;
  signOut: () => void;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
  checkout: Plan | null;
  openCheckout: (p: Plan) => void;
  closeCheckout: () => void;
}

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

/** Public share link for the couple's invitation page. */
export const inviteLink = (names: string) => `https://luma.love/i/${slugify(names)}`;

const KEY = "luma.db.v2";
const AUTH_KEY = "luma.auth.v1";

function loadDb(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      if (parsed && parsed.wedding && Array.isArray(parsed.guests)) {
        // merge over seeds so older saved databases gain newly-added fields
        // backfill task due-dates from the seed plan so saved installs light up the calendar
        const dueById = new Map(seedTasks.filter((t) => t.due).map((t) => [t.id, t.due as string]));
        return {
          ...seedDb, ...parsed,
          invitation: { ...seedDb.invitation, ...parsed.invitation },
          website: { ...seedDb.website, ...parsed.website },
          customTemplates: parsed.customTemplates ?? [],
          rsvpLog: parsed.rsvpLog ?? seedDb.rsvpLog,
          tasks: Array.isArray(parsed.tasks)
            ? parsed.tasks.map((t) => (t.due ? t : dueById.has(t.id) ? { ...t, due: dueById.get(t.id) } : t))
            : seedDb.tasks,
        };
      }
    }
  } catch { /* fall through to seed */ }
  return seedDb;
}

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch { return null; }
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db>(loadDb);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [user, setUser] = useState<User | null>(loadUser);
  const [authOpen, setAuthOpen] = useState(false);
  const [checkout, setCheckout] = useState<Plan | null>(null);
  const quotaWarned = useRef(false);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      else localStorage.removeItem(AUTH_KEY);
    } catch { /* noop */ }
  }, [user]);

  const patch = useCallback((p: Partial<Db>) => setDb((d) => ({ ...d, ...p })), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback((title: string, desc?: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, title, desc, tone }]);
    window.setTimeout(() => dismissToast(id), 4600);
  }, [dismissToast]);

  const signIn = useCallback((u: User) => setUser(u), []);
  const signOut = useCallback(() => setUser(null), []);
  const openCheckout = useCallback((p: Plan) => setCheckout(p), []);
  const closeCheckout = useCallback(() => setCheckout(null), []);

  // persist — large HTML invitation bundles can exceed browser storage;
  // warn once and keep the app running instead of failing silently forever
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      if (!quotaWarned.current) {
        quotaWarned.current = true;
        toast("Storage is full", "Some large HTML designs may not survive a refresh here. Remove an older design to free space.", "warn");
      }
    }
  }, [db, toast]);

  const value = useMemo<AppCtx>(() => ({
    db, setDb, patch, toast, toasts, dismissToast,
    user, signIn, signOut,
    authOpen, setAuthOpen,
    checkout, openCheckout, closeCheckout,
  }), [db, patch, toast, toasts, dismissToast, user, signIn, signOut, authOpen, checkout, openCheckout, closeCheckout]);

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
    const committed = db.budget.reduce((s, c) => s + c.committed, 0);
    const paid = db.budget.reduce((s, c) => s + c.paid, 0);
    const remaining = totalBudget - committed;
    const confirmed = db.guests.filter((g) => g.rsvp === "confirmed").length;
    const pending = db.guests.filter((g) => g.rsvp === "pending").length;
    const declined = db.guests.filter((g) => g.rsvp === "declined").length;
    const tasksDone = db.tasks.filter((t) => t.done).length;
    const progressPct = Math.round((tasksDone / Math.max(1, db.tasks.length)) * 100);
    const days = Math.max(0, Math.ceil((new Date(db.wedding.date).getTime() - Date.now()) / 86400000));
    const seated = db.guests.filter((g) => g.table).length;
    return { totalBudget, committed, paid, remaining, confirmed, pending, declined, total: db.guests.length, tasksDone, tasksTotal: db.tasks.length, progressPct, days, seated };
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
