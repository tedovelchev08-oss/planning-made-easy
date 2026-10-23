import { describe, it, expect } from "vitest";
import { starterTasks } from "./starterTasks";

/** A new plan opens with steps, dated back from the wedding, and this week filled in. */
const today = new Date(2026, 9, 23); // 23 October 2026

describe("starter tasks", () => {
  it("dates each step back from the wedding, and leaves past ones undated", () => {
    const tasks = starterTasks(new Date(2027, 6, 1, 12).toISOString(), today); // ~8 months out
    const venue = tasks.find((t) => t.title === "Book the venue")!;
    expect(venue.due).toBeUndefined(); // 300 days before is already gone
    const invites = tasks.find((t) => t.title === "Send invitations")!;
    expect(invites.due).toBe("2027-03-23"); // 100 days before 1 July
    expect(tasks.every((t) => !t.done && t.assignee === "B")).toBe(true);
  });

  it("this week holds the first three steps of the stage they're in, as begin-your-plan promised", () => {
    const nine = starterTasks(new Date(2027, 8, 18, 12).toISOString(), today); // 330 days: nine months out
    expect(nine.filter((t) => t.week).map((t) => t.title)).toEqual(["Book the venue", "Hire a photographer", "Book a caterer tasting"]);
    const far = starterTasks(new Date(2028, 5, 1, 12).toISOString(), today);
    expect(far.filter((t) => t.week).map((t) => t.title)).toEqual(["Agree on a budget ceiling", "Draft the first guest list", "Tour three venues"]);
    const soon = starterTasks(new Date(2026, 10, 20, 12).toISOString(), today);
    expect(soon.filter((t) => t.week).map((t) => t.title)).toEqual(["Chase remaining RSVPs", "The final fitting", "Write the vows"]);
  });

  it("every step has a phase from the timeline and a unique id", () => {
    const tasks = starterTasks(new Date(2027, 8, 18).toISOString(), today);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    expect(new Set(tasks.map((t) => t.phase))).toEqual(new Set(["p12", "p9", "p6", "p3", "p1", "fw", "wd"]));
  });
});
