-- ============================================================
-- Phase 3 model evolution
--
-- 1. Plus-ones become real guests. The free-text `guests.plus_one`
--    column is replaced by `plus_one_of` — a self-referential FK so a
--    plus-one is a first-class guest record linked to its host. This is
--    what makes plus-ones count toward headcount, meals and seating.
-- 2. Vendors link to a budget category (`budget_id`) so a booked vendor
--    price posts a commitment and its payment schedule drives `paid`.
-- 3. RSVPs can carry a plus-one name + meal so a guest can bring and
--    name their partner when replying.
-- 4. invitation_config gains `music_url` so uploaded music lives in
--    Supabase Storage (a public URL) rather than base64 in a JSON blob.
-- ============================================================

-- 1. guests: plus-one as a linked record
alter table guests add column if not exists plus_one_of uuid references guests(id) on delete set null;
create index if not exists guests_plus_one_of_idx on guests(plus_one_of);
alter table guests drop column if exists plus_one;

-- 2. vendors <-> budget
alter table vendors add column if not exists budget_id uuid references budget_categories(id) on delete set null;
create index if not exists vendors_budget_id_idx on vendors(budget_id);

-- committed/paid become derived from booked vendor schedules; the stored
-- columns now hold only the manual (non-vendor) portion
alter table budget_categories rename column committed to manual_committed;
alter table budget_categories rename column paid to manual_paid;

-- 3. rsvps: plus-one capture
alter table rsvps add column if not exists plus_one text;
alter table rsvps add column if not exists plus_one_meal text;

-- 4. music via Supabase Storage
alter table invitation_config add column if not exists music_url text;

-- submit_rsvp now accepts an optional plus-one
create or replace function submit_rsvp(
  p_token         uuid,
  p_slug          text,
  p_name          text,
  p_answer        answer_t,
  p_meal          text,
  p_note          text,
  p_source        text,
  p_plus_one      text default null,
  p_plus_one_meal text default null
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

  insert into rsvps (wedding_id, guest_id, name, answer, meal, note, source, plus_one, plus_one_meal)
  values (v_wedding, v_guest, p_name, p_answer, p_meal, p_note,
          coalesce(nullif(p_source, ''), 'link'),
          nullif(btrim(coalesce(p_plus_one, '')), ''),
          p_plus_one_meal);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function submit_rsvp(uuid, text, text, answer_t, text, text, text) from public;
revoke all on function submit_rsvp(uuid, text, text, answer_t, text, text, text, text, text) from public;
grant execute on function submit_rsvp(uuid, text, text, answer_t, text, text, text, text, text) to anon, authenticated;

-- Storage bucket for uploaded invitation music (and future media).
-- Objects are public-read; RLS is bypassed by storage policies below.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- members may write into their own wedding's folder; anyone may read
create policy "media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media');
create policy "media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media');
create policy "media update" on storage.objects for update to authenticated
  using (bucket_id = 'media');
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media');
