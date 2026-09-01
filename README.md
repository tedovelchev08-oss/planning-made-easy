# Luma — Plan the feeling, not just the wedding

Luma is a premium wedding-planning product: an editorial marketing site with an interactive
Three.js hero, and a full planner workspace (guests, budget, timeline, vendors, seating studio,
registry, and a merged Wedding Page studio for invitations + website + RSVP tracking).

Built with **React 18 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · React Three Fiber / Drei**.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build → dist/
```

`dist/` is a fully static site and deploys as-is to Netlify, Vercel or any static host
(a `netlify.toml` with security headers is included). Routing is hash-based, so every
route works on static hosting with no extra redirects.

## Scripts

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Start the Vite dev server             |
| `npm run typecheck` | TypeScript check, no emit           |
| `npm run build`   | Production build into `dist/`         |

## Project structure

```
index.html            shell, fonts, SEO/OG metadata
public/               robots.txt, sitemap.xml
src/
  main.tsx            entry
  App.tsx             routes (marketing, planner shell, guest invite, 404)
  index.css           design system (@theme tokens), materials, keyframes, reduced-motion
  lib/
    data.ts           types + seed data, toDayKey() date normalisation
    store.tsx         app state, localStorage persistence, migrations, auth session
    images.ts         remote image URLs with fallbacks
    sound.ts          WebAudio chimes + generative invitation music
  components/
    ui.tsx            primitives: buttons, modal, drawer, toasts, checkout, auth, DesignFrame
    marketing/        Nav, Hero, Sections, Social, Closing
    three/HeroScene   the 3D hero installation (lazy-loaded chunk)
    dashboard/        Shell + planner modules (Overview, Guests, Budget, Timeline,
                      Vendors, Seating, Registry, PageHub: Invitations/Website/RSVPs,
                      CalendarCard, CmdK)
  pages/              Home, GuestInvite, NotFound
```

## Current limitations (read before demoing)

There is **no backend of any kind** yet. Everything below is client-side simulation:

- **State** — all wedding data lives in the browser's `localStorage` (`luma.db.v2`).
- **Auth** — any email + any password signs you in; "Continue with Google" is hardcoded.
  Sessions persist locally. Supabase Auth is the intended Phase 1 replacement
  (`@supabase/supabase-js` is installed but not yet imported).
- **Payments** — checkout is a simulated Stripe flow: a short delay, then the plan
  entitlement is written to local state. Nothing is charged; there is no webhook.
- **Email** — sends are simulated with toasts. Resend (or equivalent) is planned.
- **Guest pages** — the public invitation/website pages read the *viewer's* localStorage,
  so a real guest's RSVP on another device never reaches the couple. A shared backend is
  required before links can be sent to real people.
- **Marketing copy** — social proof ("4,200+ couples", named testimonials) is placeholder
  copy, not real customers.
