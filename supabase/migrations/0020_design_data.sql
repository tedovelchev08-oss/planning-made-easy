-- ============================================================
-- Luma · 0020 · details for the owner's own invitation designs
--                (Phase 3, Block 18a)
--
-- The owner's designs (Celestial, Mirror Palace, Art Deco, ...) show more
-- than Luma's built-in ones: a dress code, an RSVP deadline, a schedule of
-- the day, an FAQ, a hashtag. They live in invitation_config.design_data
-- (jsonb, capped at 32 KB so it can't be used as free storage) and reach
-- guests through get_public_wedding, which now includes it.
--
-- get_public_wedding starts from 0013's version, NOT 0011's or earlier:
-- the template join compares as text and a closed invitation still returns
-- only { slug, live: false }. The existing row-level security on
-- invitation_config already lets only the wedding's members write it, and
-- 0018's row_version trigger covers it. Additive and idempotent.
-- ============================================================

alter table invitation_config add column if not exists design_data jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'invitation_config_design_data_size') then
    alter table invitation_config
      add constraint invitation_config_design_data_size check (pg_column_size(design_data) <= 32768);
  end if;
end;
$$;

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
        'motion', motion,
        -- 0013: the uploaded song's name and public address, so guests hear it
        'music', jsonb_build_object('track', music->'track', 'uploadName', music->'uploadName', 'url', music_url),
        -- 0020: the details the owner's own designs show (dress code, RSVP
        -- deadline, schedule, FAQ, hashtag)
        'design_data', design_data
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
