/**
 * POST /api/stripe-webhook — the only writer of the `entitlements` table.
 *
 *   checkout.session.completed → grant (monotonically: never a downgrade)
 *   charge.refunded            → revoke (the 14-day happiness promise)
 *
 * Security notes:
 *  · Stripe signature verification requires the RAW body. `getRawBody()` reads
 *    it defensively — from `req.body` if @vercel/node already buffered it, or
 *    from the request stream otherwise. (There is no `config.bodyParser`
 *    toggle on @vercel/node; that's a Next.js-only convention.)
 *  · SUPABASE_SERVICE_ROLE_KEY lives ONLY here (and in create-checkout for
 *    JWT verification). It is never VITE_-prefixed, so it cannot reach the
 *    client bundle. The client only ever READS entitlements (RLS read-own).
 *  · Every Stripe event id is recorded in `webhook_events` first; Stripe
 *    retries, and a repeated delivery must never double-apply.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// NOTE: there is intentionally no `export const config = { api: { bodyParser: false } }`.
// That is a Next.js API-route convention and is silently IGNORED by @vercel/node,
// so relying on it would be a lie. Instead, getRawBody() below defensively reads
// the body whether or not the platform has already buffered it.

const PLAN_RANK: Record<string, number> = { essential: 0, celebration: 1, luxe: 2 };

const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // no explicit apiVersion — the SDK pins its own, so this can't drift
  return new Stripe(key);
};

const admin = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Supabase server env is not set");
  // service role bypasses RLS — the whole point, and the whole reason this
  // key never leaves serverless functions
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

/**
 * Stripe signature verification needs the EXACT raw bytes of the payload.
 *
 * On @vercel/node the runtime may already have buffered the request body
 * (leaving the stream drained) OR may hand us a live stream. Try the buffered
 * body first — if the platform set `req.body` to a non-empty string or Buffer
 * that IS the truth — and only fall back to consuming the stream otherwise.
 *
 * (If a runtime ever hands us a body already parsed into a JSON *object*, the
 * original bytes are unrecoverable and verification must fail; we deliberately
 * do not re-serialize, since re-serialized bytes would never match the
 * signature and would fail in a confusing way.)
 */
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const r = req as VercelRequest & { body?: unknown };
  if (typeof r.body === "string" && r.body.length > 0) return Buffer.from(r.body);
  if (Buffer.isBuffer(r.body) && r.body.length > 0) return r.body;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Insert the event id; false when Stripe has already delivered it. */
async function claimEvent(supabase: ReturnType<typeof admin>, id: string, type: string): Promise<boolean> {
  const { error } = await supabase.from("webhook_events").insert({ id, type });
  if (!error) return true;
  // primary-key collision = duplicate delivery. Surface anything else loudly.
  if (String(error.code) === "23505") return false;
  throw new Error(`webhook_events insert failed: ${error.message}`);
}

async function grantFromCheckout(supabase: ReturnType<typeof admin>, session: Stripe.Checkout.Session) {
  const tier = session.metadata?.tier;
  const userId = session.metadata?.user_id ?? session.client_reference_id;
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  if (!tier || !userId || !(tier in PLAN_RANK)) {
    console.warn("[webhook] checkout.session.completed without usable metadata — skipped", session.id);
    return;
  }

  // monotonic: entitlements only ever move upward. A stale or replayed
  // session for a lower plan must not downgrade an existing one.
  const { data: existing } = await supabase.from("entitlements").select("plan").eq("user_id", userId).maybeSingle();
  if (existing && PLAN_RANK[existing.plan] >= PLAN_RANK[tier]) {
    console.log(`[webhook] entitlement already ${existing.plan} — not downgrading to ${tier} for ${userId}`);
    return;
  }

  const { error } = await supabase.from("entitlements").upsert(
    {
      user_id: userId,
      plan: tier,
      granted_at: new Date().toISOString(),
      stripe_customer_id:
        typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
      stripe_payment_intent_id: paymentIntent,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`entitlement upsert failed: ${error.message}`);

  // keep the denormalised weddings.plan copy in step (webhook is its writer)
  await supabase.from("weddings").update({ plan: tier }).eq("owner_id", userId);

  console.log(`[webhook] granted ${tier} to ${userId} (pi ${paymentIntent ?? "n/a"})`);
}

async function revokeFromRefund(supabase: ReturnType<typeof admin>, charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!pi) {
    console.warn("[webhook] charge.refunded without payment_intent — skipped", charge.id);
    return;
  }
  const { data: row } = await supabase
    .from("entitlements")
    .select("user_id, plan")
    .eq("stripe_payment_intent_id", pi)
    .maybeSingle();
  if (!row) {
    console.log(`[webhook] refund for unknown payment_intent ${pi} — nothing to revoke`);
    return;
  }
  const { error } = await supabase.from("entitlements").delete().eq("user_id", row.user_id);
  if (error) throw new Error(`entitlement revoke failed: ${error.message}`);
  await supabase.from("weddings").update({ plan: "essential" }).eq("owner_id", row.user_id);
  console.log(`[webhook] revoked ${row.plan} from ${row.user_id} (refund ${charge.id})`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });

  let event: Stripe.Event;
  try {
    const body = await getRawBody(req);
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    // unverified payload — reject outright, do not log the body
    console.warn("[webhook] signature verification failed:", (err as Error).message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const supabase = admin();

  try {
    const fresh = await claimEvent(supabase, event.id, event.type);
    if (!fresh) {
      console.log(`[webhook] duplicate event ${event.id} (${event.type}) — already applied`);
      return res.status(200).json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed":
        await grantFromCheckout(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case "charge.refunded":
        await revokeFromRefund(supabase, event.data.object as Stripe.Charge);
        break;
      default:
        console.log(`[webhook] ignored event type ${event.type}`);
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    // non-2xx makes Stripe retry; the event id is already claimed, so a
    // successful retry path re-enters here as "duplicate". To allow a true
    // retry after a transient failure we roll the claim back:
    await supabase.from("webhook_events").delete().eq("id", event.id);
    console.error(`[webhook] processing failed for ${event.id}:`, (err as Error).message);
    return res.status(500).json({ error: "Processing failed" });
  }
}
