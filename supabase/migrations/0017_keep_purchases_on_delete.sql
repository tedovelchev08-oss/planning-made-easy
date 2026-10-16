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
-- Replaces the foreign key in place. Idempotent: the drop is guarded and
-- the add always produces the same constraint.
-- ============================================================

alter table purchases drop constraint if exists purchases_wedding_id_fkey;
alter table purchases
  add constraint purchases_wedding_id_fkey
  foreign key (wedding_id) references weddings (id) on delete set null;
