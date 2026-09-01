-- ============================================================
-- Luma · 0002 · row level security + security-definer functions
--
-- Model:
--   · every planner table is readable/writable only by members
--     of its wedding (wedding_members);
--   · two deliberate anonymous surfaces, both narrow:
--       (a) get_public_wedding(slug)  — read-only public payload
--       (b) submit_rsvp(...)          — rate-limited RSVP intake
--   · entitlements is readable by the owner of the row and is
--     writable ONLY by the service role (Stripe webhook).
-- ============================================================

alter table weddings          enable row level security;
alter table wedding_members   enable row level security;
alter table wedding_invites   enable row level security;
alter table tables            enable row level security;
alter table guests            enable row level security;
alter table budget_categories enable row level security;
alter table tasks             enable row level security;
alter table vendors           enable row level security;
alter table vendor_payments   enable row level security;
alter table registry_items    enable row level security;
alter table invitation_config enable row level security;
alter table website_config    enable row level security;
alter table custom_templates  enable row level security;
alter table rsvps             enable row level security;
alter table entitlements      enable row level security;

-- ---------- membership helper ----------
-- SECURITY DEFINER so membership checks can read wedding_members without
-- recursing into its own policies; read-only and STABLE.

create or replace function is_wedding_member(w uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from wedding_members m
    where m.wedding_id = w and m.user_id = auth.uid()
  );
$$;

-- ---------- weddings ----------

create policy weddings_select on weddings for select
  using (owner_id = auth.uid() or is_wedding_member(id));
create policy weddings_insert on weddings for insert
  with check (owner_id = auth.uid());
create policy weddings_update on weddings for update
  using (is_wedding_member(id)) with check (is_wedding_member(id));
create policy weddings_delete on weddings for delete
  using (owner_id = auth.uid());

-- ---------- wedding_members ----------

create policy members_select on wedding_members for select
  using (user_id = auth.uid() or exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));
-- the owner seeds their own membership row when creating the wedding
create policy members_insert_own on wedding_members for insert
  with check (exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));
create policy members_owner_delete on wedding_members for delete
  using (exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));

-- ---------- wedding_invites ----------

create policy invites_select on wedding_invites for select
  using (invited_by = auth.uid() or exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));
create policy invites_delete on wedding_invites for delete
  using (invited_by = auth.uid() or exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));

-- ---------- planner entities (uniform member policies) ----------

create policy tables_select on tables for select using (is_wedding_member(wedding_id));
create policy tables_insert on tables for insert with check (is_wedding_member(wedding_id));
create policy tables_update on tables for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy tables_delete on tables for delete using (is_wedding_member(wedding_id));

create policy guests_select on guests for select using (is_wedding_member(wedding_id));
create policy guests_insert on guests for insert with check (is_wedding_member(wedding_id));
create policy guests_update on guests for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy guests_delete on guests for delete using (is_wedding_member(wedding_id));

create policy budget_select on budget_categories for select using (is_wedding_member(wedding_id));
create policy budget_insert on budget_categories for insert with check (is_wedding_member(wedding_id));
create policy budget_update on budget_categories for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy budget_delete on budget_categories for delete using (is_wedding_member(wedding_id));

create policy tasks_select on tasks for select using (is_wedding_member(wedding_id));
create policy tasks_insert on tasks for insert with check (is_wedding_member(wedding_id));
create policy tasks_update on tasks for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy tasks_delete on tasks for delete using (is_wedding_member(wedding_id));

create policy vendors_select on vendors for select using (is_wedding_member(wedding_id));
create policy vendors_insert on vendors for insert with check (is_wedding_member(wedding_id));
create policy vendors_update on vendors for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy vendors_delete on vendors for delete using (is_wedding_member(wedding_id));

create policy payments_select on vendor_payments for select
  using (exists (select 1 from vendors v where v.id = vendor_id and is_wedding_member(v.wedding_id)));
create policy payments_insert on vendor_payments for insert
  with check (exists (select 1 from vendors v where v.id = vendor_id and is_wedding_member(v.wedding_id)));
create policy payments_update on vendor_payments for update
  using (exists (select 1 from vendors v where v.id = vendor_id and is_wedding_member(v.wedding_id)))
  with check (exists (select 1 from vendors v where v.id = vendor_id and is_wedding_member(v.wedding_id)));
create policy payments_delete on vendor_payments for delete
  using (exists (select 1 from vendors v where v.id = vendor_id and is_wedding_member(v.wedding_id)));

create policy registry_select on registry_items for select using (is_wedding_member(wedding_id));
create policy registry_insert on registry_items for insert with check (is_wedding_member(wedding_id));
create policy registry_update on registry_items for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy registry_delete on registry_items for delete using (is_wedding_member(wedding_id));

create policy invitation_select on invitation_config for select using (is_wedding_member(wedding_id));
create policy invitation_insert on invitation_config for insert with check (is_wedding_member(wedding_id));
create policy invitation_update on invitation_config for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy invitation_delete on invitation_config for delete using (is_wedding_member(wedding_id));

create policy website_select on website_config for select using (is_wedding_member(wedding_id));
create policy website_insert on website_config for insert with check (is_wedding_member(wedding_id));
create policy website_update on website_config for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy website_delete on website_config for delete using (is_wedding_member(wedding_id));

create policy customtpl_select on custom_templates for select using (is_wedding_member(wedding_id));
create policy customtpl_insert on custom_templates for insert with check (is_wedding_member(wedding_id));
create policy customtpl_update on custom_templates for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy customtpl_delete on custom_templates for delete using (is_wedding_member(wedding_id));

-- ---------- rsvps ----------
-- members read/flag/delete; there is intentionally NO insert policy.
-- all intake goes through submit_rsvp() below.

create policy rsvps_select on rsvps for select using (is_wedding_member(wedding_id));
create policy rsvps_update on rsvps for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
create policy rsvps_delete on rsvps for delete using (is_wedding_member(wedding_id));

-- ---------- entitlements ----------
-- readable by the owner of the row only. NO insert/update/delete policies:
-- the service role (Stripe webhook) bypasses RLS and is the sole writer.

create policy entitlements_read_own on entitlements for select
  using (user_id = auth.uid());

-- ============================================================
-- anonymous surface (a): the public invitation payload
-- A SECURITY DEFINER read of exactly the fields the guest page
-- needs — never the underlying tables.
-- ============================================================

create or replace function get_public_wedding(p_slug text)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'slug',       w.slug,
    'names',      w.names,
    'partnerA',   w.partner_a,
    'partnerB',   w.partner_b,
    'date',       to_char(w.date at time zone coalesce(w.timezone, 'UTC'), 'YYYY-MM-DD"T"HH24:MI:SS'),
    'venue',      w.venue,
    'location',   w.location,
    'plan',       w.plan,
    'invitation', coalesce(to_jsonb(i) - 'wedding_id', '{}'::jsonb),
    'website',    coalesce(to_jsonb(we) - 'wedding_id', '{}'::jsonb),
    'custom',     coalesce(
      (select jsonb_build_object('id', c.id, 'name', c.name, 'dataUrl', c.data_url, 'html', c.html)
       from custom_templates c
       where c.wedding_id = w.id and c.id::text = i.template_id),
      null
    ),
    'registry',   coalesce(
      (select jsonb_agg(jsonb_build_object('name', r.name, 'store', r.store) order by r.sort)
       from registry_items r where r.wedding_id = w.id),
      '[]'::jsonb
    )
  )
  from weddings w
  left join invitation_config i  on i.wedding_id = w.id
  left join website_config   we on we.wedding_id = w.id
  where w.slug = p_slug;
$$;

revoke all on function get_public_wedding(text) from public;
grant execute on function get_public_wedding(text) to anon, authenticated;

-- the guest page resolves a per-guest token to a name so the RSVP
-- can be attributed. possession of the token is possession of the invite.

create or replace function get_guest_by_token(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('id', g.id, 'name', g.name, 'slug', w.slug)
  from guests g
  join weddings w on w.id = g.wedding_id
  where g.rsvp_token = p_token;
$$;

revoke all on function get_guest_by_token(uuid) from public;
grant execute on function get_guest_by_token(uuid) to anon, authenticated;

-- ============================================================
-- anonymous surface (b): rate-limited RSVP intake
-- ============================================================

create or replace function submit_rsvp(
  p_token  uuid,
  p_slug   text,
  p_name   text,
  p_answer answer_t,
  p_meal   text,
  p_note   text,
  p_source text
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_wedding uuid;
  v_guest   uuid;
  v_recent  int;
begin
  if p_token is not null then
    select wedding_id, id into v_wedding, v_guest
      from guests where rsvp_token = p_token;
    if v_wedding is null then
      raise exception 'invalid invitation token' using errcode = 'P0001';
    end if;
  else
    select id into v_wedding from weddings where slug = p_slug;
    if v_wedding is null then
      raise exception 'unknown wedding' using errcode = 'P0001';
    end if;
  end if;

  if length(coalesce(p_name, '')) < 2 then
    raise exception 'a name is required' using errcode = 'P0003';
  end if;

  -- rate limit: 6/h per guest token · 12/h per wedding on the open link
  select count(*) into v_recent from rsvps
   where at > now() - interval '1 hour'
     and ((p_token is not null and guest_id = v_guest)
       or (p_token is null and wedding_id = v_wedding));
  if (p_token is not null and v_recent >= 6) or (p_token is null and v_recent >= 12) then
    raise exception 'too many submissions — try again shortly' using errcode = 'P0002';
  end if;

  insert into rsvps (wedding_id, guest_id, name, answer, meal, note, source)
  values (v_wedding, v_guest, p_name, p_answer, p_meal, p_note, coalesce(nullif(p_source, ''), 'link'));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function submit_rsvp(uuid, text, text, answer_t, text, text, text) from public;
grant execute on function submit_rsvp(uuid, text, text, answer_t, text, text, text) to anon, authenticated;

-- ============================================================
-- partner invites
-- ============================================================

create or replace function invite_partner(p_wedding uuid, p_email text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (select 1 from weddings where id = p_wedding and owner_id = auth.uid()) then
    raise exception 'only the owner can invite a partner' using errcode = 'P0004';
  end if;
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'that email does not look right' using errcode = 'P0003';
  end if;
  insert into wedding_invites (wedding_id, email, invited_by)
  values (p_wedding, lower(p_email), auth.uid())
  on conflict (wedding_id, lower(email)) do update set created_at = now(), accepted_at = null;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function invite_partner(uuid, text) from public;
grant execute on function invite_partner(uuid, text) to authenticated;

-- called after sign-in: claims any pending invite addressed to the
-- account's verified email and creates the partner membership rows.

create or replace function accept_pending_invite()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text;
  v_inv   record;
  v_n     int := 0;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    return jsonb_build_object('claimed', 0);
  end if;
  for v_inv in
    select * from wedding_invites where lower(email) = v_email and accepted_at is null
  loop
    insert into wedding_members (wedding_id, user_id, role)
    values (v_inv.wedding_id, auth.uid(), 'partner')
    on conflict (wedding_id, user_id) do nothing;
    update wedding_invites set accepted_at = now() where id = v_inv.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('claimed', v_n);
end;
$$;

revoke all on function accept_pending_invite() from public;
grant execute on function accept_pending_invite() to authenticated;
