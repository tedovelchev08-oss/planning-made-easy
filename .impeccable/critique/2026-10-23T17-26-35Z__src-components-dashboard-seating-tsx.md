---
target: seating page
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:/Users/yoanaa77/Documents/planning-made-easy/src/components/dashboard/Seating.tsx"
target_fingerprint: "sha256:cd86e8a44b01d74b2b3412f8c68046a6d0ace4c38bf6cdc1799b97f971ae561c"
target_path: /Users/yoanaa77/Documents/planning-made-easy/src/components/dashboard/Seating.tsx
timestamp: 2026-10-23T17-26-35Z
slug: src-components-dashboard-seating-tsx
---
Method: dual-agent (A: design review · B: detector + browser)
Target: src/components/dashboard/Seating.tsx (+ SeatingSheet.tsx)
Score 18/40 (A). Detector CLI clean; live overlay 88 findings @1440 (77 undersized seat initials 9.28px, 43 low-contrast incl. gold initials 3.42:1, placeholder 2.3:1), focus rings gold ~2:1.
P0 over-capacity guests invisible (18 guests drawn nowhere); demo seed over capacity.
P1 broken basics: venue-object edit modal never opens (Seating.tsx:675 nested in settings Modal), freeSpot overlaps stage/tables, gear/legend cover seats, no undo on remove.
P1 touch: HTML5 draggable dead on touch; 1280px floor fixed canvas scrolls even at 1440; 28px seats.
P1 not Silk desk; not the emotional centrepiece; couple not seated on sweetheart table; no ending moment.
P2 guest tray squeezed (~1.5 names visible at 1440).
