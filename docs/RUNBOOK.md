# Luma: support runbook

How to handle the three support tickets that will arrive, using the real tables. See
[ENVIRONMENTS.md](ENVIRONMENTS.md) for which project is which.

**Where to run queries:** the **production** Supabase project (check the name top-left, not the
"PRODUCTION" badge) → **SQL Editor**. The SQL Editor runs as `postgres`, which bypasses row-level
security. Every query here can see every couple's data, so read only what the ticket needs.

**Never** fix a ticket by running a test purchase, a test RSVP or a test sign-up against production.

**First, is Luma itself up?**
```bash
curl -s https://planning-made-easy.vercel.app/api/health
```
`{"status":"ok"}` means the site and database are answering. `{"status":"unavailable"}` (HTTP 503) means
check status.supabase.com and the Supabase dashboard before anything else.

**Find the couple** (used by every section below):
```sql
select u.id as user_id, u.email, u.email_confirmed_at, u.last_sign_in_at,
       w.id as wedding_id, w.slug, w.plan, m.role
from auth.users u
left join wedding_members m on m.user_id = u.id
left join weddings w on w.id = m.wedding_id
where u.email = lower('customer@example.com');
```

---

## 1. "I paid but I'm still on the free plan"

The free plan is called **Engaged** in the app and stored as `essential`. A paid plan reaches the
wedding through **Stripe → `api/stripe-webhook` → database**:

- `purchases` gets a row for the payment.
- `entitlements` records the purchaser's plan.
- `weddings.plan` is what the app actually reads.

1. **Ask them to reload the page.** The app checks again after checkout, but a slow webhook can take a minute.
2. **Find the payment in Stripe:** Dashboard → Payments → search the customer's email. Note the
   `pi_…` id and check that the status is **Succeeded**. If it isn't, there's nothing to fix in Luma.
3. **Did it reach the database?**
   ```sql
   select tier, status, amount, amount_refunded, currency, wedding_id, user_id, created_at
   from purchases where stripe_payment_intent_id = 'pi_…';

   select plan, stripe_payment_intent_id from entitlements where user_id = '<user_id>';
   ```
4. **Read the cause from Stripe:** Developers → Webhooks → the production endpoint → **Event deliveries**,
   then find the `checkout.session.completed` for this payment.

| What you see | Cause | Fix |
|---|---|---|
| Delivery **failed** (4xx/5xx) | The webhook crashed or was misconfigured. Vercel → Logs, search `[webhook]` | Fix the cause, then click **Resend** on that event in Stripe. Safe: a failed event is not marked as processed |
| Delivered, but the log says `signature verification failed` | `STRIPE_WEBHOOK_SECRET` doesn't match this endpoint | Copy the endpoint's signing secret into Vercel (Production), redeploy, then **Resend** |
| Delivered, log says `no wedding found for purchaser` | They paid before creating a wedding | The entitlement exists. Apply it to their wedding (below) |
| Delivered, `purchases` row exists, but the wedding shows the wrong plan | They bought for a different wedding, or a partner bought it | Check `purchases.wedding_id` against their wedding |
| No delivery at all | The endpoint URL is wrong, or the event isn't subscribed | Endpoint must be `https://planning-made-easy.vercel.app/api/stripe-webhook` with events `checkout.session.completed` and `charge.refunded` |

**Applying a plan by hand** is a last resort, and only after you have confirmed a **succeeded payment in
Stripe**. Use the SQL Editor (runs as `postgres`). The app itself can't change `weddings.plan`: a trigger
(0008) allows only `postgres` and the service role.
```sql
update weddings set plan = 'celebration'   -- or 'luxe': the tier they paid for
where id = '<wedding_id>';
```
Then note the `pi_…` id and what you did in your support reply. Resending the Stripe event is always
better: it also writes `purchases` and `entitlements`, which refunds depend on.

**Refunds** are issued in Stripe (Payments → the payment → Refund). The `charge.refunded` webhook
updates the plan by itself:
- a **full** refund moves the wedding to the highest plan still paid for, or to free;
- a **partial** refund keeps the plan.

**Card disputes (chargebacks) do not change the plan automatically yet.**

---

## 2. "Guests say they can't RSVP"

Ask for **the exact link** a guest used and **the exact message** they saw.

1. **Find the wedding and whether it's open:**
   ```sql
   select w.id, w.slug, w.plan, ic.is_live, ic.collect_rsvp
   from weddings w left join invitation_config ic on ic.wedding_id = w.id
   where w.slug = '<slug>';   -- from a link like …/#/invite?slug=<slug>
   ```
   For a personal link (`…/#/invite?token=…`): `select wedding_id, name from guests where rsvp_token = '<token>';`

2. **Match the message:**

| Guest sees | Cause | Fix |
|---|---|---|
| "This invitation can't be found" / "We couldn't find this invitation" | Wrong or mistyped slug, or a token for a deleted guest | Couple re-shares the link from the app. Personal links change if the guest was deleted and re-added |
| "This invitation isn't open yet" | `is_live = false` | Couple turns on **Open to guests** in Invitations. Don't change it for them without asking: it controls their privacy |
| "We couldn't confirm you're a person" | Turnstile failed: an old browser, a blocker, or the site's domain missing from the Turnstile widget | Try another browser or turn off blockers. If **every** guest gets it, check Cloudflare → Turnstile → the widget's **hostnames** include the site's domain (add a custom domain there when you add one) |
| "Lots of answers just now…" | Rate limit: 10 answers per visitor per wedding per hour (`rsvp_rate`), 6 per personal link, 300 per wedding | Wait an hour. Many guests on one shared Wi-Fi network (a venue or office) share one address |
| "Something in the answer wasn't accepted" | A name under 2 or over 120 characters, a meal over 80, or a note over 1000 | Shorten it |
| "Your RSVP couldn't be sent" | Server error | Vercel → Logs, filter `/api/rsvp`, look for `[rsvp] submit failed` or `rate check failed` with a code |

3. **Did answers arrive?**
   ```sql
   select name, answer, source, at from rsvps
   where wedding_id = '<wedding_id>' order by at desc limit 20;
   ```
   Answers are stored straight away. The couple sees them the next time their planner syncs. Asking them to
   reload usually helps.

To check a visitor's rate-limit count (needs the service role, so use the SQL Editor):
`select ip_hash, window_start, hits from rsvp_rate where wedding_id = '<wedding_id>' order by window_start desc;`
The raw IP addresses are never stored, so you can't search by IP.

---

## 3. "I can't log in" / "I never got the email"

1. **Look the person up** (the "find the couple" query at the top).

| What you find | Cause | Fix |
|---|---|---|
| No row | They signed up with another address, or never finished signing up | Ask which addresses they might have used |
| `email_confirmed_at` is empty | The confirmation email didn't arrive | See "emails not arriving" below |
| Confirmed, signs in fine, but sees an empty planner | They're signed in with a different address than the wedding's, or the partner invite wasn't accepted | `select email, accepted_at from wedding_invites where wedding_id = '<wedding_id>';`. The partner must sign up with exactly the invited address |
| Confirmed, password forgotten | – | They use "Forgot password" on the sign-in screen, or you send a reset: Authentication → Users → the user → **Send password recovery** |

2. **Emails not arriving.** Check Supabase → **Authentication → Emails → SMTP Settings**.
   - **No custom SMTP:** Supabase's built-in mailer is meant for testing. It only delivers to your
     project team's addresses and is heavily rate-limited, so real customers **won't get emails**. Setting up
     custom SMTP (for example Resend, Postmark or Brevo) is required before launch.
   - **Custom SMTP set:** check Authentication → **Logs** for send errors, ask the person to check spam,
     and check your email provider's dashboard for bounces.
   - To unblock one person quickly, confirm them by hand. Only do this after confirming by reply email that
     they own the address: Authentication → Users → the user → **Confirm email** (if your dashboard shows it), or
     ```sql
     update auth.users set email_confirmed_at = now() where email = lower('customer@example.com') and email_confirmed_at is null;
     ```

3. **Signed in on one device but not another:** sessions are stored per browser. Signing out on a shared
   device also clears that device's offline copy of the planner.

---

## Account deletion requests

The privacy policy promises deletion **within 30 days**. Reply from the support address.

1. Confirm that the request came from the account's own email address.
2. Remind them about **Export my data** in the account menu, and that deleting an **owner** deletes the whole wedding, including for the partner.
3. Supabase → Authentication → Users → the user → **Delete user**. This cascades: an owner's wedding and
   everything in it go too, while a partner only loses their membership. Uploaded songs stay in
   storage: delete the folder `media/<wedding_id>/` in Storage.
4. Reply to confirm it's done.

---

## Monitoring (set up once, outside the code)

- **Uptime monitor** (free: UptimeRobot, Better Stack): an HTTP check on
  `https://planning-made-easy.vercel.app/api/health` every 5 minutes, alerting when the status code isn't 200.
  Send alerts to an address you read.
- **Stripe webhook failures:** Stripe emails the account owner when an endpoint keeps failing. Check it's
  enabled in your Stripe profile → Communication preferences, then look at Developers → Webhooks → the
  endpoint now and then for failed deliveries.
- **Errors:** front-end errors and function logs go to **Vercel → Logs** (search `[report:error]`, `[webhook]`,
  `[rsvp]`, `[checkout]`, `[health]`). Free Vercel plans keep logs only briefly. Setting `VITE_SENTRY_DSN`
  (Production) sends front-end errors to Sentry instead, where they're kept and grouped.

## Restore log

| Date | What was restored | Into | Took | Result |
|---|---|---|---|---|
| – | – | – | – | Not yet done: see ENVIRONMENTS.md → "Backups and a restore test" |
