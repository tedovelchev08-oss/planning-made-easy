-- ============================================================
-- Phase 4 · internationalisation
--
-- Weddings are international by nature: the couple may plan from
-- one country, pay in another currency, and host guests in a third
-- timezone. locale / currency live on the wedding record and drive
-- every fmtMoney / fmtDate call in the client.
-- ============================================================

alter table weddings
  add column if not exists locale   text not null default 'en-US',
  add column if not exists currency text not null default 'USD';

-- keep values sane without an exhaustive lookup table
alter table weddings
  add constraint weddings_locale_len   check (char_length(locale) between 2 and 35),
  add constraint weddings_currency_len check (currency ~ '^[A-Z]{3}$');

-- backfill: derive a best-effort locale from the couple's names is not
-- reliable; leave the default and let couples change it in settings.

-- the public guest page should format dates in the couple's locale too
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
       where wedding_id = w.id and id = (select template_id from invitation_config where wedding_id = w.id)
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
