-- ============================================================
-- Luma · 0012 · close the direct RSVP path (Block 5, step 2)
--
-- Since 0011 the guest page sends RSVPs through api/rsvp.ts, which checks
-- a Turnstile token and a per-visitor limit before calling
-- submit_rsvp_verified (service role only). That path is live and a real
-- guest RSVP has gone through it on production.
--
-- The anonymous submit_rsvp RPC still answered anyone with the link,
-- which let a caller skip both checks and exhaust a wedding's shared
-- allowance. Nothing in the app calls it any more, so anon and signed-in
-- users lose EXECUTE on it. The function stays (the service role keeps its
-- default grant), so nothing that depends on it breaks.
--
-- Supabase grants EXECUTE to anon and authenticated directly, not only via
-- PUBLIC, so each role is revoked by name. Idempotent.
-- ============================================================

revoke execute on function submit_rsvp(uuid, text, text, answer_t, text, text, text, text, text)
  from public, anon, authenticated;
