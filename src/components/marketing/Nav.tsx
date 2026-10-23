import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Logo } from "../ui";
import { useApp } from "../../lib/store";
import { TESTIMONIALS } from "../../lib/data";

// Stories only appears while there are real testimonials to link to —
// otherwise the link scrolls to a section that does not render.
const LINKS = [
  { label: "Invitations", id: "invitations" },
  { label: "For your guests", id: "guests" },
  { label: "Pricing", id: "pricing" },
  ...(TESTIMONIALS.length > 0 ? [{ label: "Stories", id: "stories" }] : []),
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuth, user } = useApp();

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
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${scrolled ? "border-b border-[#3a342b] bg-onyx/92 backdrop-blur" : "border-b border-transparent"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:py-5">
        <Link to="/" aria-label="Twofold home" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Logo dark />
        </Link>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Primary">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => goSection(l.id)}
              className="text-[12px] uppercase tracking-[0.2em] text-ivory/70 transition hover:text-ivory cursor-pointer"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => (user ? navigate("/planner") : openAuth())}
            className="hidden text-[12px] uppercase tracking-[0.2em] text-ivory/70 transition hover:text-ivory sm:block cursor-pointer"
          >
            {user ? user.name.split(" ")[0] : "Sign in"}
          </button>
          <Link
            to="/planner"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[2px] bg-champagne px-3.5 py-3 text-[11px] font-medium uppercase tracking-[0.18em] text-onyx transition-colors duration-300 hover:bg-[#d8b97c] sm:px-4"
          >
            {user ? "Open planner" : "Start free"}
            <ArrowUpRight size={13} aria-hidden="true" className="hidden sm:block" />
          </Link>
          <button
            className="p-2 text-ivory md:hidden cursor-pointer"
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
            className="fixed inset-0 z-[70] flex flex-col bg-onyx px-8 py-7 md:hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }}
          >
            <div className="flex items-center justify-between">
              <Logo dark />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="p-2.5 text-ivory cursor-pointer">
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
                  className="text-left font-display text-4xl text-ivory/90 transition hover:text-champagne cursor-pointer"
                >
                  {l.label}
                </motion.button>
              ))}
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
              className="mt-auto flex flex-col gap-3"
            >
              <Link to="/planner" onClick={() => setOpen(false)} className="rounded-[2px] bg-champagne px-6 py-4 text-center text-[12px] font-medium uppercase tracking-[0.2em] text-onyx">
                {user ? "Open planner" : "Start free"}
              </Link>
              <button onClick={() => { setOpen(false); if (user) navigate("/planner"); else openAuth(); }} className="rounded-[2px] border border-ivory/25 px-6 py-4 text-[12px] uppercase tracking-[0.2em] text-ivory cursor-pointer">
                {user ? `Signed in as ${user.name.split(" ")[0]}` : "Sign in"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
