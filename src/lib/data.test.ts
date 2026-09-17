import { describe, it, expect } from "vitest";
import {
  toDayKey,
  nameSimilarity,
  bestGuestMatch,
  catCommitted,
  catPaid,
  paidSum,
  initials,
  slugify,
  daysUntil,
  TIERS,
} from "./data";
import type { Guest, BudgetCategory, Vendor } from "./data";

/* ------------------------------------------------------------------ *
 * toDayKey — the regression the handoff asks to lock down before any
 * date handling is touched again.
 *
 * The wedding date is stored as a full ISO timestamp while calendar
 * cells key on "YYYY-MM-DD". That mismatch hid the wedding-day heart
 * and three seeded tasks. Every case below is about the two formats
 * agreeing.
 * ------------------------------------------------------------------ */

describe("toDayKey", () => {
  it("passes a bare day key through untouched", () => {
    // The load-bearing case. Parsing "2027-06-12" as a Date reads it as UTC
    // midnight, which is the previous day anywhere west of Greenwich — so the
    // early return is what stops the key drifting.
    expect(toDayKey("2027-06-12")).toBe("2027-06-12");
    expect(toDayKey("2027-01-01")).toBe("2027-01-01");
    expect(toDayKey("2027-12-31")).toBe("2027-12-31");
  });

  it("reduces a full ISO timestamp to the local day", () => {
    // Built in local time so the assertion holds in any timezone the suite runs in.
    const local = new Date(2027, 5, 12, 14, 30, 0);
    expect(toDayKey(local.toISOString())).toBe("2027-06-12");
  });

  it("agrees between a wedding timestamp and its calendar cell key", () => {
    // This is the bug itself: the wedding record holds a timestamp, the
    // calendar builds cells from y/m/d. They must produce the same key or the
    // wedding day renders as an ordinary day.
    const wedding = new Date(2027, 5, 12, 16, 0, 0).toISOString();
    const cell = `2027-06-${String(12).padStart(2, "0")}`;
    expect(toDayKey(wedding)).toBe(toDayKey(cell));
  });

  it("pads single-digit months and days", () => {
    expect(toDayKey(new Date(2027, 0, 5, 9, 0, 0).toISOString())).toBe("2027-01-05");
  });

  it("does not shift the day for a late-evening local timestamp", () => {
    // 23:30 local is already "tomorrow" in UTC for negative offsets. The key
    // must follow the local calendar, not UTC.
    const lateLocal = new Date(2027, 5, 12, 23, 30, 0);
    expect(toDayKey(lateLocal.toISOString())).toBe("2027-06-12");
  });

  it("does not shift the day for an early-morning local timestamp", () => {
    // 00:30 local is still "yesterday" in UTC for positive offsets.
    const earlyLocal = new Date(2027, 5, 12, 0, 30, 0);
    expect(toDayKey(earlyLocal.toISOString())).toBe("2027-06-12");
  });

  it("returns unparseable input untouched rather than throwing", () => {
    expect(toDayKey("not a date")).toBe("not a date");
    expect(toDayKey("")).toBe("");
  });

  it("is idempotent", () => {
    const once = toDayKey(new Date(2027, 5, 12, 8, 0, 0).toISOString());
    expect(toDayKey(once)).toBe(once);
  });
});

/* ------------------------------------------------------------------ *
 * nameSimilarity — the buckets are documented on the function, so the
 * tests assert those thresholds rather than exact scores.
 * ------------------------------------------------------------------ */

describe("nameSimilarity", () => {
  it("scores an exact match as 1", () => {
    expect(nameSimilarity("Maya Hartley", "Maya Hartley")).toBe(1);
  });

  it("ignores case, accents and extra spacing", () => {
    expect(nameSimilarity("maya  hartley", "Maya Hartley")).toBe(1);
    expect(nameSimilarity("Zoë Hartley", "Zoe Hartley")).toBe(1);
  });

  it("does not auto-match across a differing apostrophe", () => {
    // normaliseName turns "O'Brien" into two tokens ("o brien") but leaves
    // "OBrien" as one, so the token counts differ and coverage is penalised.
    // Lands in manual-confirm rather than merging silently, which is the safe
    // direction, but it is behaviour worth knowing about.
    const s = nameSimilarity("Zoë O'Brien", "Zoe OBrien");
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(s).toBeLessThan(0.88);
  });

  it("aligns tokens regardless of order, but still weights the final token", () => {
    // The docstring says "token order independent". That holds for the greedy
    // alignment, but the surname weight reads the LAST token positionally, so
    // a swapped name is not scored as identical. Documented here as actual
    // behaviour: surname-first input needs a manual confirm.
    const swapped = nameSimilarity("Hartley Maya", "Maya Hartley");
    expect(swapped).toBeLessThan(1);
    expect(swapped).toBeGreaterThanOrEqual(0.6);
  });

  it("auto-matches a clear typo at >= 0.88", () => {
    expect(nameSimilarity("Maya Hartly", "Maya Hartley")).toBeGreaterThanOrEqual(0.88);
  });

  it("keeps a shared surname with a different first name out of auto-match", () => {
    // Stated explicitly in the source: "Jon Weiss" vs "Jonah Weiss" should land
    // in manual-confirm range and never merge silently.
    const s = nameSimilarity("Jon Weiss", "Jonah Weiss");
    expect(s).toBeGreaterThanOrEqual(0.6);
    expect(s).toBeLessThan(0.88);
  });

  it("penalises partial coverage so a family label is not a person", () => {
    expect(nameSimilarity("The Hartley Family", "Hartley")).toBeLessThan(0.88);
  });

  it("treats unrelated names as new guests", () => {
    expect(nameSimilarity("Priya Desai", "Erik Lindqvist")).toBeLessThan(0.6);
  });

  it("returns 0 when either side is empty after normalising", () => {
    expect(nameSimilarity("", "Maya Hartley")).toBe(0);
    expect(nameSimilarity("!!!", "Maya Hartley")).toBe(0);
  });

  it("never exceeds 1", () => {
    for (const [a, b] of [
      ["Maya Hartley", "Maya Hartley"],
      ["Maya", "Maya"],
      ["A B C D", "A B C D"],
    ]) {
      expect(nameSimilarity(a, b)).toBeLessThanOrEqual(1);
    }
  });
});

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

describe("bestGuestMatch", () => {
  const guests = [guest("Maya Hartley"), guest("Theo Almeida"), guest("Priya Desai")];

  it("finds the intended guest despite a typo", () => {
    expect(bestGuestMatch("Maya Hartly", guests)?.guest.name).toBe("Maya Hartley");
  });

  it("returns null when nothing clears the floor", () => {
    expect(bestGuestMatch("Someone Entirely Else", guests)).toBeNull();
  });

  it("returns null for an empty guest list", () => {
    expect(bestGuestMatch("Maya Hartley", [])).toBeNull();
  });

  it("respects a caller-supplied floor", () => {
    expect(bestGuestMatch("Maya Hartley", guests, 1)?.guest.name).toBe("Maya Hartley");
  });
});

/* ------------------------------------------------------------------ *
 * budget maths — what useStats() aggregates over
 * ------------------------------------------------------------------ */

const payment = (amount: number, paid: boolean) => ({ label: "Deposit", amount, due: "2027-06-01", paid });

const vendor = (over: Partial<Vendor> = {}): Vendor =>
  ({
    id: "v1",
    category: "Venue",
    company: "The Old Orangery",
    contact: "",
    email: "",
    phone: "",
    price: 1000,
    status: "Booked",
    budgetId: "c1",
    payments: [],
    notes: "",
    ...over,
  }) as Vendor;

const category = (over: Partial<BudgetCategory> = {}): BudgetCategory => ({
  id: "c1",
  name: "Venue",
  budget: 5000,
  manualCommitted: 0,
  manualPaid: 0,
  color: "blush",
  ...over,
});

describe("budget aggregation", () => {
  it("counts a booked vendor's price as committed", () => {
    expect(catCommitted(category(), [vendor({ price: 1200 })])).toBe(1200);
  });

  it("ignores a vendor that is not yet booked", () => {
    // Only "Booked" commits money — an inquiry or proposal must not.
    expect(catCommitted(category(), [vendor({ price: 1200, status: "Proposal" })])).toBe(0);
    expect(catCommitted(category(), [vendor({ price: 1200, status: "Inquiry" })])).toBe(0);
    expect(catCommitted(category(), [vendor({ price: 1200, status: "Declined" })])).toBe(0);
  });

  it("adds commitments that are not tied to a tracked vendor", () => {
    expect(catCommitted(category({ manualCommitted: 500 }), [vendor({ price: 1200 })])).toBe(1700);
  });

  it("counts only payments actually marked paid", () => {
    const v = vendor({ payments: [payment(300, true), payment(200, false)] });
    expect(paidSum(v)).toBe(300);
  });

  it("treats a vendor with no payments as nothing paid", () => {
    expect(paidSum(vendor({ payments: [] }))).toBe(0);
  });

  it("rolls vendor payments and manual paid into the category", () => {
    const v = vendor({ payments: [payment(300, true), payment(250, true)] });
    expect(catPaid(category({ manualPaid: 100 }), [v])).toBe(650);
  });

  it("ignores vendors belonging to another budget category", () => {
    const other = vendor({ budgetId: "c2", price: 999, payments: [payment(999, true)] });
    expect(catCommitted(category(), [other])).toBe(0);
    expect(catPaid(category(), [other])).toBe(0);
  });

  it("never reports paid above committed for a single booked vendor", () => {
    const v = vendor({ price: 1000, payments: [payment(400, true)] });
    expect(catPaid(category(), [v])).toBeLessThanOrEqual(catCommitted(category(), [v]));
  });
});

/* ------------------------------------------------------------------ *
 * entitlement ordering — the gate in ui.tsx is rankOf(tier) <= rankOf(plan),
 * which is only correct while TIERS stays in ascending order.
 * ------------------------------------------------------------------ */

describe("plan tiers", () => {
  it("are ordered cheapest to dearest", () => {
    expect(TIERS.map((t) => t.id)).toEqual(["essential", "celebration", "luxe"]);
    const prices = TIERS.map((t) => t.price);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("gate an upgrade correctly by index", () => {
    const rank = (p: string) => TIERS.findIndex((t) => t.id === p);
    // owning celebration means luxe is still buyable, essential is not
    expect(rank("luxe") > rank("celebration")).toBe(true);
    expect(rank("essential") <= rank("celebration")).toBe(true);
  });

  it("expose exactly one featured tier", () => {
    expect(TIERS.filter((t) => t.featured)).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------ *
 * small helpers used across the planner and the invite page
 * ------------------------------------------------------------------ */

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Maya Hartley")).toBe("MH");
    // first two WORDS, not first + last — a middle name wins the second slot
    expect(initials("Maya Anne Hartley")).toBe("MA");
  });

  it("handles a single name", () => {
    expect(initials("Maya")).toBe("M");
  });

  it("ignores extra whitespace", () => {
    expect(initials("  Maya   Hartley  ")).toBe("MH");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    // "&" is spelled out rather than dropped, so the slug stays readable
    expect(slugify("Maya & Theo")).toBe("maya-and-theo");
  });

  it("produces a URL-safe string", () => {
    expect(slugify("Zoë O'Brien!")).toMatch(/^[a-z0-9-]*$/);
  });
});

describe("daysUntil", () => {
  it("never returns a negative number for a past date", () => {
    expect(daysUntil(new Date(Date.now() - 10 * 86400000).toISOString())).toBe(0);
  });

  it("counts forward for a future date", () => {
    const d = daysUntil(new Date(Date.now() + 10 * 86400000).toISOString());
    expect(d).toBeGreaterThanOrEqual(9);
    expect(d).toBeLessThanOrEqual(10);
  });
});
