# Luma: personal data inventory

For whoever writes Luma's privacy policy, terms and refund policy. Derived from the code at
`main` on 2026-10-15 (migrations `0001` to `0013`, `src/`, `api/`), not from assumptions.
Where something could not be confirmed from the code, it says so.

**Who is who.** A *couple* signs up and plans a wedding (two accounts can share one wedding:
the owner and an invited partner). *Guests* never sign up: they open an invitation link and
may RSVP.

## 1. What is stored, and who enters it

Database: Supabase Postgres. Every planner table is readable and writable only by the
wedding's members (row-level security, `is_wedding_member()`).

| Table · columns | Personal data | Entered by | Notes |
|---|---|---|---|
| `auth.users` (Supabase Auth) | email, password hash, sign-in timestamps | couple | Managed by Supabase. Luma never sees the password. |
| `weddings` · `names`, `partner_a`, `partner_b`, `date`, `venue`, `location`, `timezone`, `locale`, `currency`, `slug` | couple's names, wedding date and place | couple | `slug` is the public invitation address. New ones end in a random code (0011). |
| `wedding_members` · `user_id`, `role` | which accounts plan which wedding | system | |
| `wedding_invites` · `email`, `invited_by`, `accepted_at` | **partner's email address** | couple | Used to let the partner join after they sign up with that email. |
| `guests` · `name`, `party`, `rsvp`, `meal`, `dietary`, `notes`, `plus_one`, `plus_one_of`, `table_id`, `seat`, `rsvp_token` | **guests' names, meal choices, dietary requirements, free-text notes, plus-ones, seating** | couple (and guests' own RSVPs, once the couple syncs them) | `dietary` can reveal health or religious information (allergies, halal, kosher). `rsvp_token` is the secret in a guest's personal link. |
| `rsvps` · `name`, `answer`, `meal`, `note`, `plus_one`, `plus_one_meal`, `source`, `at` | **what a guest submitted** | guest | Written only through `api/rsvp.ts` → `submit_rsvp_verified` (0011/0012). |
| `rsvp_rate` · `ip_hash`, `wedding_id`, `window_start`, `hits` | an HMAC of the guest's IP address | system | Raw IPs are never stored. Rows older than a day are deleted. Service role only. |
| `vendors` · `company`, `contact`, `email`, `phone`, `notes` | **third parties' contact details** (vendors) | couple | Personal data about people who are not Luma users. |
| `vendor_payments`, `budget_categories`, `tasks`, `tables`, `venue_objects` | amounts, due dates, to-dos, floor plan | couple | Financial planning data. Not payment card data. |
| `registry_items` · `name`, `store`, `price`, `url`, `purchased` | gift list | couple | |
| `invitation_config` · `photo`, `music_url`, wording | a photo choice, an uploaded song's address | couple | `is_live` controls whether guests can see it at all. |
| `website_config` | site content and settings | couple | |
| `custom_templates` · `html`, `data_url` | designs the couple uploads (may contain photos of people) | couple | |
| `entitlements` · `user_id`, `plan`, `stripe_customer_id`, `stripe_payment_intent_id` | purchase record | system (Stripe webhook) | Service role writes only. |
| `purchases` · `user_id`, `wedding_id`, `tier`, `stripe_payment_intent_id`, `amount`, `amount_refunded`, `currency`, `status` | payment history | system (Stripe webhook) | Members can read their wedding's rows. |
| `webhook_events` · `id`, `type` | Stripe event ids | system | No personal data beyond ids. Service role only. |
| **Storage** bucket `media` · `<wedding_id>/music/<uuid>.<ext>` | uploaded songs | couple | **Public URLs**: anyone with the address can fetch the file. Deleting removes it from storage, but Supabase's CDN can keep serving a cached copy for up to an hour. |

**On the visitor's own device** (browser `localStorage`, cleared on sign-out):
`luma.cache.<email>` (a copy of the whole workspace for offline use), `luma.pending.<email>`
(unsaved edits), `luma.currency` (chosen currency), the Supabase session.

## 2. Who receives it (processors and third parties)

| Service | What it receives | Why | Not confirmed from code |
|---|---|---|---|
| **Supabase** | everything in section 1 | database, sign-in, file storage | Production region (staging is `eu-west-1`). Check the dashboard. |
| **Vercel** | every request: IP address, browser, the pages and API calls | hosting and serverless functions | Log retention period |
| **Stripe** | buyer's card and billing details (entered on Stripe's own page), email, and metadata `tier`, `user_id`, `wedding_id` | payments, refunds | |
| **Cloudflare Turnstile** | guest's IP and browser signals when answering an RSVP | stopping spam RSVPs | |
| **image.qwenlm.ai** | IP address of every visitor who loads the 6 marketing and invitation photos (`src/lib/images.ts`) | hosting those photos | Who operates it and their terms. Consider self-hosting the photos. |
| **Sentry** | error reports (see section 3) | error monitoring | **Only if `VITE_SENTRY_DSN` is set.** Not set at time of writing. |
| **Email provider** | sign-up confirmation and sign-in emails | auth emails | Supabase's built-in mailer is in use. Choose a provider (custom SMTP) before launch. |

Not used: Google Fonts (fonts are self-hosted from `/fonts`; the CSP still lists
`fonts.googleapis.com` and can drop it), analytics, advertising trackers.

Luma **does not send email or SMS** to guests: invitations go out through the couple's own
WhatsApp, Messenger, SMS or email via share links.

## 3. What is logged, and where

| Source | What is logged | Where |
|---|---|---|
| `src/lib/report.ts` → `api/report.ts` | front-end errors: message, stack, browser user agent, and **`window.location.hash`** | Vercel function logs |
| `src/lib/report.ts` → Sentry | the same, with the hash as a `route` tag | Sentry, if configured |
| `api/create-checkout.ts` | Stripe session id, user id, tier, amount, currency | Vercel function logs |
| `api/stripe-webhook.ts` | user id, wedding id, payment intent id, plan changes | Vercel function logs |
| `api/rsvp.ts` | database error codes on failure (no answer content) | Vercel function logs |

> **Flag for the lawyer:** `window.location.hash` on a guest's personal link is
> `#/invite?token=<rsvp_token>`. An error on that page logs the guest's secret token, which
> lets anyone with log access read and answer that guest's invitation. This should be
> stripped before logging (a small code change, scheduled separately) and mentioned in the
> policy until it is.

## 4. Data subjects' rights: what exists today

| Right | Status |
|---|---|
| Access / portability | **"Export my data"** in the planner's account menu downloads the whole workspace as JSON. |
| Erasure | **By request to support** (in-app explanation added). No self-service deletion yet. |
| Rectification | The couple can edit everything in the planner. Guests contact the couple. |
| Guests' own data | Held by the couple's wedding. A guest asks the couple, or support. |

**Deletion side effect to document.** `weddings.owner_id` is `ON DELETE CASCADE`: deleting the
**owner's** account deletes the whole wedding, including for an active partner, along with its
guests, RSVPs and files. Deleting a **partner's** account removes only their membership.

## 5. Payments and refunds: facts for the refund policy

- One-time payments: Celebration €49/$49/£49, Luxe €99/$99/£99. Upgrading pays the difference. No subscriptions.
- A **partial** refund keeps the plan. A **full** refund returns the wedding to the highest plan still paid for, or the free plan (0009).
- Digital service delivered immediately on payment. **The EU 14-day withdrawal right and how it is waived for immediate delivery is a legal question for the policy author.** The checkout does not currently ask for an explicit waiver.
