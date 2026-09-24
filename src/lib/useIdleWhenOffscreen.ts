import { useEffect, useRef } from "react";

/**
 * Decorative loops (petals, bobbing shapes, slow spins) otherwise run from
 * first paint for the whole session, including inside sections the visitor
 * never scrolls to. This parks them until their section is actually on screen.
 *
 * Returns a ref to put on the wrapper. The wrapper carries `.motion-idle`,
 * which pauses every animation beneath it; the class is removed while the
 * element intersects the viewport.
 *
 * Motion itself is unchanged — this only decides when it is allowed to run, so
 * it composes with the prefers-reduced-motion rules in index.css rather than
 * replacing them.
 */
export function useIdleWhenOffscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No IntersectionObserver (or a test environment): leave motion running
    // rather than freezing it permanently.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.remove("motion-idle");
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle("motion-idle", !entry.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return ref;
}
