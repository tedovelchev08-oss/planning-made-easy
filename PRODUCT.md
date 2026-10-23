# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engaged couples planning their own wedding together. Both partners use it, often on their phones in the evening, sometimes at the same moment. Professional wedding planners are not the audience.

Guests also meet Twofold, but only through what a couple sends them: the invitation and its RSVP, opened on a phone, with no account.

## Product Purpose

Twofold is the wedding planner two people share. Guests and their answers, budget, timeline, vendors, seating and the registry live in one plan both partners edit, and every change shows on both screens straight away. Couples send their own invitation and wedding page; guests answer from their phone and the answers land in the plan.

Success: a couple keeps the whole wedding in Twofold from the first guest list to the seating chart they hand the venue, and enjoys doing it together.

## Positioning

Planned together, live: one plan, two people, every change on both screens. Free to start; two one-time upgrades, never a subscription.

## Operating Context

- Partners plan in short evening sessions on phones and longer ones on laptops, and are often both in the plan at once.
- Seating is a shared task the couple wants to enjoy: deciding together who sits where, seeing the room come together, avoiding mistakes (full tables, guests left unseated, people who must or must not sit together), handing the venue a chart it can use, and later showing guests where they sit.
- Seating must work fully on a phone, made for touch first, not only on a laptop.

## Capabilities and Constraints

- Plans: Engaged (free: budget, timeline, vendors, seating, registry, up to 50 guests, a simple invitation with RSVP, planning with a partner); Celebration €49 and Luxe €99, one-time (every guest, every invitation design, personal RSVP links, wedding website, the venue's seating sheet). Source of truth: `src/lib/plans.ts`.
- The couple's own invitation designs are paid features; the free plan is the planner.
- Accounts and data: Supabase; the planner caches the plan on the device and syncs edits in the background. A demo mode runs without accounts.
- No own domain yet: the public address is planning-made-easy.vercel.app.
- Terms: guests answer Coming, Waiting or Can't come; tasks belong to one partner or to both ("Together"); vendors are Asked, Proposal, Booked or Declined.

## Brand Commitments

- Name: Twofold. Tagline: "Two of you. One plan." Wordmark with two gold rings as the O's (`public/brand/`).
- Quiet luxury, black tie, warm rather than cold; the owner rejected both an all-black look ("like a funeral") and an all-white one.
- Imagery is photographic and real-looking (materials, objects, light), never vector scenery; no stock photos of people.
- Plain, warm words a couple uses, not system terms.

## Evidence on Hand

- Real product, demo data (Maya & Theo) and the couple's own invitation designs in `public/designs/`.
- No confirmed customer testimonials, ratings, usage numbers or press. Do not invent any.

## Product Principles

1. Two people, one plan: every surface should make planning together visible and pleasant, never a solo chore.
2. Plain words over system words: say what a couple would say.
3. The phone is a first-class place to plan, not a reduced view.
4. Honest about what's free and what's paid; never imply a paid feature comes with the free plan.
5. Real materials and real data over decoration.
