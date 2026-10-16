# Security headers

The same header set is declared in **two** places, for two hosts:

| File           | Host it applies to | Comments allowed? |
| -------------- | ------------------ | ----------------- |
| `vercel.json`  | **Vercel (live)** — `planning-made-easy.vercel.app` | No (strict JSON) |
| `netlify.toml` | Netlify (kept for parity) | Yes |

> **⚠️ Keep them in step.** A header fixed in one file silently does nothing
> on the other host. Change both in the same commit. This document is the
> single source of truth for *why* the policy looks the way it does.

## The policy, directive by directive

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com;
frame-src 'self' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' blob: data: https:;
media-src 'self' blob: data: https://yyznkxfxmwetsmivgpxu.supabase.co https://jgwombhiovdnketixpkr.supabase.co;
connect-src 'self'
            https://yyznkxfxmwetsmivgpxu.supabase.co wss://yyznkxfxmwetsmivgpxu.supabase.co
            https://jgwombhiovdnketixpkr.supabase.co wss://jgwombhiovdnketixpkr.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self'
```

| Directive | Why it's there |
| --- | --- |
| `script-src 'unsafe-inline'` | `DesignFrame` renders owner-supplied HTML invitations in sandboxed `srcDoc` iframes (`allow-scripts`, no `allow-same-origin`). srcDoc documents inherit the parent CSP, so the inline `<script>` blocks inside imported `.html` invitations only run with `'unsafe-inline'`. The sandbox attribute keeps that code on an opaque origin with no access to the app. |
| `style-src 'unsafe-inline'` | Same srcDoc reason for inline `<style>`. |
| `font-src 'self'` | Playfair Display and Nunito Sans are self-hosted from `/fonts`; no font is loaded from Google. |
| `script-src`/`frame-src` challenges.cloudflare.com | The Turnstile spam check on the guest RSVP form. |
| `img-src data: https:` | `data:` — imported designs are stored as `canvas.toDataURL("image/jpeg")` strings (`Invitations.tsx`). `https:` — images referenced by owner HTML designs. The built-in photos are self-hosted under `/images`. |
| `media-src blob: data:` | `blob:` for object-URL media; `data:` — uploaded invitation tracks are stored via `FileReader.readAsDataURL()` (`Invitations.tsx`, 2.5 MB cap). |
| `connect-src` / `media-src` Supabase (production and staging) | **Everything the app does** — auth (magic links), workspace fetch/sync, and the anonymous RSVP insert via `submit_rsvp` — is a fetch to the project origin. Without it, the app is dead on arrival. The ref comes from `VITE_SUPABASE_URL` (see `.env.example`). |
| `connect-src` Supabase wss | Supabase Realtime socket. Not used by the app today; allowed anyway so switching Realtime on later can't be blocked by a forgotten CSP. |
| `frame-ancestors 'none'` + `X-Frame-Options: DENY` | The app is never an iframe. (Owner invitations run in `srcDoc` iframes inside the app — that direction is unaffected.) |
| `base-uri 'self'` / `form-action 'self'` | Blocks `<base>` hijack and form posts to third parties. |
| `Strict-Transport-Security` | 1 year, includeSubDomains. |

Plus, on `/assets/*` only: `Cache-Control: public, max-age=31536000, immutable`
— Vite fingerprints every asset, so immutable caching is safe.

## Changing the Supabase project

If the project ref changes (new Supabase project):

1. Update `VITE_SUPABASE_URL` in `.env.local` / the Vercel project env vars.
2. Replace `yyznkxfxmwetsmivgpxu.supabase.co` in **both** `vercel.json` and
   `netlify.toml` (https and wss, four occurrences total).
3. Re-run the B4 verification below.

## Verification after any header change (do this for real)

Deploy a preview, then from a machine with shell access:

```bash
# 1. headers present on the live response
curl -sI https://planning-made-easy.vercel.app/ \
  | grep -i "content-security-policy\|x-frame\|referrer\|strict-transport"

# 2. assets keep the immutable cache header
curl -sI https://planning-made-easy.vercel.app/assets/$(curl -s https://planning-made-easy.vercel.app/ | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2) \
  | grep -i cache-control

# 3. no CSP violations in the running app:
#    open DevTools → Console and confirm zero
#    "Refused to connect / load because it violates the following
#     Content Security Policy directive" messages while signing in,
#    opening the planner, and submitting an RSVP from #/invite.
```

A CSP that ships but blocks our own API is worse than no CSP — step 3 is
the one that actually matters.
