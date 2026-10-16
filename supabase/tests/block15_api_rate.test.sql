-- ============================================================
-- Luma · pgTAP · Block 15: hourly counters for the open endpoints
-- (0016 api_rate / api_rate_hit)
-- Run with: supabase test db
--
-- /api/report (no login) and /api/create-checkout had no limit. The
-- functions now count requests per hashed key per hour through
-- api_rate_hit, which only the server (service role) can call.
-- ============================================================

begin;
select plan(10);

select has_table('public', 'api_rate', 'api_rate exists');
select has_function('public', 'api_rate_hit', array['text', 'text'], 'api_rate_hit(text, text) exists');

-- counting, as the server ------------------------------------------------------
set local role service_role;

select is(api_rate_hit('report', 'ip-hash-a'), 1, 'the first request in an hour counts 1');
select is(api_rate_hit('report', 'ip-hash-a'), 2, 'the second counts 2');
select is(api_rate_hit('report', 'ip-hash-b'), 1, 'another visitor has their own count');
select is(api_rate_hit('checkout', 'ip-hash-a'), 1, 'another endpoint has its own count');

-- an old window is cleared, and doesn't add to the current one
set local role postgres;
insert into api_rate (bucket, key_hash, window_start, hits)
values ('report', 'ip-hash-a', date_trunc('hour', now()) - interval '2 days', 999);
set local role service_role;
select is(api_rate_hit('report', 'ip-hash-a'), 3, 'old windows don''t count toward this hour');
set local role postgres;
select is(
  (select count(*)::int from api_rate where window_start < now() - interval '1 day'), 0,
  'windows older than a day are deleted'
);

-- nobody else can use or read it ------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.api_rate_hit(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.api_rate_hit(text, text)', 'execute'),
  'signed-out and signed-in users cannot call api_rate_hit'
);
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000151", "role": "authenticated"}';
select throws_ok(
  $$ select count(*) from api_rate $$,
  '42501', null,
  'signed-in users cannot read api_rate'
);

select * from finish();
rollback;
