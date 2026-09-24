/**
 * POST /api/create-checkout — creates a one-time Stripe Checkout session
 * for one of the three tiers and returns `{ url }` for the client to
 * redirect to. No subscriptions, ever.
 *
 * Security notes:
 *  · The caller's Supabase JWT is verified HERE (service-role client), and
 *    the *verified* user id is stamped into session metadata — the client
 *    can never claim an entitlement for someone else's account.
 *  · STRIPE_SECRET_KEY never leaves this function; the client only receives
 *    the hosted Checkout URL.
 *  · Prices are bootstrapped lazily via Stripe `lookup_key`s
 *    (luma_essential / luma_celebration / luma_luxe), so no dashboard setup
 *    is required and prices are reused across sessions.
 *  · The entitlement itself is granted ONLY by api/stripe-webhook.ts when
 *    Stripe confirms payment — this endpoint grants nothing.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const TIERS: Record<string, { name: string; amount: number }> = {
  essential: { name: "Luma — Essential Planner", amount: 4900 },
  celebration: { name: "Luma — Celebration Suite", amount: 9900 },
  luxe: { name: "Luma — Premium Luxe", amount: 19900 },
};

const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
};

/** Find the tier's one-time price, creating product + price on first use. */
async function priceFor(s: Stripe, tier: string): Promise<string> {
  const lookupKey = `luma_${tier}`;
  // stripe-node v22 renamed the list filter to `lookup_keys` (array)
  const existing = await s.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const product = await s.products.create({
    name: TIERS[tier].name,
    metadata: { luma_tier: tier },
  });
  const price = await s.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: TIERS[tier].amount,
    lookup_key: lookupKey,
  });
  return price.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tier, wedding_id } = (req.body ?? {}) as { tier?: string; wedding_id?: string };
  if (!tier || !(tier in TIERS)) return res.status(400).json({ error: "Unknown tier" });
  if (!wedding_id) return res.status(400).json({ error: "Missing wedding_id" });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: "Supabase server env is not set" });

  // verify the caller with their own JWT — never trust a client-supplied id
  const authHeader = req.headers.authorization ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: "Missing authorization" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // getUser RETURNS { error } for a token it simply rejects, but THROWS for one
  // it cannot parse at all. Unguarded, a single curl with a junk bearer token
  // took the function down with a 500 FUNCTION_INVOCATION_FAILED — which is
  // also the exact signature of the Node-version outage in the handoff, so it
  // would send the next person reading these logs after entirely the wrong bug.
  let userId: string;
  try {
    const { data: authed, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !authed?.user) return res.status(401).json({ error: "Invalid session" });
    userId = authed.user.id;
  } catch {
    // Unparseable token. Same answer as a rejected one: the caller is not
    // authenticated, and which of the two it was is not their business.
    return res.status(401).json({ error: "Invalid session" });
  }

  // Verify the user is a member of this wedding (server-side check)
  const { data: membership, error: membershipErr } = await admin
    .from("wedding_members")
    .select("wedding_id")
    .eq("wedding_id", wedding_id)
    .eq("user_id", userId)
    .maybeSingle();
  
  if (membershipErr || !membership) {
    return res.status(403).json({ error: "Not a member of this wedding" });
  }

  try {
    const origin = req.headers.origin || req.headers.referer || "https://planning-made-easy.vercel.app";
    const base = String(origin).replace(/\/$/, "");
    const s = stripe();

    const session = await s.checkout.sessions.create({
      mode: "payment", // one-time purchase — the whole pricing model
      line_items: [{ price: await priceFor(s, tier), quantity: 1 }],
      success_url: `${base}/#/planner?checkout=success`,
      cancel_url: `${base}/#/planner?checkout=cancelled`,
      client_reference_id: userId,
      metadata: { tier, user_id: userId, wedding_id },
      payment_intent_data: { metadata: { tier, user_id: userId, wedding_id } },
      allow_promotion_codes: true,
    });

    console.log(`[checkout] session ${session.id} created for ${userId} (${tier})`);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[checkout] failed:", (err as Error).message);
    return res.status(500).json({ error: "Could not start checkout" });
  }
}
