-- ============================================================
-- Twofold · pgTAP · the registry on the invitation (0021)
-- Run with: supabase test db
--
-- The separate website is retired. A live invitation carries its registry,
-- with only http(s) links; a closed one still reveals nothing.
-- ============================================================

begin;
select plan(5);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('211'), 'owner21@example.com', 'hashed', now());
insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('2100'), test_uuid('211'), 'r21-open', 'Ana & Boris', now() + interval '1 year'),
       (test_uuid('2101'), test_uuid('211'), 'r21-closed', 'Closed & Couple', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('2100'), test_uuid('211'), 'owner'), (test_uuid('2101'), test_uuid('211'), 'owner');
insert into invitation_config (wedding_id, template_id, is_live)
values (test_uuid('2100'), 'tp1', true), (test_uuid('2101'), 'tp1', false);
insert into registry_items (wedding_id, name, store, url, sort)
values (test_uuid('2100'), 'Walnut boards', 'Etsy', 'https://etsy.com/x', 0),
       (test_uuid('2100'), 'Odd link', 'Shop', 'javascript:alert(1)', 1),
       (test_uuid('2101'), 'Hidden', 'Shop', 'https://example.com', 0);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  get_public_wedding('r21-open') #>> '{registry,0,name}', 'Walnut boards',
  'a live invitation carries its registry, website or not'
);
select is(
  get_public_wedding('r21-open') #>> '{registry,0,url}', 'https://etsy.com/x',
  'with the gift''s link'
);
select ok(
  get_public_wedding('r21-open') #> '{registry,1,url}' = 'null'::jsonb,
  'a link that isn''t http(s) never leaves the database'
);
select is(
  get_public_wedding('r21-open') -> 'website', '{"published": false}'::jsonb,
  'the retired website reports itself unpublished'
);
select is(
  get_public_wedding('r21-closed'), '{"slug": "r21-closed", "live": false}'::jsonb,
  'a closed invitation still reveals nothing'
);

select * from finish();
rollback;
