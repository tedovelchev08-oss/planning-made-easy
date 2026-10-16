-- ============================================================
-- Luma · pgTAP · Block 13a: partners can't silently overwrite each other
-- (0018 row versions)
-- Run with: supabase test db
--
-- Every planner row carries updated_at. A client that sends the version it
-- last saw is refused (P0409) when the row changed since, or was deleted
-- since; a client that sends no version (an old tab) works as before.
-- ============================================================

begin;
select plan(17);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres ---------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('131'), 'owner13@example.com', 'hashed', now());
insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('1300'), test_uuid('131'), 'b13-wedding', 'Version & Me', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role) values (test_uuid('1300'), test_uuid('131'), 'owner');
insert into guests (id, wedding_id, name)
values (test_uuid('1310'), test_uuid('1300'), 'Priya Desai'),
       (test_uuid('1311'), test_uuid('1300'), 'Will Be Deleted');

-- a helper to read a guest's current version, as postgres (RLS-free)
create or replace function test_guest_version(p uuid) returns timestamptz
language sql security definer set search_path = public
as $$ select updated_at from guests where id = p $$;

-- the versions each tab "loaded", captured now (as postgres) and readable by the couple
create temporary table seen as select updated_at as v from guests where id = test_uuid('1310');
create temporary table seen_new as select updated_at as v from guests where id = test_uuid('1311');
grant select on seen, seen_new to authenticated;

select has_column('public', 'guests', 'updated_at', 'guests have a version');
select has_column('public', 'invitation_config', 'updated_at', 'invitation_config has a version');
select ok(test_guest_version(test_uuid('1310')) is not null, 'a new row gets a version');

-- as the couple ---------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000131", "role": "authenticated"}';

select lives_ok(
  $$ insert into guests (id, wedding_id, name, updated_at)
     values ('00000000-0000-0000-0000-000000001310', '00000000-0000-0000-0000-000000001300', 'Priya D.', (select v from seen))
     on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at $$,
  'an edit based on the current version saves'
);
select ok(
  test_guest_version(test_uuid('1310')) > (select v from seen),
  'and the version moves on'
);

-- the other partner's tab still holds the OLD version
select throws_ok(
  $$ insert into guests (id, wedding_id, name, updated_at)
     values ('00000000-0000-0000-0000-000000001310', '00000000-0000-0000-0000-000000001300', 'Stale Name', (select v from seen))
     on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at $$,
  'P0409', null,
  'an edit based on an old version is refused'
);
select is(
  (select name from guests where id = test_uuid('1310')), 'Priya D.',
  'and the newer edit survives'
);

select throws_ok(
  $$ update guests set name = 'Stale Again', updated_at = (select v from seen)
     where id = '00000000-0000-0000-0000-000000001310' $$,
  'P0409', null,
  'a plain update with an old version is refused too'
);

-- an old tab that sends no version at all keeps working
select lives_ok(
  $$ update guests set notes = 'old tab' where id = '00000000-0000-0000-0000-000000001310' $$,
  'a write without a version still saves (old tabs keep working)'
);
select lives_ok(
  $$ insert into guests (id, wedding_id, name)
     values ('00000000-0000-0000-0000-000000001313', '00000000-0000-0000-0000-000000001300', 'New Guest')
     on conflict (id) do update set name = excluded.name $$,
  'a brand-new row without a version saves'
);
select lives_ok(
  $$ insert into guests (id, wedding_id, name, updated_at)
     values ('00000000-0000-0000-0000-000000001312', '00000000-0000-0000-0000-000000001300', 'Newer Guest', null)
     on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at $$,
  'a brand-new row with a null version saves'
);
select ok(
  test_guest_version(test_uuid('1312')) is not null,
  'and gets a version'
);

-- a row the other partner DELETED doesn't come back -------------------------
delete from guests where id = test_uuid('1311');

select throws_ok(
  $$ insert into guests (id, wedding_id, name, updated_at)
     values ('00000000-0000-0000-0000-000000001311', '00000000-0000-0000-0000-000000001300', 'Back From The Dead', (select v from seen_new))
     on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at $$,
  'P0409', null,
  'editing a row someone deleted is refused, not re-inserted'
);
select is(
  (select count(*)::int from guests where id = test_uuid('1311')), 0,
  'and it stays deleted'
);

-- single-row config tables (keyed by wedding_id) ------------------------------
select lives_ok(
  $$ insert into invitation_config (wedding_id, line1, updated_at)
     values ('00000000-0000-0000-0000-000000001300', 'First', null)
     on conflict (wedding_id) do update set line1 = excluded.line1, updated_at = excluded.updated_at $$,
  'the invitation saves without a version the first time'
);
select throws_ok(
  $$ insert into invitation_config (wedding_id, line1, updated_at)
     values ('00000000-0000-0000-0000-000000001300', 'Stale', '2000-01-01T00:00:00Z')
     on conflict (wedding_id) do update set line1 = excluded.line1, updated_at = excluded.updated_at $$,
  'P0409', null,
  'the invitation refuses an old version'
);

-- the vendor RPC honours versions too
select throws_ok(
  $$ select save_vendor('00000000-0000-0000-0000-000000001300'::uuid,
       '{"id": "00000000-0000-0000-0000-000000001390", "category": "Venue", "company": "Gone",
         "updated_at": "2000-01-01T00:00:00Z"}'::jsonb, '[]'::jsonb) $$,
  'P0409', null,
  'save_vendor refuses to re-create a vendor someone deleted'
);

select * from finish();
rollback;
