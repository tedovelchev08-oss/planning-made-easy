# Luma: go-live checklist

Everything between "the code is ready" and "real couples can pay". Work top to bottom: later steps
assume earlier ones. Each step says **where**, **what**, and **how to check it worked**.
[ENVIRONMENTS.md](ENVIRONMENTS.md) explains which project is which; [RUNBOOK.md](RUNBOOK.md) covers support.

Before any Supabase step: read the **project name in the top-left corner** (the green "PRODUCTION"
badge appears on every project). Do it on **staging first**, then production.

---

## 1. The business

- [ ] **Register the business.** You need a seller name, a registered address and, for Stripe live
  mode, business and bank details.
- [ ] **VAT: ask an accountant.** Do you need to charge VAT, from when, and do you sell to consumers in
  other EU countries (the EU-wide €10,000 threshold for digital services)? The answer decides step 6.
- [ ] **Update the legal pages:** send the registered name and full postal address, and the pages
  (privacy, terms, refunds, cookies) are updated in one PR. They currently name you personally,
  "Sofia 1000".
- [ ] **A lawyer's review** of the four legal texts, with `docs/DATA-INVENTORY.md`, before taking real money.

## 2. Email that reaches customers

Supabase's built-in mailer only delivers to your own team's addresses and a few per hour. Real couples
won't get confirmation, magic-link or reset emails until this is done.

- [ ] Choose a provider: **Resend**, **Postmark** or **Brevo** (all have free tiers). They need a domain
  you own to send from (for example `hello@yourdomain.com`), with the DNS records they give you.
- [ ] **Supabase → Authentication → Emails → SMTP Settings → Enable custom SMTP:** host, port, user and
  password from the provider, sender name "Luma", sender address on your domain.
- [ ] **Authentication → Rate Limits:** raise "emails per hour" to suit (the provider's limit applies anyway).
- [ ] **Check:** sign up with a new address you own on the live site; the email arrives within a minute
  and the link signs you in. Then try "Forgot password?".

## 3. Where sign-in links may lead

Sign-up, magic-link and reset emails send the person back to the page they started on. Supabase only
allows addresses on its list.

- [ ] **Production → Authentication → URL Configuration:** Site URL `https://planning-made-easy.vercel.app`;
  Redirect URLs include `https://planning-made-easy.vercel.app/**`.
- [ ] **Staging → the same screen:** Redirect URLs include
  `https://planning-made-easy-*-one-man-army-eaf1.vercel.app/**` (every preview).
- [ ] **Check:** a magic link requested on a preview opens that preview, not production.

## 4. Bot protection on sign-in (Block 11)

- [ ] **Staging:** Authentication → Attack Protection → Captcha on → Turnstile → the test secret
  `1x0000000000000000000000000000000AA`.
- [ ] **Production:** the same, with the real Turnstile secret (Vercel `TURNSTILE_SECRET_KEY`, Production).
- [ ] **Check:** sign in on the live site. If it says "captcha protection: request disallowed", the secret
  doesn't match the site key `0x4AAAAAAFX08Z2NQsVJGx6D`: turn captcha off and recheck.

## 5. Payments: Stripe live mode

- [ ] **Activate the Stripe account** (business details, bank account, identity).
- [ ] **Settings → Customer emails:** turn on **Successful payments** and **Refunds** (Luma refunds
  duplicate payments automatically, Block 10, and the customer should hear about it).
- [ ] **Developers → Webhooks → Add endpoint** (in **live** mode):
  `https://planning-made-easy.vercel.app/api/stripe-webhook`, events
  `checkout.session.completed`, `charge.refunded`, `charge.dispute.closed`. Copy its signing secret.
- [ ] **Vercel → Settings → Environment Variables → Production:** `STRIPE_SECRET_KEY` = the live
  `sk_live_…`; `STRIPE_WEBHOOK_SECRET` = the live endpoint's `whsec_…`. Then **Redeploy** production.
- [ ] **Your profile → Communication preferences:** email on webhook failures.
- [ ] **Check:** buy Celebration on the live site with your own card. The planner unlocks within a minute
  and the webhook shows `200`. Then refund it in Stripe: the plan goes back to free (Stripe keeps its fee).

## 6. VAT (only if step 1 says so)

- [ ] **Stripe → Tax:** set your origin address and add your **registrations** (Bulgaria, and the EU OSS
  scheme if you sell to consumers in other EU countries).
- [ ] **Vercel → Production:** `STRIPE_AUTOMATIC_TAX` = `true`, then redeploy. Prices stay €49 / €99
  **including** VAT: the buyer pays the same, the VAT comes out of it.
- [ ] **Check:** a test checkout shows "Includes VAT" and the invoice in Stripe shows the tax line.

## 7. Watching it run

- [ ] **Uptime monitor** (UptimeRobot or Better Stack, free): HTTP check on
  `https://planning-made-easy.vercel.app/api/health` every 5 minutes; alert when not 200.
- [ ] **Errors (optional):** create a Sentry project and set `VITE_SENTRY_DSN` (Production), then redeploy.
  Without it, errors are in Vercel → Logs (search `[report:error]`).
- [ ] **Vercel plan:** the free Hobby plan is for non-commercial use. Move to **Pro** before selling.

## 8. Data safety

- [ ] **Supabase → Database → Backups:** check what your plan includes (Pro: daily, kept 7 days).
- [ ] **One restore test** into staging, then wipe staging: [ENVIRONMENTS.md](ENVIRONMENTS.md) →
  "Backups and a restore test". Note it in the RUNBOOK's restore log.

## 9. Staging that matches production

- [ ] **A separate Stripe sandbox for staging** (Stripe → the account switcher → create sandbox).
  Its test keys go into Vercel **Preview** env vars, and its webhook endpoint (same three events)
  points at a preview's branch address.
- [ ] Re-run step 2's email check and step 4's captcha check on a preview.

## 10. A custom domain (optional, whenever you're ready)

Moving from `planning-made-easy.vercel.app` to your own domain touches several places at once:

- [ ] **Vercel → Domains:** add the domain.
- [ ] **Vercel → Production env:** `VITE_PUBLIC_SITE_URL` = `https://yourdomain.com` (links sent to
  guests and the address Stripe returns buyers to), then redeploy.
- [ ] **Supabase (production) → URL Configuration:** Site URL and Redirect URLs to the new domain.
- [ ] **Cloudflare → Turnstile → the widget → Hostnames:** add the domain, or RSVPs and sign-in fail there.
- [ ] **Stripe → Webhooks:** the endpoint URL can stay on `vercel.app`, or move to the new domain.
- [ ] **Legal pages:** the privacy policy and terms mention `planning-made-easy.vercel.app`; ask for a PR.
- [ ] Old guest links keep working: `vercel.app` still serves the site.

## 11. Final smoke test (on the live site, with your own accounts)

- [ ] Sign up → confirmation email → planner.
- [ ] Create the wedding, add guests, invite a partner (second account) → they join.
- [ ] Two windows, two accounts: an edit in one appears in the other within seconds.
- [ ] Turn on "Open to guests" → open the invitation on your phone → RSVP → it appears in the planner.
- [ ] Buy a plan → unlocks → refund → back to free.
- [ ] Export my data → a JSON file downloads.
- [ ] Delete the test accounts (account menu → Delete my account).
