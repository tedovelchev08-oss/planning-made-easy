/**
 * Every address the app hands to a guest or a customer comes from here.
 *
 * The app used to build links on a parked domain we don't serve,
 * so guests who got a shared link landed on a parking page. One builder means
 * one place to change when a real custom domain exists.
 */

/** Where people write for help. It must be a mailbox that actually receives mail. */
export const SUPPORT_EMAIL = "lumaplanning.support@gmail.com";

/**
 * The public origin of the site, without a trailing slash.
 * VITE_PUBLIC_SITE_URL pins it for production; without it (local dev,
 * preview deployments) links point at whatever origin is serving the app,
 * which is the one address guaranteed to work there.
 */
export function siteUrl(): string {
  const pinned = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim();
  const base = pinned || (typeof window !== "undefined" ? window.location.origin : "");
  return base.replace(/\/+$/, "");
}

/** The site's host, for display: "planning-made-easy.vercel.app". */
export const siteHost = () => siteUrl().replace(/^https?:\/\//, "");

/**
 * The guest page for a couple.
 *  · { slug }  — the open link anyone can be sent
 *  · { token } — one guest's personal link, their name arrives pre-filled
 *  · {}        — demo mode, which has no slug and renders the local sample
 * `src` records where the link was shared, for the RSVP tracker.
 */
export function guestLink(to: { slug?: string; token?: string; src?: string } = {}): string {
  const q = new URLSearchParams();
  if (to.token) q.set("token", to.token);
  else if (to.slug) q.set("slug", to.slug);
  if (to.src && (to.token || to.slug)) q.set("src", to.src);
  const qs = q.toString();
  return `${siteUrl()}/#/invite${qs ? `?${qs}` : ""}`;
}
