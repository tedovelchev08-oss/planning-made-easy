import React from "react";
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AppProvider, useApp, useStats } from "./store";
import type { Db } from "./store";
import type { Guest } from "./data";

/**
 * These run in demo mode: no VITE_SUPABASE_* is set under vitest, so
 * bootMode() returns "demo", the provider seeds in memory and nothing
 * touches the network.
 */
const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

const guest = (name: string, over: Partial<Guest> = {}): Guest => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  party: "A",
  rsvp: "pending",
  meal: null,
  table: null,
  seat: null,
  plusOneOf: null,
  dietary: null,
  notes: "",
  ...over,
});

/** Render useStats alongside setDb so a controlled guest list can be installed. */
function renderStats() {
  return renderHook(() => ({ stats: useStats(), app: useApp() }), { wrapper });
}

const withGuests = (guests: Guest[]) => (d: Db): Db => ({ ...d, guests });

describe("useStats — guest counting", () => {
  it("counts every guest in total", () => {
    const { result } = renderStats();
    act(() => result.current.app.setDb(withGuests([guest("A"), guest("B"), guest("C")])));
    expect(result.current.stats.total).toBe(3);
  });

  it("splits RSVPs into confirmed, pending and declined", () => {
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb(
        withGuests([
          guest("A", { rsvp: "confirmed" }),
          guest("B", { rsvp: "confirmed" }),
          guest("C", { rsvp: "pending" }),
          guest("D", { rsvp: "declined" }),
        ]),
      ),
    );
    const s = result.current.stats;
    expect(s.confirmed).toBe(2);
    expect(s.pending).toBe(1);
    expect(s.declined).toBe(1);
    expect(s.confirmed + s.pending + s.declined).toBe(s.total);
  });

  it("reports zeroes for an empty guest list rather than NaN", () => {
    const { result } = renderStats();
    act(() => result.current.app.setDb(withGuests([])));
    const s = result.current.stats;
    expect(s.total).toBe(0);
    expect(s.confirmed).toBe(0);
    expect(s.hosts).toBe(0);
    expect(s.plusOnes).toBe(0);
    expect(Number.isNaN(s.progressPct)).toBe(false);
  });
});

describe("useStats — plus-one counting", () => {
  it("separates hosts from their plus-ones", () => {
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb(
        withGuests([
          guest("Maya Hartley"),
          guest("Theo Almeida"),
          guest("Guest of Maya", { plusOneOf: "maya-hartley" }),
        ]),
      ),
    );
    const s = result.current.stats;
    expect(s.total).toBe(3);
    expect(s.plusOnes).toBe(1);
    expect(s.hosts).toBe(2);
  });

  it("keeps hosts + plusOnes equal to total", () => {
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb(
        withGuests([
          guest("A"),
          guest("B", { plusOneOf: "a" }),
          guest("C"),
          guest("D", { plusOneOf: "c" }),
          guest("E"),
        ]),
      ),
    );
    const s = result.current.stats;
    expect(s.hosts + s.plusOnes).toBe(s.total);
    expect(s.plusOnes).toBe(2);
  });

  it("counts plus-ones as plates when they have confirmed", () => {
    // Documented in the source: "confirmed plates = confirmed guests,
    // plus-ones included (they eat too)".
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb(
        withGuests([
          guest("Host", { rsvp: "confirmed" }),
          guest("Their plus one", { plusOneOf: "host", rsvp: "confirmed" }),
          guest("Declined host", { rsvp: "declined" }),
        ]),
      ),
    );
    const s = result.current.stats;
    expect(s.confirmed).toBe(2);
    expect(s.confirmedPlates).toBe(2);
  });

  it("treats a guest with no host as a host, not a plus-one", () => {
    const { result } = renderStats();
    act(() => result.current.app.setDb(withGuests([guest("Solo", { plusOneOf: null })])));
    expect(result.current.stats.plusOnes).toBe(0);
    expect(result.current.stats.hosts).toBe(1);
  });
});

describe("useStats — seating", () => {
  it("counts only guests assigned to a table as seated", () => {
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb(
        withGuests([guest("A", { table: "t1" }), guest("B", { table: "t1" }), guest("C")]),
      ),
    );
    expect(result.current.stats.seated).toBe(2);
  });
});

describe("useStats — budget and progress", () => {
  it("keeps remaining equal to budget minus committed", () => {
    const { result } = renderStats();
    const s = result.current.stats;
    expect(s.remaining).toBe(s.totalBudget - s.committed);
  });

  it("never divides by zero when there are no tasks", () => {
    // The guard is Math.max(1, tasks.length) — without it the hero and the
    // planner would both render NaN%.
    const { result } = renderStats();
    act(() => result.current.app.setDb((d) => ({ ...d, tasks: [] })));
    const s = result.current.stats;
    expect(s.tasksTotal).toBe(0);
    expect(s.progressPct).toBe(0);
    expect(Number.isFinite(s.progressPct)).toBe(true);
  });

  it("reports progress as a whole percentage between 0 and 100", () => {
    const { result } = renderStats();
    const s = result.current.stats;
    expect(s.progressPct).toBeGreaterThanOrEqual(0);
    expect(s.progressPct).toBeLessThanOrEqual(100);
    expect(Number.isInteger(s.progressPct)).toBe(true);
  });

  it("never reports a negative countdown for a past wedding", () => {
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb((d) => ({
        ...d,
        wedding: { ...d.wedding, date: new Date(Date.now() - 30 * 86400000).toISOString() },
      })),
    );
    expect(result.current.stats.days).toBe(0);
  });
});

describe("AppProvider boot", () => {
  it("boots into demo mode when Supabase is not configured", () => {
    const { result } = renderStats();
    expect(result.current.app.mode).toBe("demo");
  });

  it("seeds a populated workspace in demo mode", () => {
    // The counterpart to the P1 fix: demo has data, real accounts start empty.
    const { result } = renderStats();
    expect(result.current.app.db.guests.length).toBeGreaterThan(0);
    expect(result.current.stats.total).toBeGreaterThan(0);
  });
});

describe("venue objects", () => {
  it("are seeded into the demo room", () => {
    const { result } = renderStats();
    expect(result.current.app.db.venueObjects.length).toBeGreaterThan(0);
    expect(result.current.app.db.venueObjects.map((o) => o.kind)).toContain("dance");
  });

  it("survive a workspace shape written before they existed", () => {
    // The upgrade path that matters: a cached Db from before this collection
    // was added deserialises without it. Diffing must not blow up on that.
    const { result } = renderStats();
    act(() =>
      result.current.app.setDb((d) => {
        const legacy = { ...d } as Partial<Db>;
        delete legacy.venueObjects;
        return legacy as Db;
      }),
    );
    expect(() =>
      act(() => result.current.app.setDb((d) => ({ ...d, guests: [guest("After the upgrade")] }))),
    ).not.toThrow();
  });

  it("carry a position and a footprint", () => {
    const { result } = renderStats();
    for (const o of result.current.app.db.venueObjects) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThanOrEqual(100);
      expect(o.w).toBeGreaterThan(0);
      expect(o.h).toBeGreaterThan(0);
    }
  });
});
