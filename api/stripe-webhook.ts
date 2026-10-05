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

export interface PurchaseLike { tier: string; amount: number; amount_refunded: number }

/** A purchase is revoked only once it is refunded in full; a goodwill partial refund keeps the plan. */
export const isFullyRefunded = (p: Pick<PurchaseLike, "amount" | "amount_refunded">) =>
  p.amount > 0 && p.amount_refunded >= p.amount;

/** A wedding's plan: the highest tier among its purchases still standing, else essential. */
export function planFromPurchases(purchases: PurchaseLike[]): string {
  return purchases
    .filter((p) => !isFullyRefunded(p) && p.tier in PLAN_RANK)
    .reduce((best, p) => (PLAN_RANK[p.tier] > PLAN_RANK[best] ? p.tier : best), "essential");
}

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
  const weddingId = session.metadata?.wedding_id;
  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  if (!tier || !userId || !(tier in PLAN_RANK)) {
    console.warn("[webhook] checkout.session.completed without usable metadata — skipped", session.id);
    return;
  }

  // Determine which wedding to update:
  // - If wedding_id is in metadata (new sessions), use it directly
  // - Otherwise, fall back to the purchaser's membership (older sessions)
  let targetWeddingId = weddingId;
  if (!targetWeddingId) {
    const { data: membership } = await supabase
      .from("wedding_members")
      .select("wedding_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    targetWeddingId = membership?.wedding_id ?? null;
  }

  if (!targetWeddingId) {
    console.warn("[webhook] no wedding found for purchaser — entitlement recorded but plan not updated", userId);
    // Still record the entitlement, just don't update any wedding
  }

  // Record the payment in the ledger first, idempotent on the payment
  // intent: Stripe retries, and a replay must not create a second row.
  if (paymentIntent) {
    const { error: ledgerError } = await supabase.from("purchases").upsert(
      {
        wedding_id: targetWeddingId,
        user_id: userId,
        tier,
        stripe_payment_intent_id: paymentIntent,
        amount: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
      },
      { onConflict: "stripe_payment_intent_id", ignoreDuplicates: true },
    );
    if (ledgerError) throw new Error(`purchase insert failed: ${ledgerError.message}`);
  } else {
    console.warn("[webhook] checkout session without a payment intent — not recorded in purchases", session.id);
  }

  // Update the wedding's plan (authoritative, per-wedding)
  // This happens regardless of the user's existing entitlements
  if (targetWeddingId) {
    // Check current plan to enforce monotonic upgrade
    const { data: wedding } = await supabase
      .from("weddings")
      .select("plan")
      .eq("id", targetWeddingId)
      .maybeSingle();
    
    if (wedding && PLAN_RANK[wedding.plan] >= PLAN_RANK[tier]) {
      console.log(`[webhook] wedding ${targetWeddingId} already at ${wedding.plan} — not downgrading to ${tier}`);
      // Still record the entitlement even if wedding doesn't need upgrade
    } else {
      const { error: updateError } = await supabase
        .from("weddings")
        .update({ plan: tier })
        .eq("id", targetWeddingId);
      
      if (updateError) {
        throw new Error(`weddings plan update failed: ${updateError.message}`);
      }
    }
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

  console.log(`[webhook] granted ${tier} to ${userId} for wedding ${targetWeddingId ?? "none"} (pi ${paymentIntent ?? "n/a"})`);
}

/**
 * Who and which wedding a refund applies to.
 *
 * Sessions created since per-wedding plans carry both ids in the
 * PaymentIntent metadata. Older ones carry only user_id, and the oldest may
 * carry neither — for those the purchase is found the way it always was, by
 * the payment intent stamped on the entitlement row. Skipping them instead
 * would let every pre-existing customer keep a plan they were refunded for.
 */
export async function resolveRefundTarget(
  piId: string,
  metadata: Record<string, string | undefined>,
  lookup: {
    ownerOfPaymentIntent: (piId: string) => Promise<string | null>;
    weddingOf: (userId: string) => Promise<string | null>;
  },
): Promise<{ userId: string; weddingId: string | null } | null> {
  const userId = metadata.user_id || (await lookup.ownerOfPaymentIntent(piId));
  if (!userId) return null;
  const weddingId = metadata.wedding_id || (await lookup.weddingOf(userId));
  return { userId, weddingId };
}

type Admin = ReturnType<typeof admin>;

/** The ledger row a refund applies to, creating it for payments made before the ledger existed. */
async function purchaseForRefund(supabase: Admin, piId: string, charge: Stripe.Charge) {
  const { data: row, error } = await supabase
    .from("purchases").select("id, wedding_id, user_id, tier").eq("stripe_payment_intent_id", piId).maybeSingle();
  if (error) throw new Error(`purchase lookup failed: ${error.message}`);
  if (row) return row;

  // Not in the ledger (or the backfill): rebuild it from the PaymentIntent,
  // whose metadata create-checkout always stamped with the tier.
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe().paymentIntents.retrieve(piId);
  } catch (err) {
    // eslint-disable-next-line preserve-caught-error -- api targets ES2020, no Error cause
    throw new Error(`failed to retrieve payment intent ${piId}: ${(err as Error).message}`);
  }
  const tier = paymentIntent.metadata?.tier;
  if (!tier || !(tier in PLAN_RANK)) return null;

  const target = await resolveRefundTarget(piId, paymentIntent.metadata ?? {}, {
    async ownerOfPaymentIntent(id) {
      const { data, error: e } = await supabase
        .from("entitlements").select("user_id").eq("stripe_payment_intent_id", id).maybeSingle();
      if (e) throw new Error(`entitlement lookup failed: ${e.message}`);
      return data?.user_id ?? null;
    },
    async weddingOf(uid) {
      const { data, error: e } = await supabase
        .from("wedding_members").select("wedding_id").eq("user_id", uid).limit(1).maybeSingle();
      if (e) throw new Error(`membership lookup failed: ${e.message}`);
      return data?.wedding_id ?? null;
    },
  });
  if (!target) return null;

  const { data: created, error: insertError } = await supabase
    .from("purchases")
    .upsert(
      {
        wedding_id: target.weddingId, user_id: target.userId, tier,
        stripe_payment_intent_id: piId, amount: charge.amount, currency: charge.currency,
      },
      { onConflict: "stripe_payment_intent_id" },
    )
    .select("id, wedding_id, user_id, tier")
    .single();
  if (insertError) throw new Error(`purchase insert failed: ${insertError.message}`);
  return created;
}

/**
 * charge.refunded fires for partial refunds too, each time with the running
 * total in amount_refunded. Record it; only a FULL refund revokes anything,
 * and then the plan falls back to whatever else was paid for — an upgrade
 * refunded in full returns the wedding to the tier bought before it.
 */
async function revokeFromRefund(supabase: Admin, charge: Stripe.Charge) {
  const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!piId) {
    console.warn("[webhook] charge.refunded without payment_intent — skipped", charge.id);
    return;
  }

  const purchase = await purchaseForRefund(supabase, piId, charge);
  if (!purchase) {
    console.log(`[webhook] refund for unknown payment_intent ${piId} — nothing to revoke`);
    return;
  }

  const full = charge.refunded === true || isFullyRefunded({ amount: charge.amount, amount_refunded: charge.amount_refunded });
  const { error: updateError } = await supabase
    .from("purchases")
    .update({
      amount: charge.amount,
      amount_refunded: charge.amount_refunded,
      status: full ? "refunded" : charge.amount_refunded > 0 ? "partially_refunded" : "paid",
    })
    .eq("id", purchase.id);
  if (updateError) throw new Error(`purchase refund update failed: ${updateError.message}`);

  if (!full) {
    console.log(`[webhook] partial refund on ${piId} (${charge.amount_refunded}/${charge.amount}) — plan unchanged`);
    return;
  }

  // The wedding's plan, recomputed from everything still paid for.
  if (purchase.wedding_id) {
    const { data: rows, error } = await supabase
      .from("purchases").select("tier, amount, amount_refunded").eq("wedding_id", purchase.wedding_id);
    if (error) throw new Error(`purchase list failed: ${error.message}`);
    const plan = planFromPurchases(rows ?? []);
    const { error: planError } = await supabase.from("weddings").update({ plan }).eq("id", purchase.wedding_id);
    if (planError) throw new Error(`wedding plan update failed: ${planError.message}`);
    console.log(`[webhook] full refund on ${piId}: wedding ${purchase.wedding_id} now ${plan}`);
  }

  // The purchaser's entitlement row (their purchase record, which the
  // checkout-return screen reads) follows their own remaining purchases.
  if (purchase.user_id) {
    const { data: mine, error } = await supabase
      .from("purchases").select("tier, amount, amount_refunded").eq("user_id", purchase.user_id);
    if (error) throw new Error(`purchase list failed: ${error.message}`);
    const standing = (mine ?? []).filter((p) => !isFullyRefunded(p));
    const result = standing.length
      ? await supabase.from("entitlements").update({ plan: planFromPurchases(standing) }).eq("user_id", purchase.user_id)
      : await supabase.from("entitlements").delete().eq("user_id", purchase.user_id);
    if (result.error) throw new Error(`entitlement update failed: ${result.error.message}`);
  }
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
