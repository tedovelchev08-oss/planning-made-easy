-- ============================================================
-- Luma · 0008 · security fixes
--
-- Five critical fixes:
--   1a. weddings.plan becomes authoritative, only service role writes it
--   1b. webhook_events gets RLS (service role only)
--   1c. storage media bucket scoped to wedding folders
--   1d. accept_pending_invite checks email verification
--   1e. pgTAP tests added in separate file
--
-- All changes are additive and idempotent.
-- ============================================================

-- ---------- 1a. weddings.plan authority ----------

-- Trigger: force plan and owner_id for non-service callers
create or replace function enforce_wedding_plan_authority()
returns trigger
language plpgsql
as $$
begin
  -- service_role and postgres (migrations) bypass this check
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return NEW;
  end if;

  -- on INSERT: force plan to 'essential'
  if TG_OP = 'INSERT' then
    NEW.plan := 'essential';
    return NEW;
  end if;

  -- on UPDATE: preserve plan and owner_id from OLD
  if TG_OP = 'UPDATE' then
    NEW.plan := OLD.plan;
    NEW.owner_id := OLD.owner_id;
    return NEW;
  end if;

  return NEW;
end;
$$;

-- Drop existing trigger if present (idempotent)
drop trigger if exists trg_enforce_wedding_plan_authority on weddings;

-- Create trigger
create trigger trg_enforce_wedding_plan_authority
  before insert or update on weddings
  for each row
  execute function enforce_wedding_plan_authority();

-- Backfill: set every wedding's plan to the highest entitlement held by ANY member
-- This corrects partner purchases and removes any self-granted plans
do $$
declare
  w uuid;
  best_plan text;
begin
  for w in select id from weddings loop
    select coalesce(
      (select plan from entitlements
       where user_id in (select user_id from wedding_members where wedding_id = w)
       order by case plan when 'luxe' then 3 when 'celebration' then 2 when 'essential' then 1 else 0 end desc
       limit 1),
      'essential'
    ) into best_plan;

    -- Update as postgres (migration role) so the trigger allows it
    execute format('update weddings set plan = %L where id = %L', best_plan, w);
  end loop;
end $$;

-- ---------- 1b. webhook_events RLS ----------

alter table webhook_events enable row level security;

-- No policies: service role bypasses RLS, which is exactly what the webhook needs.
-- Anon and authenticated cannot read or write.

-- ---------- Fix: wedding_invites INSERT policy ----------
-- Migration 0002 forgot to add an INSERT policy for wedding_invites.
-- The owner must be able to invite partners.

drop policy if exists invites_insert on wedding_invites;

create policy invites_insert on wedding_invites for insert
  with check (exists (
    select 1 from weddings w where w.id = wedding_id and w.owner_id = auth.uid()
  ));

-- ---------- Fix: remove duplicate submit_rsvp function ----------
-- Migration 0002 created a 7-parameter version, migration 0003 created a 9-parameter version.
-- This caused ambiguity in function calls. Drop the old 7-parameter version.

drop function if exists submit_rsvp(uuid, text, text, answer_t, text, text, text);

-- ---------- Fix: get_public_wedding type mismatch ----------
-- Migration 0004 had a type mismatch: custom_templates.id is uuid but
-- invitation_config.template_id is text. This caused "operator does not exist: uuid = text".

create or replace function get_public_wedding(p_slug text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_wedding uuid;
  v_out jsonb;
begin
  select id into v_wedding from weddings where slug = p_slug;
  if v_wedding is null then return null; end if;

  select jsonb_build_object(
    'slug', w.slug,
    'names', w.names,
    'partnerA', w.partner_a,
    'partnerB', w.partner_b,
    'date', w.date,
    'venue', w.venue,
    'location', w.location,
    'timezone', w.timezone,
    'locale', w.locale,
    'currency', w.currency,
    'plan', w.plan,
    'invitation', (
      select jsonb_build_object(
        'template_id', template_id, 'line1', line1, 'line2', line2,
        'venue_line', venue_line, 'collect_rsvp', collect_rsvp,
        'collect_meal', collect_meal, 'collect_notes', collect_notes,
        'photo', photo, 'colors', colors, 'font_serif', font_serif,
        'motion', motion, 'music', jsonb_build_object('track', music->'track')
      ) from invitation_config where wedding_id = w.id
    ),
    'custom', (
      select jsonb_build_object('id', id, 'name', name, 'html', html, 'dataUrl', data_url)
        from custom_templates
       where wedding_id = w.id and id = (select template_id::uuid from invitation_config where wedding_id = w.id)
    ),
    'website', (
      select jsonb_build_object(
        'template', template, 'hero_photo', hero_photo, 'bg', bg, 'ink', ink,
        'accent', accent, 'serif', serif, 'animations', animations,
        'sections', sections, 'domain', domain, 'published', published
      ) from website_config where wedding_id = w.id
    ),
    'registry', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'store', store, 'purchased', purchased) order by sort), '[]'::jsonb)
        from registry_items where wedding_id = w.id
    )
  ) into v_out
  from weddings w where w.id = v_wedding;

  -- only published sites expose their website/registry payload
  if v_out->'website'->>'published' <> 'true' then
    v_out := jsonb_set(v_out, '{website}', '{"published": false}'::jsonb);
    v_out := v_out - 'registry';
  end if;

  return v_out;
end;
$$;

revoke all on function get_public_wedding(text) from public;
grant execute on function get_public_wedding(text) to anon, authenticated;

-- ---------- 1c. storage media bucket scoped to wedding folders ----------

-- Drop existing policies (idempotent)
drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;
drop policy if exists "media list" on storage.objects;

-- Public bucket: no SELECT policy needed. Public URLs work without policies.
-- Only authenticated members can list/upload/update/delete in their wedding folder.

-- Helper function to safely check wedding membership with UUID validation
create or replace function is_valid_wedding_folder(path text)
returns boolean
language sql stable
as $$
  select case
    when array_length(storage.foldername(path), 1) >= 1
         and (storage.foldername(path))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then is_wedding_member(((storage.foldername(path))[1])::uuid)
    else false
  end;
$$;

-- Write/update/delete/list: only members of the wedding folder
-- Folder structure: media/<wedding_id>/<filename>
create policy "media write" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and is_valid_wedding_folder(name)
  );

create policy "media update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and is_valid_wedding_folder(name)
  );

create policy "media delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and is_valid_wedding_folder(name)
  );

create policy "media list" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and is_valid_wedding_folder(name)
  );

-- Set bucket limits (idempotent)
update storage.buckets
set file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
where id = 'media';

-- ---------- 1d. accept_pending_invite email verification ----------

create or replace function accept_pending_invite()
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_email text;
  v_claimed int := 0;
  v_wedding_ids uuid[];
begin
  v_email := auth.jwt()->>'email';
  if v_email is null then
    return jsonb_build_object('claimed', 0);
  end if;

  -- Require verified email: either email_confirmed_at is set, or the JWT has email_verified claim
  if not (
    exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null)
    or (auth.jwt()->>'email_verified')::boolean is true
  ) then
    return jsonb_build_object('claimed', 0);
  end if;

  -- Collect wedding_ids from pending invites ONLY (accepted_at is null)
  select array_agg(wedding_id) into v_wedding_ids
  from wedding_invites
  where lower(email) = lower(v_email)
    and accepted_at is null;

  -- If no pending invites, return early
  if v_wedding_ids is null or array_length(v_wedding_ids, 1) is null then
    return jsonb_build_object('claimed', 0);
  end if;

  -- Mark exactly those invites as accepted
  update wedding_invites
  set accepted_at = now()
  where lower(email) = lower(v_email)
    and accepted_at is null;

  get diagnostics v_claimed = row_count;

  -- Auto-add to wedding_members for exactly those weddings
  insert into wedding_members (wedding_id, user_id, role)
  select unnest(v_wedding_ids), auth.uid(), 'partner'
  on conflict (wedding_id, user_id) do nothing;

  return jsonb_build_object('claimed', v_claimed);
end;
$$;

-- Revoke public execute, grant to authenticated only
revoke all on function accept_pending_invite() from public;
grant execute on function accept_pending_invite() to authenticated;
