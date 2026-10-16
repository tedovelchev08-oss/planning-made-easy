-- ============================================================
-- Luma · 0014 · partner invites are for signed-in users only
--
-- 0002 and 0008 revoked EXECUTE on accept_pending_invite() and
-- invite_partner() from PUBLIC and granted it to authenticated. But
-- Supabase grants EXECUTE on new functions to anon (and authenticated)
-- directly, so signed-out visitors could still call both. Each refuses
-- them today (no auth.uid(), no email in the token), but a signed-out
-- caller has no business reaching either: anon loses EXECUTE by name, as
-- 0012 did for submit_rsvp. Signed-in users keep it.
--
-- Revokes and grants only; idempotent.
-- ============================================================

revoke execute on function accept_pending_invite() from public, anon;
revoke execute on function invite_partner(uuid, text) from public, anon;

grant execute on function accept_pending_invite() to authenticated;
grant execute on function invite_partner(uuid, text) to authenticated;
