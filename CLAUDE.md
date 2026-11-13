# Twofold: notes for Claude

Twofold (formerly "Luma") is the wedding planner two people share. React 18 + Vite + TypeScript,
Supabase (Postgres, RLS, storage), Stripe Checkout, Vercel (`api/*.ts` functions), Vitest + pgTAP.
Live: https://planning-made-easy.vercel.app (no own domain yet).

Read before designing or writing copy: `PRODUCT.md` (who it's for, plans, brand commitments) and
`DESIGN.md` (tokens, type, components). Operations: `docs/GO-LIVE.md`, `docs/RUNBOOK.md`,
`docs/ENVIRONMENTS.md`, `docs/BACKEND.md`.

## Two computers, one project

The owner works on a Windows PC at work and a Mac at home, each with its own Claude chat and its
own clone of this repo. Chats don't share history; this file and git are the shared memory.

- **Start of a session:** `git pull` on main before anything else.
- **End of a session:** commit, push, and open or update the PR. Then update **Status** below.
- Never have both machines editing the same branch at once. One branch per piece of work.

## Rules that have cost real time before

1. **Migrations apply to production automatically when merged to main.** Never edit a migration
   that is already on main; add the next number. Keep them idempotent. Test with
   `supabase db reset && supabase test db` before the PR.
2. **Never write to production to test.** Use local Supabase or the staging project.
3. `"engines": {"node": "22.x"}` in `package.json` is load-bearing (removing it crashed every
   function). Don't touch it.
4. **Never add or loosen a policy, grant or check to make a test pass.** Fix the test instead:
   go through the real path (an RPC), not around it.
5. pgTAP fixtures: `authenticated`/`anon` can't create objects in `public`. Create helper tables
   and fixture rows at the top, as postgres, before the first `set local role`; don't drop them,
   `rollback` does. CI prints failing pgTAP lines as annotations: read them before changing code.
6. RLS restricts rows, not columns. Plan and ownership columns are locked by a trigger.
7. Secrets live in Vercel / Supabase / GitHub settings, never in the repo or the chat. Server-only
   secrets never get a `VITE_` prefix.
8. Green CI isn't the whole report: show pgTAP output, curl against a preview, or phone (375x812)
   and desktop screenshots, whichever fits the change.

## Status (update at the end of every session)

As of 2026-11-13:

- **main** is at PR #107 (Silk planner: frame, guests, money, timeline, seating). Phase 1 and most
  of Phase 2 of the production audit are merged; the Twofold rebrand merged in #96, the landing
  rebuild in #97.
- **Open: PR #108** "one Invitation page; Registry in the Silk desk look", branch
  `feat/planner-silk-registry-page`. All checks green, mergeable. Note before merging:
  - it adds migration `0021_registry_on_invitation.sql`, which runs on production at merge;
  - it retires the separate wedding website and removes it from the Celebration and Luxe
    feature lists in `src/lib/plans.ts`. Stripe product descriptions and any marketing copy that
    still promise a website need the same change.
- `polish/all-designs` has one unmerged commit from 2026-10-21; probably superseded. Check
  before deleting.
- **Go-live is blocked on the owner, not code** (`docs/GO-LIVE.md`): business registration and
  VAT, lawyer review of the legal pages, an email provider on an own domain (until then real
  couples get no sign-up emails), Stripe live mode, Supabase URL settings, Turnstile in
  production. Buying the Twofold domain unblocks the most.
- **Parked:** an on-screen assistant (a glass "light" avatar was favoured over an illustrated
  persona). The reminder rules it would use already exist in `src/lib/nudges.ts`.
- Invitation designs live in `public/designs/`. Some still carry "Luma" in file names, storage
  keys and `assets/CREDITS.txt`; credits are guest-visible-adjacent and should say Twofold.
