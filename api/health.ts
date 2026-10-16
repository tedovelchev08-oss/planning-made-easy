/**
 * GET /api/health — is Luma able to serve guests and couples right now?
 *
 * Asks Supabase one trivial question with the PUBLIC anon key: the guest
 * page's own get_public_wedding RPC for a slug that can never exist. Any
 * answer (null) proves the database, the API gateway and the anon role all
 * work; a timeout or an error means guests can't open invitations either.
 *
 * 200 { status: "ok" } or 503 { status: "unavailable" }. The response never
 * carries keys, URLs or error details: point an uptime monitor at it.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/** Longer than a healthy round trip (~100 ms), shorter than a monitor's timeout. */
export const TIMEOUT_MS = 4000;

/** Can't be a real slug: slugs are lowercase letters, digits and hyphens. */
const PROBE_SLUG = "__health__";

export async function supabaseAnswers(url: string, anonKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/get_public_wedding`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: PROBE_SLUG }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false; // timeout, DNS, connection refused
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }
  // a monitor must see the live state, never a cached one
  res.setHeader("Cache-Control", "no-store");

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const ok = !!url && !!anonKey && (await supabaseAnswers(url, anonKey));

  if (!ok) console.error("[health] Supabase did not answer", { configured: !!url && !!anonKey });
  return res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "unavailable" });
}
