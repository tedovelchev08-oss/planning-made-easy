-- ============================================================
-- Luma · pgTAP · Block 5: RSVP limits, live flag, server-only paths (0011)
-- Run with: supabase test db
-- ============================================================

begin;
select plan(19);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres, before any role switch ------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('61'), 'b5@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('600'), test_uuid('61'), 'b5-live', 'Live & Couple', now() + interval '1 year'),
       (test_uuid('601'), test_uuid('61'), 'b5-closed', 'Closed & Couple', now() + interval '1 year'),
       (test_uuid('602'), test_uuid('61'), 'b5-legacy', 'Legacy & Couple', now() + interval '1 year');
insert into invitation_config (wedding_id, template_id, is_live) values (test_uuid('600'), 'tp13', true);
-- no is_live given: the column default, which is what every new wedding gets
insert into invitation_config (wedding_id, template_id) values (test_uuid('601'), 'tp13');
-- 602 has no invitation_config row at all, like weddings that predate it

-- the public payload --------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  get_public_wedding('b5-closed'), '{"slug": "b5-closed", "live": false}'::jsonb,
  'a new wedding starts closed: only its slug and live=false'
);
select is(
  (get_public_wedding('b5-closed') ? 'names') or (get_public_wedding('b5-closed') ? 'date'), false,
  'a closed wedding exposes no names or date'
);
select is(get_public_wedding('b5-live') ->> 'names', 'Live & Couple', 'a live wedding returns its full payload');
select is((get_public_wedding('b5-live') ->> 'live')::boolean, true, 'and says it is live');
select is(get_public_wedding('b5-legacy') ->> 'names', 'Legacy & Couple', 'a wedding with no invitation row still loads');

-- the old anonymous path: limits and rules ---------------------------------
select throws_ok(
  $$ select submit_rsvp(null, 'b5-closed', 'Guest', 'yes', null, null, 'link') $$,
  'P0006', null,
  'a closed wedding refuses RSVPs'
);
select throws_ok(
  $$ select submit_rsvp(null, 'b5-live', repeat('x', 121), 'yes', null, null, 'link') $$,
  'P0003', null,
  'a 121-character name is refused'
);
select throws_ok(
  $$ select submit_rsvp(null, 'b5-live', 'Guest', 'yes', null, repeat('x', 1001), 'link') $$,
  'P0003', null,
  'a 1001-character note is refused'
);
select throws_ok(
  $$ select submit_rsvp(null, 'b5-live', 'Guest', 'yes', repeat('x', 81), null, 'link') $$,
  'P0003', null,
  'an 81-character meal is refused'
);
select throws_ok(
  $$ select submit_rsvp(null, 'b5-live', 'Guest', 'yes', null, null, 'link', repeat('x', 121)) $$,
  'P0003', null,
  'a 121-character plus-one is refused'
);
select throws_ok(
  $$ select submit_rsvp(null, 'b5-live', 'Guest', 'yes', null, null, 'tiktok') $$,
  'P0003', null,
  'a source outside the allowlist is refused'
);
select lives_ok(
  $$ select submit_rsvp(null, 'b5-live', repeat('x', 120), 'yes', repeat('m', 80), repeat('n', 1000), 'whatsapp') $$,
  'answers exactly at every limit are accepted'
);

-- server-only functions -------------------------------------------------------
select throws_ok(
  $$ select submit_rsvp_verified(null, 'b5-live', 'Guest', 'yes', null, null, 'link') $$,
  '42501', null,
  'anon cannot call the verified path directly'
);
select throws_ok(
  $$ select rsvp_rate_hit(null, 'b5-live', 'hash', 10) $$,
  '42501', null,
  'anon cannot touch the rate limiter'
);
select throws_ok(
  $$ select submit_rsvp_impl(null, 'b5-live', 'Guest', 'yes', null, null, 'link', null, null, 100000) $$,
  '42501', null,
  'anon cannot call the implementation with its own ceiling'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000061", "role": "authenticated"}';
select throws_ok(
  $$ select submit_rsvp_verified(null, 'b5-live', 'Guest', 'yes', null, null, 'link') $$,
  '42501', null,
  'a signed-in user cannot call the verified path either'
);

-- the server's path --------------------------------------------------------------
set local role service_role;
set local request.jwt.claims = '{"role": "service_role"}';

select lives_ok(
  $$ select submit_rsvp_verified(null, 'b5-live', 'Verified guest', 'yes', null, null, 'link') $$,
  'the service role submits through the verified path'
);
select is(
  (select array_agg(rsvp_rate_hit(null, 'b5-live', 'visitor-a', 3) order by n) from generate_series(1, 4) n),
  array[true, true, true, false],
  'the per-visitor limit allows 3 then blocks the 4th'
);
select is(
  rsvp_rate_hit(null, 'b5-live', 'visitor-b', 3), true,
  'a different visitor has their own allowance'
);

select * from finish();
rollback;
