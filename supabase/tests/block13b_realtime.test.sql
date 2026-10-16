-- ============================================================
-- Luma · pgTAP · Block 13b: planner tables publish changes to Realtime
-- (0019) so a partner's edit appears without reloading
-- Run with: supabase test db
-- ============================================================

begin;
select plan(12);

select ok(
  exists (select 1 from pg_publication where pubname = 'supabase_realtime'),
  'the supabase_realtime publication exists'
);

select ok(
  exists (select 1 from pg_publication_tables
          where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t),
  format('%s publishes its changes', t)
)
from unnest(array['weddings', 'guests', 'tables', 'venue_objects', 'budget_categories', 'tasks',
                  'vendors', 'registry_items', 'custom_templates', 'invitation_config', 'website_config']) as t;

select * from finish();
rollback;
