-- ============================================================
-- Luma · pgTAP · the free plan's guest limit (0010)
-- Run with: supabase test db
-- ============================================================

begin;
select plan(11);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres, before any role switch ------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('51'), 'free@example.com', 'hashed', now()),
       (test_uuid('52'), 'paid@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date, plan)
values (test_uuid('500'), test_uuid('51'), 'free-limit', 'Free & Couple', now() + interval '1 year', 'essential'),
       (test_uuid('501'), test_uuid('52'), 'paid-limit', 'Paid & Couple', now() + interval '1 year', 'celebration');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('500'), test_uuid('51'), 'owner'), (test_uuid('501'), test_uuid('52'), 'owner');

-- 49 guests already on the free wedding, 60 on the paid one
insert into guests (id, wedding_id, name)
select test_uuid((1000 + n)::text), test_uuid('500'), 'Guest ' || n from generate_series(1, 49) n;
insert into guests (wedding_id, name)
select test_uuid('501'), 'Paid guest ' || n from generate_series(1, 60) n;

-- the free couple --------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000051", "role": "authenticated"}';

-- at 49: the first of two rows would fit, the second would be the 51st
select throws_ok(
  $$ insert into guests (wedding_id, name) values (test_uuid('500'), 'a'), (test_uuid('500'), 'b') $$,
  'P0005', null,
  'a multi-row insert cannot slip past the limit'
);
select is(
  (select count(*)::int from guests where wedding_id = test_uuid('500')), 49,
  'and the refused statement added nobody'
);
select lives_ok(
  $$ insert into guests (id, wedding_id, name) values (test_uuid('1050'), test_uuid('500'), 'The fiftieth') $$,
  'the 50th guest fits on the free plan'
);
select throws_ok(
  $$ insert into guests (wedding_id, name) values (test_uuid('500'), 'The fifty-first') $$,
  'P0005', null,
  'the 51st guest is refused on the free plan'
);
select lives_ok(
  $$ insert into guests (id, wedding_id, name) values (test_uuid('1001'), test_uuid('500'), 'Guest 1, renamed')
     on conflict (id) do update set name = excluded.name $$,
  'editing a guest at the limit still saves (the app saves edits as upserts)'
);
select is(
  (select name from guests where id = test_uuid('1001')), 'Guest 1, renamed',
  'and the edit landed'
);
select lives_ok(
  $$ delete from guests where id = test_uuid('1002') $$,
  'removing a guest is always allowed'
);
select lives_ok(
  $$ insert into guests (wedding_id, name) values (test_uuid('500'), 'Takes the freed place') $$,
  'and frees a place for a new one'
);
select is(
  (select count(*)::int from guests where wedding_id = test_uuid('500')), 50,
  'the free wedding ends with exactly 50 guests, none lost'
);

-- a paid couple --------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000052", "role": "authenticated"}';
select lives_ok(
  $$ insert into guests (wedding_id, name) values (test_uuid('501'), 'Guest sixty-one') $$,
  'Celebration has no guest limit'
);

-- the service role ------------------------------------------------------------
set local role service_role;
select lives_ok(
  $$ insert into guests (wedding_id, name) values (test_uuid('500'), 'Added by the server') $$,
  'the service role is not limited'
);

select * from finish();
rollback;
