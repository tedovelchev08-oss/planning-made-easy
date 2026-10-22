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
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * One-time prices in minor units, the same number in every currency
 * (€49 / $49 / £49). Mirrors src/lib/plans.ts — serverless functions build
 * separately, and src/lib/checkout-price.test.ts fails if the two drift.
 * The free plan is never sold.
 */
export const PRICES: Record<"celebration" | "luxe", { name: string; amount: number }> = {
  celebration: { name: "Twofold — Celebration", amount: 4900 },
  luxe: { name: "Twofold — Luxe", amount: 9900 },
};
export const CURRENCIES = ["eur", "usd", "gbp"] as const;
type Currency = (typeof CURRENCIES)[number];
const RANK: Record<string, number> = { essential: 0, celebration: 1, luxe: 2 };

/** Checkout sessions one account may start per hour (counted in api_rate, 0016). */
export const CHECKOUTS_PER_HOUR = 10;

export const SITE_URL = "https://planning-made-easy.vercel.app";
/** This project's preview deployments: branch aliases and per-deployment URLs. */
const PREVIEW_ORIGIN = /^https:\/\/planning-made-easy-[a-z0-9-]+-one-man-army-eaf1\.vercel\.app$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;

type SiteEnv = { VERCEL_ENV?: string; VERCEL_URL?: string; VITE_PUBLIC_SITE_URL?: string };

/**
 * Where Stripe sends the buyer back to. The Origin header is whatever the
 * caller sends, so it is only ever CHOSEN from, never trusted: our own site,
 * and on non-production deployments this project's previews or localhost.
 * Anything else, including a missing header, gets the deployment's own
 * address. Before this, `curl -H "Origin: https://evil.example"` produced a
 * genuine Twofold checkout link that ended on evil.example.
 */
export function checkoutBase(origin: string | undefined, env: SiteEnv): string {
  const site = (env.VITE_PUBLIC_SITE_URL || SITE_URL).replace(/\/$/, "");
  const production = env.VERCEL_ENV === "production";
  const self = !production && env.VERCEL_URL ? `https://${env.VERCEL_URL}` : site;
  const o = (origin ?? "").replace(/\/$/, "");
  if (o === site) return site;
  if (!production && (o === self || PREVIEW_ORIGIN.test(o))) return o;
  if (!env.VERCEL_ENV && LOCAL_ORIGIN.test(o)) return o; // `vercel dev` on a laptop
  return self;
}

/**
 * What a checkout charges, given what the wedding already has. Upgrading
 * from Celebration to Luxe charges the difference — nobody pays twice for
 * what they already own. Returns null when there is nothing to buy.
 */
export function checkoutPrice(tier: string, currency: string, currentPlan: string) {
  if (!(tier in PRICES) || !(CURRENCIES as readonly string[]).includes(currency)) return null;
  const t = tier as keyof typeof PRICES;
  if ((RANK[currentPlan] ?? 0) >= RANK[t]) return null;
  const owned = currentPlan in PRICES ? PRICES[currentPlan as keyof typeof PRICES].amount : 0;
  const upgrade = owned > 0;
  return {
    amount: PRICES[t].amount - owned,
    currency: currency as Currency,
    name: upgrade ? `${PRICES[t].name} (upgrade from ${PRICES[currentPlan as keyof typeof PRICES].name.replace("Twofold — ", "")})` : PRICES[t].name,
    // v2: the old luma_<tier> USD prices stay in Stripe for past purchases
    lookupKey: `luma_v2_${t}${upgrade ? `_from_${currentPlan}` : ""}_${currency}`,
  };
}

const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
};

/**
 * VAT, once it applies (docs/GO-LIVE.md): STRIPE_AUTOMATIC_TAX=true turns on
 * Stripe Tax. Prices are then TAX-INCLUSIVE, so €49 stays €49 for the buyer
 * and the VAT comes out of it, as EU consumer prices must show. Those prices
 * have their own lookup keys (_incl), so they never mix with the existing
 * ones, whose tax behaviour can't be changed. Off unless set.
 */
export const automaticTax = (env: { STRIPE_AUTOMATIC_TAX?: string } = process.env) => env.STRIPE_AUTOMATIC_TAX === "true";

/** Find the one-time price, creating product + price on first use. */
async function priceFor(s: Stripe, p: NonNullable<ReturnType<typeof checkoutPrice>>, tax: boolean): Promise<string> {
  const lookupKey = tax ? `${p.lookupKey}_incl` : p.lookupKey;
  // stripe-node v22 renamed the list filter to `lookup_keys` (array)
  const existing = await s.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data.length > 0) return existing.data[0].id;

  const product = await s.products.create({ name: p.name, metadata: { luma_price: lookupKey } });
  const price = await s.prices.create({
    product: product.id,
    currency: p.currency,
    unit_amount: p.amount,
    lookup_key: lookupKey,
    ...(tax ? { tax_behavior: "inclusive" as const } : {}),
    // two first-ever checkouts at once both get here; without this the
    // second fails on the duplicate lookup key and the buyer sees a 500
    transfer_lookup_key: true,
  });
  return price.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tier, wedding_id, currency = "eur" } = (req.body ?? {}) as { tier?: string; wedding_id?: string; currency?: string };
  if (!tier || !(tier in PRICES)) return res.status(400).json({ error: "Unknown tier" });
  if (!(CURRENCIES as readonly string[]).includes(currency)) return res.status(400).json({ error: "Unknown currency" });
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

  // Each call creates a Stripe session: cap them per account. Fails open, so
  // a counter outage never blocks a real payment.
  try {
    const key = createHmac("sha256", serviceKey).update(userId).digest("hex");
    const { data: hits, error: rateErr } = await admin.rpc("api_rate_hit", { p_bucket: "checkout", p_key: key });
    if (rateErr) console.error("[checkout] rate check failed:", rateErr.message);
    else if (typeof hits === "number" && hits > CHECKOUTS_PER_HOUR) {
      return res.status(429).json({ error: "Too many checkout attempts. Please try again in an hour." });
    }
  } catch (err) {
    console.error("[checkout] rate check failed:", (err as Error).message);
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

  // Priced against the plan the server has, never one the client claims.
  const { data: wedding, error: weddingErr } = await admin
    .from("weddings").select("plan").eq("id", wedding_id).maybeSingle();
  if (weddingErr || !wedding) return res.status(404).json({ error: "Wedding not found" });
  const price = checkoutPrice(tier, currency, wedding.plan);
  if (!price) return res.status(409).json({ error: "This wedding already has that plan" });

  try {
    const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
    const base = checkoutBase(origin, process.env);
    const s = stripe();
    const tax = automaticTax();

    const session = await s.checkout.sessions.create({
      mode: "payment", // one-time purchase — the whole pricing model
      line_items: [{ price: await priceFor(s, price, tax), quantity: 1 }],
      success_url: `${base}/#/planner?checkout=success`,
      cancel_url: `${base}/#/planner?checkout=cancelled`,
      client_reference_id: userId,
      metadata: { tier, user_id: userId, wedding_id },
      payment_intent_data: { metadata: { tier, user_id: userId, wedding_id } },
      allow_promotion_codes: true,
      // an abandoned tab can't be paid hours later, after the plan changed
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      // Stripe works out the buyer's VAT from their billing country
      ...(tax ? { automatic_tax: { enabled: true } } : {}),
    });

    console.log(`[checkout] session ${session.id} created for ${userId} (${tier}, ${price.amount} ${price.currency})`);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("[checkout] failed:", (err as Error).message);
    return res.status(500).json({ error: "Could not start checkout" });
  }
}
