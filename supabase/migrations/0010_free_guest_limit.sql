-- ============================================================
-- Luma · 0010 · the free plan's guest limit, enforced in the database
--
-- The free plan ("Engaged", stored as 'essential') includes up to 50
-- guests. The app refuses a 51st, but the API is reachable directly, so
-- the limit is enforced here too.
--
--   · Only NEW guests count: guests.upsert(...) is how the app saves an
--     edit, and Postgres runs BEFORE INSERT triggers for an upsert even
--     when it turns into an update. A row that already exists is an edit
--     and always passes.
--   · Nothing is ever removed: a wedding already over 50 (or one that drops
--     back to the free plan after a refund) keeps every guest; it just
--     can't add more until it upgrades.
--   · SECURITY INVOKER on purpose: the count runs under the caller's RLS,
--     and current_user is the caller, so the service role still passes.
--
-- The 50 mirrors FREE_GUEST_LIMIT in src/lib/plans.ts; a vitest reads this
-- file and fails if they differ.
-- ============================================================

create or replace function enforce_free_guest_limit()
returns trigger
language plpgsql
as $$
declare
  v_plan  plan_t;
  v_count integer;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return NEW;
  end if;

  -- an upsert of an existing guest is an edit, not a new guest
  if exists (select 1 from guests where id = NEW.id) then
    return NEW;
  end if;

  select plan into v_plan from weddings where id = NEW.wedding_id;
  if v_plan is distinct from 'essential' then
    return NEW;
  end if;

  select count(*) into v_count from guests where wedding_id = NEW.wedding_id;
  if v_count >= 50 then
    raise exception 'The free plan includes up to 50 guests'
      using errcode = 'P0005', hint = 'Upgrade to Celebration for unlimited guests.';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_free_guest_limit on guests;

create trigger trg_enforce_free_guest_limit
  before insert on guests
  for each row
  execute function enforce_free_guest_limit();
