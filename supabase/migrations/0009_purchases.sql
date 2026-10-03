-- ============================================================
-- Luma · 0009 · purchases ledger
--
-- One row per Stripe payment. entitlements (0001) keeps a single row per
-- user and overwrote stripe_payment_intent_id on every purchase, so:
--   · after an upgrade, refunding the upgrade dropped the customer to
--     nothing although they still paid for the lower tier, and refunding
--     the original purchase matched no row at all;
--   · charge.refunded fires for PARTIAL refunds too, and any refund
--     revoked the whole plan.
-- With a ledger, a wedding's plan is the highest tier among its purchases
-- that are not fully refunded (api/stripe-webhook.ts).
--
-- Additive and idempotent. Written only by the service role.
-- ============================================================

create table if not exists purchases (
  id                       uuid primary key default gen_random_uuid(),
  -- null when the purchaser belonged to no wedding at the time
  wedding_id               uuid references weddings (id) on delete cascade,
  user_id                  uuid references auth.users (id) on delete set null,
  tier                     plan_t not null,
  stripe_payment_intent_id text not null unique,
  -- minor units (cents). Backfilled rows start at list price; the first
  -- refund event for a payment overwrites it with the real charge amount.
  amount                   integer not null check (amount >= 0),
  amount_refunded          integer not null default 0 check (amount_refunded >= 0),
  currency                 text not null default 'usd',
  status                   text not null default 'paid'
                           check (status in ('paid', 'partially_refunded', 'refunded')),
  created_at               timestamptz not null default now()
);

create index if not exists purchases_wedding_idx on purchases (wedding_id);
create index if not exists purchases_user_idx on purchases (user_id);

alter table purchases enable row level security;

-- Members may see their wedding's purchases. No insert, update or delete
-- policy: the webhook writes with the service role, which bypasses RLS.
drop policy if exists purchases_read_members on purchases;
create policy purchases_read_members on purchases for select
  using (wedding_id is not null and is_wedding_member(wedding_id));

-- ---------- backfill ----------
-- Every entitlement that recorded a payment intent becomes a purchase,
-- attributed to the purchaser's wedding (their owned one first). Only the
-- LATEST purchase per user survives in entitlements, so earlier ones (a
-- Celebration later upgraded to Luxe) cannot be recovered from here.
insert into purchases (wedding_id, user_id, tier, stripe_payment_intent_id, amount, created_at)
select
  (select m.wedding_id from wedding_members m
    where m.user_id = e.user_id
    order by (m.role = 'owner') desc
    limit 1),
  e.user_id,
  e.plan,
  e.stripe_payment_intent_id,
  case e.plan when 'luxe' then 19900 when 'celebration' then 9900 else 4900 end,
  e.granted_at
from entitlements e
where e.stripe_payment_intent_id is not null
on conflict (stripe_payment_intent_id) do nothing;
