# Luma: environments

Luma runs in three places. **Only Production touches real customers.** Every pull-request preview
talks to a separate staging database, so testing a PR can never read or change a real couple's wedding.

| | Local | Preview (every PR) | Production |
|---|---|---|---|
| Site | `npm run dev` | `planning-made-easy-*.vercel.app` | planning-made-easy.vercel.app |
| Supabase | demo mode (no `.env.local`) or local `supabase start` | **luma-staging** · `jgwombhiovdnketixpkr` · eu-west-1 | **production** · `yyznkxfxmwetsmivgpxu` |
| Stripe | – | test mode | test mode today; **live mode at launch** |
| Turnstile | – | Cloudflare **test** keys (always pass) | real keys |
| Errors | browser console | Vercel function logs | Vercel function logs (Sentry not configured) |

## Lesson learned: check the project, not the badge

The Supabase dashboard shows a green **"PRODUCTION"** badge on *every* project's main branch, including
luma-staging. It names the git branch, not the project. Before running SQL by hand, read the
**project name in the top-left corner** (and the ref in the URL: `jgwombhiovdnketixpkr` = staging,
`yyznkxfxmwetsmivgpxu` = production). SQL meant for staging was once run against production because of this badge.

## Environment variables (Vercel → Settings → Environment Variables)

Each variable is set **separately for Production and for Preview**. Never tick both with one value,
except where the table says "same".

| Variable | Production | Preview | Who reads it |
|---|---|---|---|
| `VITE_SUPABASE_URL` | production project URL | staging project URL | browser + all functions |
| `VITE_SUPABASE_ANON_KEY` | production anon key | staging anon key | browser + `/api/health` (public by design) |
| `SUPABASE_SERVICE_ROLE_KEY` | production service role | staging service role | functions only. **Secret** |
| `STRIPE_SECRET_KEY` | `sk_live_…` at launch (`sk_test_…` until then) | `sk_test_…` from the **staging** Stripe sandbox | `api/create-checkout`, `api/stripe-webhook`. **Secret** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` of the production endpoint | `whsec_…` of the staging endpoint | `api/stripe-webhook`. **Secret** |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAAFX08Z2NQsVJGx6D` | `1x00000000000000000000AA` (test) | browser |
| `TURNSTILE_SECRET_KEY` | real secret | `1x0000000000000000000000000000000AA` (test) | `api/rsvp`. **Secret** in production |
| `VITE_PUBLIC_SITE_URL` | `https://planning-made-easy.vercel.app` | **unset** (links then point at the preview itself) | browser |
| `VITE_SENTRY_DSN` | unset (optional) | unset | browser |

Rules:

- **Server secrets never get a `VITE_` prefix.** Anything starting with `VITE_` is built into the public JavaScript.
- `VITE_*` values are baked in at **build** time. After changing one, **redeploy**, or the old value stays.
- The CSP in `vercel.json` (`connect-src`) lists **both** Supabase origins, because the headers are the same for
  every deployment. A new Supabase project must be added there, or the browser blocks it.

## Stripe

- **Production** uses the main Stripe account. It is in test mode until launch. Webhook endpoint:
  `https://planning-made-easy.vercel.app/api/stripe-webhook`, events `checkout.session.completed`, `charge.refunded` and `charge.dispute.closed`.
- **Preview** should use a **separate Stripe sandbox**. Then test purchases on a PR never show up among
  production's test data, and the two webhook secrets can't be mixed up. Its webhook endpoint must point at a
  deployment that serves Preview env vars. A preview URL changes with every deployment, so use the
  **branch alias** of a long-lived branch, or update the endpoint before a payment test.
- At launch: switch Production's `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to live-mode values, create
  the live webhook endpoint, and redeploy.

## Database changes: staging first, then production

Merging to `main` applies new migrations to **production automatically** (Supabase GitHub integration).
There is no step in between, so a migration must be **applied to staging and tested there before the PR merges**.

1. The PR adds a new file `supabase/migrations/00NN_*.sql`. Never edit one that's already on `main`.
2. CI runs the pgTAP suite against a throwaway database ("Supabase RLS Tests"). It must pass.
3. Apply the migration to **staging**, by either method:
   - **Dashboard:** open the **luma-staging** project (check the name top-left) → SQL Editor → paste the
     file's contents → Run. Expect "Success. No rows returned".
   - **CLI** (from the repo folder):
     ```bash
     supabase link --project-ref jgwombhiovdnketixpkr
     supabase db push
     ```
     `db push` applies only migrations staging hasn't run yet. It asks for the staging database password.
4. Test the change on the PR's preview, which uses staging.
5. Merge. Then confirm production applied it: the "Supabase Preview" check on the merge commit, or in
   production's SQL Editor run `select version from supabase_migrations.schema_migrations order by version desc limit 3;`.
   If the deploy failed (for example "dial error: timeout" during an outage), apply the file by hand in
   **production's** SQL Editor. Migrations are idempotent, so running one twice is safe.

### Setting up staging from scratch

Run every file in `supabase/migrations/` **in order** (0001, 0002, …) against the staging project, by either
method above. With the CLI, a single `supabase db push` runs them all.

## Backups and a restore test

What's available depends on the Supabase plan, which the code can't see:
**production project → Database → Backups**.

- **Free plan:** no dashboard backups. Make your own with
  `supabase db dump --linked -f backup.sql` (schema) and `supabase db dump --linked --data-only -f data.sql`
  (data), and keep the files somewhere private. **They contain customer data.**
- **Pro plan:** daily backups, kept 7 days. Point-in-time recovery is a paid add-on.

**Do one test restore before launch**, so you know the backups actually work. This follows Supabase's
"Backup and restore using the CLI" guide. Both connection strings are in each project → **Connect** (use the session pooler string).

1. **Dump production data** (read-only on production):
   ```bash
   supabase db dump --db-url "$PROD_DB_URL" -f data.sql --use-copy --data-only
   ```
2. **Reset staging** to an empty copy of the schema. This deletes everything in staging. Check the ref twice:
   ```bash
   supabase link --project-ref jgwombhiovdnketixpkr
   supabase db reset --linked
   ```
3. **Restore the data into staging**:
   ```bash
   psql --single-transaction --variable ON_ERROR_STOP=1 \
     --command 'SET session_replication_role = replica' \
     --file data.sql --dbname "$STAGING_DB_URL"
   ```
4. **Check it worked:** run `select count(*) from weddings;` (and `guests`, `purchases`, `auth.users`) in staging's SQL Editor and in production's, and compare.
5. **Wipe staging again** with step 2, then delete `data.sql`. After the test, staging holds real customer data, and every preview uses staging.
6. Write down the date and how long it took in `docs/RUNBOOK.md` → "Restore log".
