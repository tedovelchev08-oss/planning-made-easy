-- ============================================================
-- Twofold · pgTAP · Block 19: a couple's own designs can't be stored at
-- any size (0022 custom_templates_size)
-- Run with: supabase test db
-- ============================================================

begin;
select plan(3);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('191'), 'owner19@example.com', 'hashed', now());
insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('1900'), test_uuid('191'), 'b19', 'Ana & Boris', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('1900'), test_uuid('191'), 'owner');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000191", "role": "authenticated"}';

select lives_ok(
  $$ insert into custom_templates (wedding_id, name, data_url)
     values ('00000000-0000-0000-0000-000000001900', 'Our card', 'data:image/jpeg;base64,' || repeat('a', 200000)) $$,
  'an ordinary image is saved'
);
select throws_ok(
  $$ insert into custom_templates (wedding_id, name, data_url)
     values ('00000000-0000-0000-0000-000000001900', 'Too big', repeat('a', 4600000)) $$,
  '23514', null,
  'an image past the limit is refused, even through the API'
);
select throws_ok(
  $$ insert into custom_templates (wedding_id, name, html)
     values ('00000000-0000-0000-0000-000000001900', 'Too big', repeat('a', 4600000)) $$,
  '23514', null,
  'so is a page past the limit'
);

select * from finish();
rollback;
