import { describe, it, expect } from "vitest";
import { isFullyRefunded, planFromPurchases } from "../../api/stripe-webhook";

const paid = (tier: string, amount: number, amount_refunded = 0) => ({ tier, amount, amount_refunded });

describe("planFromPurchases — what a refund leaves a wedding on", () => {
  it("a partial refund leaves the plan unchanged", () => {
    // charge.refunded fires for a $10 goodwill refund too; that used to
    // delete the whole plan
    expect(planFromPurchases([paid("luxe", 19900, 1000)])).toBe("luxe");
  });

  it("a full refund drops the plan", () => {
    expect(planFromPurchases([paid("celebration", 9900, 9900)])).toBe("essential");
  });

  it("refunding an upgrade in full returns to the tier bought before it, not essential", () => {
    expect(planFromPurchases([paid("celebration", 9900), paid("luxe", 19900, 19900)])).toBe("celebration");
  });

  it("refunding the original purchase keeps the upgrade", () => {
    expect(planFromPurchases([paid("celebration", 9900, 9900), paid("luxe", 19900)])).toBe("luxe");
  });

  it("takes the highest tier still standing across partners' purchases", () => {
    expect(planFromPurchases([paid("essential", 4900), paid("luxe", 19900), paid("celebration", 9900)])).toBe("luxe");
  });

  it("is essential with no purchases at all", () => {
    expect(planFromPurchases([])).toBe("essential");
  });

  it("ignores a tier it does not know", () => {
    expect(planFromPurchases([paid("platinum", 50000)])).toBe("essential");
  });
});

describe("isFullyRefunded", () => {
  it("only when the refunded total reaches the amount", () => {
    expect(isFullyRefunded({ amount: 9900, amount_refunded: 9899 })).toBe(false);
    expect(isFullyRefunded({ amount: 9900, amount_refunded: 9900 })).toBe(true);
  });

  it("a zero-amount purchase (a 100% promo code) is never treated as refunded", () => {
    expect(isFullyRefunded({ amount: 0, amount_refunded: 0 })).toBe(false);
  });
});
