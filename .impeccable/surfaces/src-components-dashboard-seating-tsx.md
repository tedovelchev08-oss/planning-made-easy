---
version: 1
slug: "src-components-dashboard-seating-tsx"
primary_target: "src/components/dashboard/Seating.tsx"
related_targets: ["src/components/dashboard/SeatingSheet.tsx"]
---

# Seating

Scope: the planner's Seating page (`src/components/dashboard/Seating.tsx`, print sheet `SeatingSheet.tsx`). Visitor mode: Operate, with the owner's ask that it be the most enjoyable, beautiful part of planning.

Audience and job: both partners, often on phones in the evening and sometimes together, seat their confirmed guests; avoid mistakes (full tables, unseated guests); hand the venue a chart; later show guests where they sit.

Constraints: the Silk desk planner world (planner.css tokens); keyboard and screen-reader paths kept (arrow-nudge, seat labels); touch-first on phones; no partner-presence data exists, so none is shown.

Open decisions: must-sit-together / keep-apart rules (no data yet); sharing the board with guests (later).

## Direction contract

THESIS: Seating is the room coming together, not a toolbox beside a canvas. It refuses the category default of a cramped floor with initials and an equal-weight button wall.

OWN-WORLD: Silk desk: onyx rail, beige paper (#ece3d1) with #f6f0e4 cards on 3px corners, Italiana table names, Jost names, Cormorant italic notes, bronze/champagne states, onyx seats with champagne initials; the couple's sweetheart table drawn as two linked rings.

STORY: The couple see who still needs a seat, pick a guest, tap a seat or a table, and watch the room fill until everyone has a place; then they print the board for the venue.

FIRST VIEWPORT: Laptop: title and counts, a Room · Tables · Board switch; a full-height "To place" list on the left; the floor fills the rest at the room's own proportion, no sideways scroll. Phone: Tables view, the guest tray as a bottom bar.

FORM: Room + table cards + board, from the ordered list (dealt 5, 3, 1; owner fused 1 with 2 and 3). seed:34908663fc4c1251

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
