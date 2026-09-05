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
 * past. Anchored at noon UTC so it renders as the 12th in every timezone;
 * midnight would display as the 11th anywhere west of Greenwich.
 */
const sampleDate = () => new Date(Date.UTC(new Date().getUTCFullYear() + 1, 5, 12, 12)).toISOString();

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
