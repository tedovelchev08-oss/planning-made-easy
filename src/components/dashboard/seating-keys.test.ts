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
