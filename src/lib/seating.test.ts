import { describe, it, expect } from "vitest";
import { seatingManifest } from "./seating";
import type { Guest, SeatTable } from "./data";

const guest = (name: string, over: Partial<Guest> = {}): Guest => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  party: "A",
  rsvp: "confirmed",
  meal: null,
  table: null,
  seat: null,
  plusOneOf: null,
  dietary: null,
  notes: "",
  ...over,
});

const table = (id: string, name: string, capacity = 8): SeatTable => ({
  id, name, shape: "round", capacity, x: 50, y: 50,
});

describe("seatingManifest — tables", () => {
  it("groups guests under their table", () => {
    const m = seatingManifest(
      [table("t1", "Table 1"), table("t2", "Table 2")],
      [
        guest("Maya", { table: "t1", seat: 0 }),
        guest("Theo", { table: "t1", seat: 1 }),
        guest("Priya", { table: "t2", seat: 0 }),
      ],
    );
    expect(m.tables[0].seated.map((s) => s.name)).toEqual(["Maya", "Theo"]);
    expect(m.tables[1].seated.map((s) => s.name)).toEqual(["Priya"]);
  });

  it("orders a table by seat number", () => {
    const m = seatingManifest(
      [table("t1", "Table 1")],
      [
        guest("Third", { table: "t1", seat: 2 }),
        guest("First", { table: "t1", seat: 0 }),
        guest("Second", { table: "t1", seat: 1 }),
      ],
    );
    expect(m.tables[0].seated.map((s) => s.name)).toEqual(["First", "Second", "Third"]);
  });

  it("reports free seats and flags a table over capacity", () => {
    const m = seatingManifest(
      [table("t1", "Small", 2)],
      [
        guest("A", { table: "t1", seat: 0 }),
        guest("B", { table: "t1", seat: 1 }),
        guest("C", { table: "t1", seat: 2 }),
      ],
    );
    expect(m.tables[0].over).toBe(true);
    expect(m.tables[0].free).toBe(-1);
    expect(m.totals.overCapacityTables).toBe(1);
  });

  it("keeps an empty table in the sheet", () => {
    // A venue setting the room still needs to know it exists.
    const m = seatingManifest([table("t1", "Table 1")], []);
    expect(m.tables).toHaveLength(1);
    expect(m.tables[0].seated).toHaveLength(0);
    expect(m.tables[0].free).toBe(8);
  });

  it("marks plus-ones", () => {
    const m = seatingManifest(
      [table("t1", "Table 1")],
      [guest("Host", { table: "t1", seat: 0 }), guest("Their guest", { table: "t1", seat: 1, plusOneOf: "host" })],
    );
    expect(m.tables[0].seated[1].isPlusOne).toBe(true);
    expect(m.tables[0].seated[0].isPlusOne).toBe(false);
  });
});

describe("seatingManifest — who still needs a seat", () => {
  it("separates unassigned guests", () => {
    const m = seatingManifest(
      [table("t1", "Table 1")],
      [guest("Seated", { table: "t1", seat: 0 }), guest("Floating")],
    );
    expect(m.unassigned.map((s) => s.name)).toEqual(["Floating"]);
    expect(m.totals.seated).toBe(1);
    expect(m.totals.unassigned).toBe(1);
  });

  it("counts only confirmed guests as needing chasing", () => {
    // Someone who declined does not need a seat, so counting them would
    // overstate the work left.
    const m = seatingManifest(
      [],
      [
        guest("Coming", { rsvp: "confirmed" }),
        guest("Maybe", { rsvp: "pending" }),
        guest("Not coming", { rsvp: "declined" }),
      ],
    );
    expect(m.totals.unassigned).toBe(3);
    expect(m.totals.unassignedConfirmed).toBe(1);
  });
});

describe("seatingManifest — the kitchen", () => {
  it("counts meals for confirmed guests only", () => {
    const m = seatingManifest(
      [],
      [
        guest("A", { meal: "Sea Bass" }),
        guest("B", { meal: "Sea Bass" }),
        guest("C", { meal: "Herb Chicken" }),
        guest("D", { meal: "Sea Bass", rsvp: "declined" }),
      ],
    );
    expect(m.meals.find((x) => x.label === "Sea Bass")?.count).toBe(2);
    expect(m.meals.find((x) => x.label === "Herb Chicken")?.count).toBe(1);
  });

  it("groups guests with no meal chosen and lists them last", () => {
    const m = seatingManifest(
      [],
      [guest("A", { meal: "Sea Bass" }), guest("B"), guest("C"), guest("D")],
    );
    expect(m.meals[m.meals.length - 1].label).toBe("No meal chosen");
    expect(m.meals[m.meals.length - 1].count).toBe(3);
  });

  it("attaches names to every dietary note rather than only counting them", () => {
    // A total of "3 vegan" is useless at the pass; the kitchen needs to know
    // which plate goes where.
    const m = seatingManifest(
      [],
      [
        guest("Zoe", { dietary: "Vegan" }),
        guest("Adam", { dietary: "Vegan" }),
        guest("Priya", { dietary: "Nut allergy" }),
      ],
    );
    expect(m.dietary[0].note).toBe("Vegan");
    expect(m.dietary[0].names).toEqual(["Adam", "Zoe"]); // sorted
    expect(m.dietary.find((d) => d.note === "Nut allergy")?.names).toEqual(["Priya"]);
  });

  it("ignores blank dietary notes", () => {
    const m = seatingManifest([], [guest("A", { dietary: "   " }), guest("B", { dietary: null })]);
    expect(m.dietary).toHaveLength(0);
  });
});

describe("seatingManifest — edge cases", () => {
  it("handles an empty workspace", () => {
    const m = seatingManifest([], []);
    expect(m.tables).toHaveLength(0);
    expect(m.unassigned).toHaveLength(0);
    expect(m.totals.seated).toBe(0);
    expect(m.meals).toHaveLength(0);
    expect(m.dietary).toHaveLength(0);
  });

  it("surfaces a guest pointing at a table that no longer exists", () => {
    // Deleting a table clears its guests, but a stale cache or a half-synced
    // edit could still carry one. Such a guest is seated nowhere, so they must
    // appear as needing a seat rather than vanishing off the sheet entirely.
    const m = seatingManifest([table("t1", "Table 1")], [guest("Orphan", { table: "gone" })]);
    expect(m.tables[0].seated).toHaveLength(0);
    expect(m.unassigned.map((s) => s.name)).toEqual(["Orphan"]);
    expect(m.totals.seated).toBe(0);
    expect(m.totals.unassignedConfirmed).toBe(1);
  });
});
