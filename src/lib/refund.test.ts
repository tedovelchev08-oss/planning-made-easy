import { describe, it, expect, vi } from "vitest";
import { resolveRefundTarget } from "../../api/stripe-webhook";

const lookups = (owner: string | null, wedding: string | null) => ({
  ownerOfPaymentIntent: vi.fn(async () => owner),
  weddingOf: vi.fn(async () => wedding),
});

describe("resolveRefundTarget — which purchase a refund revokes", () => {
  it("uses the metadata of a session created with per-wedding plans", async () => {
    const l = lookups("someone-else", "other-wedding");
    const t = await resolveRefundTarget("pi_new", { user_id: "u1", wedding_id: "w1" }, l);
    expect(t).toEqual({ userId: "u1", weddingId: "w1" });
    expect(l.ownerOfPaymentIntent).not.toHaveBeenCalled();
    expect(l.weddingOf).not.toHaveBeenCalled();
  });

  it("finds the wedding for an older session that carried only user_id", async () => {
    // Every purchase made before wedding_id was added looks like this. They
    // used to be skipped, so a refunded customer kept their paid plan.
    const l = lookups(null, "w1");
    const t = await resolveRefundTarget("pi_old", { user_id: "u1", tier: "luxe" }, l);
    expect(t).toEqual({ userId: "u1", weddingId: "w1" });
    expect(l.weddingOf).toHaveBeenCalledWith("u1");
  });

  it("falls back to the entitlement row when the metadata is empty", async () => {
    const l = lookups("u1", "w1");
    const t = await resolveRefundTarget("pi_oldest", {}, l);
    expect(t).toEqual({ userId: "u1", weddingId: "w1" });
    expect(l.ownerOfPaymentIntent).toHaveBeenCalledWith("pi_oldest");
  });

  it("still revokes from a purchaser who belongs to no wedding", async () => {
    const t = await resolveRefundTarget("pi_old", { user_id: "u1" }, lookups(null, null));
    expect(t).toEqual({ userId: "u1", weddingId: null });
  });

  it("returns null for a payment nobody on record made", async () => {
    expect(await resolveRefundTarget("pi_unknown", {}, lookups(null, null))).toBeNull();
  });
});
