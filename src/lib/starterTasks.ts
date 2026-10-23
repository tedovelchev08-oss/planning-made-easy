import type { PhaseId, Task } from "./data";

/**
 * The plan a new couple opens on. Each step sits in its phase with a due
 * date counted back from the wedding; steps whose date has already passed
 * keep no date (they're still worth doing, just not on a deadline). The
 * first three of the stage they're in get "this week", so the Overview
 * never opens empty.
 *
 * The first steps of each phase are the ones "begin your plan" names
 * (src/pages/Auth.tsx, FIRST_STEPS); keep the two in step.
 */
const STEPS: [phase: PhaseId, title: string, daysBefore: number][] = [
  ["p12", "Agree on a budget ceiling", 400],
  ["p12", "Draft the first guest list", 390],
  ["p12", "Tour three venues", 380],
  ["p12", "Start an inspiration board", 370],
  ["p9", "Book the venue", 300],
  ["p9", "Hire a photographer", 290],
  ["p9", "Book a caterer tasting", 280],
  ["p9", "Choose who will marry you", 270],
  ["p6", "Send save-the-dates", 200],
  ["p6", "Book a hair and makeup trial", 190],
  ["p6", "Arrange guest hotel blocks", 185],
  ["p6", "Choose what you'll wear", 180],
  ["p6", "Plan the honeymoon", 170],
  ["p3", "Send invitations", 100],
  ["p3", "Order wedding bands", 95],
  ["p3", "Choose ceremony music", 90],
  ["p3", "Final menu tasting", 80],
  ["p3", "Start the seating plan", 70],
  ["p1", "Chase remaining RSVPs", 30],
  ["p1", "The final fitting", 25],
  ["p1", "Write the vows", 20],
  ["p1", "Give the venue final numbers", 14],
  ["fw", "Confirm every vendor's arrival time", 7],
  ["fw", "Hand the day's schedule to someone you trust", 5],
  ["fw", "Pack for the day", 2],
  ["wd", "Give the rings to the person holding them", 0],
];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** the starter plan for a wedding on `weddingIso`, as of `today` */
export function starterTasks(weddingIso: string, today = new Date()): Task[] {
  const wedding = new Date(weddingIso);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const tasks: Task[] = STEPS.map(([phase, title, daysBefore], i) => {
    const due = new Date(wedding.getFullYear(), wedding.getMonth(), wedding.getDate() - daysBefore);
    return {
      id: `starter-${i}`,
      title,
      phase,
      done: false,
      assignee: "B",
      ...(due >= start ? { due: dayKey(due) } : {}),
    };
  });
  // this week: the first three steps of the stage they're in, the same
  // three "begin your plan" showed them
  const months = (wedding.getTime() - start.getTime()) / 864e5 / 30.4;
  const now: PhaseId = months >= 12 ? "p12" : months >= 9 ? "p9" : months >= 6 ? "p6" : months >= 3 ? "p3" : "p1";
  for (const t of tasks.filter((x) => x.phase === now).slice(0, 3)) t.week = true;
  return tasks;
}
