/**
 * Static sample figures for the marketing page.
 *
 * The homepage must render identically signed-out and signed-in, so nothing
 * here may read from the store. A signed-out visitor gets placeholderDb(),
 * which would otherwise advertise "0 guests · $0 left · 0% progress" — and
 * divide by a zero budget.
 *
 * These are illustrative numbers for a fictional couple, not product claims.
 */

/**
 * June 12 of next year — always 4-16 months out, so the sample never reads as
 * past.
 *
 * Built at noon LOCAL time, not UTC. The date is only ever rendered in the
 * viewer's own timezone, so anchoring it locally makes it read as the 12th
 * everywhere. Noon UTC only survives about +/-11 hours of offset: a test run
 * under Pacific/Kiritimati (UTC+14) displayed the 13th.
 */
const sampleDate = () => new Date(new Date().getFullYear() + 1, 5, 12, 12, 0, 0).toISOString();

export const SAMPLE_PLANNER = {
  date: sampleDate(),
  guests: 142,
  confirmed: 118,
  totalBudget: 42000,
  committed: 27300,
  get remaining() {
    return this.totalBudget - this.committed;
  },
  /** Share of budget committed, guarded so an edited constant can never yield NaN%. */
  get committedPct() {
    return this.totalBudget > 0 ? Math.round((this.committed / this.totalBudget) * 100) : 0;
  },
  tasksDone: 34,
  tasksTotal: 48,
  get progressPct() {
    return Math.round((this.tasksDone / Math.max(1, this.tasksTotal)) * 100);
  },
} as const;
