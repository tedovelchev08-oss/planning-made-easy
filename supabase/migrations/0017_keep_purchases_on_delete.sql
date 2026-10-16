-- ============================================================
-- Luma · 0017 · keep payment records when a wedding is deleted
--                (Phase 2, Block 14)
--
-- Deleting an owner's account deletes their wedding, and 0009 made
-- purchases.wedding_id ON DELETE CASCADE, so Luma's own record of a
-- payment disappeared with it. Accounting law can require keeping it (the
-- privacy policy says "as long as accounting law requires"). The row now
-- stays: wedding_id becomes null, as user_id already does (0009), so what
-- remains is an anonymous record of tier, amount, currency, date and the
-- Stripe payment reference.
--
-- Also: wedding_invites.invited_by referenced auth.users with no delete
-- rule (0001), so deleting any owner who had ever invited a partner FAILED
-- ("violates foreign key constraint wedding_invites_invited_by_fkey"),
-- from the app and from the Supabase dashboard alike. An invite sent by a
-- deleted account means nothing, so it now goes with that account.
--
-- Both foreign keys are replaced in place. Idempotent: the drops are
-- guarded and the adds always produce the same constraints.
-- ============================================================

alter table purchases drop constraint if exists purchases_wedding_id_fkey;
alter table purchases
  add constraint purchases_wedding_id_fkey
  foreign key (wedding_id) references weddings (id) on delete set null;

alter table wedding_invites drop constraint if exists wedding_invites_invited_by_fkey;
alter table wedding_invites
  add constraint wedding_invites_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete cascade;
