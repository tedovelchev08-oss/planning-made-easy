-- ============================================================
-- Phase C · Stripe webhook support
--
-- webhook_events: idempotency ledger. Stripe retries deliveries,
-- so every event id is recorded exactly once and duplicate
-- deliveries are no-ops. Written ONLY by the service role (the
-- api/stripe-webhook.ts Vercel function); no client policies.
-- ============================================================

create table if not exists webhook_events (
  id          text primary key,            -- the Stripe event id (evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);

-- housekeeping: nothing older than 90 days is needed for idempotency
-- (Stripe's retry window is 3 days). No policy: service role only.
create index if not exists webhook_events_received_idx on webhook_events (received_at);
