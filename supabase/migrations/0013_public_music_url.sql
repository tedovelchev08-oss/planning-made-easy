-- ============================================================
-- Luma · 0013 · guests hear the couple's uploaded song (Block 6)
--
-- invitation_config.music_url has existed since 0003 and was never
-- written: the app kept the song as a data URL and dropped it on save,
-- so couples heard it in preview and guests never did. The app now
-- uploads the song to media/<wedding>/music/<random>.<ext> (a path the
-- 0008 storage policies allow only for the wedding's members) and saves
-- its public address in music_url.
--
-- get_public_wedding now returns the song's name and address. It starts
-- from 0011's version, NOT 0004's or 0008's: the template join compares as
-- text (so built-in designs like 'tp13' don't crash it), and a closed
-- invitation still returns only { slug, live: false }. Idempotent.
-- ============================================================

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
        'music', jsonb_build_object('track', music->'track', 'uploadName', music->'uploadName', 'url', music_url)
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
