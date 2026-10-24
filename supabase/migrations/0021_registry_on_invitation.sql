-- ============================================================
-- Twofold · 0021 · the registry moves onto the invitation
--
-- The separate wedding website is retired: the couple's invitation is the
-- page guests open. Its registry used to reach guests only through a
-- published website; now a live invitation always carries its registry
-- (name, store, whether it's been given, and the link when it is http(s)).
-- A couple with no registry items shows none.
--
-- website_config stays as it is (nothing is deleted); get_public_wedding
-- just reports { published: false } for it so older clients render nothing.
--
-- Starts from 0020's version: the template join compares as text and a
-- closed invitation still returns only { slug, live: false }. Idempotent.
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
    -- 0021: the separate website is retired; old clients still read the key
    'website', jsonb_build_object('published', false),
    -- 0021: a live invitation shows its registry, links included, under the
    -- reply. Only http(s) links leave the database.
    'registry', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', name, 'store', store, 'purchased', purchased,
               'url', case when url ~* '^https?://' then url else null end
             ) order by sort), '[]'::jsonb)
        from registry_items where wedding_id = w.id
    )
  ) into v_out
  from weddings w where w.id = v_wedding;

  return v_out;
end;
$$;

revoke all on function get_public_wedding(text) from public;
grant execute on function get_public_wedding(text) to anon, authenticated;
