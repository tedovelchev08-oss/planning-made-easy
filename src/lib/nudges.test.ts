import { describe, it, expect } from "vitest";
import { daysBetween, hideNudge, nudgesFor, visibleNudges, type NudgeState } from "./nudges";
import type { Db } from "./store";

/** Block 22: what the reminders say, worked out from the couple's own plan. */
const TODAY = "2027-01-10";

function plan(over: Partial<Db> = {}): Db {
  return {
    wedding: { names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris", date: "2027-06-12", venue: "", location: "", timezone: "UTC", locale: "en-GB", currency: "EUR", slug: "ana-boris" },
    guests: [{ id: "g1" }], tasks: [], vendors: [], rsvpLog: [],
    invitation: { live: true },
    ...over,
  } as unknown as Db;
}
const ids = (db: Db) => nudgesFor(db, TODAY).map((n) => n.id);

describe("daysBetween", () => {
  it("counts whole days between day keys", () => {
    expect(daysBetween("2027-01-10", "2027-01-13")).toBe(3);
    expect(daysBetween("2027-01-10", "2027-01-09")).toBe(-1);
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2); // across a clock change
  });
});

describe("nudgesFor", () => {
  it("a calm plan has nothing to say", () => {
    expect(nudgesFor(plan(), TODAY)).toEqual([]);
  });

  it("overdue tasks come first and are named; done tasks never count", () => {
    const db = plan({ tasks: [
      { id: "t1", title: "Book the florist", done: false, due: "2027-01-08", phase: "p", assignee: "both" },
      { id: "t2", title: "Order the cake", done: false, due: "2027-01-09", phase: "p", assignee: "both" },
      { id: "t3", title: "Already done", done: true, due: "2027-01-01", phase: "p", assignee: "both" },
    ] as unknown as Db["tasks"] });
    const [n] = nudgesFor(db, TODAY);
    expect(n).toMatchObject({ id: "tasks-overdue", tone: "urgent", title: "2 tasks are overdue" });
    expect(n.body).toBe('"Book the florist" and "Order the cake"');
    expect(n.action?.to).toBe("/planner/timeline");
  });

  it("tasks due in the next three days, today marked", () => {
    const db = plan({ tasks: [
      { id: "t1", title: "Call the venue", done: false, due: "2027-01-10", phase: "p", assignee: "both" },
      { id: "t2", title: "Later task", done: false, due: "2027-01-20", phase: "p", assignee: "both" },
    ] as unknown as Db["tasks"] });
    const n = nudgesFor(db, TODAY).find((x) => x.id === "tasks-soon")!;
    expect(n.title).toBe("A task is due soon");
    expect(n.body).toBe('"Call the venue" (today)');
  });

  it("vendor payments: overdue is urgent, due within a week is attention, paid or declined never", () => {
    const db = plan({ vendors: [
      { id: "v1", company: "The Glasshouse", status: "Booked", payments: [
        { label: "Deposit", amount: 3000, due: "2027-01-05", paid: false },
        { label: "Second", amount: 4000, due: "2027-01-15", paid: false },
        { label: "Final", amount: 5000, due: "2027-03-01", paid: false },
        { label: "Paid one", amount: 100, due: "2027-01-11", paid: true },
      ] },
      { id: "v2", company: "Declined Co", status: "Declined", payments: [{ label: "x", amount: 1, due: "2027-01-11", paid: false }] },
    ] as unknown as Db["vendors"] });
    const pays = nudgesFor(db, TODAY).filter((n) => n.id.startsWith("payment:"));
    expect(pays.map((p) => [p.tone, p.title])).toEqual([
      ["urgent", "Payment to The Glasshouse is overdue"],
      ["attention", "Payment to The Glasshouse is due in 5 days"],
    ]);
    expect(pays[0].body).toMatch(/^Deposit: .*3,000/);
  });

  it("guests' answers waiting to be added", () => {
    const db = plan({ rsvpLog: [
      { id: "r1", name: "Priya", answer: "yes", synced: false },
      { id: "r2", name: "Tom", answer: "no", synced: false },
      { id: "r3", name: "Old", answer: "yes", synced: true },
    ] as Db["rsvpLog"] });
    const n = nudgesFor(db, TODAY).find((x) => x.id === "rsvps-waiting")!;
    expect(n.title).toBe("2 new RSVP answers");
    expect(n.body).toBe("Priya and Tom replied. Add them to your guest list.");
  });

  it("milestones show on the day, with a few days' grace for the big ones, and are one-off", () => {
    const at = (days: number) => {
      const d = new Date(Date.parse(`${TODAY}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
      return nudgesFor(plan({ wedding: { ...plan().wedding, date: d } }), TODAY).find((n) => n.id.startsWith("milestone:"));
    };
    expect(at(100)).toMatchObject({ id: "milestone:100", once: true, title: "100 days to go" });
    expect(at(98)?.id).toBe("milestone:100");
    expect(at(95)).toBeUndefined();
    expect(at(0)?.title).toBe("Today is the day");
  });

  it("setup gaps: an empty guest list, and an invitation still closed close to the day", () => {
    const soon = "2027-04-01"; // 81 days away
    expect(ids(plan({ guests: [], wedding: { ...plan().wedding, date: soon } }))).toContain("no-guests");
    expect(ids(plan({ invitation: { live: false } as Db["invitation"], wedding: { ...plan().wedding, date: soon } }))).toContain("invitation-closed");
    expect(ids(plan({ invitation: { live: false } as Db["invitation"] }))).not.toContain("invitation-closed"); // 153 days away
  });
});

describe("hiding reminders", () => {
  const n = { id: "tasks-overdue", tone: "urgent" as const, title: "", body: "" };
  const m = { id: "milestone:100", tone: "celebrate" as const, title: "", body: "", once: true };
  const empty: NudgeState = { hidden: {} };

  it("an ordinary reminder hides for today and comes back tomorrow", () => {
    const s = hideNudge(empty, n, TODAY);
    expect(visibleNudges([n], s, TODAY)).toEqual([]);
    expect(visibleNudges([n], s, "2027-01-11")).toEqual([n]);
  });

  it("a milestone, once dismissed, stays dismissed", () => {
    const s = hideNudge(empty, m, TODAY);
    expect(visibleNudges([m], s, "2027-01-11")).toEqual([]);
  });
});
