import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Armchair, CalendarDays, Gift, Globe, LayoutDashboard, LogOut, Menu,
  Sparkles, Store, Users, Wallet, X, Clock3, Crown,
} from "lucide-react";
import { Logo, Drawer, Pill } from "../ui";
import { useApp, useStats } from "../../lib/store";
import { fmtDateShort } from "../../lib/data";

const MODULES = [
  { path: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "guests", label: "Guest List", icon: Users },
  { path: "budget", label: "Budget", icon: Wallet },
  { path: "timeline", label: "Timeline", icon: Clock3 },
  { path: "vendors", label: "Vendors", icon: Store },
  { path: "seating", label: "Seating", icon: Armchair },
  { path: "registry", label: "Registry", icon: Gift },
  { path: "page", label: "Wedding Page", icon: Globe },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { db, user, signOut, setAuthOpen, openCheckout } = useApp();
  const stats = useStats();

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Planner modules">
      {MODULES.map((m) => (
        <NavLink
          key={m.path}
          to={`/planner/${m.path}`}
          end={m.end as boolean | undefined}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[0.88rem] font-semibold transition-all duration-300 ${
              isActive
                ? "bg-ink text-cream shadow-card"
                : "text-ink-2 hover:bg-white/80 hover:text-ink"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <m.icon size={17} className={isActive ? "text-gold" : "text-ink-mute group-hover:text-ink"} />
              {m.label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blush" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-full flex-col p-5">
      <Link to="/" className="inline-flex w-fit items-center" aria-label="Back to luma home">
        <Logo />
      </Link>

      <div className="mt-6 rounded-[1.4rem] border border-white/70 bg-white/60 p-4 shadow-sm">
        <p className="font-display text-[1.05rem] leading-tight text-ink">{db.wedding.names}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] font-semibold text-ink-mute">
          <CalendarDays size={12} className="text-blush-deep" /> {fmtDateShort(db.wedding.date)}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full bg-gradient-to-r from-sage to-gold" style={{ width: `${stats.progressPct}%` }} />
          </div>
          <span className="ml-2.5 text-[0.68rem] font-extrabold text-ink">{stats.progressPct}%</span>
        </div>
      </div>

      <div className="mt-6 flex-1">{nav}</div>

      <div className="rounded-[1.4rem] border border-gold/25 bg-gold-soft/40 p-4">
        <p className="flex items-center gap-1.5 text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-gold-deep">
          <Crown size={12} /> {db.plan === "essential" ? "Essential" : db.plan === "celebration" ? "Celebration" : "Premium Luxe"}
        </p>
        {db.plan !== "luxe" ? (
          <>
            <p className="mt-1.5 text-[0.78rem] leading-snug text-ink-2">Animated invitations & full website are a tap away.</p>
            <button onClick={() => { openCheckout("luxe"); onNavigate?.(); }} className="mt-3 w-full rounded-full bg-ink py-2 text-[0.78rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer">
              Upgrade to Luxe
            </button>
          </>
        ) : (
          <p className="mt-1.5 flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-2"><Sparkles size={12} className="text-gold-deep" /> Every feature unlocked. Enjoy.</p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-ink/8 pt-4">
        {user ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-[0.8rem] font-bold text-ink">{user.name}</p>
              <p className="truncate text-[0.68rem] text-ink-mute">{user.email}</p>
            </div>
            <button onClick={() => { signOut(); onNavigate?.(); }} aria-label="Sign out" className="rounded-full p-2 text-ink-mute transition hover:bg-ink/5 hover:text-ink cursor-pointer">
              <LogOut size={15} />
            </button>
          </>
        ) : (
          <button onClick={() => { setAuthOpen(true); onNavigate?.(); }} className="w-full rounded-full border border-ink/15 py-2 text-[0.8rem] font-bold text-ink transition hover:bg-ink hover:text-cream cursor-pointer">
            Sign in
          </button>
        )}
      </div>
    </div>
  );
}

export default function Shell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { db, user } = useApp();
  const stats = useStats();
  const current = MODULES.find((m) => (m.path === "" ? location.pathname === "/planner" || location.pathname === "/planner/" : location.pathname.startsWith(`/planner/${m.path}`)));

  return (
    <div className="min-h-screen bg-parchment/60">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] border-r border-white/70 bg-cream/80 backdrop-blur-xl lg:block">
        <SidebarContent />
      </aside>

      {/* mobile drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Planner navigation">
        <div className="flex justify-end p-4">
          <button onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="rounded-full bg-ink/5 p-2 text-ink cursor-pointer"><X size={16} /></button>
        </div>
        <SidebarContent onNavigate={() => setDrawerOpen(false)} />
      </Drawer>

      <div className="lg:pl-[250px]">
        {/* topbar */}
        <header className="sticky top-0 z-30 border-b border-white/60 bg-cream/75 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-8">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open navigation" className="rounded-full border border-ink/12 bg-white/70 p-2.5 text-ink lg:hidden cursor-pointer">
              <Menu size={17} />
            </button>
            <div className="min-w-0">
              <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Luma planner</p>
              <h1 className="truncate font-display text-xl leading-tight text-ink">{current?.label ?? "Dashboard"}</h1>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <Pill tone="gold" className="hidden sm:inline-flex">{stats.days} days to go</Pill>
              <Pill tone="pending" className="hidden md:inline-flex">{db.wedding.venue}</Pill>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-[0.8rem] italic text-cream" aria-label={user ? user.name : "Maya and Theo"}>
                {user ? user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "M&T"}
              </span>
            </div>
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

      {/* mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-cream/90 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Quick modules"
      >
        <div className="flex items-center justify-around px-2 py-2">
          {MODULES.slice(0, 4).map((m) => (
            <NavLink
              key={m.path} to={`/planner/${m.path}`} end={m.end as boolean | undefined}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[0.6rem] font-bold transition ${isActive ? "text-ink bg-white shadow-sm" : "text-ink-mute"}`}
            >
              <m.icon size={17} />
              {m.label.split(" ")[0]}
            </NavLink>
          ))}
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[0.6rem] font-bold text-ink-mute cursor-pointer">
            <Menu size={17} />
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>{false && <motion.div />}</AnimatePresence>
    </div>
  );
}
