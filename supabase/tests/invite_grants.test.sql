-- ============================================================
-- Luma · pgTAP · partner invites are for signed-in users only (0014)
-- Run with: supabase test db
--
-- Supabase grants EXECUTE on new functions to anon directly, so the
-- "revoke ... from public" in 0002/0008 never took it away from signed-out
-- visitors. Both functions refuse them today (no uid, no email), but
-- signed-out callers should not reach them at all.
-- ============================================================

begin;
select plan(8);

-- who may call what --------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.accept_pending_invite()', 'execute'),
  'anon cannot execute accept_pending_invite'
);
select ok(
  not has_function_privilege('anon', 'public.invite_partner(uuid, text)', 'execute'),
  'anon cannot execute invite_partner'
);
select ok(
  has_function_privilege('authenticated', 'public.accept_pending_invite()', 'execute'),
  'signed-in users still can execute accept_pending_invite'
);
select ok(
  has_function_privilege('authenticated', 'public.invite_partner(uuid, text)', 'execute'),
  'signed-in users still can execute invite_partner'
);
select ok(
  not has_function_privilege('public', 'public.accept_pending_invite()', 'execute'),
  'PUBLIC has no execute on accept_pending_invite'
);
select ok(
  not has_function_privilege('public', 'public.invite_partner(uuid, text)', 'execute'),
  'PUBLIC has no execute on invite_partner'
);

-- and it holds when actually called ---------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select throws_ok(
  $$ select accept_pending_invite() $$,
  '42501', null,
  'a signed-out call to accept_pending_invite is refused'
);
select throws_ok(
  $$ select invite_partner('00000000-0000-0000-0000-000000000001'::uuid, 'x@example.com') $$,
  '42501', null,
  'a signed-out call to invite_partner is refused'
);

select * from finish();
rollback;
