import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

/**
 * api/stripe-webhook.ts: a chargeback takes the money back without a
 * refund, so charge.refunded never fires. Only a dispute closed as LOST
 * may revoke the plan, through the same fallback as a full refund.
 *
 * Events are signed with the real Stripe SDK, so they pass the handler's
 * own signature check; the database is a small in-memory stand-in.
 */
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};

function table(name: string) {
  db[name] ??= [];
  let rows = db[name];
  let op: "select" | "update" | "delete" = "select";
  let values: Row = {};
  const filters: [string, unknown][] = [];
  const matching = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
  const run = () => {
    const hit = matching();
    if (op === "update") hit.forEach((r) => Object.assign(r, values));
    if (op === "delete") db[name] = rows = rows.filter((r) => !hit.includes(r));
    return hit;
  };
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    limit: () => q,
    update: (v: Row) => { op = "update"; values = v; return q; },
    delete: () => { op = "delete"; return q; },
    insert: async (row: Row) => {
      if (name === "webhook_events" && rows.some((r) => r.id === row.id)) return { error: { code: "23505", message: "duplicate" } };
      rows.push(row);
      return { error: null };
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: run(), error: null }),
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: table }) }));

const SECRET = "whsec_test_dispute";
const { default: handler, disputeRevokes } = await import("../../api/stripe-webhook");
const stripe = new Stripe("sk_test_dummy");

async function deliver(type: string, object: Row, id = `evt_${Math.random().toString(36).slice(2)}`) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res: { statusCode?: number; status: (n: number) => typeof res; json: () => typeof res; setHeader: () => void } = {
    status(n) { this.statusCode = n; return this; }, json() { return this; }, setHeader() {},
  };
  await handler({ method: "POST", body: payload, headers: { "stripe-signature": header } } as never, res as never);
  return res.statusCode;
}

const dispute = (status: string, pi = "pi_luxe") =>
  ({ id: "dp_1", object: "dispute", status, payment_intent: pi, amount: 9900, currency: "eur", charge: "ch_1" });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.spyOn(console, "log").mockImplementation(() => {});
  // a wedding that bought Celebration, then upgraded to Luxe
  db.weddings = [{ id: "w1", plan: "luxe" }];
  db.purchases = [
    { id: "p1", wedding_id: "w1", user_id: "u1", tier: "celebration", stripe_payment_intent_id: "pi_cel", amount: 4900, amount_refunded: 0, status: "paid" },
    { id: "p2", wedding_id: "w1", user_id: "u1", tier: "luxe", stripe_payment_intent_id: "pi_luxe", amount: 5000, amount_refunded: 0, status: "paid" },
  ];
  db.entitlements = [{ user_id: "u1", plan: "luxe", stripe_payment_intent_id: "pi_luxe" }];
});

describe("disputeRevokes", () => {
  it("is true only for a dispute we lost", () => {
    expect(disputeRevokes({ status: "lost" })).toBe(true);
    for (const status of ["won", "warning_closed", "needs_response", "under_review"] as const) {
      expect(disputeRevokes({ status })).toBe(false);
    }
  });
});

describe("charge.dispute.closed", () => {
  it("a lost dispute on the upgrade returns the wedding to the plan still paid for", async () => {
    expect(await deliver("charge.dispute.closed", dispute("lost"))).toBe(200);
    expect(db.weddings[0].plan).toBe("celebration");
    expect(db.entitlements[0].plan).toBe("celebration");
    expect(db.purchases.find((p) => p.id === "p2")).toMatchObject({ status: "refunded", amount_refunded: 5000 });
    expect(db.purchases.find((p) => p.id === "p1")).toMatchObject({ status: "paid" });
  });

  it("a lost dispute on the only purchase returns the wedding to the free plan", async () => {
    db.purchases = db.purchases.filter((p) => p.id === "p2");
    expect(await deliver("charge.dispute.closed", dispute("lost"))).toBe(200);
    expect(db.weddings[0].plan).toBe("essential");
    expect(db.entitlements).toHaveLength(0);
  });

  it("a won dispute changes nothing", async () => {
    expect(await deliver("charge.dispute.closed", dispute("won"))).toBe(200);
    expect(db.weddings[0].plan).toBe("luxe");
    expect(db.purchases.every((p) => p.status === "paid")).toBe(true);
  });

  it("an opened dispute (charge.dispute.created) changes nothing", async () => {
    expect(await deliver("charge.dispute.created", dispute("needs_response"))).toBe(200);
    expect(db.weddings[0].plan).toBe("luxe");
  });

  it("delivering the same lost dispute twice is applied once", async () => {
    await deliver("charge.dispute.closed", dispute("lost"), "evt_same");
    db.weddings[0].plan = "luxe"; // if it ran again, this would be overwritten
    await deliver("charge.dispute.closed", dispute("lost"), "evt_same");
    expect(db.weddings[0].plan).toBe("luxe");
  });
});
