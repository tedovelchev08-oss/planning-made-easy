import { describe, it, expect } from "vitest";
import { PRICES, CURRENCIES, checkoutPrice } from "../../api/create-checkout";
import { PLANS, PLAN_ORDER, CURRENCY_ORDER, upgradePrice } from "./plans";

describe("server prices match the plans people see", () => {
  it("charges exactly the displayed price, in minor units", () => {
    expect(PRICES.celebration.amount).toBe(PLANS.celebration.price * 100);
    expect(PRICES.luxe.amount).toBe(PLANS.luxe.price * 100);
  });

  it("supports exactly the currencies the picker offers", () => {
    expect([...CURRENCIES]).toEqual(CURRENCY_ORDER);
  });
});

describe("checkoutPrice", () => {
  it("charges the full price from the free plan, in the chosen currency", () => {
    expect(checkoutPrice("celebration", "gbp", "essential")).toMatchObject({ amount: 4900, currency: "gbp", lookupKey: "luma_v2_celebration_gbp" });
    expect(checkoutPrice("luxe", "usd", "essential")).toMatchObject({ amount: 9900, currency: "usd", lookupKey: "luma_v2_luxe_usd" });
  });

  it("charges only the difference to upgrade Celebration to Luxe", () => {
    const p = checkoutPrice("luxe", "eur", "celebration");
    expect(p).toMatchObject({ amount: 5000, lookupKey: "luma_v2_luxe_from_celebration_eur" });
    expect(p?.name).toMatch(/upgrade/i);
  });

  it("sells nothing a wedding already has, or a downgrade", () => {
    expect(checkoutPrice("celebration", "eur", "celebration")).toBeNull();
    expect(checkoutPrice("celebration", "eur", "luxe")).toBeNull();
    expect(checkoutPrice("luxe", "eur", "luxe")).toBeNull();
  });

  it("never sells the free plan, an unknown plan or an unknown currency", () => {
    expect(checkoutPrice("essential", "eur", "essential")).toBeNull();
    expect(checkoutPrice("platinum", "eur", "essential")).toBeNull();
    expect(checkoutPrice("celebration", "jpy", "essential")).toBeNull();
  });
});

describe("the price shown is the price charged", () => {
  it("for every plan a wedding could move to, from every plan it could be on", () => {
    for (const current of PLAN_ORDER) {
      for (const target of PLAN_ORDER) {
        const shown = upgradePrice(target, current);
        const charged = target === "essential" ? null : checkoutPrice(target, "eur", current);
        if (shown === null || shown === 0) expect(charged).toBeNull();
        else expect(charged?.amount).toBe(shown * 100);
      }
    }
  });
});
