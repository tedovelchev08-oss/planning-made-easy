import { describe, it, expect } from "vitest";
import { purchaseArrived } from "./checkout";

describe("purchaseArrived — the checkout-return screen", () => {
  it("keeps waiting while the buyer has no purchase on record", () => {
    // Every wedding starts on 'essential', so reading the wedding's plan here
    // confirmed an Essential purchase before the webhook had run at all.
    expect(purchaseArrived(null, "essential")).toBe(false);
  });

  it("confirms an Essential purchase once the webhook has recorded it", () => {
    expect(purchaseArrived("essential", "essential")).toBe(true);
  });

  it("keeps waiting when only a lower tier is on record", () => {
    expect(purchaseArrived("celebration", "luxe")).toBe(false);
  });

  it("confirms when the recorded tier meets or beats what was bought", () => {
    expect(purchaseArrived("luxe", "celebration")).toBe(true);
    expect(purchaseArrived("luxe", "luxe")).toBe(true);
  });

  it("does not confirm a stale ?checkout=success with nothing bought", () => {
    // No pending tier and no purchase: "Check again" used to say success here.
    expect(purchaseArrived(null, null)).toBe(false);
  });

  it("accepts any purchase when the pending tier is unknown", () => {
    expect(purchaseArrived("essential", null)).toBe(true);
  });
});
