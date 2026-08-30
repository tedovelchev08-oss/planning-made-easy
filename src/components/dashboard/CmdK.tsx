import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  Armchair, BellRing, Check, Clock3, CornerDownLeft, ExternalLink, Gift, Globe,
  LayoutDashboard, Link2, Search, Store, Users, Wallet,
} from "lucide-react";
import { inviteLink, useApp } from "../../lib/store";
import { playChime } from "../../lib/sound";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  run: () => void;
}

const MODULES: { path: string; label: string; icon: React.ReactNode }[] = [
  { path: "/planner", label: "Dashboard", icon: <LayoutDashboard size={15} /> },
  { path: "/planner/guests", label: "Guest List", icon: <Users size={15} /> },
  { path: "/planner/budget", label: "Budget", icon: <Wallet size={15} /> },
  { path: "/planner/timeline", label: "Timeline", icon: <Clock3 size={15} /> },
  { path: "/planner/vendors", label: "Vendors", icon: <Store size={15} /> },
  { path: "/planner/seating", label: "Seating", icon: <Armchair size={15} /> },
  { path: "/planner/registry", label: "Registry", icon: <Gift size={15} /> },
  { path: "/planner/page", label: "Wedding Page", icon: <Globe size={15} /> },
];

export default function CmdK({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, setDb, toast } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const ql = q.trim().toLowerCase();

  const items = useMemo<Item[]>(() => {
    const nav = (to: string) => () => { navigate(to); onClose(); };
    const link = inviteLink(db.wedding.names);
    const out: Item[] = [];

    // quick actions — always useful
    const actions: Item[] = [
      {
        id: "a-link", group: "Actions", label: "Copy invitation link", hint: link.replace("https://", ""), icon: <Link2 size={15} />,
        run: () => {
          navigator.clipboard?.writeText(link).then(
            () => toast("Link copied", "Send it anywhere — WhatsApp, Instagram, a group chat.", "info"),
            () => toast("Your link", link, "info"),
          );
          onClose();
        },
      },
      { id: "a-guest", group: "Actions", label: "Open the guest page", hint: "what guests see", icon: <ExternalLink size={15} />, run: () => { window.location.hash = "#/invite"; onClose(); } },
      { id: "a-rsvps", group: "Actions", label: "Review new RSVPs", hint: "link answers waiting", icon: <BellRing size={15} />, run: nav("/planner/page?tab=rsvp") },
    ];
    out.push(...actions.filter((a) => !ql || a.label.toLowerCase().includes(ql)));

    // modules
    out.push(...MODULES.filter((m) => !ql || m.label.toLowerCase().includes(ql)).map((m) => ({
      id: `m-${m.path}`, group: "Jump to", label: m.label, icon: m.icon, run: nav(m.path),
    })));

    // complete a task without leaving the keyboard
    if (ql) {
      out.push(...db.tasks.filter((t) => !t.done && t.title.toLowerCase().includes(ql)).slice(0, 4).map((t) => ({
        id: `t-${t.id}`, group: "Tasks", label: `Complete “${t.title}”`, icon: <Check size={15} />,
        run: () => {
          setDb((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: true } : x)) }));
          playChime("done");
          toast("Task complete", t.title);
          onClose();
        },
      })));

      // guests — jump to the list with the search pre-filled
      out.push(...db.guests.filter((g) => g.name.toLowerCase().includes(ql)).slice(0, 5).map((g) => ({
        id: `g-${g.id}`, group: "Guests", label: g.name, hint: `${g.rsvp}${g.meal ? ` · ${g.meal}` : ""}`, icon: <Users size={15} />,
        run: () => {
          window.dispatchEvent(new CustomEvent("luma:guest-focus", { detail: g.name }));
          navigate("/planner/guests");
          onClose();
        },
      })));

      // vendors
      out.push(...db.vendors.filter((v) => (v.company + " " + v.category).toLowerCase().includes(ql)).slice(0, 4).map((v) => ({
        id: `v-${v.id}`, group: "Vendors", label: v.company, hint: `${v.category} · ${v.status}`, icon: <Store size={15} />,
        run: () => {
          window.dispatchEvent(new CustomEvent("luma:vendor-focus", { detail: v.company }));
          navigate("/planner/vendors");
          onClose();
        },
      })));
    }

    return out;
  }, [ql, db, navigate, onClose, setDb, toast]);

  useEffect(() => setActive(0), [ql]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && items[active]) { e.preventDefault(); items[active].run(); }
  };

  let lastGroup = "";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[85]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[3px]" onClick={onClose} aria-label="Close search" />
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute left-1/2 top-[12vh] w-[min(94vw,620px)] -translate-x-1/2 overflow-hidden rounded-[1.4rem] border border-white/70 bg-cream/95 shadow-glass backdrop-blur-2xl"
            role="dialog" aria-modal="true" aria-label="Command palette"
          >
            <div className="flex items-center gap-3 border-b border-ink/8 px-5 py-4">
              <Search size={17} className="shrink-0 text-gold-deep" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Search guests, vendors, tasks — or jump anywhere…"
                className="w-full bg-transparent text-[0.95rem] text-ink placeholder:text-ink-mute/70 focus:outline-none"
                aria-label="Command palette search"
              />
              <kbd className="hidden shrink-0 rounded-md border border-ink/15 px-1.5 py-0.5 text-[0.62rem] font-extrabold text-ink-mute sm:block">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-[0.85rem] font-semibold text-ink-mute">
                  Nothing matches “{q}” — try a guest, a vendor, or a task.
                </p>
              )}
              {items.map((it, i) => {
                const showGroup = it.group !== lastGroup;
                lastGroup = it.group;
                return (
                  <React.Fragment key={it.id}>
                    {showGroup && (
                      <p className="px-3 pb-1 pt-2.5 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">{it.group}</p>
                    )}
                    <button
                      data-idx={i}
                      onClick={it.run}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors cursor-pointer ${i === active ? "bg-ink text-cream" : "text-ink hover:bg-ink/5"}`}
                    >
                      <span className={i === active ? "text-gold" : "text-gold-deep"}>{it.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.88rem] font-bold">{it.label}</span>
                        {it.hint && <span className={`block truncate text-[0.68rem] font-semibold ${i === active ? "text-cream/60" : "text-ink-mute"}`}>{it.hint}</span>}
                      </span>
                      {i === active && <CornerDownLeft size={13} className="shrink-0 text-cream/60" />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex items-center gap-4 border-t border-ink/8 px-5 py-2.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span className="ml-auto normal-case tracking-normal">esc to close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
