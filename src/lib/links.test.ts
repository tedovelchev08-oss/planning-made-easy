import { describe, it, expect, vi, afterEach } from "vitest";
import { guestLink, siteHost, siteUrl } from "./links";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("falls back to the origin serving the app", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "");
    expect(siteUrl()).toBe(window.location.origin);
  });

  it("uses the pinned public URL, without a trailing slash", () => {
    vi.stubEnv("VITE_PUBLIC_SITE_URL", "https://planning-made-easy.vercel.app/");
    expect(siteUrl()).toBe("https://planning-made-easy.vercel.app");
    expect(siteHost()).toBe("planning-made-easy.vercel.app");
  });
});

describe("guestLink — every link resolves to the real guest route", () => {
  const base = () => `${window.location.origin}/#/invite`;

  it("builds the open link from a slug", () => {
    expect(guestLink({ slug: "maya-theo" })).toBe(`${base()}?slug=maya-theo`);
  });

  it("builds a personal link from a token, and prefers it over a slug", () => {
    expect(guestLink({ token: "abc" })).toBe(`${base()}?token=abc`);
    expect(guestLink({ slug: "maya-theo", token: "abc" })).toBe(`${base()}?token=abc`);
  });

  it("tags the share channel", () => {
    expect(guestLink({ slug: "maya-theo", src: "whatsapp" })).toBe(`${base()}?slug=maya-theo&src=whatsapp`);
  });

  it("gives demo mode, which has no slug, the local guest page", () => {
    expect(guestLink()).toBe(base());
    expect(guestLink({ src: "whatsapp" })).toBe(base());
  });

  it("encodes a slug safely", () => {
    expect(guestLink({ slug: "a&b" })).toBe(`${base()}?slug=a%26b`);
  });
});

describe("no link to the parked domain anywhere in src", () => {
  // Built from parts so this guard does not match itself.
  const parked = ["luma", "love"].join(".");
  const files = import.meta.glob("../**/*.{ts,tsx,css,html}", { query: "?raw", import: "default", eager: true });

  it("scans the source tree", () => {
    expect(Object.keys(files).length).toBeGreaterThan(20);
  });

  it.each(Object.entries(files))("%s", (_path, text) => {
    expect(text as string).not.toContain(parked);
  });
});
