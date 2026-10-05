/**
 * GET /api/geo — the visitor's country, for picking a default currency.
 *
 * Reads only the country code Vercel adds to every request. Nothing is
 * stored or logged, and no IP address leaves this function.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const raw = req.headers["x-vercel-ip-country"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const country = typeof value === "string" && /^[A-Z]{2}$/i.test(value) ? value.toUpperCase() : null;
  // per visitor, so never shared through a CDN cache
  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({ country });
}
