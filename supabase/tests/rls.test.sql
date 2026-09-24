-- ============================================================
-- Luma · RLS policy tests (pgTAP · run with `supabase db test`)
-- ============================================================

begin;
select plan(22);

-- helpers ----------------------------------------------------
create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- Create test_tokens table as postgres (before any role switches)
create table test_tokens (rsvp_token uuid);
grant select, insert on test_tokens to anon, authenticated;

-- fixtures ---------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
  (test_uuid('10'), 'owner@example.com', 'hashed', now()),
  (test_uuid('11'), 'partner@example.com', 'hashed', now()),
  (test_uuid('12'), 'stranger@example.com', 'hashed', now());

-- the owner creates a wedding and their membership -----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000010", "role": "authenticated", "email": "owner@example.com", "email_verified": true}';

select lives_ok(
  $$ insert into public.weddings (id, owner_id, slug, names, partner_a, partner_b, date)
     values (test_uuid('200'), test_uuid('10'), 'rls-test', 'Test & Coupled', 'Test', 'Coupled', now() + interval '30 days') $$,
  'owner can create a wedding'
);

select lives_ok(
  $$ insert into public.wedding_members (wedding_id, user_id, role)
     values (test_uuid('200'), test_uuid('10'), 'owner') $$,
  'owner can seed their membership row'
);

select lives_ok(
  $$ insert into public.guests (wedding_id, name) values (test_uuid('200'), 'Amara') $$,
  'member can insert guests'
);

-- Store the token in the table we created earlier
insert into test_tokens select rsvp_token from public.guests where name = 'Amara';

-- Direct rsvp inserts are blocked; members must use submit_rsvp
select throws_ok(
  $$ insert into public.rsvps (wedding_id, name, answer) values (test_uuid('200'), 'walk-in', 'yes') $$,
  null, null, 'direct rsvp insert is blocked (must use submit_rsvp)'
);

-- a stranger sees and touches nothing ------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000012", "role": "authenticated", "email": "stranger@example.com", "email_verified": true}';

select is_empty($$ select * from public.weddings $$, 'stranger sees no weddings');
select is_empty($$ select * from public.guests $$,  'stranger sees no guests');

select throws_ok(
  $$ insert into public.guests (wedding_id, name) values (test_uuid('200'), 'intruder') $$,
  null, null, 'stranger cannot insert guests'
);
select throws_ok(
  $$ insert into public.rsvps (wedding_id, name, answer) values (test_uuid('200'), 'intruder', 'yes') $$,
  null, null, 'stranger cannot insert rsvps directly'
);

-- entitlements: clients never write ---------------------------
select throws_ok(
  $$ insert into public.entitlements (user_id, plan) values (auth.uid(), 'luxe') $$,
  null, null, 'authenticated client cannot grant itself an entitlement'
);
select is_empty($$ select * from public.entitlements $$, 'clients cannot read entitlement rows they do not own');

-- anonymous surface -------------------------------------------
set local role anon;

select is_empty($$ select * from public.weddings $$, 'anon sees no weddings');
select throws_ok(
  $$ insert into public.rsvps (wedding_id, name, answer) values (test_uuid('200'), 'anon', 'yes') $$,
  null, null, 'anon cannot write the rsvps table directly'
);

select ok(public.get_public_wedding('rls-test') is not null, 'anon can fetch the public payload by slug');
select is(
  public.get_public_wedding('rls-test') ->> 'names', 'Test & Coupled',
  'public payload carries the couple names'
);
select ok(public.get_public_wedding('does-not-exist') is null, 'unknown slug returns null');

select lives_ok(
  $$ select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text) $$,
  'anon can submit an RSVP with a valid guest token'
);
select throws_ok(
  $$ select public.submit_rsvp(null::uuid, 'nope'::text, 'x'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text) $$,
  'P0001', null, 'open-link submission against an unknown slug is rejected'
);
select throws_ok(
  $$ select public.submit_rsvp('00000000-0000-0000-0000-000000000000'::uuid, null::text, 'x'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text) $$,
  'P0001', null, 'a forged token is rejected'
);

-- burn the 6-per-hour token budget, then hit the wall
select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text);
select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text);
select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text);
select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text);
select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text);

select throws_ok(
  $$ select public.submit_rsvp((select rsvp_token from test_tokens)::uuid, null::text, 'Amara'::text, 'yes'::answer_t, null::text, null::text, 'link'::text, null::text, null::text) $$,
  'P0002', null, 'rate limit kicks in after 6 submissions per token per hour'
);

-- partner invite flow ------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000010", "role": "authenticated", "email": "owner@example.com", "email_verified": true}';

select lives_ok(
  $$ select public.invite_partner(test_uuid('200'), 'partner@example.com') $$,
  'owner can invite a partner by email'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000011", "role": "authenticated", "email": "partner@example.com", "email_verified": true}';

select is(
  (select public.accept_pending_invite() ->> 'claimed'), '1',
  'partner claims the invite on sign-in'
);
select isnt_empty(
  $$ select * from public.guests $$,
  'partner membership grants planner access'
);

select * from finish();
rollback;
