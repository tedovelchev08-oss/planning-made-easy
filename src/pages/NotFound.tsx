import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Compass, HeartHandshake } from "lucide-react";
import { Logo } from "../components/ui";
import { usePrefersReducedMotion } from "../lib/store";

/** Top-level 404 for any unrecognised hash route. */
export default function NotFound() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden">
      <span className="inv-petal" style={{ left: "16%", animationDuration: "12s" }} aria-hidden="true" />
      <span className="inv-petal" style={{ left: "52%", animationDuration: "14s", animationDelay: "3s" }} aria-hidden="true" />
      <span className="inv-petal" style={{ left: "81%", animationDuration: "11s", animationDelay: "6s" }} aria-hidden="true" />

      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Link to="/" aria-label="Luma home"><Logo /></Link>
        <Link
          to="/planner"
          className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white/60 px-5 py-2.5 text-[0.8rem] font-bold text-ink backdrop-blur transition hover:border-ink/45"
        >
          <HeartHandshake size={14} className="text-blush-deep" /> Open planner
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="text-[0.66rem] font-extrabold uppercase tracking-[0.32em] text-gold-deep"
        >
          Off the seating chart
        </motion.p>
        <motion.h1
          initial={reduced ? false : { opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 font-display text-[6rem] leading-none tracking-tight text-ink sm:text-[9rem]"
        >
          4<span className="text-blush-deep">0</span>4
        </motion.h1>
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-md font-display text-2xl italic leading-snug text-ink-2 sm:text-3xl"
        >
          This page wasn't on the guest list.
        </motion.p>
        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.34 }}
          className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-ink-mute"
        >
          The address may have changed, or the link lost a letter on the way. Either way —
          everything worth finding is one tap away.
        </motion.p>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 rounded-full bg-ink px-8 py-4 text-[0.92rem] font-bold text-cream shadow-lift transition-all duration-300 hover:bg-ink/85 active:scale-[0.97]"
          >
            Back to Luma
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 rounded-full border border-ink/20 bg-white/50 px-7 py-4 text-[0.92rem] font-bold text-ink backdrop-blur transition-all duration-300 hover:border-ink/45 hover:bg-white/80"
          >
            <Compass size={16} className="text-sage-deep" /> Into the planner
          </Link>
        </motion.div>
      </main>

      <p className="pb-8 text-center text-[0.66rem] font-bold uppercase tracking-[0.3em] text-ink-mute/60">
        luma · plan the feeling
      </p>
    </div>
  );
}
