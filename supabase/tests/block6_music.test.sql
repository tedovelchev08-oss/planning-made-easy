-- ============================================================
-- Luma · pgTAP · Block 6: the uploaded song reaches guests (0013)
-- Run with: supabase test db
-- ============================================================

begin;
select plan(10);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres, before any role switch ------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('71'), 'couple6@example.com', 'hashed', now()),
       (test_uuid('72'), 'stranger6@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date, plan)
values (test_uuid('700'), test_uuid('71'), 'b6-song', 'Song & Couple', now() + interval '1 year', 'luxe'),
       (test_uuid('701'), test_uuid('71'), 'b6-closed', 'Quiet & Couple', now() + interval '1 year', 'luxe');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('700'), test_uuid('71'), 'owner'), (test_uuid('701'), test_uuid('71'), 'owner');

insert into invitation_config (wedding_id, template_id, is_live, music, music_url)
values
  (test_uuid('700'), 'tp13', true, '{"track": "upload", "uploadName": "Our first dance"}',
   'https://example.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000700/music/song.mp3'),
  (test_uuid('701'), 'tp13', false, '{"track": "upload", "uploadName": "Secret song"}',
   'https://example.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000701/music/secret.mp3');

-- Storage blocks raw SQL deletes with a guard trigger; the Storage API
-- clears it per request with this setting. Setting it here, for this test
-- transaction only, lets the delete POLICIES (the thing under test) decide.
set local storage.allow_delete_query = 'true';

-- a song already stored for the couple's wedding
insert into storage.objects (bucket_id, name)
values ('media', '00000000-0000-0000-0000-000000000700/music/existing.mp3');

-- what guests receive ------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is(
  get_public_wedding('b6-song') #>> '{invitation,music,url}',
  'https://example.supabase.co/storage/v1/object/public/media/00000000-0000-0000-0000-000000000700/music/song.mp3',
  'guests receive the uploaded song''s address'
);
select is(
  get_public_wedding('b6-song') #>> '{invitation,music,uploadName}', 'Our first dance',
  'and its name'
);
select is(
  get_public_wedding('b6-song') #>> '{invitation,music,track}', 'upload',
  'and that the upload is the track to play'
);
select is(
  get_public_wedding('b6-closed'), '{"slug": "b6-closed", "live": false}'::jsonb,
  'a closed invitation still reveals nothing, the song included'
);

-- storage: a stranger can't touch the couple's songs ---------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000072", "role": "authenticated"}';

select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-000000000700/music/intruder.mp3') $$,
  '42501', null,
  'a stranger cannot upload into the couple''s music folder'
);

delete from storage.objects where name = '00000000-0000-0000-0000-000000000700/music/existing.mp3';

set local role postgres;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000000700/music/existing.mp3'), 1,
  'a stranger cannot delete the couple''s song'
);

-- the couple manages their own ----------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000071", "role": "authenticated"}';

select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('media', '00000000-0000-0000-0000-000000000700/music/new-song.mp3') $$,
  'the couple uploads a song into their wedding''s music folder'
);
select lives_ok(
  $$ delete from storage.objects where name = '00000000-0000-0000-0000-000000000700/music/existing.mp3' $$,
  'the couple can delete a replaced song'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('media', 'music/no-wedding-folder.mp3') $$,
  '42501', null,
  'a song outside a wedding folder is refused'
);

set local role postgres;
select is(
  (select count(*)::int from storage.objects where name = '00000000-0000-0000-0000-000000000700/music/existing.mp3'), 0,
  'and the replaced song is gone'
);

select * from finish();
rollback;
