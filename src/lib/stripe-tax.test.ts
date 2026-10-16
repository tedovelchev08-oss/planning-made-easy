import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * STRIPE_AUTOMATIC_TAX (Block 16): off by default, nothing changes. On,
 * prices are created tax-inclusive under their own lookup keys and the
 * session asks Stripe to work out the VAT, so €49 stays €49 to the buyer.
 */
const pricesList = vi.fn(async () => ({ data: [] as { id: string }[] }));
const pricesCreate = vi.fn(async () => ({ id: "price_new" }));
const sessionsCreate = vi.fn(async () => ({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" }));
vi.mock("stripe", () => ({
  default: class {
    prices = { list: pricesList, create: pricesCreate };
    products = { create: async () => ({ id: "prod_1" }) };
    checkout = { sessions: { create: sessionsCreate } };
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: async () => ({ data: 1, error: null }),
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (t: string) => {
      const row = t === "weddings" ? { plan: "essential" } : { wedding_id: "w1" };
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: row, error: null }) };
      return q;
    },
  }),
}));

const { default: handler, automaticTax, SITE_URL } = await import("../../api/create-checkout");

async function checkout() {
  const res: { statusCode?: number; status: (n: number) => typeof res; json: () => typeof res; setHeader: () => void } = {
    status(n) { this.statusCode = n; return this; }, json() { return this; }, setHeader() {},
  };
  await handler({
    method: "POST", headers: { authorization: "Bearer jwt", origin: SITE_URL },
    body: { tier: "celebration", wedding_id: "w1", currency: "eur" },
  } as never, res as never);
  return res;
}

beforeEach(() => {
  pricesList.mockClear(); pricesCreate.mockClear(); sessionsCreate.mockClear();
  vi.unstubAllEnvs();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("automaticTax", () => {
  it("is on only when explicitly set to 'true'", () => {
    expect(automaticTax({})).toBe(false);
    expect(automaticTax({ STRIPE_AUTOMATIC_TAX: "1" })).toBe(false);
    expect(automaticTax({ STRIPE_AUTOMATIC_TAX: "true" })).toBe(true);
  });
});

describe("checkout with the tax switch", () => {
  it("off (today): same prices and session as before, no tax", async () => {
    expect((await checkout()).statusCode).toBe(200);
    const price = (pricesCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(price.lookup_key).toBe("luma_v2_celebration_eur");
    expect(price).not.toHaveProperty("tax_behavior");
    expect((sessionsCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0]).not.toHaveProperty("automatic_tax");
  });

  it("on: a tax-inclusive €49 under its own lookup key, and Stripe Tax on the session", async () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX", "true");
    expect((await checkout()).statusCode).toBe(200);
    expect(pricesList).toHaveBeenCalledWith({ lookup_keys: ["luma_v2_celebration_eur_incl"], limit: 1 });
    expect((pricesCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({
      unit_amount: 4900, currency: "eur", tax_behavior: "inclusive", lookup_key: "luma_v2_celebration_eur_incl",
    });
    expect((sessionsCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0]).toMatchObject({ automatic_tax: { enabled: true } });
  });
});
