import { planRank, type Plan } from "./data";

/**
 * Has the purchase the buyer just paid for reached the database?
 *
 * `purchased` is the buyer's OWN entitlement row, which only the webhook
 * writes. The wedding's plan cannot answer this: it starts at 'essential', so
 * an Essential purchase — or a stale ?checkout=success — would read as
 * confirmed before Stripe had told us anything.
 */
export function purchaseArrived(purchased: Plan | null, pendingTier: Plan | null): boolean {
  if (!purchased) return false;
  return planRank(purchased) >= (pendingTier ? planRank(pendingTier) : 0);
}
