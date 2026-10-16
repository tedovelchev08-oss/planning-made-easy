import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Block 10: two tabs, or both partners, can each pay for the same plan.
 * The webhook now refunds whatever part of a payment the wedding didn't owe,
 * judged from the wedding's own ledger in the order payments were recorded.
 */
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let clock = 0;

function table(name: string) {
  db[name] ??= [];
  let op: "select" | "update" | "delete" = "select";
  let values: Row = {};
  const filters: [string, unknown][] = [];
  const matching = () => db[name].filter((r) => filters.every(([k, v]) => r[k] === v));
  const run = () => {
    const hit = matching();
    if (op === "update") hit.forEach((r) => Object.assign(r, values));
    if (op === "delete") db[name] = db[name].filter((r) => !hit.includes(r));
    return hit;
  };
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
    limit: () => q,
    update: (v: Row) => { op = "update"; values = v; return q; },
    delete: () => { op = "delete"; return q; },
    insert: async (row: Row) => {
      if (name === "webhook_events" && db[name].some((r) => r.id === row.id)) return { error: { code: "23505", message: "duplicate" } };
      db[name].push(row);
      return { error: null };
    },
    upsert: async (row: Row, opts: { onConflict: string; ignoreDuplicates?: boolean }) => {
      const key = opts.onConflict;
      const existing = db[name].find((r) => r[key] === row[key]);
      if (existing) { if (!opts.ignoreDuplicates) Object.assign(existing, row); }
      else db[name].push({ amount_refunded: 0, status: "paid", created_at: `2026-10-16T10:00:${String(clock++).padStart(2, "0")}Z`, ...row });
      return { error: null };
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => ({ data: run()[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: run(), error: null }),
  };
  return q;
}
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: table }) }));

const refundsCreate = vi.fn(async () => ({ id: "re_1" }));
vi.mock("stripe", async (importOriginal) => {
  const Actual = ((await importOriginal()) as { default: new (k: string) => object }).default;
  return { default: class extends (Actual as new (k: string) => object) { refunds = { create: refundsCreate }; } };
});

const SECRET = "whsec_test_double";
const { default: handler, excessOf } = await import("../../api/stripe-webhook");
const Stripe = (await import("stripe")).default as unknown as new (k: string) => { webhooks: { generateTestHeaderString: (o: { payload: string; secret: string }) => string } };
const signer = new Stripe("sk_test_dummy");

async function paid(pi: string, tier: string, amount: number, user = "u1") {
  const session = {
    id: `cs_${pi}`, object: "checkout.session", payment_intent: pi, amount_total: amount, currency: "eur",
    metadata: { tier, user_id: user, wedding_id: "w1" }, client_reference_id: user, customer: null,
  };
  const payload = JSON.stringify({ id: `evt_${pi}`, object: "event", type: "checkout.session.completed", data: { object: session } });
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res: { statusCode?: number; status: (n: number) => typeof res; json: () => typeof res; setHeader: () => void } = {
    status(n) { this.statusCode = n; return this; }, json() { return this; }, setHeader() {},
  };
  await handler({ method: "POST", body: payload, headers: { "stripe-signature": header } } as never, res as never);
  return res.statusCode;
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  clock = 0;
  refundsCreate.mockClear();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.spyOn(console, "log").mockImplementation(() => {});
  db.weddings = [{ id: "w1", plan: "essential" }];
});

const row = (pi: string, tier: string, amount: number, at: string, refunded = 0) =>
  ({ stripe_payment_intent_id: pi, tier, amount, amount_refunded: refunded, created_at: at });

describe("excessOf", () => {
  it("a first purchase owes its full price: nothing to refund", () => {
    expect(excessOf("pi_1", "celebration", "eur", 4900, [row("pi_1", "celebration", 4900, "t1")])).toBe(0);
  });
  it("a second payment for a tier already owned is refunded in full", () => {
    const ledger = [row("pi_1", "celebration", 4900, "t1"), row("pi_2", "celebration", 4900, "t2")];
    expect(excessOf("pi_2", "celebration", "eur", 4900, ledger)).toBe(4900);
    expect(excessOf("pi_1", "celebration", "eur", 4900, ledger)).toBe(0);
  });
  it("Luxe at full price after Celebration landed: the difference is refunded", () => {
    const ledger = [row("pi_1", "celebration", 4900, "t1"), row("pi_2", "luxe", 9900, "t2")];
    expect(excessOf("pi_2", "luxe", "eur", 9900, ledger)).toBe(4900);
  });
  it("a normal upgrade at the difference price: nothing to refund", () => {
    const ledger = [row("pi_1", "celebration", 4900, "t1"), row("pi_2", "luxe", 5000, "t2")];
    expect(excessOf("pi_2", "luxe", "eur", 5000, ledger)).toBe(0);
  });
  it("Celebration paid after Luxe landed is refunded in full", () => {
    const ledger = [row("pi_1", "luxe", 9900, "t1"), row("pi_2", "celebration", 4900, "t2")];
    expect(excessOf("pi_2", "celebration", "eur", 4900, ledger)).toBe(4900);
  });
  it("a fully refunded earlier purchase doesn't count as owned", () => {
    const ledger = [row("pi_1", "celebration", 4900, "t1", 4900), row("pi_2", "celebration", 4900, "t2")];
    expect(excessOf("pi_2", "celebration", "eur", 4900, ledger)).toBe(0);
  });
  it("two payments recorded at the same instant agree on which one is first", () => {
    const ledger = [row("pi_b", "celebration", 4900, "t1"), row("pi_a", "celebration", 4900, "t1")];
    expect(excessOf("pi_a", "celebration", "eur", 4900, ledger) + excessOf("pi_b", "celebration", "eur", 4900, ledger)).toBe(4900);
  });
  it("a discount code paying less than list is never refunded", () => {
    expect(excessOf("pi_1", "celebration", "eur", 2500, [row("pi_1", "celebration", 2500, "t1")])).toBe(0);
  });
  it("an unknown currency never triggers a refund on a guess", () => {
    expect(excessOf("pi_1", "celebration", "jpy", 4900, [row("pi_1", "celebration", 4900, "t1")])).toBe(0);
  });
});

describe("checkout.session.completed", () => {
  it("one payment: plan granted, nothing refunded", async () => {
    expect(await paid("pi_1", "celebration", 4900)).toBe(200);
    expect(db.weddings[0].plan).toBe("celebration");
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("owner and partner both pay for Celebration: the second is refunded in full", async () => {
    await paid("pi_1", "celebration", 4900, "owner");
    await paid("pi_2", "celebration", 4900, "partner");
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    const [params, opts] = refundsCreate.mock.calls[0] as unknown as [{ payment_intent: string; amount: number }, { idempotencyKey: string }];
    expect(params).toMatchObject({ payment_intent: "pi_2", amount: 4900 });
    expect(opts.idempotencyKey).toBe("luma-excess-pi_2");
    expect(db.weddings[0].plan).toBe("celebration");
  });

  it("Luxe paid at full price after Celebration landed: the €49 difference is refunded, Luxe granted", async () => {
    await paid("pi_1", "celebration", 4900);
    await paid("pi_2", "luxe", 9900);
    expect(refundsCreate).toHaveBeenCalledTimes(1);
    expect((refundsCreate.mock.calls[0] as unknown as [{ amount: number }])[0].amount).toBe(4900);
    expect(db.weddings[0].plan).toBe("luxe");
  });

  it("a normal upgrade at the difference price refunds nothing", async () => {
    await paid("pi_1", "celebration", 4900);
    await paid("pi_2", "luxe", 5000);
    expect(refundsCreate).not.toHaveBeenCalled();
    expect(db.weddings[0].plan).toBe("luxe");
  });

  it("the same event delivered twice refunds once", async () => {
    await paid("pi_1", "celebration", 4900);
    await paid("pi_2", "celebration", 4900);
    await paid("pi_2", "celebration", 4900);
    expect(refundsCreate).toHaveBeenCalledTimes(1);
  });

  it("if the refund call fails, Stripe is told to retry (500) and the retry refunds once", async () => {
    await paid("pi_1", "celebration", 4900);
    refundsCreate.mockRejectedValueOnce(new Error("stripe unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await paid("pi_2", "celebration", 4900)).toBe(500);
    expect(await paid("pi_2", "celebration", 4900)).toBe(200);
    expect(refundsCreate).toHaveBeenCalledTimes(2); // the failed attempt + the retry, same idempotency key
    const keys = refundsCreate.mock.calls.map((c) => (c as unknown as [unknown, { idempotencyKey: string }])[1].idempotencyKey);
    expect(new Set(keys)).toEqual(new Set(["luma-excess-pi_2"]));
  });
});
