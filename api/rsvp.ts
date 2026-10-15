/**
 * POST /api/rsvp — the guest page's only way to answer an invitation.
 *
 * The anonymous submit_rsvp RPC let anyone with the link exhaust a
 * wedding's shared allowance (12 an hour) so real guests were turned away.
 * This function puts three checks in front of it:
 *  1. a Cloudflare Turnstile token, verified server-side (the secret never
 *     leaves this function);
 *  2. a per-visitor limit per wedding per hour, keyed by an HMAC of the IP —
 *     the raw IP is never stored;
 *  3. then submit_rsvp_verified with the service role, whose per-wedding
 *     ceiling is only a backstop.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/** answers per visitor per wedding per hour */
export const PER_VISITOR_LIMIT = 10;

const SOURCES = ["link", "whatsapp", "instagram", "messenger", "email"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RsvpInput {
  token: string | null;
  slug: string | null;
  name: string;
  answer: "yes" | "no";
  meal: string | null;
  note: string | null;
  source: (typeof SOURCES)[number];
  plusOne: string | null;
  plusOneMeal: string | null;
  turnstile: string;
}

/** Optional text: null when absent or empty, undefined when it isn't text or is too long. */
function optional(v: unknown, max: number): string | null | undefined {
  if (v == null || v === "") return null;
  return typeof v === "string" && v.length <= max ? v : undefined;
}

/**
 * Shape-check the body before spending a Turnstile verification or a
 * database call on it. The database enforces the same limits (0011); this
 * only rejects obvious junk early. Returns an error message, or the input.
 */
export function parseRsvp(body: unknown): RsvpInput | string {
  if (!body || typeof body !== "object") return "Expected a JSON body";
  const b = body as Record<string, unknown>;
  const token = typeof b.token === "string" && UUID.test(b.token) ? b.token : null;
  const slug = typeof b.slug === "string" && /^[a-z0-9-]{1,80}$/.test(b.slug) ? b.slug : null;
  if (!token && !slug) return "A wedding link is required";
  if (typeof b.name !== "string" || b.name.trim().length < 2 || b.name.length > 120) return "A name of 2 to 120 characters is required";
  if (b.answer !== "yes" && b.answer !== "no") return "Answer must be yes or no";
  const source = (SOURCES as readonly unknown[]).includes(b.source ?? "link") ? ((b.source ?? "link") as RsvpInput["source"]) : null;
  if (!source) return "Unknown source";
  if (typeof b.turnstile !== "string" || !b.turnstile || b.turnstile.length > 2048) return "Please complete the check";
  const meal = optional(b.meal, 80), note = optional(b.note, 1000), plusOne = optional(b.plusOne, 120), plusOneMeal = optional(b.plusOneMeal, 80);
  if (meal === undefined || note === undefined || plusOne === undefined || plusOneMeal === undefined) return "An answer is too long";
  return { token, slug, name: b.name, answer: b.answer, meal, note, source, plusOne, plusOneMeal, turnstile: b.turnstile };
}

/** HMAC of the visitor's IP: stable per visitor, useless if the table leaks. */
export const hashIp = (ip: string, key: string) => createHmac("sha256", key).update(ip).digest("hex");

/** The first address in x-forwarded-for is the client; Vercel sets it. */
export function clientIp(req: Pick<VercelRequest, "headers">): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  const real = req.headers["x-real-ip"];
  return first || (Array.isArray(real) ? real[0] : real) || "unknown";
}

/** Database error codes from 0011, as HTTP statuses and words a guest can act on. */
export function statusFor(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "P0001": return { status: 404, error: "We couldn't find this invitation. Check the link." };
    case "P0002": return { status: 429, error: "Lots of answers just now. Please try again in a few minutes." };
    case "P0003": return { status: 400, error: "Something in the answer wasn't accepted. Please check it and try again." };
    case "P0006": return { status: 403, error: "This invitation isn't open for RSVPs yet." };
    default: return { status: 500, error: "Your RSVP couldn't be sent. Please try again." };
  }
}

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") form.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const j = (await r.json()) as { success?: boolean };
    return j.success === true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !serviceKey) return res.status(500).json({ error: "RSVPs are not configured" });

  const input = parseRsvp(req.body);
  if (typeof input === "string") return res.status(400).json({ error: input });

  const ip = clientIp(req);
  if (!(await verifyTurnstile(secret, input.turnstile, ip))) {
    return res.status(403).json({ error: "We couldn't confirm you're a person. Please try the check again." });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: allowed, error: rateErr } = await admin.rpc("rsvp_rate_hit", {
    p_token: input.token, p_slug: input.slug, p_ip_hash: hashIp(ip, secret), p_limit: PER_VISITOR_LIMIT,
  });
  if (rateErr) {
    console.error("[rsvp] rate check failed:", rateErr.message);
    return res.status(500).json({ error: statusFor(undefined).error });
  }
  if (allowed === false) return res.status(429).json({ error: statusFor("P0002").error });

  const { error } = await admin.rpc("submit_rsvp_verified", {
    p_token: input.token, p_slug: input.slug, p_name: input.name, p_answer: input.answer,
    p_meal: input.meal, p_note: input.note, p_source: input.source,
    p_plus_one: input.plusOne, p_plus_one_meal: input.plusOneMeal,
  });
  if (error) {
    const out = statusFor(error.code);
    if (out.status === 500) console.error("[rsvp] submit failed:", error.code, error.message);
    return res.status(out.status).json({ error: out.error });
  }
  return res.status(200).json({ ok: true });
}
