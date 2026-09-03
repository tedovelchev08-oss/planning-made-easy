# Luma — Backend

Supabase is the source of truth. The browser keeps a localStorage copy only as an
offline cache and instant-paint layer; every mutation is written back to Postgres.

## Setup

```bash
supabase init                      # once
supabase start                     # local stack
supabase db push                   # applies supabase/migrations/*
supabase db test                   # runs supabase/tests/rls.test.sql (pgTAP)

cp .env.example .env.local         # fill in the two VITE_ values from supabase status
npm run dev
```

Leave `.env.local` empty (or unset) and the app boots in **demo mode**: the full
seeded workspace, purely in-memory, no network. That is also what `?demo=1` and
the `/demo` route force.

## Data model

```
auth.users ──< wedding_members >── weddings ──< guests (rsvp_token uuid)
                  (owner|partner)      │        tables, tasks, budget_categories,
                                       │        vendors >─ vendor_payments,
                                       │        registry_items, custom_templates
                                       ├── invitation_config   (1 row)
                                       ├── website_config      (1 row)
                                       └── rsvps (anonymous intake, synced flag)

auth.users ──< entitlements          service-role-only (Stripe webhook, Phase 2)
             weddings.plan is a denormalised mirror of the current entitlement.
```

Both partners share one plan: the owner creates the wedding + their
`wedding_members` row, invites the partner by email (`invite_partner()`), and the
partner's next sign-in claims it (`accept_pending_invite()`), creating the second
membership row.

## The two anonymous surfaces

Everything else is member-only via RLS (`is_wedding_member()`). Anonymous access
exists in exactly two places, both expressed as SECURITY DEFINER functions rather
than table policies, so no underlying table is ever directly exposed:

### (a) `get_public_wedding(slug)` → jsonb

The guest-page reader. Returns *only* what a guest needs to render the page:
names, date, venue, plan, `invitation_config`, `website_config`, the matching
`custom_templates` row (if the invitation is an owner-imported design), and
registry **names/stores** (no URLs, no prices). Unknown slug → `null`.
Executable by `anon` + `authenticated`.

### (b) `submit_rsvp(token, slug, name, answer, meal, note, source)` → jsonb

The only write path open to anonymous callers, and never via the `rsvps` table
itself (it has no insert policy). Rules:

- resolves the wedding by **guest token** (per-guest link) or **slug** (open link);
  anything else raises `P0001`;
- names shorter than 2 characters raise `P0003`;
- rate-limited to **6 submissions / hour / token** and **12 / hour / wedding**
  on the open link (`P0002`);
- inserts into `rsvps` with `guest_id` set when a token was supplied.

**Answers never mutate the guest list.** They land in the couple's RSVP tracker
(`rsvps` rows, `synced = false`) and only become guest-record changes when the
couple explicitly uses the existing "Sync to guest list" review step.

## entitlements — service role only

`entitlements` has a single SELECT policy (`user_id = auth.uid()`) and **no**
insert/update/delete policies. The Stripe webhook (Phase 2) runs with
`SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS, and is the sole writer:

```
checkout.session.completed → upsert entitlements(plan, stripe_*)
                           → update weddings.plan (mirror)
```

The client can therefore never grant itself a tier, however it tampers with the UI.

## Frontend wiring

- `src/lib/supabase.ts` — client (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).
- `src/lib/db-types.ts` — the `Database` type, hand-mirrored from the migrations.
  Regenerate after schema changes with:
  `supabase gen types typescript --local > src/lib/db-types.ts`
- `src/lib/api.ts` — typed CRUD per entity + the RPC wrappers above.
- `src/lib/store.tsx` — optimistic local state, debounced write-behind, offline
  queue, reconnect reconciliation; `useApp()`/`useStats()` shapes unchanged.

## End-to-end RSVP confirmation

1. Deploy, sign up, finish onboarding → note your slug (`Settings → share link`).
2. Open `#/i/<slug>` in a **private window** (signed out).
3. Submit an RSVP.
4. In the couple's session: the RSVPs tab shows the answer with its channel badge;
   "Sync to guest list" applies it to the guest record.

## Known limits

- `invitation_config.music.uploadData` and `custom_templates.html` live in the
  row (fine for a demo; move to Storage buckets before scale).
- OAuth providers are not configured; auth is email+password and magic link.
