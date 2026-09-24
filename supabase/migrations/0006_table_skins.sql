-- Table surfaces for the seating floor plan.
--
-- Additive and idempotent: existing rows take the house default ('linen'),
-- which is what they already render as, so this is a no-op for every plan
-- currently stored. Nothing is rewritten and nothing can be lost.
--
-- Skins other than 'linen' are a Premium Luxe feature. That entitlement is
-- enforced in the client UI only; a row carrying any valid skin is accepted
-- here, exactly as `shape` and `capacity` are. The value is cosmetic and grants
-- no access to anything, so it is not a security boundary — unlike
-- `entitlements`, which stays read-own with no write policy.

alter table tables
  add column if not exists skin text not null default 'linen';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tables_skin_check'
  ) then
    alter table tables
      add constraint tables_skin_check
      check (skin in ('linen', 'marble', 'oak', 'noir'));
  end if;
end $$;
