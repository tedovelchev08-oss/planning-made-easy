-- ============================================================
-- Luma · pgTAP · Block 18a: the owner's own invitation designs read the
-- couple's design details (0020 invitation_config.design_data)
-- Run with: supabase test db
--
-- Designs like Celestial show a dress code, an RSVP deadline, a schedule
-- and an FAQ. Those live in invitation_config.design_data and reach guests
-- through get_public_wedding, only while the invitation is open.
-- ============================================================

begin;
select plan(8);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('181'), 'owner18@example.com', 'hashed', now()),
       (test_uuid('182'), 'stranger18@example.com', 'hashed', now());
insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('1800'), test_uuid('181'), 'b18-open', 'Ana & Boris', now() + interval '1 year'),
       (test_uuid('1801'), test_uuid('181'), 'b18-closed', 'Closed & Couple', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('1800'), test_uuid('181'), 'owner'), (test_uuid('1801'), test_uuid('181'), 'owner');
insert into invitation_config (wedding_id, template_id, is_live)
values (test_uuid('1800'), 'studio:celestial', true), (test_uuid('1801'), 'studio:celestial', false);

select has_column('public', 'invitation_config', 'design_data', 'invitation_config has design_data');
select is(
  (select design_data from invitation_config where wedding_id = test_uuid('1800')), '{}'::jsonb,
  'it starts empty'
);

-- the couple fills it in ---------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000181", "role": "authenticated"}';
select lives_ok(
  $$ update invitation_config
       set design_data = '{"dressCode": "Black tie", "rsvpDeadline": "1 March 2027", "schedule": [{"time": "16:00", "title": "Ceremony"}]}'::jsonb
     where wedding_id in ('00000000-0000-0000-0000-000000001800', '00000000-0000-0000-0000-000000001801') $$,
  'a member saves the design details'
);
select throws_ok(
  $$ update invitation_config set design_data = jsonb_build_object('notes', repeat('x', 40000))
     where wedding_id = '00000000-0000-0000-0000-000000001800' $$,
  '23514', null,
  'design details are capped in size'
);

-- a stranger can't --------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000182", "role": "authenticated"}';
update invitation_config set design_data = '{"dressCode": "hacked"}'::jsonb where wedding_id = test_uuid('1800');

-- what guests receive -------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  get_public_wedding('b18-open') #>> '{invitation,design_data,dressCode}', 'Black tie',
  'guests of an open invitation receive the design details (and the stranger''s edit never landed)'
);
select is(
  get_public_wedding('b18-open') #>> '{invitation,design_data,schedule,0,title}', 'Ceremony',
  'including the schedule'
);
select is(
  get_public_wedding('b18-open') #>> '{invitation,template_id}', 'studio:celestial',
  'and which design to show'
);
select is(
  get_public_wedding('b18-closed'), '{"slug": "b18-closed", "live": false}'::jsonb,
  'a closed invitation still reveals nothing'
);

select * from finish();
rollback;
