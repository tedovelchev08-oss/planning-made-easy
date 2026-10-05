import { describe, it, expect } from "vitest";
import {
  CURRENCIES, CURRENCY_ORDER, FEATURES, FREE_DESIGN_ID, FREE_GUEST_LIMIT, PLANS, PLAN_ORDER,
  can, currencyForCountry, formatPrice, guestLimit, planRank, type Feature,
} from "./plans";
import { seedTemplates, TABLE_SKINS } from "./data";

describe("plans", () => {
  it("go free → Celebration €49 → Luxe €99, ascending", () => {
    expect(PLAN_ORDER.map((p) => PLANS[p].price)).toEqual([0, 49, 99]);
    expect(PLAN_ORDER.map((p) => planRank(p))).toEqual([0, 1, 2]);
  });

  it("feature Celebration, and only Celebration", () => {
    expect(PLAN_ORDER.filter((p) => PLANS[p].featured)).toEqual(["celebration"]);
  });

  it("never describe themselves as a subscription", () => {
    const copy = JSON.stringify(PLANS).toLowerCase();
    for (const banned of ["per month", "/mo", "monthly", "yearly", "renews", "trial"]) expect(copy).not.toContain(banned);
  });

  it("only sell things the app has", () => {
    // these were once on the pricing page and never existed
    const copy = JSON.stringify(PLANS).toLowerCase();
    for (const missing of ["custom domain", "multiple events", "priority support", "photo gallery", "playlist", "guest messaging"]) {
      expect(copy).not.toContain(missing);
    }
  });

  it("count the invitation designs the copy promises", () => {
    expect(seedTemplates.filter((t) => !t.luxe)).toHaveLength(18);
    expect(seedTemplates.filter((t) => t.luxe)).toHaveLength(6);
    expect(seedTemplates.some((t) => t.id === FREE_DESIGN_ID && !t.luxe)).toBe(true);
  });

  it("gate the premium table finishes behind Luxe", () => {
    expect(TABLE_SKINS.filter((s) => s.lockedBy).every((s) => s.lockedBy === FEATURES.premiumSkins.plan)).toBe(true);
  });
});

describe("can", () => {
  it("lets the free plan use nothing paid", () => {
    for (const f of Object.keys(FEATURES) as Feature[]) expect(can("essential", f)).toBe(false);
  });

  it("lets Celebration use Celebration features but not Luxe ones", () => {
    expect(can("celebration", "unlimitedGuests")).toBe(true);
    expect(can("celebration", "personalLinks")).toBe(true);
    expect(can("celebration", "exports")).toBe(true);
    expect(can("celebration", "motion")).toBe(false);
  });

  it("lets Luxe use everything", () => {
    for (const f of Object.keys(FEATURES) as Feature[]) expect(can("luxe", f)).toBe(true);
  });
});

describe("guestLimit", () => {
  it("is 50 on the free plan and unlimited once paid", () => {
    expect(guestLimit("essential")).toBe(FREE_GUEST_LIMIT);
    expect(FREE_GUEST_LIMIT).toBe(50);
    expect(guestLimit("celebration")).toBe(Infinity);
    expect(guestLimit("luxe")).toBe(Infinity);
  });
});

describe("currency", () => {
  it("defaults by country, not language", () => {
    expect(currencyForCountry("US")).toBe("usd");
    expect(currencyForCountry("GB")).toBe("gbp");
    expect(currencyForCountry("DE")).toBe("eur");
    expect(currencyForCountry("BG")).toBe("eur");
    expect(currencyForCountry("fr")).toBe("eur");
  });

  it("falls back to euros for everywhere else, and for no country at all", () => {
    expect(currencyForCountry("JP")).toBe("eur");
    expect(currencyForCountry("")).toBe("eur");
    expect(currencyForCountry(null)).toBe("eur");
  });

  it("shows the same number in every currency", () => {
    expect(CURRENCY_ORDER.map((c) => formatPrice(49, c))).toEqual(["€49", "$49", "£49"]);
    expect(Object.keys(CURRENCIES)).toEqual(CURRENCY_ORDER);
  });
});
