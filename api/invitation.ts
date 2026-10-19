/**
 * GET /api/invitation?slug=… | ?token=…: what one of the owner's own
 * invitation designs (public/designs/<id>/) needs to show a couple's
 * invitation (Block 18).
 *
 * It reads the same public payload the guest page does (get_public_wedding,
 * with the public anon key, so row-level security and the "open to guests"
 * flag apply exactly as before) and returns it already shaped as the
 * design's `invitationData`. A personal link (?token=) also returns the
 * guest's name, to prefill the RSVP form.
 *
 *   200 { status: "live", design, invitation, guest?, turnstileSiteKey }
 *   200 { status: "closed" } · 404 { status: "missing" }
 *   409 { status: "other-design" } when the wedding doesn't use a studio
 *       design (or its plan doesn't include it): the page sends the guest
 *       back to Luma's own invitation page.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { planAllows, studioDesignOf, toInvitationData, type PublicWedding } from "./_lib/studioDesigns";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9-]{1,80}$/;

async function rpc<T>(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status}`);
  return (await res.json()) as T | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  // per guest and per moment (the couple can close it at any time)
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(500).json({ error: "Invitations are not configured" });

  const token = typeof req.query.token === "string" && UUID.test(req.query.token) ? req.query.token : null;
  let slug = typeof req.query.slug === "string" && SLUG.test(req.query.slug) ? req.query.slug : null;
  if (!token && !slug) return res.status(400).json({ error: "A wedding link is required" });

  try {
    let guest: { name: string } | null = null;
    if (token) {
      const g = await rpc<{ name: string; slug: string }>(url, anon, "get_guest_by_token", { p_token: token });
      if (!g) return res.status(404).json({ status: "missing" });
      guest = { name: g.name };
      slug = g.slug;
    }

    const pub = await rpc<PublicWedding & { live?: boolean }>(url, anon, "get_public_wedding", { p_slug: slug });
    if (!pub) return res.status(404).json({ status: "missing" });
    if (pub.live === false) return res.status(200).json({ status: "closed" });

    const design = studioDesignOf(pub.invitation?.template_id);
    if (!design || !planAllows(pub.plan, design)) return res.status(409).json({ status: "other-design" });

    return res.status(200).json({
      status: "live",
      design: design.id,
      slug: pub.slug,
      invitation: toInvitationData(pub, design),
      guest,
      turnstileSiteKey: process.env.VITE_TURNSTILE_SITE_KEY ?? null,
    });
  } catch (err) {
    console.error("[invitation] failed:", (err as Error).message);
    return res.status(502).json({ error: "The invitation couldn't be loaded. Please try again." });
  }
}
