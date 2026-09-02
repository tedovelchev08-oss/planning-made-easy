-- ============================================================
-- Luma · 0001 · schema
-- Every planner entity is scoped to a wedding. Both partners
-- share one plan through wedding_members.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------

create type plan_t          as enum ('essential', 'celebration', 'luxe');
create type rsvp_t          as enum ('confirmed', 'pending', 'declined');
create type party_t         as enum ('A', 'B', 'S');
create type assignee_t      as enum ('A', 'T', 'B');
create type phase_t         as enum ('p12', 'p9', 'p6', 'p3', 'p1', 'fw', 'wd');
create type table_shape_t   as enum ('round', 'rect', 'head', 'sweetheart');
create type vendor_status_t as enum ('Inquiry', 'Proposal', 'Booked', 'Declined');
create type answer_t        as enum ('yes', 'no');
create type member_role_t   as enum ('owner', 'partner');

-- ---------- core ----------

create table weddings (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  slug       text not null unique,
  partner_a  text not null default '',
  partner_b  text not null default '',
  names      text not null default '',
  date       timestamptz not null,
  venue      text not null default '',
  location   text not null default '',
  timezone   text not null default 'UTC',
  -- denormalised copy of the current entitlement plan so the public reader
  -- can gate luxe presentation. entitlements (below) is the source of truth
  -- and is written only by the service role via the Stripe webhook.
  plan       plan_t not null default 'essential',
  created_at timestamptz not null default now()
);

create table wedding_members (
  wedding_id uuid not null references weddings (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       member_role_t not null default 'owner',
  primary key (wedding_id, user_id)
);

create table wedding_invites (
  id          uuid primary key default gen_random_uuid(),
  wedding_id  uuid not null references weddings (id) on delete cascade,
  email       text not null,
  invited_by  uuid not null references auth.users (id),
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (wedding_id, lower(email))
);

-- ---------- planner entities ----------

create table tables (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  name       text not null,
  shape      table_shape_t not null default 'round',
  capacity   int not null default 8 check (capacity between 1 and 20),
  x          numeric not null default 50,
  y          numeric not null default 50,
  sort       int not null default 0
);

create table guests (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  name       text not null,
  party      party_t not null default 'A',
  rsvp       rsvp_t not null default 'pending',
  meal       text,
  plus_one   text,
  table_id   uuid references tables (id) on delete set null,
  seat       int,
  dietary    text,
  notes      text not null default '',
  -- per-guest RSVP link token. Knowing the token is knowing the invitation.
  rsvp_token uuid not null unique default gen_random_uuid(),
  sort       int not null default 0
);

create table budget_categories (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  name       text not null,
  budget     numeric(12,2) not null default 0,
  committed  numeric(12,2) not null default 0,
  paid       numeric(12,2) not null default 0,
  color      text not null default '#D4AF37',
  sort       int not null default 0
);

create table tasks (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  title      text not null,
  phase      phase_t not null,
  done       boolean not null default false,
  assignee   assignee_t not null default 'B',
  due        date,
  week       boolean not null default false,
  sort       int not null default 0
);

create table vendors (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  category   text not null,
  company    text not null,
  contact    text not null default '',
  email      text not null default '',
  phone      text not null default '',
  price      numeric(12,2) not null default 0,
  status     vendor_status_t not null default 'Inquiry',
  contract   boolean not null default false,
  notes      text not null default '',
  sort       int not null default 0
);

create table vendor_payments (
  id        uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors (id) on delete cascade,
  label     text not null,
  amount    numeric(12,2) not null default 0,
  due       text not null default '',
  paid      boolean not null default false,
  sort      int not null default 0
);

create table registry_items (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  name       text not null,
  store      text not null default '',
  price      numeric(12,2) not null default 0,
  url        text not null default '',
  purchased  boolean not null default false,
  sort       int not null default 0
);

-- ---------- one row per wedding ----------

create table invitation_config (
  wedding_id    uuid primary key references weddings (id) on delete cascade,
  template_id   text not null default 'tp13',
  line1         text not null default '',
  line2         text not null default '',
  venue_line    text not null default '',
  collect_rsvp  boolean not null default true,
  collect_meal  boolean not null default true,
  collect_notes boolean not null default true,
  photo         text,
  colors        jsonb,
  font_serif    boolean,
  motion        jsonb not null default '{"petals":"gentle","shimmer":true,"type":true}'::jsonb,
  music         jsonb not null default '{"track":"serene","uploadName":null,"uploadData":null}'::jsonb
);

create table website_config (
  wedding_id  uuid primary key references weddings (id) on delete cascade,
  template    text not null default 'serene',
  hero_photo  text not null default '',
  bg          text not null default '#FFF8F0',
  ink         text not null default '#332B31',
  accent      text not null default '#D4AF37',
  serif       boolean not null default true,
  animations  boolean not null default true,
  sections    jsonb not null default '{"hero":true,"story":true,"details":true,"schedule":true,"venue":true,"travel":true,"registry":true,"gallery":true,"rsvp":true,"music":false}'::jsonb,
  domain      text not null default '',
  published   boolean not null default false
);

create table custom_templates (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  name       text not null,
  data_url   text,
  html       text,
  added_at   timestamptz not null default now(),
  sort       int not null default 0
);

-- ---------- public RSVP intake ----------

create table rsvps (
  id         uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references weddings (id) on delete cascade,
  guest_id   uuid references guests (id) on delete set null,
  name       text not null,
  answer     answer_t not null,
  meal       text,
  note       text,
  source     text not null default 'link',
  at         timestamptz not null default now(),
  synced     boolean not null default false
);

-- ---------- commerce (service-role only) ----------

create table entitlements (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  plan                     plan_t not null,
  granted_at               timestamptz not null default now(),
  stripe_customer_id       text,
  stripe_payment_intent_id text
);

-- ---------- indexes ----------

create index guests_wedding_idx        on guests (wedding_id, sort);
create index tables_wedding_idx        on tables (wedding_id, sort);
create index budget_wedding_idx        on budget_categories (wedding_id, sort);
create index tasks_wedding_idx         on tasks (wedding_id, sort);
create index vendors_wedding_idx       on vendors (wedding_id, sort);
create index vendor_payments_vendor_idx on vendor_payments (vendor_id, sort);
create index registry_wedding_idx      on registry_items (wedding_id, sort);
create index custom_tpl_wedding_idx    on custom_templates (wedding_id, sort);
create index rsvps_wedding_at_idx      on rsvps (wedding_id, at desc);
create index rsvps_guest_idx           on rsvps (guest_id);
create index invites_wedding_idx       on wedding_invites (wedding_id);
create index members_user_idx          on wedding_members (user_id);
