import { useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { CalendarDays, ChevronDown, GripVertical, Plus, Trash2 } from "lucide-react";
import { Assignee, PHASES, PhaseId, Task, fmtDateShort } from "../../lib/data";
import { useApp, useStats } from "../../lib/store";
import { playChime } from "../../lib/sound";
import { Reveal } from "../ui";

const chip = (a: Assignee, names: { A: string; B: string }) =>
  a === "A"
    ? { label: names.A, cls: "bg-blush-soft text-blush-deep" }
    : a === "T"
    ? { label: names.B, cls: "bg-sage-soft text-sage-deep" }
    : { label: "Both", cls: "bg-lav-soft text-lav-deep" };

export default function Timeline() {
  const { db, setDb, toast } = useApp();
  const stats = useStats();
  const [open, setOpen] = useState<Record<string, boolean>>({ p1: true, fw: true, wd: true });
  const [drafts, setDrafts] = useState<Record<string, { title: string; assignee: Assignee }>>({});

  const byPhase = (p: PhaseId) => db.tasks.filter((t) => t.phase === p);

  const togglePhase = (p: PhaseId) => setOpen((o) => ({ ...o, [p]: !(o[p] ?? defaultOpen(p)) }));
  const defaultOpen = (p: PhaseId) => ["p1", "fw", "wd"].includes(p);

  const toggleTask = (id: string) => {
    const was = db.tasks.find((x) => x.id === id);
    playChime(was && !was.done ? "done" : "undo");
    setDb((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t && !t.done) {
        const remaining = d.tasks.filter((x) => !x.done && x.id !== id).length;
        if (remaining === 0) setTimeout(() => toast("The whole plan, done", "Nothing left but the dress rehearsal. Unbelievable."), 60);
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
    toast("Task added", "Slotted into the rhythm.");
  };

  const reorder = (phase: PhaseId, next: Task[]) => {
    setDb((d) => ({ ...d, tasks: [...d.tasks.filter((t) => t.phase !== phase), ...next] }));
  };

  const names = { A: db.wedding.partnerA, B: db.wedding.partnerB };

  return (
    <div className="space-y-6">
      {/* progress header */}
      <Reveal>
        <section className="flex flex-wrap items-center gap-6 rounded-[1.8rem] border border-white/70 bg-white/60 p-7 backdrop-blur-md">
          <div>
            <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">The rhythm</p>
            <h2 className="mt-1 font-display text-2xl text-ink">{stats.tasksDone} of {stats.tasksTotal} arranged</h2>
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="h-2.5 overflow-hidden rounded-full bg-ink/8">
              <motion.div initial={{ width: 0 }} animate={{ width: `${stats.progressPct}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-gradient-to-r from-sage via-gold to-blush-deep" />
            </div>
          </div>
          <span className="font-display text-3xl text-ink">{stats.progressPct}<span className="text-lg text-ink-mute">%</span></span>
        </section>
      </Reveal>

      {PHASES.map((phase, pi) => {
        const tasks = byPhase(phase.id);
        const done = tasks.filter((t) => t.done).length;
        const openNow = open[phase.id] ?? defaultOpen(phase.id);
        const draft = drafts[phase.id] ?? { title: "", assignee: "B" as Assignee };
        return (
          <Reveal key={phase.id} delay={pi * 0.05}>
            <section className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/60 backdrop-blur-md" aria-label={`${phase.label} tasks`}>
              <button
                onClick={() => togglePhase(phase.id)}
                aria-expanded={openNow}
                className="flex w-full items-center gap-4 px-6 py-5 text-left transition hover:bg-white/60 cursor-pointer"
              >
                <span className="font-display text-[1.35rem] text-blush-deep">{String(pi + 1).padStart(2, "0")}</span>
                <span className="flex-1">
                  <span className="block font-display text-xl text-ink">{phase.label}</span>
                  <span className="text-[0.76rem] font-semibold text-ink-mute">{phase.hint}</span>
                </span>
                <span className="hidden items-center gap-2 sm:flex">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-ink/8">
                    <span className="block h-full rounded-full bg-sage-deep transition-all duration-700" style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%` }} />
                  </span>
                  <span className="text-[0.72rem] font-extrabold text-ink-2">{done}/{tasks.length}</span>
                </span>
                <ChevronDown size={18} className={`text-ink-mute transition-transform duration-300 ${openNow ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence initial={false}>
                {openNow && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-ink/8 px-5 py-4 sm:px-6">
                      <Reorder.Group axis="y" values={tasks} onReorder={(next) => reorder(phase.id, next)} className="space-y-2">
                        {tasks.map((t) => {
                          const c = chip(t.assignee, names);
                          return (
                            <Reorder.Item
                              key={t.id} value={t}
                              className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors duration-300 ${t.done ? "border-sage/40 bg-sage-soft/50" : "border-ink/8 bg-white/75 hover:border-gold/50"}`}
                            >
                              <span className="cursor-grab text-ink-mute/50 transition group-hover:text-ink-mute active:cursor-grabbing" aria-hidden="true"><GripVertical size={15} /></span>
                              <button onClick={() => toggleTask(t.id)} aria-pressed={t.done} aria-label={`Mark "${t.title}" ${t.done ? "incomplete" : "complete"}`} className="cursor-pointer">
                                <span className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-all duration-300 ${t.done ? "border-sage-deep bg-sage-deep" : "border-ink/25 bg-white hover:border-gold"}`}>
                                  {t.done && (
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#FFF8F0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M4.5 12.5l5 5 10-11" className="check-draw" />
                                    </svg>
                                  )}
                                </span>
                              </button>
                              <span className={`flex-1 text-[0.92rem] font-bold transition ${t.done ? "text-ink-mute line-through decoration-sage-deep/50" : "text-ink"}`}>{t.title}</span>
                              {t.week && <span className="hidden rounded-full bg-gold-soft px-2 py-0.5 text-[0.6rem] font-extrabold text-gold-deep sm:block">THIS WEEK</span>}
                              {t.due && (
                                <span className="hidden items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-[0.6rem] font-extrabold text-ink-mute md:flex" title={`Due ${t.due}`}>
                                  <CalendarDays size={9} /> {fmtDateShort(t.due)}
                                </span>
                              )}
                              <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-extrabold ${c.cls}`}>{c.label}</span>
                              <button onClick={() => removeTask(t.id)} aria-label={`Delete task ${t.title}`} className="rounded-full p-1.5 text-ink-mute opacity-0 transition hover:bg-blush-soft hover:text-blush-deep group-hover:opacity-100 focus:opacity-100 cursor-pointer">
                                <Trash2 size={13} />
                              </button>
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>

                      {tasks.length === 0 && (
                        <p className="rounded-2xl border border-dashed border-ink/15 px-5 py-6 text-center text-[0.85rem] font-semibold text-ink-mute">
                          Nothing here yet — add the first task below and give this chapter a heartbeat.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={draft.title}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: { ...draft, title: e.target.value } }))}
                          onKeyDown={(e) => e.key === "Enter" && addTask(phase.id)}
                          placeholder={`Add a ${phase.label.toLowerCase()} task…`}
                          aria-label={`New task for ${phase.label}`}
                          className="min-w-[200px] flex-1 rounded-xl border border-ink/12 bg-white/80 px-4 py-2.5 text-[0.88rem] placeholder:text-ink-mute/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
                        />
                        <select
                          value={draft.assignee} aria-label="Assignee"
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [phase.id]: { ...draft, assignee: e.target.value as Assignee } }))}
                          className="rounded-xl border border-ink/12 bg-white/80 px-3 py-2.5 text-[0.82rem] font-bold text-ink-2 focus:outline-none cursor-pointer"
                        >
                          <option value="B">Both</option>
                          <option value="A">{names.A}</option>
                          <option value="T">{names.B}</option>
                        </select>
                        <button onClick={() => addTask(phase.id)} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[0.82rem] font-bold text-cream transition hover:bg-ink/85 cursor-pointer">
                          <Plus size={14} /> Add
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </Reveal>
        );
      })}

      <p className="flex items-center gap-2 text-[0.74rem] font-semibold text-ink-mute">
        <CalendarDays size={13} /> Drag tasks to reorder within a phase. Check them off when the moment is yours.
      </p>
    </div>
  );
}
