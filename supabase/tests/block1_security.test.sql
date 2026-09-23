-- ============================================================
-- Luma · pgTAP tests for Block 1 security fixes
--
-- These tests verify:
--   1a. weddings.plan authority (trigger)
--   1b. webhook_events RLS
--   1c. storage media bucket scoped to wedding folders
--   1d. accept_pending_invite email verification
--
-- Run with: supabase test db
-- ============================================================

begin;

select plan(14);

-- ---------- helpers ----------

-- Create two test users
select tests_create_user('owner@example.com', 'owner-uuid') as owner_id;
select tests_create_user('partner@example.com', 'partner-uuid') as partner_id;
select tests_create_user('outsider@example.com', 'outsider-uuid') as outsider_id;

-- Owner creates a wedding
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';

insert into weddings (id, owner_id, slug, names, date)
values ('wedding-uuid', 'owner-uuid', 'test-wedding', 'Test & Wedding', now() + interval '1 year');

insert into wedding_members (wedding_id, user_id, role)
values ('wedding-uuid', 'owner-uuid', 'owner');

-- ---------- 1a. weddings.plan authority ----------

-- Test 1: Member cannot update plan directly
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';

update weddings set plan = 'luxe' where id = 'wedding-uuid';

select results_eq(
  $$select plan from weddings where id = 'wedding-uuid'$$,
  $$values ('essential'::plan_t)$$,
  'Member update of weddings.plan is blocked by trigger'
);

-- Test 2: Member cannot insert with non-essential plan
insert into weddings (id, owner_id, slug, names, date, plan)
values ('wedding-2-uuid', 'owner-uuid', 'test-wedding-2', 'Test 2 & Wedding', now() + interval '1 year', 'luxe');

select results_eq(
  $$select plan from weddings where id = 'wedding-2-uuid'$$,
  $$values ('essential'::plan_t)$$,
  'Member insert with plan=luxe is forced to essential by trigger'
);

-- Test 3: Member cannot change owner_id
update weddings set owner_id = 'partner-uuid' where id = 'wedding-uuid';

select results_eq(
  $$select owner_id from weddings where id = 'wedding-uuid'$$,
  $$values ('owner-uuid'::uuid)$$,
  'Member update of weddings.owner_id is blocked by trigger'
);

-- Test 4: Service role CAN update plan (webhook path)
set local role service_role;

update weddings set plan = 'luxe' where id = 'wedding-uuid';

select results_eq(
  $$select plan from weddings where id = 'wedding-uuid'$$,
  $$values ('luxe'::plan_t)$$,
  'Service role can update weddings.plan (webhook path)'
);

-- Reset for next tests
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';

-- ---------- 1b. webhook_events RLS ----------

-- Test 5: Anon cannot select from webhook_events
set local role anon;

select throws_ok(
  $$select * from webhook_events$$,
  '42501',
  'new row violates row-level security policy for table "webhook_events"',
  'Anon cannot select from webhook_events'
);

-- Test 6: Authenticated cannot select from webhook_events
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';

select throws_ok(
  $$select * from webhook_events$$,
  '42501',
  'new row violates row-level security policy for table "webhook_events"',
  'Authenticated cannot select from webhook_events'
);

-- Test 7: Service role can select from webhook_events
set local role service_role;

select lives_ok(
  $$select * from webhook_events$$,
  'Service role can select from webhook_events'
);

-- ---------- 1c. storage media bucket ----------

-- Test 8: User cannot insert into another wedding's folder
set local role authenticated;
set request.jwt.claim.sub = 'outsider-uuid';

select throws_ok(
  $$insert into storage.objects (name, bucket_id) values ('wedding-uuid/test.jpg', 'media')$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'User cannot insert into another wedding folder'
);

-- Test 9: Member can insert into their own wedding's folder
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';

select lives_ok(
  $$insert into storage.objects (name, bucket_id) values ('wedding-uuid/test.jpg', 'media')$$,
  'Member can insert into their own wedding folder'
);

-- ---------- 1d. accept_pending_invite email verification ----------

-- Test 10: Unverified email cannot claim invite
set local role authenticated;
set request.jwt.claim.sub = 'partner-uuid';
set request.jwt.claim.email = 'partner@example.com';
set request.jwt.claim.email_verified = 'false';

-- Insert an invite
set local role authenticated;
set request.jwt.claim.sub = 'owner-uuid';
insert into wedding_invites (wedding_id, email, invited_by)
values ('wedding-uuid', 'partner@example.com', 'owner-uuid');

-- Partner tries to claim with unverified email
set local role authenticated;
set request.jwt.claim.sub = 'partner-uuid';
set request.jwt.claim.email = 'partner@example.com';
set request.jwt.claim.email_verified = 'false';

select results_eq(
  $$select claimed from accept_pending_invite()$$,
  $$values (0::int)$$,
  'Unverified email cannot claim invite'
);

-- Test 11: Verified email can claim invite
set request.jwt.claim.email_verified = 'true';

select results_eq(
  $$select claimed from accept_pending_invite()$$,
  $$values (1::int)$$,
  'Verified email can claim invite'
);

-- Test 12: Partner is now a member
select results_eq(
  $$select count(*)::int from wedding_members where wedding_id = 'wedding-uuid' and user_id = 'partner-uuid'$$,
  $$values (1::int)$$,
  'Partner is added to wedding_members after claiming invite'
);

-- ---------- Backfill test ----------

-- Test 13: Backfill sets wedding plan to highest member entitlement
-- Setup: partner has luxe entitlement
set local role service_role;
insert into entitlements (user_id, plan) values ('partner-uuid', 'luxe');

-- Wedding should now be luxe after backfill (already ran in migration)
select results_eq(
  $$select plan from weddings where id = 'wedding-uuid'$$,
  $$values ('luxe'::plan_t)$$,
  'Backfill sets wedding plan to highest member entitlement'
);

-- Test 14: Service role can update plan after backfill
update weddings set plan = 'celebration' where id = 'wedding-uuid';

select results_eq(
  $$select plan from weddings where id = 'wedding-uuid'$$,
  $$values ('celebration'::plan_t)$$,
  'Service role can still update plan after backfill'
);

-- ---------- cleanup ----------

rollback;
