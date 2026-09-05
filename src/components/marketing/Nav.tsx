import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "../ui";
import { useApp } from "../../lib/store";

const LINKS = [
  { label: "Features", id: "features" },
  { label: "How it works", id: "how" },
  { label: "Pricing", id: "pricing" },
  { label: "Stories", id: "stories" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuthOpen, user } = useApp();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 28);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // lock page scroll while the full-screen mobile menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const goSection = (id: string) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 380);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 sm:px-5">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full border transition-all duration-500 ${
          scrolled
            ? "mt-2 border-white/70 bg-white/75 py-2 pl-5 pr-2.5 shadow-card backdrop-blur-xl"
            : "mt-4 border-white/55 bg-white/45 py-3 pl-6 pr-3 backdrop-blur-md"
        }`}
      >
        <Link to="/" aria-label="Luma home" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => goSection(l.id)}
              className="group relative text-small font-semibold text-ink-2 transition hover:text-ink cursor-pointer"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-blush-deep transition-all duration-300 group-hover:w-full" />
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuthOpen(true)}
            className="hidden rounded-full px-4 py-2 text-small font-semibold text-ink-2 transition hover:bg-ink/5 hover:text-ink sm:block cursor-pointer"
          >
            {user ? user.name.split(" ")[0] : "Sign in"}
          </button>
          <Link
            to="/planner"
            className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-small font-bold text-cream transition-all duration-300 hover:bg-ink/85 hover:shadow-lift active:scale-95"
          >
            Open planner
            <ArrowUpRight size={14} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <button
            className="rounded-full p-2 text-ink md:hidden cursor-pointer"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex flex-col bg-ink px-8 py-7 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between">
              <Logo dark />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-full bg-cream/10 p-2.5 text-cream cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <nav className="mt-16 flex flex-col gap-2" aria-label="Mobile">
              {LINKS.map((l, i) => (
                <motion.button
                  key={l.id}
                  initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  onClick={() => goSection(l.id)}
                  className="text-left font-display text-4xl text-cream/90 transition hover:text-blush cursor-pointer"
                >
                  {l.label}
                </motion.button>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
              className="mt-auto flex flex-col gap-3"
            >
              <Link to="/planner" onClick={() => setOpen(false)} className="rounded-full bg-blush px-6 py-4 text-center font-bold text-ink">
                Open planner →
              </Link>
              <button onClick={() => { setOpen(false); setAuthOpen(true); }} className="rounded-full border border-cream/25 px-6 py-4 font-semibold text-cream cursor-pointer">
                {user ? `Signed in as ${user.name.split(" ")[0]}` : "Sign in"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
