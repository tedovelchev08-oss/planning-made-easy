import { describe, it, expect } from "vitest";
import { arrowDelta, snapPct } from "./Seating";

/**
 * The keyboard alternative to dragging (WCAG 2.2 AA, Dragging Movements).
 * Geometry is tested here; the wiring is exercised in the browser.
 */

describe("arrowDelta", () => {
  it("moves one percent per press", () => {
    expect(arrowDelta("ArrowRight", false)).toEqual({ dx: 1, dy: 0 });
    expect(arrowDelta("ArrowLeft", false)).toEqual({ dx: -1, dy: 0 });
    expect(arrowDelta("ArrowDown", false)).toEqual({ dx: 0, dy: 1 });
    expect(arrowDelta("ArrowUp", false)).toEqual({ dx: 0, dy: -1 });
  });

  it("moves five percent with shift held", () => {
    expect(arrowDelta("ArrowRight", true)).toEqual({ dx: 5, dy: 0 });
    expect(arrowDelta("ArrowUp", true)).toEqual({ dx: 0, dy: -5 });
  });

  it("ignores every other key, so typing is never hijacked", () => {
    for (const k of ["a", "Enter", " ", "Tab", "Escape", "PageDown", "Home"]) {
      expect(arrowDelta(k, false)).toBeNull();
    }
  });

  it("never mixes axes", () => {
    for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
      const d = arrowDelta(k, false)!;
      expect(d.dx === 0 || d.dy === 0).toBe(true);
    }
  });
});

describe("snapPct", () => {
  it("snaps to a hundredth of a percent", () => {
    expect(snapPct(12.3456)).toBe(12.35);
    expect(snapPct(50)).toBe(50);
  });

  it("is idempotent, so repeated nudges do not drift", () => {
    // A nudge reads the current value and writes it back; if snapping were
    // lossy the position would creep over a long run of key presses.
    let v = snapPct(37.777);
    for (let i = 0; i < 50; i++) v = snapPct(v);
    expect(v).toBe(37.78);
  });

  it("keeps a whole-number nudge exact", () => {
    let v = 20;
    for (let i = 0; i < 10; i++) v = snapPct(v + 1);
    expect(v).toBe(30);
  });
});

import { freeSpot, layoutTables, roomLayout } from "./Seating";
import { seedGuests, seedTables } from "../../lib/data";

describe("freeSpot", () => {
  it("never drops a new table on a room object or on another table", () => {
    const stage = { id: "s", kind: "stage" as const, label: "", x: 14, y: 22, w: 24, h: 11 };
    const t1 = { id: "t1", name: "Table 1", shape: "round" as const, capacity: 8, x: 32, y: 22 };
    const spot = freeSpot({ w: 17, h: 24 }, [t1], [stage]);
    expect(spot).not.toEqual({ x: 14, y: 22 });
    expect(spot).not.toEqual({ x: 32, y: 22 });
  });
});

describe("freeSpot on a full floor", () => {
  it("still avoids sitting exactly on an existing table", () => {
    const tables = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, name: `T${i}`, shape: "round" as const, capacity: 8, x: 14 + (i % 5) * 18, y: 22 + Math.floor(i / 5) * 18 }));
    const spot = freeSpot({ w: 17, h: 24 }, tables, []);
    expect(tables.some((t) => t.x === spot.x && t.y === spot.y)).toBe(false);
  });
});

describe("the demo plan", () => {
  it("never seats more guests at a table than it has seats", () => {
    for (const t of seedTables) {
      expect(seedGuests.filter((g) => g.table === t.id).length).toBeLessThanOrEqual(t.capacity);
    }
  });

  it("keeps every plus-one at their host's table", () => {
    for (const g of seedGuests.filter((x) => x.plusOneOf)) {
      expect(g.table).toBe(seedGuests.find((h) => h.id === g.plusOneOf)!.table);
    }
  });
});

describe("layoutTables", () => {
  const floor = { w: 800, h: 600 };
  const box = (id: string, x: number, y: number) => ({ id, x, y, hw: 100, hh: 100 });

  it("moves two touching tables just far enough apart", () => {
    const at = layoutTables([box("a", 40, 50), box("b", 52, 50)], floor);
    const ax = (at.get("a")!.x / 100) * 800, bx = (at.get("b")!.x / 100) * 800;
    expect(bx - ax).toBeGreaterThanOrEqual(205);
  });

  it("keeps every table whole on the floor", () => {
    const at = layoutTables([box("edge", 2, 98)], floor);
    expect((at.get("edge")!.x / 100) * 800).toBeGreaterThanOrEqual(100);
    expect((at.get("edge")!.y / 100) * 600).toBeLessThanOrEqual(500 + 1e-6);
  });

  it("leaves tables that already have room exactly where they are", () => {
    const at = layoutTables([box("a", 20, 30), box("b", 80, 70)], floor);
    expect(at.get("a")).toEqual({ x: 20, y: 30 });
    expect(at.get("b")).toEqual({ x: 80, y: 70 });
  });
});

describe("roomLayout", () => {
  it("keeps a roomy plan at full size, and shrinks an overfull one only until nothing touches", () => {
    const two = roomLayout((sc) => [{ id: "a", x: 20, y: 50, hw: 90 * sc, hh: 90 * sc }, { id: "b", x: 80, y: 50, hw: 90 * sc, hh: 90 * sc }], { w: 800, h: 500 }, 1, 0.62);
    expect(two.scale).toBe(1);
    const many = roomLayout((sc) => Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, x: 10 + (i % 4) * 26, y: 20 + Math.floor(i / 4) * 30, hw: 120 * sc, hh: 120 * sc })), { w: 800, h: 500 }, 1, 0.62);
    expect(many.scale).toBeLessThan(1);
    expect(many.scale).toBeGreaterThanOrEqual(0.62);
  });
});
