import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Armchair, BellRing, Check, Clock3, ExternalLink, Gift, Globe, LayoutDashboard,
  Download, Link2, Loader2, LogOut, Menu, Plus, Search, Store, Trash2, Users, Wallet, X,
} from "lucide-react";
import { useApp, useStats, type SyncStatus } from "../../lib/store";
import { SUPPORT_EMAIL, guestLink } from "../../lib/links";
import { downloadExport } from "../../lib/exportData";
import { deleteAccount } from "../../lib/api";
import { fmtDate, initials, planLabel } from "../../lib/data";
import { useT } from "../../lib/i18n";
import { Logo, Modal, Pill, btn } from "../ui";
import CmdK from "./CmdK";
import Reminders from "./Reminders";
import "./planner.css";

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

/**
 * saving / saved / offline — the write-behind pulse, on every screen size.
 * It used to be desktop-only, so phones showed no save status at all, and
 * "Offline — queued" implied edits were safe when they lived only in memory.
 */
function SyncChip() {
  const { sync } = useApp();
  const kept = sync.durable !== false;
  const meta: Record<SyncStatus, { label: string; short: string; dot: string; cls: string }> = {
    demo: { label: "Demo, nothing is saved", short: "Demo", dot: "bg-lav-deep", cls: "border-lav/60 bg-lav-soft/70 text-lav-deep" },
    booting: { label: "Loading plan", short: "Loading", dot: "bg-ink-mute anim-pulse-soft", cls: "border-ink/10 bg-white/60 text-ink-mute" },
    saving: { label: sync.pending > 0 ? `Saving · ${sync.pending}` : "Saving", short: "Saving", dot: "bg-gold anim-pulse-soft", cls: "border-gold/40 bg-gold-soft/70 text-gold-deep" },
    saved: { label: "Saved", short: "Saved", dot: "bg-sage-deep", cls: "border-sage/50 bg-sage-soft/70 text-sage-deep" },
    offline: {
      label: kept ? "Offline · kept on this device" : "Offline · not saved yet",
      short: kept ? "Offline" : "Not saved",
      dot: "bg-blush-deep", cls: "border-blush/60 bg-blush-soft/70 text-blush-deep",
    },
    error: {
      label: sync.problem ? "A change can't be saved" : "Not saved · retrying",
      short: sync.problem ? "Can't save" : "Retrying",
      dot: "bg-blush-deep anim-pulse-soft", cls: "border-blush/60 bg-blush-soft/70 text-blush-deep",
    },
  };
  const m = meta[sync.status];
  const detail = sync.problem
    ?? (sync.status === "offline" && !kept ? "This device couldn't store your edits. Keep this tab open until you're back online."
      : sync.lastSaved ? `Last saved ${new Date(sync.lastSaved).toLocaleTimeString()}` : "Nothing saved yet");
  return (
    <span
      role="status" aria-live="polite"
      title={detail}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-medium md:px-3 ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} aria-hidden="true" />
      <span className="md:hidden">{m.short}</span>
      <span className="hidden md:inline">{m.label}</span>
      <span className="sr-only">{`. ${detail}`}</span>
    </span>
  );
}

export default function Shell() {
  const { db, user, signOut, toast, mode, weddingId, invitePartner, saveNow } = useApp();
  const { t } = useT();
  const stats = useStats();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteMatches = !!user?.email && deleteConfirm.trim().toLowerCase() === user.email.toLowerCase();

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteMatches) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deleteConfirm.trim());
      setDeleteInfo(false);
      signOut(); // clears this device's copy of the planner and any unsaved edits
      toast("Your account is deleted", "Thank you for planning with Twofold.");
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };
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

  // The demo has no account to sign out of: its "Sign out" used to toast
  // "Signed out" and leave Maya & Theo on screen. There it leaves the demo.
  const leaveLabel = mode === "demo" ? "Leave demo" : "Sign out";
  const leave = async (farewell: string) => {
    if (mode === "demo") { signOut(); window.location.hash = "#/"; return; }
    // Signing out clears unsaved edits from this device (it may be shared),
    // so send them first, and ask before throwing away any that won't go.
    const left = await saveNow();
    if (left > 0 && !window.confirm(
      `${left} ${left === 1 ? "change hasn't" : "changes haven't"} saved yet — you look to be offline. ` +
      "Sign out anyway and lose them? Choose Cancel to stay signed in; they'll save when you're back online.",
    )) return;
    signOut();
    toast("Signed out", farewell, "info");
  };

  const pct = stats.progressPct;
  const link = guestLink({ slug: db.wedding.slug });

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
    <nav className="pl-nav flex flex-col gap-0.5 px-3 py-2" aria-label="Planner modules">
      {MODULES.map((m) => (
        <NavLink key={m.path} to={m.path ? `/planner/${m.path}` : "/planner"} end={m.end}>
          <m.icon size={17} strokeWidth={1.6} className="shrink-0" />
          {t(m.key)}
          {m.path === "page" && db.rsvpLog.some((e) => !e.synced) && (
            <span className="ml-auto h-2 w-2 rounded-full bg-[var(--pl-gold)]" title="New RSVP answers" />
          )}
        </NavLink>
      ))}
    </nav>
  );

  // the couple, at the foot of the rail
  const us = (
    <div className="pl-us mt-auto border-t border-white/10 px-6 pb-7 pt-5">
      <b>{db.wedding.partnerA}{db.wedding.partnerB && <><i>&amp;</i>{db.wedding.partnerB}</>}</b>
      <p>{fmtDate(db.wedding.date, { day: "numeric", month: "long", year: "numeric" })}<br /><span>{stats.days} {stats.days === 1 ? "day" : "days"} to go</span></p>
    </div>
  );

  return (
    <div className="pl relative flex h-full min-h-screen flex-col lg:flex-row">
      <CmdK open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <Modal open={deleteInfo} onClose={() => { if (!deleting) setDeleteInfo(false); }} label="Delete my account">
        <form className="p-7 sm:p-8" onSubmit={confirmDelete}>
          <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink"><Trash2 size={20} className="text-blush-deep" /> Delete your account</h2>
          <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-2">
            This can't be undone. Your account is deleted straight away.
          </p>
          <div className="mt-5 space-y-2.5 rounded-2xl border border-ink/10 bg-white/70 p-4 text-[0.84rem] leading-relaxed text-ink-2">
            <p><strong className="text-ink">If you created this wedding</strong>, deleting your account deletes the whole wedding — guests, RSVPs, seating, budget and uploaded songs — for your partner too.</p>
            <p><strong className="text-ink">If you joined as a partner</strong>, only your access is removed; the wedding stays with whoever created it.</p>
            <p>Want a copy first? <strong className="text-ink">Export my data</strong> downloads everything.</p>
          </div>
          <label className="mt-5 block text-[0.8rem] font-bold text-ink-2" htmlFor="delete-confirm">
            Type <strong className="text-ink">{user?.email ?? "your email"}</strong> to confirm
          </label>
          <input
            id="delete-confirm" type="email" autoComplete="off" value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-[0.9rem] text-ink outline-none focus:border-blush-deep"
          />
          {deleteError && (
            <p className="mt-3 rounded-xl border border-blush-deep/40 bg-blush-soft/70 px-4 py-3 text-[0.82rem] font-bold text-blush-deep" role="alert">{deleteError}</p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => { downloadExport(db, user, weddingId); toast("Your data is downloading", "Everything in your planner, as one JSON file."); }} className={btn.outline}>
              <Download size={14} /> Export my data first
            </button>
            <button type="submit" disabled={!deleteMatches || deleting} className={`${btn.ink} disabled:pointer-events-none disabled:opacity-50`}>
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={14} />} Delete my account
            </button>
          </div>
          <p className="mt-4 text-right text-[0.74rem] text-ink-mute">
            Trouble? Email <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline underline-offset-2">{SUPPORT_EMAIL}</a>.
          </p>
        </form>
      </Modal>

      {/* desktop rail */}
      <aside className="pl-rail sticky top-0 z-30 hidden h-screen w-[256px] shrink-0 flex-col lg:flex">
        <div className="px-6 pb-8 pt-7"><NavLink to="/" aria-label="Twofold, home"><Logo dark /></NavLink></div>
        {sidebar}
        {us}
      </aside>

      {/* mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              className="pl-rail fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col shadow-glass lg:hidden"
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              aria-label="Planner navigation"
            >
              <div className="flex items-center justify-between px-6 py-5">
                <Logo dark />
                <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="rounded-full p-2.5 text-[var(--pl-ivory)]/70 hover:text-[var(--pl-ivory)] cursor-pointer"><X size={17} /></button>
              </div>
              {/* the nav fills the drawer's height; without this wrapper it pushed
                  the sign-out button below the screen, where it could not be reached */}
              <div className="min-h-0 flex-1 overflow-y-auto">{sidebar}</div>
              {us}
              <div className="px-3 pb-6">
                <button
                  onClick={() => { setDrawerOpen(false); void leave("See you at the next planning session."); }}
                  className="flex w-full items-center gap-3 rounded-[2px] px-3 py-3 text-[14.5px] text-[var(--pl-ivory)]/66 transition hover:bg-white/5 hover:text-[var(--pl-ivory)] cursor-pointer"
                >
                  <LogOut size={16} /> {leaveLabel}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-30 border-b border-[var(--pl-line)] bg-[var(--pl-onyx)] text-[var(--pl-ivory)] lg:bg-[var(--pl-paper)]/90 lg:text-[var(--pl-ink)] lg:backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="-ml-1 rounded-full p-2.5 lg:hidden cursor-pointer">
              <Menu size={19} strokeWidth={1.6} />
            </button>
            <NavLink to="/" className="lg:hidden" aria-label="Twofold, home"><Logo dark /></NavLink>

            <button
              onClick={() => setCmdOpen(true)}
              className="ml-auto hidden h-10 w-60 items-center gap-2.5 rounded-[2px] border border-[var(--pl-line)] bg-[var(--pl-card)] px-3 text-[13.5px] text-[var(--pl-ink-2)] transition hover:border-[rgb(28_26_23/.3)] hover:text-[var(--pl-ink)] lg:flex cursor-pointer"
            >
              <Search size={15} strokeWidth={1.6} />
              Search the plan
              <kbd className="ml-auto rounded-[2px] border border-[var(--pl-line)] px-1.5 py-0.5 font-sans text-[11px]">⌘K</kbd>
            </button>
            <button onClick={() => setCmdOpen(true)} aria-label="Search the plan" className="ml-auto rounded-full p-2.5 lg:hidden cursor-pointer">
              <Search size={18} strokeWidth={1.6} />
            </button>

            <SyncChip />

            <Reminders />

            {/* account */}
            <div className="relative">
              <button
                onClick={() => setAccountOpen((o) => !o)}
                aria-label="Account menu" aria-expanded={accountOpen}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pl-gold)] text-[12px] font-medium text-[var(--pl-onyx)] transition hover:brightness-105 cursor-pointer"
              >
                {user ? initials(user.name) : mode === "demo" ? "M·T" : "··"}
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <>
                    <motion.button className="fixed inset-0 z-40 cursor-default" exit={{ pointerEvents: "none" }} onClick={() => setAccountOpen(false)} aria-label="Close account menu" />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-[3px] bg-[var(--pl-card)] text-[var(--pl-ink)] shadow-glass"
                      role="menu" aria-label="Account"
                    >
                      <div className="px-4 py-4">
                        <p className="text-[0.92rem] font-extrabold text-ink">{user?.name ?? (mode === "demo" ? "Maya & Theo" : "Not signed in")}</p>
                        <p className="mt-0.5 truncate text-[0.72rem] font-semibold text-ink-mute">{user?.email ?? (mode === "demo" ? "demo couple session" : "Sign in to sync your plan")}</p>
                        <span className="mt-2.5 inline-block"><Pill tone="gold">{planLabel(db.plan)}</Pill></span>
                      </div>

                      {mode === "cloud" && weddingId && (
                        <div className="border-t border-ink/8 px-4 py-3.5">
                          <p className="text-[13px] font-medium text-ink-2">Invite your partner</p>
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
                        {mode === "cloud" && user && (
                          <>
                            <button
                              onClick={() => {
                                setAccountOpen(false);
                                downloadExport(db, user, weddingId);
                                toast("Your data is downloading", "Everything in your planner, as one JSON file.");
                              }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-bold text-ink transition hover:bg-ink/5 cursor-pointer"
                              role="menuitem"
                            >
                              <Download size={15} /> Export my data
                            </button>
                            <button
                              onClick={() => { setAccountOpen(false); setDeleteConfirm(""); setDeleteError(null); setDeleteInfo(true); }}
                              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-bold text-ink transition hover:bg-ink/5 cursor-pointer"
                              role="menuitem"
                            >
                              <Trash2 size={15} /> Delete my account
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { setAccountOpen(false); void leave("Your plan is saved — see you soon."); }}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[0.84rem] font-bold text-ink transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"
                          role="menuitem"
                        >
                          <LogOut size={15} /> {leaveLabel}
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* the journey line: how far through the plan you are */}
          <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10 lg:bg-[rgb(28_26_23/.06)]" aria-hidden="true">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-[var(--pl-gold)]"
            />
          </div>
        </header>

        <main
          className={
            location.pathname.startsWith("/planner/seating")
              ? "mx-auto w-full min-w-0 max-w-none px-3 py-4 pb-24 sm:px-5 lg:pb-5"
              : "mx-auto w-full min-w-0 max-w-6xl px-4 py-7 sm:px-8 pb-28 lg:pb-12"
          }
        >
          <Outlet />
        </main>
      </div>

      {/* mobile quick-action dock (not on seating, where the guest tray sits there) */}
      {!location.pathname.startsWith("/planner/seating") && <motion.button
        onClick={() => setDockOpen(true)}
        aria-label="Quick actions"
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--pl-gold)] text-[var(--pl-onyx)] shadow-[0_14px_30px_-12px_rgb(0_0_0/.6)] transition hover:brightness-105 lg:hidden cursor-pointer"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Plus size={22} />
      </motion.button>}

      <AnimatePresence>
        {dockOpen && (
          <motion.div className="fixed inset-0 z-[72] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}>
            <button className="absolute inset-0 cursor-default bg-ink/45 backdrop-blur-[2px]" onClick={() => setDockOpen(false)} aria-label="Close quick actions" />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="absolute inset-x-0 bottom-0 rounded-t-[14px] bg-[var(--pl-card)] p-5 shadow-glass"
              style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
              role="dialog" aria-modal="true" aria-label="Quick actions"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/15" aria-hidden="true" />
              <p className="mb-4 text-center font-display text-[24px] text-[var(--pl-ink)]">Quick actions</p>
              <div className="grid grid-cols-3 gap-2.5">
                {dockActions.map((a) => (
                  <button
                    key={a.label}
                    onClick={a.run}
                    className="flex flex-col items-center gap-2 rounded-[3px] border border-[var(--pl-line)] bg-[var(--pl-paper)]/60 px-2 py-4 text-[13px] text-[var(--pl-ink)] transition hover:border-[var(--pl-gold)] active:scale-95 cursor-pointer"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--pl-onyx)] text-[var(--pl-gold)]">{a.icon}</span>
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
        className="fixed inset-x-0 bottom-0 z-40 bg-[var(--pl-onyx)] lg:hidden"
        style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
        aria-label="Primary"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 px-2 pb-1 pt-1.5">
          {MODULES.slice(0, 5).map((m) => (
            <NavLink
              key={m.path}
              to={m.path ? `/planner/${m.path}` : "/planner"}
              end={m.end}
              className={({ isActive }) =>
                `flex min-h-12 flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors ${
                  isActive ? "text-[var(--pl-ivory)]" : "text-[var(--pl-ivory)]/55 hover:text-[var(--pl-ivory)]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <m.icon size={20} strokeWidth={1.6} className={isActive ? "text-[var(--pl-gold)]" : ""} />
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
