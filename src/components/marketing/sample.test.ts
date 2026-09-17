import { describe, it, expect } from "vitest";
import { SAMPLE_PLANNER } from "./sample";
import { toDayKey } from "../../lib/data";

/**
 * These constants exist so the homepage renders identically signed-out and
 * signed-in. The tests guard the two properties that made them necessary:
 * the budget bar must never divide by zero, and the sample date must never
 * read as a wedding in the past.
 */
describe("SAMPLE_PLANNER", () => {
  it("never yields NaN for the budget bar", () => {
    // The original bug: committed / totalBudget against an empty store put
    // `width: NaN%` on the hero progress bar.
    expect(Number.isFinite(SAMPLE_PLANNER.committedPct)).toBe(true);
    expect(SAMPLE_PLANNER.committedPct).toBeGreaterThan(0);
    expect(SAMPLE_PLANNER.committedPct).toBeLessThanOrEqual(100);
  });

  it("keeps remaining equal to budget minus committed", () => {
    expect(SAMPLE_PLANNER.remaining).toBe(SAMPLE_PLANNER.totalBudget - SAMPLE_PLANNER.committed);
  });

  it("reports progress as a whole percentage", () => {
    expect(Number.isInteger(SAMPLE_PLANNER.progressPct)).toBe(true);
    expect(SAMPLE_PLANNER.progressPct).toBeGreaterThanOrEqual(0);
    expect(SAMPLE_PLANNER.progressPct).toBeLessThanOrEqual(100);
  });

  it("cannot report more tasks done than exist", () => {
    expect(SAMPLE_PLANNER.tasksDone).toBeLessThanOrEqual(SAMPLE_PLANNER.tasksTotal);
  });

  it("cannot report more confirmed guests than invited", () => {
    expect(SAMPLE_PLANNER.confirmed).toBeLessThanOrEqual(SAMPLE_PLANNER.guests);
  });

  it("always advertises a wedding in the future", () => {
    expect(new Date(SAMPLE_PLANNER.date).getTime()).toBeGreaterThan(Date.now());
  });

  it("renders as the 12th of June in any timezone", () => {
    // Anchored at noon UTC precisely so it does not display as the 11th west
    // of Greenwich — the same class of bug as toDayKey.
    const key = toDayKey(SAMPLE_PLANNER.date);
    expect(key.slice(4)).toBe("-06-12");
  });
});
