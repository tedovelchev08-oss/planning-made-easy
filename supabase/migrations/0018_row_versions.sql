-- ============================================================
-- Luma · 0018 · row versions: partners can't silently overwrite each other
--                (Phase 2, Block 13a)
--
-- Every save is a full-row write of the copy a tab loaded. Partner B's
-- tab, open for hours, wrote its stale guest over partner A's newer edit,
-- and an edit to a guest A had deleted re-inserted it.
--
-- Now every planner row has updated_at, kept by the row_version trigger:
--   · A client may send the version it last saw (updated_at). If the row
--     has changed since, or no longer exists, the write is refused with
--     SQLSTATE P0409. The app then reloads and says so.
--   · A client that sends no version (null, or omits the column: an old
--     tab, the webhook, an RPC) writes exactly as before.
--   · Every successful write stamps a new version (clock_timestamp()).
--
-- How "sent a version" is told apart: an omitted column takes its default,
-- now(), the transaction's start time, which no client can have seen
-- before. So a value that is null or equal to now() means "no version".
--
-- INSERT ... ON CONFLICT runs the BEFORE INSERT trigger on the proposed row
-- first, so the INSERT branch looks the row up by its key (trigger arg):
-- if it exists, the UPDATE branch decides; if not and a version was sent,
-- it was deleted by someone else.
--
-- save_vendor (0015) is redefined to pass the version through and return
-- the new one. Additive and idempotent.
-- ============================================================

create or replace function row_version()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_key     text := tg_argv[0];
  v_sent    boolean := new.updated_at is not null and new.updated_at <> now();
  v_exists  boolean;
begin
  if tg_op = 'INSERT' then
    execute format('select exists (select 1 from %I.%I where %I = ($1).%I)',
                   tg_table_schema, tg_table_name, v_key, v_key)
      into v_exists using new;
    if v_exists then
      -- an upsert of an existing row: the UPDATE branch checks it. NOT NULL
      -- is checked on this proposed row before the conflict is found, so a
      -- missing version becomes now(), which the UPDATE branch reads as
      -- "no version sent"
      if new.updated_at is null then new.updated_at := now(); end if;
      return new;
    end if;
    if v_sent then
      raise exception 'this was deleted by someone else' using errcode = 'P0409';
    end if;
    new.updated_at := clock_timestamp();
    return new;
  end if;

  -- UPDATE: a version that was sent must be the current one
  if v_sent and new.updated_at is distinct from old.updated_at then
    raise exception 'this was changed by someone else' using errcode = 'P0409';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('weddings', 'id'), ('guests', 'id'), ('tables', 'id'), ('venue_objects', 'id'),
      ('budget_categories', 'id'), ('tasks', 'id'), ('vendors', 'id'), ('registry_items', 'id'),
      ('custom_templates', 'id'), ('invitation_config', 'wedding_id'), ('website_config', 'wedding_id')
    ) as x(name, key)
  loop
    execute format('alter table %I add column if not exists updated_at timestamptz not null default now()', t.name);
    execute format('drop trigger if exists trg_row_version on %I', t.name);
    execute format(
      'create trigger trg_row_version before insert or update on %I for each row execute function row_version(%L)',
      t.name, t.key);
  end loop;
end;
$$;

-- ---------- save_vendor: pass the version through, return the new one ----------
-- The return type changes (void → timestamptz), which needs a drop first.

drop function if exists save_vendor(uuid, jsonb, jsonb);

create function save_vendor(p_wedding uuid, p_vendor jsonb, p_payments jsonb)
returns timestamptz
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id      uuid := (p_vendor->>'id')::uuid;
  v_version timestamptz;
begin
  insert into vendors (id, wedding_id, category, company, contact, email, phone,
                       price, status, contract, notes, budget_id, sort, updated_at)
  values (
    v_id, p_wedding,
    p_vendor->>'category',
    p_vendor->>'company',
    coalesce(p_vendor->>'contact', ''),
    coalesce(p_vendor->>'email', ''),
    coalesce(p_vendor->>'phone', ''),
    coalesce((p_vendor->>'price')::numeric, 0),
    coalesce((p_vendor->>'status')::vendor_status_t, 'Inquiry'),
    coalesce((p_vendor->>'contract')::boolean, false),
    coalesce(p_vendor->>'notes', ''),
    nullif(p_vendor->>'budget_id', '')::uuid,
    0,
    (p_vendor->>'updated_at')::timestamptz
  )
  on conflict (id) do update set
    category   = excluded.category,
    company    = excluded.company,
    contact    = excluded.contact,
    email      = excluded.email,
    phone      = excluded.phone,
    price      = excluded.price,
    status     = excluded.status,
    contract   = excluded.contract,
    notes      = excluded.notes,
    budget_id  = excluded.budget_id,
    updated_at = excluded.updated_at
  returning updated_at into v_version;

  delete from vendor_payments where vendor_id = v_id;

  insert into vendor_payments (vendor_id, label, amount, due, paid, sort)
  select v_id, p.label, coalesce(p.amount, 0), coalesce(p.due, ''), coalesce(p.paid, false), (p.ord - 1)::int
    from rows from (
           jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as (label text, amount numeric, due text, paid boolean)
         ) with ordinality as p(label, amount, due, paid, ord);

  return v_version;
end;
$$;

revoke execute on function save_vendor(uuid, jsonb, jsonb) from public, anon;
grant execute on function save_vendor(uuid, jsonb, jsonb) to authenticated;
