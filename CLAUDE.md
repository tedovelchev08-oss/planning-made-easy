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

- **main** is at PR #108 (merged 2026-11-13): one Invitation page (invitation, replies, share
  link, open-to-guests switch) and the Registry in the Silk desk look. The separate wedding
  website is retired; migration `0021_registry_on_invitation.sql` (registry now travels with the
  live invitation; nothing deleted) ran on production at merge. Terms and privacy no longer
  promise a website. Before #108: the Silk planner (#103-#107), the Twofold rebrand (#96), the
  landing rebuild (#97); Phase 1 and most of Phase 2 of the production audit.
- Terms promise "we won't take away features from a plan you have already paid for". Retiring the
  website was fine only because Stripe isn't live yet; once it is, removing a paid feature needs
  a plan for existing buyers.
- PR #110 (2026-11-14): designs with their own story section mark it `data-luma-story` (words:
  `data-luma-story-text`) so `luma-bridge.js` hides it when the couple wrote no story (Glasshouse,
  Red Thread, All In, Cinema). A new design with a custom story section needs the same markers.
  Bump `luma-bridge.js?v=` in every design when the bridge changes (now v=3).
- PR #111 (2026-11-14): Celestial and Mirror Palace openings start only once `html.luma-loading`
  is removed (the page is hidden until the couple's details load). Any design with a timed
  opening must do the same, or guests arrive mid-animation. Note: the in-app test browser
  freezes CSS animations when its window is off screen; judge animation timing on a real phone.
- PR #112: a reset link no longer traps people on /new-password (AuthLinks redirects once).
- PR #113 (2026-11-14): Italiana retired. Display type is Cormorant Garamond: page titles Light 300
  upright (`h1.font-display`), section/card titles italic 400 (`h2/h3.font-display`, `.pl-card-h`).
  Owner rejected bold/generic serifs; never use semibold or bold display type. Planner grows to
  1560px on 2xl screens.
- **In progress: Invitation page redesign "A + C"** (owner's choice, mocks at
  https://claude.ai/artifact/Va1KAjFt6eU2nJos3qcjJu): full-screen invitation edited in place
  (click text to type, dashed "+ Add" for empty sections, floating bar: design, colours,
  phone/desktop, see as guest), plus a guided first-time walk-through. **1b done (#114):** the
  invitation fills the page, studio designs show live in a same-origin iframe (`/designs/*` may be
  framed by 'self' only), tools open sheets from a floating bar, sharing lives in the Share sheet.
  **2 done (#116):** built-in designs are edited in place (`Editable`, `InviteArt` `edit` prop:
  names, lines, venue, date picker, + Add for photo/replies); the planner's studio preview loads
  `?preview=1&quiet=1` and the bridge skips the opening. **3 in progress:** studio designs edited
  in place, loaded with `?preview=1&quiet=1&edit=1`; the bridge posts `twofold:edit` to the
  planner, which saves through `studioEditPatch` (`src/components/dashboard/studioEdit.ts`).
  Done: Celestial, Mirror Palace (#117), Amalfi, Art Deco (#118), Riviera, Palm Springs (#119),
  Palm Shadow, The Tide (#120), Cinema, All In (#121), Red Thread, Glasshouse (#122), Liquid
  Gold, Inscription (#123). Left: Map, Plaster. Capitals must come from CSS, not `toUpperCase()`,
  or typed names are saved in capitals. Inscription's stone.js leaves editable lines unsplit. Markers: `data-edit="key"` (+ `data-edit-label`) makes text
  editable (keys: partner1/2, venueName, venueAddress, hashtag, story/story1/story2, or the
  design's own `extras.texts` key); `data-follow="key"` copies follow without being editable
  (cards, credits); `data-follow-names` lines show "A & B". Nothing inside `aria-hidden` is
  editable. Bridge is v=9 (reads typed letters, never innerText, which applies CSS capitals). Then 4: guided walk-through; "+ Add" for empty studio sections.
- PR #115: Red Thread measured a hidden section after #110. Designs must never measure or
  trigger on a section that may be hidden; use the first visible one.
- Unresolved: owner saw the dashboard wider than the phone screen after zooming out on an iPhone,
  on a preview URL with a near-empty plan. Not reproduced with demo data at 375px.
- The GitHub CLI (`gh`) is installed on the Windows PC, signed in as `tedovelchev08-oss`.
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
