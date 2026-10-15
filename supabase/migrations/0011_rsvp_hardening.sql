-- ============================================================
-- Luma · 0011 · harden the public RSVP and invitation surface (Block 5)
--
-- 5a. Spam and lock-out
--   · The open RSVP link allowed 12 submissions an hour PER WEDDING, a
--     counter every guest shared: 12 junk submissions and real guests saw
--     "too many submissions" all week. Names, meals and notes had no length
--     limit, so anonymous callers could store arbitrarily large text.
--   · Now: length caps and a source allowlist (P0003). The guest page goes
--     through api/rsvp.ts, which checks a Turnstile token, rate-limits per
--     hashed visitor IP per wedding (rsvp_rate_hit), and then calls
--     submit_rsvp_verified with the service role, where the per-wedding
--     ceiling is a backstop of 300 an hour.
--   · The old anonymous submit_rsvp keeps its strict ceiling until a later
--     migration revokes it, once the API path is live.
--
-- 5b. Unpublished weddings
--   · get_public_wedding returned names, date, venue, location, photo and
--     any custom template for weddings never shared, through slugs anyone
--     can guess from first names. A new invitation_config.is_live flag
--     gates that: while false, only { slug, live: false } comes back, and
--     RSVPs are refused (P0006).
--   · Existing weddings are backfilled to live, so no link already in a
--     guest's hands breaks. New weddings start not live.
--   · A wedding with no invitation_config row at all predates the flag and
--     counts as live, for the same reason.
--
-- get_public_wedding starts from 0008's version (the template join compares
-- as text, so built-in designs like 'tp13' don't crash it). Additive and
-- idempotent.
-- ============================================================

-- ---------- 5b. the "invitation is live" flag ----------

-- Existing rows take the column default when it is added, so they become
-- live; the default then flips so every NEW invitation starts closed.
alter table invitation_config add column if not exists is_live boolean not null default true;
alter table invitation_config alter column is_live set default false;

create or replace function wedding_is_live(p_wedding uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select is_live from invitation_config where wedding_id = p_wedding), true);
$$;

revoke all on function wedding_is_live(uuid) from public, anon, authenticated;

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

  -- not shared yet: say so, and nothing else
  if not wedding_is_live(v_wedding) then
    return jsonb_build_object('slug', p_slug, 'live', false);
  end if;

  select jsonb_build_object(
    'slug', w.slug,
    'live', true,
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
       where wedding_id = w.id
         -- built-in designs use ids like 'tp13', which crash a ::uuid cast;
         -- compare as text so they simply match no custom template
         and id::text = (select template_id from invitation_config where wedding_id = w.id)
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

-- ---------- 5a. one implementation, two entry points ----------

create or replace function submit_rsvp_impl(
  p_token          uuid,
  p_slug           text,
  p_name           text,
  p_answer         answer_t,
  p_meal           text,
  p_note           text,
  p_source         text,
  p_plus_one       text,
  p_plus_one_meal  text,
  p_wedding_ceiling integer
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_wedding uuid;
  v_guest   uuid;
  v_recent  int;
  v_source  text := coalesce(nullif(p_source, ''), 'link');
  v_name    text := btrim(coalesce(p_name, ''));
  v_plus    text := nullif(btrim(coalesce(p_plus_one, '')), '');
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

  if not wedding_is_live(v_wedding) then
    raise exception 'this invitation is not open yet' using errcode = 'P0006';
  end if;

  -- what a guest can send, bounded
  if length(v_name) < 2 then
    raise exception 'a name is required' using errcode = 'P0003';
  end if;
  if length(v_name) > 120 or length(coalesce(v_plus, '')) > 120 then
    raise exception 'that name is too long' using errcode = 'P0003';
  end if;
  if length(coalesce(p_meal, '')) > 80 or length(coalesce(p_plus_one_meal, '')) > 80 then
    raise exception 'that meal choice is too long' using errcode = 'P0003';
  end if;
  if length(coalesce(p_note, '')) > 1000 then
    raise exception 'that note is too long' using errcode = 'P0003';
  end if;
  if v_source not in ('link', 'whatsapp', 'instagram', 'messenger', 'email') then
    raise exception 'unknown source' using errcode = 'P0003';
  end if;

  -- 6 an hour per personal link; the open link's per-wedding ceiling is set
  -- by the caller (strict for the anonymous path, a backstop for the API)
  select count(*) into v_recent from rsvps
   where at > now() - interval '1 hour'
     and ((p_token is not null and guest_id = v_guest)
       or (p_token is null and wedding_id = v_wedding));
  if (p_token is not null and v_recent >= 6) or (p_token is null and v_recent >= p_wedding_ceiling) then
    raise exception 'too many submissions — try again shortly' using errcode = 'P0002';
  end if;

  insert into rsvps (wedding_id, guest_id, name, answer, meal, note, source, plus_one, plus_one_meal)
  values (v_wedding, v_guest, v_name, p_answer, p_meal, p_note, v_source, v_plus, p_plus_one_meal);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function submit_rsvp_impl(uuid, text, text, answer_t, text, text, text, text, text, integer)
  from public, anon, authenticated;

-- the old anonymous path: same rules, strict shared ceiling, revoked later
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
language sql security definer
set search_path = public
as $$
  select submit_rsvp_impl(p_token, p_slug, p_name, p_answer, p_meal, p_note, p_source, p_plus_one, p_plus_one_meal, 12);
$$;

revoke all on function submit_rsvp(uuid, text, text, answer_t, text, text, text, text, text) from public;
grant execute on function submit_rsvp(uuid, text, text, answer_t, text, text, text, text, text) to anon, authenticated;

-- the API path: only the server calls it, after Turnstile and the per-IP limit
create or replace function submit_rsvp_verified(
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
language sql security definer
set search_path = public
as $$
  select submit_rsvp_impl(p_token, p_slug, p_name, p_answer, p_meal, p_note, p_source, p_plus_one, p_plus_one_meal, 300);
$$;

revoke all on function submit_rsvp_verified(uuid, text, text, answer_t, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function submit_rsvp_verified(uuid, text, text, answer_t, text, text, text, text, text) to service_role;

-- ---------- 5a. per-visitor rate limit ----------
-- Counts per wedding per HASHED visitor IP per hour. The raw IP is never
-- stored: api/rsvp.ts sends an HMAC of it. Service role only.

create table if not exists rsvp_rate (
  wedding_id   uuid not null references weddings (id) on delete cascade,
  ip_hash      text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (wedding_id, ip_hash, window_start)
);

alter table rsvp_rate enable row level security;
-- no policies: only the service role (which bypasses RLS) reads or writes

create or replace function rsvp_rate_hit(p_token uuid, p_slug text, p_ip_hash text, p_limit integer)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_wedding uuid;
  v_window  timestamptz := date_trunc('hour', now());
  v_hits    integer;
begin
  if p_token is not null then
    select wedding_id into v_wedding from guests where rsvp_token = p_token;
  else
    select id into v_wedding from weddings where slug = p_slug;
  end if;
  -- unknown wedding: let submit_rsvp_verified give the real error
  if v_wedding is null then return true; end if;

  insert into rsvp_rate (wedding_id, ip_hash, window_start, hits)
  values (v_wedding, p_ip_hash, v_window, 1)
  on conflict (wedding_id, ip_hash, window_start) do update set hits = rsvp_rate.hits + 1
  returning hits into v_hits;

  -- housekeeping: an hour-old window is never read again
  delete from rsvp_rate where window_start < now() - interval '1 day';

  return v_hits <= p_limit;
end;
$$;

revoke all on function rsvp_rate_hit(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function rsvp_rate_hit(uuid, text, text, integer) to service_role;
