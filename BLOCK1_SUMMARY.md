# Block 1 Implementation Summary

## Changes Made

### 1. Database Migration (0008_security_fixes.sql)

**1a. weddings.plan authority**
- Created trigger `enforce_wedding_plan_authority()` that:
  - Forces `plan = 'essential'` on INSERT for non-service callers
  - Preserves `plan` and `owner_id` on UPDATE for non-service callers
  - Allows service_role and postgres to bypass (for webhook and migrations)
- Backfill script sets each wedding's plan to the highest entitlement held by any member

**1b. webhook_events RLS**
- Enabled RLS on `webhook_events` table
- No policies created (service role bypasses RLS, anon/authenticated cannot access)

**1c. Storage media bucket**
- Dropped old permissive policies
- Created new policies scoped to wedding folders:
  - `media read`: public (for guest page images)
  - `media write/update/delete/list`: authenticated users who are members of the wedding folder
  - Folder structure: `media/<wedding_id>/<filename>`
- Set bucket limits: 10MB file size, image/audio MIME types only

**1d. accept_pending_invite email verification**
- Rewrote function to check `email_confirmed_at` or `email_verified` JWT claim
- Returns `{claimed: 0}` for unverified emails
- Auto-adds partner to `wedding_members` after claiming

### 2. API Changes

**create-checkout.ts**
- Now requires `wedding_id` in request body
- Verifies caller is a member of that wedding (403 if not)
- Adds `wedding_id` to session metadata and payment_intent_data.metadata

**stripe-webhook.ts**
- `grantFromCheckout`: 
  - Reads `wedding_id` from session metadata
  - Falls back to purchaser's membership for older sessions
  - Updates `weddings.plan` by `wedding_id` (not `owner_id`)
  - Checks current plan before updating (monotonic upgrade)
  - Throws on update error (was silently ignored)
- `revokeFromRefund`:
  - Finds all weddings the user is a member of
  - Downgrades each to the highest entitlement held by remaining members
  - Handles multi-wedding users correctly

### 3. Client Changes

**api.ts**
- `fetchWorkspace`: reads `plan` from `weddings.plan` only (removed entitlement fallback)
- `createWedding`: no longer sends `plan` in insert (trigger forces 'essential')
- `createCheckoutSession`: now requires `weddingId` parameter
- `refreshEntitlement`: polls `weddings.plan` instead of `entitlements` (so partner purchases are visible)

**ui.tsx**
- `CheckoutModal`: passes `weddingId` to `createCheckoutSession`
- Throws error if no wedding found (onboarding not complete)

### 4. CI Changes

**ci.yml**
- Added `rls-tests` job that:
  - Sets up Supabase CLI
  - Starts local Supabase
  - Runs `supabase test db` (executes pgTAP tests)
  - Stops Supabase

### 5. pgTAP Tests (block1_security.test.sql)

14 tests covering:
- Member cannot update `weddings.plan` (blocked by trigger)
- Member cannot insert with non-essential plan (forced to essential)
- Member cannot change `owner_id` (blocked by trigger)
- Service role CAN update `weddings.plan` (webhook path)
- Anon cannot select from `webhook_events`
- Authenticated cannot select from `webhook_events`
- Service role can select from `webhook_events`
- User cannot insert into another wedding's storage folder
- Member can insert into their own wedding's storage folder
- Unverified email cannot claim invite
- Verified email can claim invite
- Partner is added to `wedding_members` after claiming
- Backfill sets wedding plan to highest member entitlement
- Service role can still update plan after backfill

## Verification Required

### Before Merge

Run locally:
```bash
supabase start
supabase db reset
supabase test db
```

Expected: All 14 tests pass.

If tests fail, check:
- Trigger syntax in 0008
- Policy names match what's being dropped
- Function signatures match calls

### After Merge

1. **CI should pass**: The `rls-tests` job will run `supabase test db` automatically

2. **Manual verification** (requires Stripe test mode):
   ```bash
   # Terminal 1: Start Stripe CLI
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   
   # Terminal 2: Start dev server
   npm run dev
   
   # Terminal 3: Create test purchase as PARTNER
   # - Sign in as partner
   # - Navigate to pricing
   # - Purchase Celebration Suite
   # - Complete Stripe test checkout (4242 4242 4242 4242)
   
   # Verify: Owner's session should show upgraded plan
   # Check: weddings.plan should be 'celebration' for the wedding
   ```

3. **Security verification** (browser console):
   ```javascript
   // Try to self-grant Luxe (should fail)
   const { error } = await supabase
     .from('weddings')
     .update({ plan: 'luxe' })
     .eq('id', 'your-wedding-id');
   
   // Verify plan is still 'essential' or current plan
   const { data } = await supabase
     .from('weddings')
     .select('plan')
     .eq('id', 'your-wedding-id');
   console.log(data[0].plan); // Should NOT be 'luxe'
   ```

## Rollback Plan

If issues arise after merge:

1. **Revert the migration**: 
   ```sql
   drop trigger trg_enforce_wedding_plan_authority on weddings;
   drop function enforce_wedding_plan_authority();
   -- Re-enable old storage policies
   -- Revert accept_pending_invite to original
   ```

2. **Revert API changes**: Git revert the commits

3. **Revert client changes**: Git revert the commits

## Notes

- The trigger uses `current_user` to detect service_role/postgres. This works because:
  - Service role sets `current_user = 'service_role'`
  - Migrations run as `postgres` or `supabase_admin`
  - Authenticated users have `current_user = 'authenticated'`

- The backfill runs as the migration role (postgres), so the trigger allows it

- Storage policies use `storage.foldername(name)[1]::uuid` to extract wedding_id from path
  - The `is not null` check prevents errors on malformed paths
  - UUID cast will fail safely if the folder name is not a valid UUID

- The webhook now handles both old sessions (no wedding_id) and new sessions (with wedding_id)
  - Old sessions fall back to purchaser's membership
  - This ensures backward compatibility during rollout
