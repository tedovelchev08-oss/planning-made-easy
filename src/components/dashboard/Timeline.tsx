import { useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { CalendarCheck, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { Assignee, PHASES, PhaseId, Task, fmtDate, fmtDateShort } from "../../lib/data";
import { useApp, useStats } from "../../lib/store";
import { playChime } from "../../lib/sound";

export default function Timeline() {
  const { db, setDb, toast } = useApp();
  const stats = useStats();
  // the stage you're in opens by itself; the rest wait folded
  const now: PhaseId = stats.days > 365 ? "p12" : stats.days > 270 ? "p9" : stats.days > 180 ? "p6" : stats.days > 90 ? "p3" : stats.days > 7 ? "p1" : stats.days > 0 ? "fw" : "wd";
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; assignee: Assignee }>>({});

  const byPhase = (p: PhaseId) => db.tasks.filter((t) => t.phase === p);

  const togglePhase = (p: PhaseId) => setOpen((o) => ({ ...o, [p]: !(o[p] ?? defaultOpen(p)) }));
  const defaultOpen = (p: PhaseId) => p === now;

  const toggleTask = (id: string) => {
    const was = db.tasks.find((x) => x.id === id);
    playChime(was && !was.done ? "done" : "undo");
    setDb((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t && !t.done) {
        const remaining = d.tasks.filter((x) => !x.done && x.id !== id).length;
        if (remaining === 0) setTimeout(() => toast("Every step is done", "Nothing left on the plan."), 60);
      }
      return { ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, done: !x.done } : x)) };
    });
  };

  const removeTask = (id: string) => {
    setDb((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) }));
    toast("Task removed", undefined, "info");
  };

  const addTask = (phase: PhaseId) => {
    const d = drafts[phase];
    if (!d?.title.trim()) return;
    setDb((prev) => ({
      ...prev,
      tasks: [...prev.tasks, { id: `t-${Date.now()}`, title: d.title.trim(), phase, done: false, assignee: d.assignee } as Task],
    }));
    setDrafts((prev) => ({ ...prev, [phase]: { title: "", assignee: "B" } }));
    toast("Step added");
  };

  const reorder = (phase: PhaseId, next: Task[]) => {
    setDb((d) => ({ ...d, tasks: [...d.tasks.filter((t) => t.phase !== phase), ...next] }));
  };

  const names = { A: db.wedding.partnerA, B: db.wedding.partnerB };
  const ENDS: Record<PhaseId, number> = { p12: 270, p9: 180, p6: 90, p3: 30, p1: 7, fw: 1, wd: 0 };
  const byWhen = (p: PhaseId) => {
    const d = new Date(db.wedding.date);
    d.setDate(d.getDate() - ENDS[p]);
    return p === "wd" ? `on ${fmtDate(d.toISOString(), { day: "numeric", month: "long" })}` : `by ${fmtDate(d.toISOString(), { day: "numeric", month: "short", year: "numeric" })}`;
  };
  const toggleWeek = (t: Task) => setDb((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, week: !x.week } : x)) }));
  const nextUp = db.tasks.filter((t) => !t.done && t.due).sort((a, b) => (a.due! < b.due! ? -1 : 1))[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Timeline</h1>
        <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
          {stats.tasksDone} of {stats.tasksTotal} done{nextUp && <> · next: <span className="text-[var(--pl-ink)]">{nextUp.title}</span>, by {fmtDateShort(nextUp.due!)}</>}
        </p>
        <div className="mt-4 flex h-[3px] max-w-md overflow-hidden rounded-full bg-[rgb(28_26_23/.1)]" aria-hidden="true">
          <motion.span initial={{ width: 0 }} animate={{ width: `${stats.progressPct}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="bg-[var(--pl-bronze)]" />
        </div>
      </header>

      {PHASES.map((phase) => {
        const tasks = byPhase(phase.id);
        const done = tasks.filter((t) => t.done).length;
        const openNow = open[phase.id] ?? defaultOpen(phase.id);
        const draft = drafts[phase.id] ?? { title: "", assignee: "B" as Assignee };
        return (
          <section key={phase.id} className="pl-card overflow-hidden" aria-label={`${phase.label} tasks`}>
            <button
              onClick={() => togglePhase(phase.id)}
              aria-expanded={openNow}
              className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-[rgb(28_26_23/.025)] cursor-pointer"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-[26px] leading-none">{phase.label}</span>
                  {phase.id === now && <span className="text-[13px] text-[var(--pl-bronze)]">where you are</span>}
                </span>
                <span className="mt-1 block font-accent text-[16px] italic text-[var(--pl-ink-2)]">{phase.hint}, {byWhen(phase.id)}</span>
              </span>
              <span className="hidden items-center gap-3 sm:flex">
                <span className="flex h-[3px] w-24 overflow-hidden rounded-full bg-[rgb(28_26_23/.1)]" aria-hidden="true">
                  <span className="bg-[var(--pl-bronze)]" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
                </span>
                <span className="w-14 text-right text-[13.5px] tabular-nums text-[var(--pl-ink-2)]">{done} of {tasks.length}</span>
              </span>
              <ChevronDown size={18} strokeWidth={1.6} className={`text-[var(--pl-ink-2)] transition-transform duration-300 ${openNow ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
              {openNow && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[var(--pl-line)]">
                    <Reorder.Group axis="y" values={tasks} onReorder={(next) => reorder(phase.id, next)}>
                      {tasks.map((t) => (
                        <Reorder.Item key={t.id} value={t} className="pl-row group flex items-center gap-3 bg-[var(--pl-card)] px-4 py-3 sm:px-5">
                          <span className="hidden cursor-grab text-[rgb(28_26_23/.25)] transition group-hover:text-[var(--pl-ink-2)] active:cursor-grabbing sm:block" aria-hidden="true"><GripVertical size={15} /></span>
                          <button onClick={() => toggleTask(t.id)} aria-pressed={t.done} aria-label={`Mark "${t.title}" ${t.done ? "incomplete" : "complete"}`} className="flex h-10 w-9 shrink-0 items-center justify-center cursor-pointer">
                            <span className={`pl-ring${t.done ? " is-done" : ""}`} aria-hidden="true" />
                          </button>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[15px] ${t.done ? "text-[var(--pl-ink-2)] line-through decoration-[rgb(28_26_23/.3)]" : ""}`}>{t.title}</span>
                                                          <span className="block text-[12.5px] text-[var(--pl-ink-2)]">
                                {t.due && `by ${fmtDateShort(t.due)}`}
                                <span className="sm:hidden">{t.due ? " · " : ""}{t.assignee === "A" ? names.A : t.assignee === "T" ? names.B : "Together"}</span>
                              </span>
                          </span>
                          <button
                            onClick={() => toggleWeek(t)} aria-pressed={!!t.week}
                            aria-label={t.week ? `Take "${t.title}" off this week` : `Put "${t.title}" on this week`}
                            className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] transition sm:px-3 cursor-pointer ${t.week ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : "text-[var(--pl-ink-2)] hover:bg-[rgb(28_26_23/.06)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"}`}
                          >
                            <CalendarCheck size={15} strokeWidth={1.6} className="sm:hidden" aria-hidden="true" />
                            <span className="hidden sm:inline">This week</span>
                          </button>
                          <span className="pl-who hidden w-20 text-right sm:block">{t.assignee === "A" ? names.A : t.assignee === "T" ? names.B : "Together"}</span>
                          <button onClick={() => removeTask(t.id)} aria-label={`Delete task ${t.title}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(181_90_69/.12)] hover:text-[#a53d28] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 cursor-pointer">
                            <Trash2 size={15} strokeWidth={1.6} />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>

                    {tasks.length === 0 && (
                      <p className="px-6 py-5 text-[14.5px] text-[var(--pl-ink-2)]">Nothing here yet. Add the first step below.</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pl-line)] px-4 py-3 sm:px-5">
                      <input
                        value={draft.title}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: { ...draft, title: e.target.value } }))}
                        onKeyDown={(e) => e.key === "Enter" && addTask(phase.id)}
                        placeholder="Add a step"
                        aria-label={`New task for ${phase.label}`}
                        className="h-10 min-w-[180px] flex-1 rounded-[2px] border border-[var(--pl-line)] bg-transparent px-3 text-[14.5px] outline-none placeholder:text-[rgb(28_26_23/.42)] focus-visible:border-[var(--pl-bronze)]"
                      />
                      <select
                        value={draft.assignee} aria-label="Who will do it"
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: { ...draft, assignee: e.target.value as Assignee } }))}
                        className="h-10 rounded-[2px] border border-[var(--pl-line)] bg-transparent px-2 text-[13.5px] cursor-pointer"
                      >
                        <option value="B">Together</option>
                        <option value="A">{names.A}</option>
                        <option value="T">{names.B}</option>
                      </select>
                      <button onClick={() => addTask(phase.id)} className="inline-flex h-10 items-center gap-1.5 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[13.5px] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer">
                        <Plus size={15} strokeWidth={1.8} /> Add
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        );
      })}

      <p className="text-[13px] text-[var(--pl-ink-2)]">Drag a step to reorder it within its stage. "This week" puts it on the Overview.</p>
    </div>
  );
}
