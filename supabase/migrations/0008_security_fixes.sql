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

-- ---------- 1c. storage media bucket scoped to wedding folders ----------

-- Drop existing policies (idempotent)
drop policy if exists "media read" on storage.objects;
drop policy if exists "media write" on storage.objects;
drop policy if exists "media update" on storage.objects;
drop policy if exists "media delete" on storage.objects;

-- Public read: anyone can read (guests viewing invitations)
create policy "media read" on storage.objects
  for select
  using (bucket_id = 'media');

-- Write/update/delete: only members of the wedding folder
-- Folder structure: media/<wedding_id>/<filename>
-- storage.foldername(name) returns array of path segments
create policy "media write" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'media'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1]::uuid is not null
    and is_wedding_member((storage.foldername(name))[1]::uuid)
  );

create policy "media update" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'media'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1]::uuid is not null
    and is_wedding_member((storage.foldername(name))[1]::uuid)
  );

create policy "media delete" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'media'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1]::uuid is not null
    and is_wedding_member((storage.foldername(name))[1]::uuid)
  );

-- List: only members of that folder
create policy "media list" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'media'
    and array_length(storage.foldername(name), 1) >= 1
    and (storage.foldername(name))[1]::uuid is not null
    and is_wedding_member((storage.foldername(name))[1]::uuid)
  );

-- Set bucket limits (idempotent)
update storage.buckets
set file_size_limit = 10485760,  -- 10 MB
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg']
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

  update wedding_invites
  set accepted_at = now()
  where lower(email) = lower(v_email)
    and accepted_at is null;

  get diagnostics v_claimed = row_count;

  -- Auto-add to wedding_members
  insert into wedding_members (wedding_id, user_id, role)
  select wedding_id, auth.uid(), 'partner'
  from wedding_invites
  where lower(email) = lower(v_email)
    and accepted_at is not null
    and not exists (
      select 1 from wedding_members
      where wedding_id = wedding_invites.wedding_id
        and user_id = auth.uid()
    );

  return jsonb_build_object('claimed', v_claimed);
end;
$$;

-- Revoke public execute, grant to authenticated only
revoke all on function accept_pending_invite() from public;
grant execute on function accept_pending_invite() to authenticated;
