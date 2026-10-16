-- ============================================================
-- Luma · 0016 · hourly request counters for the open endpoints
--                (Phase 2, Block 15)
--
-- POST /api/report needs no login and wrote one log line per call: a
-- script could flood the logs (cost, and real errors drown). POST
-- /api/create-checkout created a Stripe Checkout Session per call for any
-- signed-in user. Both now count requests per key per hour here and stop
-- past a limit set in the function code.
--
-- Same shape as rsvp_rate (0011), generalised by a bucket name. Keys are
-- hashes made by the server (an HMAC of the IP, or of the user id), never
-- raw IPs. Service role only: no grants to visitors, RLS on, no policies.
-- Additive and idempotent.
-- ============================================================

create table if not exists api_rate (
  bucket       text not null,
  key_hash     text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (bucket, key_hash, window_start)
);

alter table api_rate enable row level security;
-- no policies: only the service role (which bypasses RLS) reads or writes
revoke all on table api_rate from public, anon, authenticated;

-- Counts one request and returns this hour's total for the key.
create or replace function api_rate_hit(p_bucket text, p_key text)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_hits   integer;
begin
  insert into api_rate (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key, v_window, 1)
  on conflict (bucket, key_hash, window_start) do update set hits = api_rate.hits + 1
  returning hits into v_hits;

  -- housekeeping: a past window is never read again
  delete from api_rate where window_start < now() - interval '1 day';

  return v_hits;
end;
$$;

revoke all on function api_rate_hit(text, text) from public, anon, authenticated;
grant execute on function api_rate_hit(text, text) to service_role;
