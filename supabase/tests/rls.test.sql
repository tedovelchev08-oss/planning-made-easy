-- ============================================================
-- Luma · RLS policy tests (pgTAP · run with `supabase db test`)
-- ============================================================

begin;
select plan(21);

-- fixtures ---------------------------------------------------
select tests.create_supabase_user('owner@example.com');
select tests.create_supabase_user('partner@example.com');
select tests.create_supabase_user('stranger@example.com');

-- the owner creates a wedding and their membership -----------
select tests.authenticate_as('owner@example.com');

select lives_ok(
  $$ insert into public.weddings (slug, names, partner_a, partner_b, date)
     values ('rls-test', 'Test & Coupled', 'Test', 'Coupled', now() + interval '30 days') $$,
  'owner can create a wedding'
);

create temp table vars as select id as wid from public.weddings where slug = 'rls-test';

select lives_ok(
  $$ insert into public.wedding_members (wedding_id, user_id, role)
     select wid, auth.uid(), 'owner' from vars $$,
  'owner can seed their membership row'
);

select lives_ok(
  $$ insert into public.guests (wedding_id, name) select wid, 'Amara' from vars $$,
  'member can insert guests'
);

select lives_ok(
  $$ insert into public.rsvps (wedding_id, name, answer) select wid, 'walk-in', 'yes' from vars $$,
  'authenticated member can insert rsvps directly'
);

create temp table tok as select rsvp_token from public.guests where name = 'Amara';

-- a stranger sees and touches nothing ------------------------
select tests.authenticate_as('stranger@example.com');

select is_empty($$ select * from public.weddings $$, 'stranger sees no weddings');
select is_empty($$ select * from public.guests $$,  'stranger sees no guests');

select throws_ok(
  $$ insert into public.guests (wedding_id, name) select wid, 'intruder' from vars $$,
  null, null, 'stranger cannot insert guests'
);
select throws_ok(
  $$ insert into public.rsvps (wedding_id, name, answer) select wid, 'intruder', 'yes' from vars $$,
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
  $$ insert into public.rsvps (wedding_id, name, answer) select wid, 'anon', 'yes' from vars $$,
  null, null, 'anon cannot write the rsvps table directly'
);

select ok(public.get_public_wedding('rls-test') is not null, 'anon can fetch the public payload by slug');
select is(
  public.get_public_wedding('rls-test') ->> 'names', 'Test & Coupled',
  'public payload carries the couple names'
);
select ok(public.get_public_wedding('does-not-exist') is null, 'unknown slug returns null');

select lives_ok(
  $$ select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link') $$,
  'anon can submit an RSVP with a valid guest token'
);
select throws_ok(
  $$ select public.submit_rsvp(null, 'nope', 'x', 'yes', null, null, 'link') $$,
  'P0001', null, 'open-link submission against an unknown slug is rejected'
);
select throws_ok(
  $$ select public.submit_rsvp('00000000-0000-0000-0000-000000000000'::uuid, null, 'x', 'yes', null, null, 'link') $$,
  'P0001', null, 'a forged token is rejected'
);

-- burn the 6-per-hour token budget, then hit the wall
select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link');
select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link');
select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link');
select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link');
select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link');

select throws_ok(
  $$ select public.submit_rsvp((select rsvp_token from tok), null, 'Amara', 'yes', null, null, 'link') $$,
  'P0002', null, 'rate limit kicks in after 6 submissions per token per hour'
);

-- partner invite flow ------------------------------------------
reset role;
select tests.authenticate_as('owner@example.com');

select lives_ok(
  $$ select public.invite_partner((select wid from vars), 'partner@example.com') $$,
  'owner can invite a partner by email'
);

select tests.authenticate_as('partner@example.com');
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
