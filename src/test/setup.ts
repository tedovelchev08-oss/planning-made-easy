import "@testing-library/jest-dom/vitest";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* ---- browser APIs jsdom does not provide ---- */

// useMediaQuery / usePrefersReducedMotion read matchMedia
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

// Reveal / SiteBody use whileInView → IntersectionObserver
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class IO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = () => [];
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  Object.defineProperty(window, "IntersectionObserver", { writable: true, value: IO });
}

// ResizeObserver (framer-motion layout measurements)
if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
  class RO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
  Object.defineProperty(window, "ResizeObserver", { writable: true, value: RO });
}

// scrollIntoView is called by the tracker, guests and the guest page
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

// CSV export uses object URLs
if (typeof URL.createObjectURL !== "function") {
  Object.defineProperty(URL, "createObjectURL", { writable: true, value: vi.fn(() => "blob:mock") });
}
if (typeof URL.revokeObjectURL !== "function") {
  Object.defineProperty(URL, "revokeObjectURL", { writable: true, value: vi.fn() });
}

// clipboard (share links) — tests override per-case as needed
if (typeof navigator !== "undefined" && !navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    writable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined), readText: vi.fn().mockResolvedValue("") },
  });
}
