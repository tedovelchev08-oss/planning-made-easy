import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Armchair, BellRing, CalendarDays, Check, Clock3, ExternalLink, Gift, Globe, LayoutDashboard,
  Link2, LogOut, Menu, Plus, Search, Store, Users, Wallet, X,
} from "lucide-react";
import { useApp, useStats, type SyncStatus } from "../../lib/store";
import { initials, planLabel } from "../../lib/data";
import { useT } from "../../lib/i18n";
import { Logo, Pill } from "../ui";
import CmdK from "./CmdK";

const MODULES = [
  { path: "", key: "nav.dashboard", icon: LayoutDashboard, end: true },
  { path: "guests", key: "nav.guests", icon: Users },
  { path: "budget", key: "nav.budget", icon: Wallet },
  { path: "timeline", key: "nav.timeline", icon: Clock3 },
  { path: "vendors", key: "nav.vendors", icon: Store },
  { path: "seating", key: "nav.seating", icon: Armchair },
  { path: "registry", key: "nav.registry", icon: Gift },
  { path: "page", key: "nav.page", icon: Globe },
];

/** saving / saved / offline — the write-behind pulse, always visible */
function SyncChip() {
  const { sync } = useApp();
  const meta: Record<SyncStatus, { label: string; dot: string; cls: string }> = {
    demo: { label: "Demo · in-memory", dot: "bg-lav-deep", cls: "border-lav/60 bg-lav-soft/70 text-lav-deep" },
    booting: { label: "Loading plan", dot: "bg-ink-mute anim-pulse-soft", cls: "border-ink/10 bg-white/60 text-ink-mute" },
    saving: { label: sync.pending > 0 ? `Saving · ${sync.pending}` : "Saving", dot: "bg-gold anim-pulse-soft", cls: "border-gold/40 bg-gold-soft/70 text-gold-deep" },
    saved: { label: "Saved", dot: "bg-sage-deep", cls: "border-sage/50 bg-sage-soft/70 text-sage-deep" },
    offline: { label: "Offline — queued", dot: "bg-blush-deep", cls: "border-blush/60 bg-blush-soft/70 text-blush-deep" },
    error: { label: "Sync issue", dot: "bg-blush-deep anim-pulse-soft", cls: "border-blush/60 bg-blush-soft/70 text-blush-deep" },
  };
  const m = meta[sync.status];
  return (
    <span
      role="status" aria-live="polite"
      title={sync.lastSaved ? `Last saved ${new Date(sync.lastSaved).toLocaleTimeString()}` : "Nothing saved yet"}
      className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.64rem] font-extrabold uppercase tracking-[0.12em] md:flex ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/** ambient planner light — shifts with the hour so the room feels lived-in */
function plannerGlows() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return ["bg-blush/25", "bg-gold-soft/45", "bg-lav/20"];
  if (h >= 12 && h < 17) return ["bg-sage/25", "bg-blush/18", "bg-lav/15"];
  if (h >= 17 && h < 22) return ["bg-lav/30", "bg-blush/22", "bg-sage/15"];
  return ["bg-lav/22", "bg-blush/15", "bg-gold-soft/25"];
}

export default function Shell() {
  const { db, user, signOut, toast, mode, weddingId, invitePartner } = useApp();
  const { t } = useT();
  const stats = useStats();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [invited, setInvited] = useState(false);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteBusy(true);
    try {
      await invitePartner(inviteEmail.trim());
      setInvited(true);
    } catch (err) {
      toast("Couldn't send the invite", (err as Error).message, "warn");
    } finally {
      setInviteBusy(false);
    }
  };

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // ⌘K / Ctrl+K anywhere in the planner
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const glows = useMemo(() => plannerGlows(), []);
  const pct = stats.progressPct;
  const link = `https://luma.love/i/${db.wedding.names.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const copyLink = () => {
    navigator.clipboard?.writeText(link).then(
      () => toast("Link copied", "Send it anywhere — WhatsApp, Instagram, a group chat.", "info"),
      () => toast("Your link", link, "info"),
    );
  };

  const dockActions: { label: string; icon: React.ReactNode; run: () => void }[] = [
    { label: "Add guest", icon: <Users size={19} />, run: () => { window.dispatchEvent(new CustomEvent("luma:guest-add")); setDrawerLike("/planner/guests"); } },
    { label: "Invite link", icon: <Link2 size={19} />, run: () => { copyLink(); setDockOpen(false); } },
    { label: "Guest page", icon: <ExternalLink size={19} />, run: () => { window.location.hash = "#/invite"; setDockOpen(false); } },
    { label: "RSVPs", icon: <BellRing size={19} />, run: () => setDrawerLike("/planner/page?tab=rsvp") },
    { label: "New task", icon: <Clock3 size={19} />, run: () => setDrawerLike("/planner/timeline") },
    { label: "Seating", icon: <Armchair size={19} />, run: () => setDrawerLike("/planner/seating") },
  ];
  const setDrawerLike = (to: string) => { setDockOpen(false); window.location.hash = `#${to}`; };

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4" aria-label="Planner modules">
      {MODULES.map((m) => (
        <NavLink
          key={m.path}
          to={`/planner/${m.path}`}
          end={m.end}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-2xl px-4 py-3 text-[0.9rem] font-semibold transition-all duration-300 ${
              isActive
                ? "bg-ink text-cream shadow-card"
                : "text-ink-2 hover:bg-white/70 hover:text-ink hover:translate-x-0.5"
            }`
          }
        >
          <m.icon size={17} className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
          {t(m.key)}
          {m.path === "page" && db.rsvpLog.some((e) => !e.synced) && (
            <span className="ml-auto h-2 w-2 rounded-full bg-blush anim-pulse-soft" title="New RSVP answers" />
          )}
        </NavLink>
      ))}

      <div className="mt-auto rounded-2xl border border-gold/35 bg-gold-soft/50 p-4">
        <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-gold-deep">Your plan</p>
        <p className="mt-1 font-display text-lg leading-tight text-ink">{planLabel(db.plan)}</p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-ink-2">One purchase, yours forever.</p>
        {db.plan !== "luxe" && (
          <button
            onClick={() => setDrawerLike("/planner/page")}
            className="mt-3 w-full rounded-full bg-ink py-2 text-[0.72rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer"
          >
            Explore Luxe
          </button>
        )}
      </div>
    </nav>
  );

  return (
    <div className="relative flex h-full min-h-screen flex-col lg:flex-row">
      {/* ambient planner light */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className={`anim-bob absolute -top-40 left-[6%] h-[26rem] w-[26rem] rounded-full blur-3xl ${glows[0]}`} />
        <div className={`anim-bob absolute right-[4%] top-[30%] h-[22rem] w-[22rem] rounded-full blur-3xl ${glows[1]}`} style={{ animationDelay: "-3.5s" }} />
        <div className={`anim-bob absolute bottom-[-6rem] left-[38%] h-[24rem] w-[24rem] rounded-full blur-3xl ${glows[2]}`} style={{ animationDelay: "-6s" }} />
        {[14, 42, 71, 88].map((left, i) => (
          <span key={left} className="inv-petal opacity-70" style={{ left: `${left}%`, animationDuration: `${16 + i * 4}s`, animationDelay: `${i * 5}s` }} />
        ))}
      </div>

      <CmdK open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-[264px] shrink-0 border-r border-white/60 bg-white/40 backdrop-blur-xl lg:block">
        <div className="flex items-center justify-between px-6 py-5">
          <NavLink to="/"><Logo /></NavLink>
          <span className="rounded-full bg-blush-soft px-2.5 py-1 text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-blush-deep">Planner</span>
        </div>
        {sidebar}
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-[280px] bg-cream shadow-glass lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              aria-label="Planner navigation"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <Logo />
                <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="rounded-full bg-ink/5 p-2 text-ink-2 cursor-pointer"><X size={16} /></button>
              </div>
              {sidebar}
              <div className="px-4 pb-6">
                <button
                  onClick={() => { signOut(); setDrawerOpen(false); toast("Signed out", "See you at the next planning session.", "info"); }}
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-[0.9rem] font-bold text-blush-deep transition hover:bg-blush-soft cursor-pointer"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-30 border-b border-ink/8 bg-cream/70 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="rounded-full border border-ink/15 p-2.5 lg:hidden cursor-pointer">
              <Menu size={17} />
            </button>
            <NavLink to="/" className="lg:hidden"><Logo /></NavLink>

            <button
              onClick={() => setCmdOpen(true)}
              className="ml-auto hidden items-center gap-2.5 rounded-full border border-ink/12 bg-white/60 py-2 pl-3.5 pr-2.5 text-[0.76rem] font-bold text-ink-mute transition hover:border-ink/35 hover:text-ink sm:flex cursor-pointer"
            >
              <Search size={13} />
              Search the plan
              <kbd className="rounded-md border border-ink/15 bg-white px-1.5 py-0.5 text-[0.6rem] font-extrabold">⌘K</kbd>
            </button>
            <button onClick={() => setCmdOpen(true)} aria-label="Search the plan" className="ml-auto rounded-full border border-ink/15 p-2.5 text-ink-2 transition hover:border-ink/40 sm:ml-0 sm:hidden cursor-pointer">
              <Search size={15} />
            </button>

            <SyncChip />

            <span className="hidden items-center gap-2 rounded-full border border-gold/40 bg-gold-soft/60 px-3.5 py-2 text-[0.72rem] font-extrabold text-gold-deep lg:flex">
              <CalendarDays size={13} /> {stats.days} days
            </span>

            {/* account */}
            <div className="relative">
              <button
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Account menu" aria-expanded={accountOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-blush text-[0.66rem] font-extrabold text-ink shadow-sm ring-2 ring-white transition hover:scale-105 cursor-pointer"
              >
                {user ? initials(user.name) : mode === "demo" ? "M·T" : "··"}
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" onClick={() => setAccountOpen(false)} aria-label="Close account menu" />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-white/70 bg-cream/95 shadow-glass backdrop-blur-xl"
                      role="menu" aria-label="Account"
                    >
                      <div className="px-4 py-4">
                        <p className="text-[0.92rem] font-extrabold text-ink">{user?.name ?? (mode === "demo" ? "Maya & Theo" : "Not signed in")}</p>
                        <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-ink-mute">{user?.email ?? (mode === "demo" ? "demo couple session" : "Sign in to sync your plan")}</p>
                        <span className="mt-2.5 inline-block"><Pill tone="gold">{planLabel(db.plan)}</Pill></span>
                      </div>

                      {mode === "cloud" && weddingId && (
                        <div className="border-t border-ink/8 px-4 py-3.5">
                          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.16em] text-ink-mute">Invite your partner</p>
                          {invited ? (
                            <p className="mt-2 flex items-start gap-1.5 text-[0.76rem] font-bold leading-snug text-sage-deep">
                              <Check size={13} className="mt-0.5 shrink-0" /> Invite sent — when they sign up with this email, your plan becomes theirs too.
                            </p>
                          ) : (
                            <form onSubmit={sendInvite} className="mt-2 flex gap-1.5">
                              <input
                                type="email" required value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="their@email.com"
                                aria-label="Partner email address"
                                className="w-full min-w-0 rounded-xl border border-ink/12 bg-white/80 px-3 py-2 text-[0.78rem] placeholder:text-ink-mute/60 focus:border-gold/60 focus:outline-none"
                              />
                              <button
                                type="submit" disabled={inviteBusy}
                                className="shrink-0 rounded-full bg-ink px-3.5 py-2 text-[0.72rem] font-bold text-cream transition hover:bg-ink/85 disabled:opacity-50 cursor-pointer"
                              >
                                {inviteBusy ? "…" : "Invite"}
                              </button>
                            </form>
                          )}
                        </div>
                      )}

                      <div className="border-t border-ink/8 p-2">
                        <button
                          onClick={() => { signOut(); setAccountOpen(false); toast("Signed out", "Your plan is saved — see you soon.", "info"); }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-bold text-ink transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* the journey line — how far through the plan you are */}
          <div className="absolute inset-x-0 bottom-0 h-[2.5px] bg-ink/6" aria-hidden="true">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative h-full bg-gradient-to-r from-gold via-blush-deep to-sage-deep"
            >
              <span className="absolute -top-[5px] right-0 flex h-3 w-3 -translate-y-0 items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#E98BA0" className="drop-shadow-sm"><path d="M12 21S3.5 15.4 1.6 10.6C.3 7.3 2.4 4 5.8 4c2.4 0 4 1.4 6.2 3.8C14.2 5.4 15.8 4 18.2 4c3.4 0 5.5 3.3 4.2 6.6C20.5 15.4 12 21 12 21z" /></svg>
              </span>
            </motion.div>
          </div>
        </header>

        <main
          className={
            location.pathname.startsWith("/planner/seating")
              ? "mx-auto max-w-none px-3 py-4 pb-24 sm:px-5 lg:pb-5"
              : "mx-auto max-w-6xl px-4 py-7 sm:px-8 pb-28 lg:pb-12"
          }
        >
          <Outlet />
        </main>
      </div>

      {/* mobile quick-action dock */}
      <motion.button
        onClick={() => setDockOpen(true)}
        aria-label="Quick actions"
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-glass transition hover:scale-105 lg:hidden cursor-pointer"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus size={22} />
      </motion.button>

      <AnimatePresence>
        {dockOpen && (
          <motion.div className="fixed inset-0 z-[72] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" onClick={() => setDockOpen(false)} aria-label="Close quick actions" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="absolute inset-x-0 bottom-0 rounded-t-[1.8rem] bg-cream p-5 shadow-glass"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
              role="dialog" aria-modal="true" aria-label="Quick actions"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" aria-hidden="true" />
              <p className="mb-3 text-center text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-ink-mute">Quick actions</p>
              <div className="grid grid-cols-3 gap-2.5">
                {dockActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.run}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-ink/10 bg-white/75 px-2 py-4 text-[0.72rem] font-bold text-ink transition hover:border-gold/60 hover:bg-white hover:shadow-card active:scale-95 cursor-pointer"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blush-soft text-blush-deep">{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* mobile bottom tabs */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/40 bg-cream/85 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 px-2 pb-1 pt-1.5">
          {MODULES.slice(0, 5).map((m) => (
            <NavLink
              key={m.path}
              to={`/planner/${m.path}`}
              end={m.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-2xl py-2 text-[0.6rem] font-bold transition-colors ${
                  isActive ? "text-blush-deep" : "text-ink-mute hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`rounded-2xl px-4 py-1.5 transition-all duration-300 ${isActive ? "bg-blush-soft shadow-sm" : ""}`}>
                    <m.icon size={19} />
                  </span>
                  {t(m.key).split(" ")[0]}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
