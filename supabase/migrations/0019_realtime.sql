-- ============================================================
-- Luma · 0019 · live updates between partners (Phase 2, Block 13b)
--
-- Adds the planner tables to Supabase's Realtime publication, so an open
-- planner hears about a partner's change within a second or two instead
-- of on the next focus. The app listens per wedding and reloads through
-- its usual path (send own edits first, then fetch); 0018's versions keep
-- that safe.
--
-- Realtime applies each subscriber's row-level security to INSERT and
-- UPDATE events, so a couple only hears about their own wedding. DELETE
-- events can't be filtered or RLS-checked and carry only the primary key
-- (a random uuid); the app ignores any it doesn't recognise.
--
-- Additive and idempotent: each table is added only if it isn't already
-- in the publication.
-- ============================================================

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'weddings', 'guests', 'tables', 'venue_objects', 'budget_categories', 'tasks',
    'vendors', 'registry_items', 'custom_templates', 'invitation_config', 'website_config'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
