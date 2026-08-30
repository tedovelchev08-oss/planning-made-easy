import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Globe, Heart, Lock } from "lucide-react";
import { useApp, usePrefersReducedMotion } from "../lib/store";
import { Logo } from "../components/ui";
import { SiteBody } from "../components/dashboard/Website";

/**
 * The public wedding website — what guests see when they visit the couple's
 * domain (here mirrored at #/site). Distinct from #/invite, which is the
 * personal RSVP card.
 */
export default function GuestSite() {
  const { db, toast } = useApp();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const [countdown, setCountdown] = useState(() => daysUntil(db.wedding.date));

  useEffect(() => {
    document.title = `${db.wedding.names} — Wedding`;
    const id = window.setInterval(() => setCountdown(daysUntil(db.wedding.date)), 60000);
    return () => window.clearInterval(id);
  }, [db.wedding.date, db.wedding.names]);

  const w = db.website;
  const anim = db.plan === "luxe" && w.animations && !reduced;

  if (!w.published) {
    return (
      <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <span className="inv-petal" style={{ left: "18%", animationDuration: "11s" }} aria-hidden="true" />
        <span className="inv-petal" style={{ left: "48%", animationDuration: "13s", animationDelay: "2s" }} aria-hidden="true" />
        <span className="inv-petal" style={{ left: "76%", animationDuration: "10s", animationDelay: "4s" }} aria-hidden="true" />
        <motion.div initial={reduced ? false : { opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="max-w-md">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold/50 bg-white/70 text-gold-deep shadow-card backdrop-blur">
            <Lock size={22} />
          </span>
          <h1 className="mt-6 font-display text-4xl tracking-tight text-ink">
            {db.wedding.names}<span className="text-blush-deep">’s</span> site
          </h1>
          <p className="mt-3 font-display text-lg italic text-ink-2">is still being written.</p>
          <p className="mt-4 text-[0.9rem] leading-relaxed text-ink-2">
            The couple hasn't published their wedding website yet. Check back soon —
            or head to the invitation for the essentials and RSVP.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/invite" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[0.88rem] font-bold text-cream transition hover:bg-ink/85 active:scale-[0.97]">
              Open the invitation <ArrowRight size={14} />
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/60 px-5 py-3 text-[0.88rem] font-bold text-ink transition hover:border-ink/45">
              Made with <Logo className="scale-75" />
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100svh]">
      {/* floating couple bar */}
      <motion.header
        initial={reduced ? false : { opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3 sm:px-6"
      >
        <div className="glass flex items-center gap-2.5 rounded-full py-2 pl-4 pr-2.5 shadow-card">
          <span className="font-display text-[0.95rem] italic text-ink">{db.wedding.names}</span>
          <span className="rounded-full bg-ink px-3 py-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-cream">
            {countdown} days
          </span>
        </div>
        <Link
          to="/invite"
          className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[0.76rem] font-extrabold text-blush-deep shadow-card transition hover:scale-[1.03]"
        >
          <Heart size={13} fill="#E98BA0" className="text-blush-deep" /> RSVP
        </Link>
      </motion.header>

      <main>
        <SiteBody w={w} db={db} anim={anim} onRsvp={() => navigate("/invite")} />
      </main>

      {/* footer bridge back to Luma */}
      <div className="flex items-center justify-center gap-3 bg-ink px-6 py-5">
        <Globe size={13} className="text-gold" />
        <p className="text-[0.72rem] font-semibold text-cream/60">
          {w.domain} · planned calmly with
        </p>
        <Link to="/" aria-label="Luma — plan the feeling"><Logo dark /></Link>
      </div>
    </div>
  );
}

function daysUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
