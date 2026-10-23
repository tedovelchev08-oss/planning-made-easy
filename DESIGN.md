---
name: Twofold
description: The wedding planner two people share. Quiet luxury, black tie, warm.
colors:
  onyx: "#0f0e0d"
  onyx-hover: "#2a2622"
  ink: "#1c1a17"
  ink-2: "rgb(28 26 23 / .64)"
  line: "rgb(28 26 23 / .12)"
  paper: "#ece3d1"
  card: "#f6f0e4"
  linen-card: "#e4d6bb"
  cream: "#f7f2e8"
  ivory: "#ede3cf"
  champagne: "#c9a86a"
  champagne-hover: "#d8b97c"
  bronze: "#7a5c28"
  taupe: "#8c826f"
  coming: "#7aa06a"
  cant-come: "#b55a45"
  alert: "#a53d28"
typography:
  display:
    fontFamily: "Italiana, Didot, Georgia, serif"
    fontSize: "46px"
    fontWeight: 400
    lineHeight: 1
  headline:
    fontFamily: "Italiana, Didot, Georgia, serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Italiana, Didot, Georgia, serif"
    fontSize: "22px"
    fontWeight: 400
    lineHeight: 1.15
  body:
    fontFamily: "Jost, Futura, Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-small:
    fontFamily: "Jost, Futura, Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.4
  accent:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "Jost, Futura, Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.14em"
  figures:
    fontFamily: "Jost, Futura, Avenir Next, Helvetica Neue, sans-serif"
    fontSize: "0.86em"
    fontWeight: 300
    fontFeature: "tnum"
rounded:
  hairline: "2px"
  card: "3px"
  table: "6px"
  sheet: "14px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.onyx}"
    textColor: "{colors.ivory}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.onyx-hover}"
  button-quiet:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.hairline}"
    padding: "0 14px"
    height: "40px"
  button-gold:
    backgroundColor: "{colors.champagne}"
    textColor: "{colors.onyx}"
    typography: "{typography.label}"
    rounded: "{rounded.hairline}"
    padding: "16px 24px"
  button-gold-hover:
    backgroundColor: "{colors.champagne-hover}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  segment-active:
    backgroundColor: "{colors.onyx}"
    textColor: "{colors.ivory}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  chip-filter:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  chip-filter-active:
    backgroundColor: "{colors.onyx}"
    textColor: "{colors.ivory}"
  input-search:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body-small}"
    rounded: "{rounded.hairline}"
    padding: "0 12px 0 36px"
    height: "40px"
  input-underline:
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "9px 0 10px"
  rail:
    backgroundColor: "{colors.onyx}"
    textColor: "{colors.ivory}"
    width: "256px"
  nav-item:
    textColor: "{colors.ivory}"
    rounded: "{rounded.hairline}"
    padding: "10px 12px"
  seat-taken:
    backgroundColor: "{colors.onyx}"
    textColor: "{colors.champagne}"
    rounded: "{rounded.pill}"
---

# Design System: Twofold

## Overview

**Creative North Star: "The Silk Desk"**

Twofold is a writing desk set out for two on an evening: black silk with two gold rings resting on it, and beige paper laid across the desk where the plan is written. The onyx rail carries the photograph of that silk at its foot; every page is paper; every list sits on a slightly lighter card with corners barely softened, like cut stock. The world is quiet luxury and black tie, but warm: champagne and bronze carry every moment of meaning, and nothing is either all black or all white.

The planner is calm and moderately dense. Pages open with a large Italiana title and one plain sentence of where things stand, then cards. Type does the hierarchy, not colour or weight: Italiana for names and titles, Jost for everything read, a few words in Cormorant italic for the human notes ("Together", "where you are", a guest's diet). Progress is thin bronze lines and rings, never badges or bright fills. The marketing site and sign-in pages are the same world seen from further away: black silk ground, the form or the planner preview on a beige card.

The brand's emblem is behaviour, not decoration: a finished thing closes into two linked rings. A task tick slides its second ring in; the wedding day in the date picker sits inside two rings; when every guest has a seat, two rings close on the Seating page; the sweetheart table is drawn as the couple's two rings.

**Key Characteristics:**
- Onyx rail with the black-silk-and-rings photograph; beige paper ground; lighter cards on 3px corners.
- Italiana display, Jost text, Cormorant Garamond italic for the few italic words.
- Champagne and bronze for state and meaning; onyx for the one primary action.
- Two linked rings as the signature for "done".
- Real photographic material (silk, metal, light); no vector scenery, no gradients pretending to be material on chrome.

## Colors

A warm onyx-and-paper palette with two metals: champagne for light on dark, bronze for meaning on paper.

### Primary
- **Onyx** (#0f0e0d): the rail, the mobile top bar and bottom tabs, the primary button, the selected segment and chip, a taken seat. The one solid dark on a paper page; its rarity on paper is what marks the action.
- **Onyx Lifted** (#2a2622): hover for onyx buttons.

### Secondary
- **Champagne** (#c9a86a): the brand metal. On onyx it is the accent text (the "&" between the couple's names, the active nav icon, a seat's initials, counts in a selected chip). On paper it is a fill or ring only: the "waiting" dot, the committed share of a meter, the outline of a table or card that can take the picked guest, the journey line under the top bar, the active-nav inset rule. Never body text on paper.
- **Champagne Lit** (#d8b97c): hover for the gold marketing button.
- **Bronze** (#7a5c28): meaning on paper. Links (always underlined, 4px offset), "who" names in italic, the second, closing ring, the plan-progress line, focus outlines inside planner controls, the auth form's caret, links and focus underline.

### Tertiary (state)
- **Coming Sage** (#7aa06a): guests who said yes, booked vendors; an 8px dot or a meter share, never a pill.
- **Can't-come Terracotta** (#b55a45): declined guests and vendors, over-budget meter share, a table over capacity's outline, a full guest count's left rule.
- **Alert Rust** (#a53d28): text that must be read as a problem: over capacity counts, a negative budget, form errors on the auth card, delete hovers.

### Neutral
- **Paper** (#ece3d1): the planner page ground.
- **Card** (#f6f0e4): cards, popovers, the modal sheet, the phone guest tray, quiet buttons, search fields.
- **Linen Card** (#e4d6bb): the sign-in card on black silk; also the unselected guest avatar on Seating.
- **Cream** (#f7f2e8): the marketing page's paper (inside the landing card, the guests section) and the body fallback.
- **Ivory** (#ede3cf): text on onyx; at 66% for idle nav, 72% for secondary lines on silk.
- **Ink** (#1c1a17): text on paper.
- **Ink 2** (rgb(28 26 23 / .64)): secondary text on paper: subtitles, meta, counts.
- **Line** (rgb(28 26 23 / .12)): every hairline divider and quiet border on paper.
- **Taupe** (#8c826f): secondary text on the marketing site.

**The Metal-on-Dark Rule.** Champagne is text only on onyx. On paper, words in the brand metal are bronze; champagne there is a ring, a dot, an outline or a fill.

**The One Onyx Rule.** A paper page carries one onyx action per region (Add, Book them, Print). Everything else is a quiet button or an underlined bronze link.

**The Dot-Not-Pill Rule.** Answers and statuses are a small coloured dot beside a plain word ("Coming", "Waiting", "Can't come"), not a filled badge.

## Typography

**Display Font:** Italiana (with Didot, Georgia)
**Body Font:** Jost (with Futura, Avenir Next, Helvetica Neue)
**Accent Font:** Cormorant Garamond italic (with Georgia)

**Character:** A high-contrast, hairline display face for names and titles against a geometric, light sans for everything read; the italic serif is the handwriting in the margin.

### Hierarchy
- **Display** (400, 40px on phone / 46px from 640px, line-height 1): the page title ("Seating", "Timeline", the greeting). Auth card titles run larger (clamp(40px, 11vw, 52px)); the landing headline clamp(42px, 11vw, 84px); the couple's names on sign-in clamp(52px, 5.4vw, 80px).
- **Headline** (400, 26px, line-height 1): card titles, table names on cards, timeline phase names. The rail's couple names are 27px.
- **Title** (400, 22–24px): a vendor's name in a card, a figure in a "Where you stand" row, a table name on the floor (19px).
- **Body** (Jost 400, 14.5–15.5px, ~1.5): list rows, sentences under titles. Auth and marketing run Jost 300 at 16–18px.
- **Body small** (Jost 400, 12.5–13.5px): meta lines, counts, legends, card-header counts, quiet buttons.
- **Accent** (Cormorant Garamond italic 400, 16px; 13–21px by context): who a task belongs to, phase hints, dietary notes, the date under the couple's names, the "&" between them at 0.7em.
- **Label** (Jost 500, 12px, letter-spacing 0.14em, uppercase): onyx primary buttons only. Auth uses 12.5px / 0.18em, marketing 12px / 0.2em.

**The Lining Figure Rule.** Digits never sit in Italiana: its old-style "1" reads as "ı". Inside an Italiana line, numbers switch to Jost light at 0.86em with tabular figures ("Table 4"); counts and money elsewhere are Jost with tabular figures.

**The Italic Is Cormorant Rule.** Italiana has no italic; any italic word is set in Cormorant Garamond, never a slanted Italiana.

**The No Bold Rule.** The planner's weights stop at 500. Hierarchy comes from Italiana size and ink-2, not from bold Jost.

## Layout

The planner is a 256px sticky onyx rail on laptops (from 1024px) and a page on paper to its right: a sticky top bar (paper at 90% with blur on laptop, onyx on phone) with a 2px champagne journey line along its foot, then content at max-width 72rem with 32px side padding (16px on phone). Seating breaks out to full width, because the floor needs the room.

Pages stack in 24px steps (title block, then cards); cards in a grid sit 20px apart; a two-column page splits roughly 1.35 : 1 (Overview) or a fixed 290px list beside a fluid area (Seating). Inside a card, headers pad 22px 24px 14px with a hairline below, rows pad 16px 24px and are divided by hairlines, never boxed. Card footers are a single hairline-topped line with one bronze link.

On a phone the rail becomes a drawer and a five-tab onyx bar at the foot; a champagne round button opens quick actions in a bottom sheet; on Overview the couple's names and countdown open the page on an onyx band, since the rail isn't there. Seating's guest tray takes the quick-action button's place. Every interactive target is at least 40px, most 44px.

Sign-in is a full-bleed black-silk photograph; on laptop the couple's names sit on the left half and the linen card (max 500px) on the right; on phone the rings show at the top and the card sits below them. The landing page is onyx with a card that opens like a folded invitation, then alternating onyx and cream sections at 8vw side padding.

## Elevation & Depth

Depth is paper on paper: cards sit a shade lighter than the ground, with a white top-edge highlight and a long, low, warm shadow that reads as a sheet lying on a desk, not floating. Overlays (popovers, the modal sheet, the phone tray) get a deeper, cooler shadow. On silk, the auth card carries a heavy, dark drop so it sits on the fabric.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 0 rgb(255 255 255 / .6) inset, 0 18px 40px -30px rgb(60 40 15 / .55)`): every planner card.
- **Popover** (`box-shadow: 0 18px 40px -16px rgb(0 0 0 / .45)` plus a 1px line ring): menus such as Seating's Add.
- **Sheet** (`box-shadow: 0 40px 80px -30px rgb(0 0 0 / .55)`): the modal.
- **Tray** (`box-shadow: 0 -12px 30px -18px rgb(0 0 0 / .45)`): the phone guest tray above the tabs.
- **On silk** (`box-shadow: 0 1px 0 rgb(255 255 255 / .45) inset, 0 40px 80px -30px rgb(0 0 0 / .8), 0 10px 24px -12px rgb(0 0 0 / .6)`): the sign-in card.
- **Table** (`box-shadow: 0 0 0 1px <skin ring>, 0 16px 26px -18px rgb(60 40 15 / .55), inset 0 1px 0 rgb(255 255 255 / .5)`): a table on the floor.

**The State Outline Rule.** A card or table never lifts to show state; it takes an outline: 2px champagne when it can take the picked guest, 1.5px terracotta when over capacity, a 3px inset left rule for a status banner.

## Shapes

Corners are barely there. Buttons, inputs, nav items and kbd keys are 2px; cards, popovers, menus and the modal on a laptop are 3px, like cut card stock. Long tables on the floor are 6px. Pills are reserved for things that are chosen or held: the Room/Tables/Board switch, filter chips, the guest chip in the phone tray, seats, avatars and icon buttons are full circles. A bottom sheet on a phone rounds its top to 10–14px.

The ring is the recurring form: two 18px circles in 1.4px strokes, the second sliding in to overlap the first by 8px when something is done; the same pair, larger, marks the wedding day, the sweetheart table and "everyone has a seat". Auth fields are a single underline, no box.

## Components

### Buttons
- **Primary (onyx):** onyx fill, ivory label in Jost 500 12px uppercase at 0.14em, 40px tall, 16px sides, 2px corners; hover to #2a2622. Icon at 15px, stroke 1.8 where present.
- **Quiet:** card fill, 1px line border, ink Jost 13.5px sentence case, 40px tall, 14px sides; hover darkens the border to 30% ink. For secondary actions (Print, See the board, Later).
- **Link:** bronze, underlined with a 4px offset, 13–13.5px. Used for every "go elsewhere" and Undo/Cancel.
- **Gold (marketing):** champagne fill, onyx label 12px / 0.2em uppercase, 16px 24px, 2px corners; hover #d8b97c. An outline variant is a 1px inset ivory or ink ring.
- **Auth send:** full-width onyx, 54px tall, 12.5px / 0.18em uppercase ivory.

### Chips and segments
- **View switch:** a card-filled pill track with a line ring and 4px inset; the active segment is an onyx pill with ivory text, others hover at 5% ink.
- **Filter chips:** 40px pills, card fill with a line border; active is onyx with its count in champagne.
- **Answer:** a dot (8px) plus the word, tappable to cycle.

### Cards / Containers
- **Corner Style:** 3px.
- **Background:** card (#f6f0e4) on paper (#ece3d1).
- **Shadow Strategy:** Paper (see Elevation).
- **Border:** none; internal divisions are hairlines in line colour.
- **Header:** Italiana 26px title with a Jost 13px ink-2 count aligned to its baseline, 22px 24px 14px, hairline below.
- **Rows:** 16px 24px, hairline between, hover at 2.5% ink.

### Inputs / Fields
- **Planner search:** 40–44px, 2px corners, 1px line border, card or transparent fill, a 15px search icon at 12px in; focus turns the border bronze.
- **Auth fields:** no box; a single 1px underline at 26% ink, Jost 300 18px; hover 42%; focus bronze underline doubled with a 1px shadow; invalid in rust. Labels Jost 13px ink at 70%.

### Navigation
- **Rail:** 256px onyx with the silk-and-rings photograph anchored at its foot under a top-to-bottom onyx fade. Items are 14.5px Jost, ivory at 66%, 10px 12px, 2px corners; hover ivory on a 5% wash; active ivory on an 8% wash with a 2px champagne inset rule on the left and a champagne icon. The couple's names close the rail in Italiana 27px with a champagne Cormorant "&".
- **Phone:** onyx top bar; five tabs on onyx at 11px with 20px icons, ivory at 55%, active ivory with a champagne icon.

### The Two Rings (signature)
A task's tick is one ring in 35% ink; done, the first turns champagne and a bronze ring slides in from the left over 0.45s on cubic-bezier(.16, 1, .3, 1). The same pair closes over 1.1s when every guest has a seat, circles the chosen day in the sign-in calendar, and draws the sweetheart table. With reduced motion the rings simply appear.

### Seating floor
The room is a card holding a warm radial paper (#fbf6ec to #f1e8d6) with a 22px bronze dot grid at 12%. Tables paint in four skins (linen, marble, oak, noir) as CSS gradients, named in Italiana with lining figures and counted in Jost 12px. Seats are 1-to-1 circles: empty is a 45% white disc in a 1.4px bronze ring with a bronze plus; taken is onyx with champagne initials; a plus-one adds a 2px champagne ring; a seat beyond capacity is oxblood (#7c2f22) with blush initials. A guest just seated scales in over 0.6s with a champagne halo; their list row warms for 1.2s. Room objects (dance floor, bar) are architect's hairline outlines with an italic name.

## Do's and Don'ts

### Do:
- **Do** set every page on paper (#ece3d1) with its content on cards (#f6f0e4) at 3px corners and the Paper shadow.
- **Do** open each page with an Italiana title (40/46px) and one plain Jost sentence of where things stand, in ink-2 with key figures in ink.
- **Do** switch digits inside Italiana to Jost light at 0.86em with tabular figures.
- **Do** use bronze for words of meaning on paper and keep champagne for text on onyx, dots, rings and outlines.
- **Do** show status as a dot and a plain word, and progress as a 3px line in bronze, champagne or sage.
- **Do** mark "done" with the two linked rings, and respect reduced motion by dropping the slide and settle.
- **Do** keep italic words in Cormorant Garamond.
- **Do** keep focus visible in bronze (2px or 1.5px, 2–3px offset) inside paper surfaces.

### Don't:
- **Don't** make the planner all black or all white; the owner rejected both. Onyx is the rail and the actions; the pages are paper.
- **Don't** use vector or illustrated scenery; material is photographic (the silk, the rings, light).
- **Don't** set champagne text on paper or ivory.
- **Don't** use filled status pills, bold Jost, or tracked uppercase labels above content; uppercase is for button labels only.
- **Don't** round cards beyond 3px or buttons beyond 2px; full pills are only for switches, chips, seats and avatars.
- **Don't** lift a card to show state; outline it.
- **Don't** put numbers in Italiana.
