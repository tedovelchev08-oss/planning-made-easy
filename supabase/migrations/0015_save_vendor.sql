-- ============================================================
-- Luma · 0015 · save a vendor and its payment schedule in one step
--                (Phase 2, Block 12)
--
-- The client saved a vendor in three requests: upsert the vendor, DELETE
-- all its vendor_payments, INSERT the new list. When the insert failed
-- after the delete (a dropped connection, a bad row), the vendor was left
-- with no payment schedule, and the next load on any device showed it
-- empty.
--
-- save_vendor does the same three steps inside one function call, which
-- PostgREST runs as one transaction: any error rolls all of it back.
--
-- SECURITY INVOKER: it runs as the caller, so the existing row-level
-- security on vendors and vendor_payments still decides everything. A
-- vendor that belongs to another wedding fails the update policy (42501).
-- wedding_id is set on insert only, so a vendor can never be moved to a
-- different wedding through it.
--
-- Signed-in users only: anon is revoked by name (see 0014). Idempotent.
-- ============================================================

create or replace function save_vendor(p_wedding uuid, p_vendor jsonb, p_payments jsonb)
returns void
language plpgsql security invoker
set search_path = public
as $$
declare
  v_id uuid := (p_vendor->>'id')::uuid;
begin
  insert into vendors (id, wedding_id, category, company, contact, email, phone,
                       price, status, contract, notes, budget_id, sort)
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
    0
  )
  on conflict (id) do update set
    category  = excluded.category,
    company   = excluded.company,
    contact   = excluded.contact,
    email     = excluded.email,
    phone     = excluded.phone,
    price     = excluded.price,
    status    = excluded.status,
    contract  = excluded.contract,
    notes     = excluded.notes,
    budget_id = excluded.budget_id;

  -- payment rows carry no client ids: replace the schedule wholesale
  delete from vendor_payments where vendor_id = v_id;

  insert into vendor_payments (vendor_id, label, amount, due, paid, sort)
  select v_id, p.label, coalesce(p.amount, 0), coalesce(p.due, ''), coalesce(p.paid, false), (p.ord - 1)::int
    from rows from (
           jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as (label text, amount numeric, due text, paid boolean)
         ) with ordinality as p(label, amount, due, paid, ord);
end;
$$;

revoke execute on function save_vendor(uuid, jsonb, jsonb) from public, anon;
grant execute on function save_vendor(uuid, jsonb, jsonb) to authenticated;
