import type { Guest, SeatTable } from "./data";

/**
 * The seating chart as a caterer or venue actually needs it.
 *
 * A floor plan alone is not much use to a kitchen: what they ask for is who is
 * at which table, who is not seated yet, and how many of each meal — with the
 * dietary notes attached to names rather than buried in a column.
 *
 * Pure, so it can be tested without rendering anything.
 */

export interface ManifestSeat {
  seat: number | null;
  name: string;
  meal: string | null;
  dietary: string | null;
  isPlusOne: boolean;
}

export interface ManifestTable {
  id: string;
  name: string;
  capacity: number;
  seated: ManifestSeat[];
  /** Negative when the table is over capacity. */
  free: number;
  over: boolean;
}

export interface SeatingManifest {
  tables: ManifestTable[];
  unassigned: ManifestSeat[];
  totals: {
    tables: number;
    seated: number;
    unassigned: number;
    /** Confirmed guests with no table — the number that actually needs chasing. */
    unassignedConfirmed: number;
    overCapacityTables: number;
  };
  /** Meal name → count, for the kitchen. Guests with no meal chosen are grouped. */
  meals: { label: string; count: number }[];
  /** Every dietary note with the names attached, so nothing gets lost in a total. */
  dietary: { note: string; names: string[] }[];
}

const toSeat = (g: Guest): ManifestSeat => ({
  seat: g.seat,
  name: g.name,
  meal: g.meal,
  dietary: g.dietary,
  isPlusOne: !!g.plusOneOf,
});

/** Only confirmed guests are seated; the rest are still a question. */
const isSeatable = (g: Guest) => g.rsvp === "confirmed";

export function seatingManifest(tables: SeatTable[], guests: Guest[]): SeatingManifest {
  const byTable = new Map<string, Guest[]>();
  for (const g of guests) {
    if (!g.table) continue;
    const list = byTable.get(g.table);
    if (list) list.push(g);
    else byTable.set(g.table, [g]);
  }

  const manifestTables: ManifestTable[] = tables.map((t) => {
    const seated = (byTable.get(t.id) ?? [])
      .slice()
      // seat order where known, then alphabetically, so the sheet is scannable
      .sort((a, b) =>
        a.seat !== null && b.seat !== null ? a.seat - b.seat : a.name.localeCompare(b.name),
      )
      .map(toSeat);
    return {
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      seated,
      free: t.capacity - seated.length,
      over: seated.length > t.capacity,
    };
  });

  // Anyone with no table, OR pointing at a table that no longer exists. The
  // second case should not happen — deleting a table clears its guests — but a
  // stale cache or a half-synced edit can produce one, and a guest who is
  // seated nowhere must surface as needing a seat rather than silently
  // disappearing off the sheet.
  const known = new Set(tables.map((t) => t.id));
  const isSeated = (g: Guest) => !!g.table && known.has(g.table);
  const unassigned = guests.filter((g) => !isSeated(g)).map(toSeat);

  const mealCounts = new Map<string, number>();
  for (const g of guests) {
    if (!isSeatable(g)) continue;
    const key = g.meal?.trim() || "No meal chosen";
    mealCounts.set(key, (mealCounts.get(key) ?? 0) + 1);
  }

  const dietaryMap = new Map<string, string[]>();
  for (const g of guests) {
    const note = g.dietary?.trim();
    if (!note) continue;
    const list = dietaryMap.get(note);
    if (list) list.push(g.name);
    else dietaryMap.set(note, [g.name]);
  }

  return {
    tables: manifestTables,
    unassigned,
    totals: {
      tables: tables.length,
      seated: guests.filter(isSeated).length,
      unassigned: unassigned.length,
      unassignedConfirmed: guests.filter((g) => !isSeated(g) && isSeatable(g)).length,
      overCapacityTables: manifestTables.filter((t) => t.over).length,
    },
    meals: [...mealCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      // biggest first, but "No meal chosen" always last — it is a gap, not a dish
      .sort((a, b) =>
        a.label === "No meal chosen" ? 1 : b.label === "No meal chosen" ? -1 : b.count - a.count,
      ),
    dietary: [...dietaryMap.entries()]
      .map(([note, names]) => ({ note, names: names.slice().sort((a, b) => a.localeCompare(b)) }))
      .sort((a, b) => b.names.length - a.names.length),
  };
}
