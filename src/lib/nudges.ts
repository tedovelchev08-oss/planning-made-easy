import type { Db } from "./store";
import { fmtDate, fmtMoney, toDayKey } from "./data";

/**
 * Reminders (Block 22): what deserves the couple's attention today, worked
 * out from their own plan. Pure, so it's easy to test, and so the assistant
 * (Block 21) can later say the same things in its own voice.
 *
 * Every reminder has a stable id. Hiding one hides it for the rest of the
 * day (it comes back tomorrow if it still applies); a milestone, once
 * hidden, stays hidden.
 */
export type NudgeTone = "urgent" | "attention" | "celebrate" | "tip";

export interface Nudge {
  id: string;
  tone: NudgeTone;
  title: string;
  body: string;
  action?: { label: string; to: string };
  /** milestones are one-off: hiding them is for good */
  once?: boolean;
}

/** whole days from `from` to `to` (both "YYYY-MM-DD") */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

const MILESTONES: { days: number; title: string; body: string }[] = [
  { days: 180, title: "Six months to go", body: "A good time to book the photographer and send save-the-dates." },
  { days: 100, title: "100 days to go", body: "Time to send your invitations, if they haven't gone out yet." },
  { days: 60, title: "Two months to go", body: "Chase the missing RSVPs and give your caterer a first headcount." },
  { days: 30, title: "One month to go", body: "Settle the seating plan and the meal choices." },
  { days: 14, title: "Two weeks to go", body: "Confirm timings with every vendor." },
  { days: 7, title: "One week to go", body: "Print the seating chart and plan the last payments." },
  { days: 1, title: "Tomorrow is the day", body: "Everything that could be planned is planned. Enjoy it." },
  { days: 0, title: "Today is the day", body: "Congratulations to you both." },
];

const ORDER: Record<NudgeTone, number> = { urgent: 0, attention: 1, celebrate: 2, tip: 3 };

const list = (names: string[], max = 2) =>
  names.length <= max ? names.join(" and ") : `${names.slice(0, max).join(", ")} and ${names.length - max} more`;

export function nudgesFor(db: Db, today: string): Nudge[] {
  const out: Nudge[] = [];
  const toWedding = db.wedding.date ? daysBetween(today, toDayKey(db.wedding.date)) : null;

  // tasks: overdue, then due in the next 3 days
  const open = db.tasks.filter((t) => !t.done && t.due);
  const overdue = open.filter((t) => daysBetween(today, t.due!) < 0);
  const soon = open.filter((t) => { const d = daysBetween(today, t.due!); return d >= 0 && d <= 3; });
  if (overdue.length) {
    out.push({
      id: "tasks-overdue", tone: "urgent",
      title: overdue.length === 1 ? "A task is overdue" : `${overdue.length} tasks are overdue`,
      body: list(overdue.map((t) => `"${t.title}"`)),
      action: { label: "Open timeline", to: "/planner/timeline" },
    });
  }
  if (soon.length) {
    out.push({
      id: "tasks-soon", tone: "attention",
      title: soon.length === 1 ? "A task is due soon" : `${soon.length} tasks are due soon`,
      body: list(soon.map((t) => `"${t.title}"${daysBetween(today, t.due!) === 0 ? " (today)" : ""}`)),
      action: { label: "Open timeline", to: "/planner/timeline" },
    });
  }

  // vendor payments: overdue, or due within a week (each one named)
  for (const v of db.vendors) {
    if (v.status === "Declined") continue;
    v.payments.forEach((p, i) => {
      if (p.paid || !p.due) return;
      const d = daysBetween(today, p.due);
      if (d > 7) return;
      out.push({
        id: `payment:${v.id}:${i}:${p.due}`,
        tone: d < 0 ? "urgent" : "attention",
        title: d < 0 ? `Payment to ${v.company} is overdue` : `Payment to ${v.company} ${d === 0 ? "is due today" : `is due in ${d} day${d === 1 ? "" : "s"}`}`,
        body: `${p.label}: ${fmtMoney(p.amount)}, due ${fmtDate(p.due, { day: "numeric", month: "long" })}.`,
        action: { label: "Open vendors", to: "/planner/vendors" },
      });
    });
  }

  // guests' answers waiting to be added to the guest list
  const waiting = db.rsvpLog.filter((e) => !e.synced);
  if (waiting.length) {
    out.push({
      id: "rsvps-waiting", tone: "attention",
      title: waiting.length === 1 ? "A new RSVP answer" : `${waiting.length} new RSVP answers`,
      body: `${list(waiting.map((e) => e.name))} replied. Add ${waiting.length === 1 ? "it" : "them"} to your guest list.`,
      action: { label: "Review answers", to: "/planner/invitation?tab=replies" },
    });
  }

  if (toWedding !== null && toWedding >= 0) {
    // the milestone of the moment (a few days' grace for the big ones)
    const m = MILESTONES.find((x) => toWedding <= x.days && toWedding >= x.days - (x.days >= 30 ? 3 : 0));
    if (m) out.push({ id: `milestone:${m.days}`, tone: "celebrate", title: m.title, body: m.body, once: true });

    // setup gaps that matter as the day gets closer
    if (db.guests.length === 0 && toWedding <= 300) {
      out.push({
        id: "no-guests", tone: "tip", title: "Start your guest list",
        body: "Add the first names; RSVPs, seating and meal counts all build on it.",
        action: { label: "Add guests", to: "/planner/guests" },
      });
    }
    if (db.guests.length > 0 && !db.invitation.live && toWedding <= 120) {
      out.push({
        id: "invitation-closed", tone: "tip", title: "Your invitation isn't open yet",
        body: "Guests who open your link see \"not open yet\". Turn on Open to guests when you're ready.",
        action: { label: "Open invitation", to: "/planner/invitation" },
      });
    }
  }

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}

/* ------------------------------ what's been hidden ------------------------------ */

export interface NudgeState {
  /** id → the day it was hidden on, or "always" for one-off reminders */
  hidden: Record<string, string>;
  /** the day the pop-up was last shown */
  popupDay?: string;
}

export const nudgeKey = (weddingId: string | null) => `luma.reminders.${weddingId ?? "demo"}`;

export function loadNudgeState(weddingId: string | null): NudgeState {
  try {
    const s = JSON.parse(localStorage.getItem(nudgeKey(weddingId)) ?? "null") as NudgeState | null;
    return s && typeof s.hidden === "object" ? s : { hidden: {} };
  } catch {
    return { hidden: {} };
  }
}

export function saveNudgeState(weddingId: string | null, s: NudgeState): void {
  try { localStorage.setItem(nudgeKey(weddingId), JSON.stringify(s)); } catch { /* private mode: forgotten on reload */ }
}

export const visibleNudges = (all: Nudge[], s: NudgeState, today: string) =>
  all.filter((n) => s.hidden[n.id] !== "always" && s.hidden[n.id] !== today);

/** hide for today, or for good if it's a one-off */
export const hideNudge = (s: NudgeState, n: Nudge, today: string): NudgeState =>
  ({ ...s, hidden: { ...s.hidden, [n.id]: n.once ? "always" : today } });
