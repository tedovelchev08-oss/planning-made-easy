-- Venue objects on the seating floor: dance floor, stage, bar, entrance, and
-- the cake and photo spots. These are not tables — they hold nobody, so they
-- carry no capacity and no seats — but they are what turns a diagram of circles
-- into a floor plan of a room.
--
-- Additive: a new table with its own policies. Nothing existing is touched, and
-- a workspace with no rows here behaves exactly as it does today.

create table if not exists venue_objects (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  kind       text not null,
  label      text not null default '',
  -- centre position, as a percentage of the floor, matching `tables`
  x          numeric not null default 50,
  y          numeric not null default 50,
  -- size, also percentage-based, so objects scale with the floor
  w          numeric not null default 24,
  h          numeric not null default 18,
  sort       int not null default 0,
  constraint venue_objects_kind_check
    check (kind in ('dance', 'stage', 'bar', 'entrance', 'cake', 'photo'))
);

create index if not exists venue_objects_wedding_idx on venue_objects (wedding_id, sort);

alter table venue_objects enable row level security;

-- Same uniform member policies as every other planner entity.
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'venue_objects_select') then
    create policy venue_objects_select on venue_objects
      for select using (is_wedding_member(wedding_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'venue_objects_insert') then
    create policy venue_objects_insert on venue_objects
      for insert with check (is_wedding_member(wedding_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'venue_objects_update') then
    create policy venue_objects_update on venue_objects
      for update using (is_wedding_member(wedding_id)) with check (is_wedding_member(wedding_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'venue_objects_delete') then
    create policy venue_objects_delete on venue_objects
      for delete using (is_wedding_member(wedding_id));
  end if;
end $$;
