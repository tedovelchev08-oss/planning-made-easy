import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Store, Trash2, Wallet } from "lucide-react";
import { BudgetCategory, Vendor, catCommitted, catPaid, fmtMoney } from "../../lib/data";
import { useApp, useCountUp } from "../../lib/store";
import { Field, Modal, Pill, Reveal, btn, inputCls } from "../ui";

const PALETTE = ["#D4AF37", "#EE8FA1", "#A78BD4", "#74996B", "#FFB5C2", "#C9B8E8", "#A8C5A0", "#5C4F55"];

/** committed minus what the category's own vendors already account for */
const vendorCommittedFor = (c: BudgetCategory, vendors: Vendor[]) =>
  vendors.filter((v) => v.budgetId === c.id && v.status === "Booked").reduce((s, v) => s + v.price, 0);

const vendorPaidFor = (c: BudgetCategory, vendors: Vendor[]) =>
  vendors.filter((v) => v.budgetId === c.id && v.status === "Booked").reduce((s, v) => s + v.payments.filter((p) => p.paid).reduce((a, p) => a + p.amount, 0), 0);

export default function Budget() {
  const { db, setDb, toast } = useApp();
  const [editing, setEditing] = useState<BudgetCategory | null>(null);
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", budget: "" });

  // the whole picture now reconciles: committed & paid are derived from
  // booked vendor schedules plus each category's manual amounts
  const total = db.budget.reduce((s, c) => s + c.budget, 0);
  const committed = db.budget.reduce((s, c) => s + catCommitted(c, db.vendors), 0);
  const paid = db.budget.reduce((s, c) => s + catPaid(c, db.vendors), 0);
  const remaining = total - committed;

  const shownTotal = useCountUp(total);
  const shownCommitted = useCountUp(committed);
  const shownPaid = useCountUp(paid);
  const shownRemaining = useCountUp(remaining);

  const saveEditing = () => {
    if (!editing) return;
    setDb((d) => ({ ...d, budget: d.budget.map((c) => (c.id === editing.id ? editing : c)) }));
    toast("Budget updated", `${editing.name} now reflects reality.`);
    setEditing(null);
  };

  const addCategory = () => {
    const b = Number(newCat.budget);
    if (!newCat.name.trim() || !b || b <= 0) { toast("Give it a name and a number", "Both make a category real.", "warn"); return; }
    setDb((d) => ({
      ...d,
      budget: [...d.budget, { id: `b-${Date.now()}`, name: newCat.name.trim(), budget: b, manualCommitted: 0, manualPaid: 0, color: PALETTE[d.budget.length % PALETTE.length] }],
    }));
    toast("Category added", `${newCat.name.trim()} joins the plan.`);
    setAdding(false);
    setNewCat({ name: "", budget: "" });
  };

  return (
    <div className="space-y-6">
      {/* summary */}
      <Reveal>
        <section className="overflow-hidden rounded-[1.8rem] border border-white/70 bg-ink p-7 text-cream shadow-lift sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold">The whole picture</p>
              <p className="mt-2 font-display text-[2.2rem] leading-none sm:text-[3.4rem]">{fmtMoney(shownTotal)}</p>
              <p className="mt-2 text-[0.85rem] font-semibold text-cream/60">total budget · reconciled against your vendors</p>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:gap-10">
              <div>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-blush">Committed</p>
                <p className="mt-1.5 font-display text-base sm:text-2xl">{fmtMoney(shownCommitted)}</p>
              </div>
              <div>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-gold">Paid</p>
                <p className="mt-1.5 font-display text-base sm:text-2xl">{fmtMoney(shownPaid)}</p>
              </div>
              <div>
                <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-sage">Remaining</p>
                <p className="mt-1.5 font-display text-base sm:text-2xl">{fmtMoney(shownRemaining)}</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex h-3.5 overflow-hidden rounded-full bg-cream/12">
              <motion.span initial={{ width: 0 }} animate={{ width: `${(paid / Math.max(1, total)) * 100}%` }} transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }} className="rounded-l-full bg-gold" title="Paid" />
              <motion.span initial={{ width: 0 }} animate={{ width: `${((committed - paid) / Math.max(1, total)) * 100}%` }} transition={{ duration: 1.3, delay: 0.2, ease: [0.22, 1, 0.36, 1] }} className="bg-blush" title="Committed, not yet paid" />
              <motion.span initial={{ width: 0 }} animate={{ width: `${Math.max(0, (remaining / Math.max(1, total)) * 100)}%` }} transition={{ duration: 1.3, delay: 0.4, ease: [0.22, 1, 0.36, 1] }} className="bg-sage/50" title="Still yours to plan with" />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[0.7rem] font-bold text-cream/60">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-gold" /> paid</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blush" /> committed</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-sage/50" /> remaining</span>
            </div>
          </div>
        </section>
      </Reveal>

      {/* categories */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-ink">Categories</h2>
        <button onClick={() => setAdding(true)} className={`${btn.ink} !py-2.5`}><Plus size={15} /> Add category</button>
      </div>

      <div className="space-y-3">
        {db.budget.map((c, i) => {
          const cCommitted = catCommitted(c, db.vendors);
          const cPaid = catPaid(c, db.vendors);
          const pctCommitted = Math.round((cCommitted / Math.max(1, c.budget)) * 100);
          const over = cCommitted > c.budget;
          const linked = db.vendors.filter((v) => v.budgetId === c.id);
          const booked = linked.filter((v) => v.status === "Booked");
          return (
            <Reveal key={c.id} delay={i * 0.04}>
              <div className={`group rounded-[1.4rem] border bg-white/65 p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-card ${over ? "border-blush-deep/50" : "border-white/70"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden="true" />
                  <div className="w-full sm:w-40">
                    <p className="font-bold text-ink">{c.name}</p>
                    <p className="text-[0.68rem] font-semibold text-ink-mute">{fmtMoney(cCommitted)} of {fmtMoney(c.budget)}</p>
                  </div>
                  <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-ink/8">
                    <motion.div
                      initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, pctCommitted)}%` }} viewport={{ once: true }}
                      transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full" style={{ background: over ? "#E98BA0" : c.color }}
                    />
                    <div className="absolute inset-y-0 left-0 bg-ink/25" style={{ width: `${Math.min(100, (cPaid / Math.max(1, c.budget)) * 100)}%` }} title={`Paid: ${fmtMoney(cPaid)}`} />
                  </div>
                  <div className="flex items-center gap-3 sm:w-56 sm:justify-end">
                    {over ? <Pill tone="pending">Over by {fmtMoney(cCommitted - c.budget)}</Pill>
                      : <Pill tone="confirmed">{fmtMoney(c.budget - cCommitted)} free</Pill>}
                    <button onClick={() => setEditing({ ...c })} aria-label={`Adjust ${c.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-gold-soft hover:text-gold-deep cursor-pointer"><Pencil size={14} /></button>
                    <button
                      onClick={() => { setDb((d) => ({ ...d, budget: d.budget.filter((x) => x.id !== c.id), vendors: d.vendors.map((v) => (v.budgetId === c.id ? { ...v, budgetId: null } : v)) })); toast(`${c.name} removed`, linked.length ? `${linked.length} vendor${linked.length > 1 ? "s" : ""} unlinked — their commitments now show as untraced.` : undefined, "info"); }}
                      aria-label={`Remove ${c.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* which commitments came from which vendor */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-6">
                  {booked.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-white/80 px-2.5 py-1 text-[0.66rem] font-extrabold text-ink-2" title={`${v.company} · ${v.payments.filter((p) => p.paid).length}/${v.payments.length} payments made`}>
                      <Store size={10} className="text-gold-deep" /> {v.company} · {fmtMoney(v.price)}
                    </span>
                  ))}
                  {linked.filter((v) => v.status === "Proposal").map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink/20 px-2.5 py-1 text-[0.66rem] font-bold text-ink-mute" title="Proposal — nothing committed until it's booked">
                      {v.company} · pending
                    </span>
                  ))}
                  {c.manualCommitted > 0 && (
                    <span className="inline-flex items-center rounded-full bg-ink/5 px-2.5 py-1 text-[0.66rem] font-bold text-ink-mute" title="Not tied to a tracked vendor">
                      other · {fmtMoney(c.manualCommitted)}
                    </span>
                  )}
                  {linked.length === 0 && c.manualCommitted === 0 && (
                    <span className="text-[0.66rem] font-semibold text-ink-mute/60">no commitments yet</span>
                  )}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-[0.74rem] font-semibold text-ink-mute">
        <Wallet size={13} /> Committed and paid flow in from booked vendors automatically — mark a payment paid in Vendors and it lands here. The dark band is paid; the rest is promised.
      </p>

      {/* edit modal — manual amounts only; vendor money is edited in Vendors */}
      <Modal open={!!editing} onClose={() => setEditing(null)} label="Adjust category">
        {editing && (() => {
          const fromVendorsC = vendorCommittedFor(editing, db.vendors);
          const fromVendorsP = vendorPaidFor(editing, db.vendors);
          return (
            <div className="p-7 sm:p-8">
              <h2 className="font-display text-2xl text-ink">Adjust {editing.name}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Field label="Budget"><input type="number" min={0} className={inputCls} value={editing.budget} onChange={(e) => setEditing({ ...editing, budget: Number(e.target.value) })} /></Field>
                <Field label="Manual committed"><input type="number" min={0} className={inputCls} value={editing.manualCommitted} onChange={(e) => setEditing({ ...editing, manualCommitted: Number(e.target.value) })} /></Field>
                <Field label="Manual paid"><input type="number" min={0} className={inputCls} value={editing.manualPaid} onChange={(e) => setEditing({ ...editing, manualPaid: Number(e.target.value) })} /></Field>
              </div>
              <p className="mt-4 rounded-xl bg-sage-soft/60 px-4 py-3 text-[0.76rem] font-semibold leading-relaxed text-sage-deep">
                Vendors linked here already account for {fmtMoney(fromVendorsC)} committed · {fmtMoney(fromVendorsP)} paid.
                Edit their schedules in the Vendors module — these fields are for everything else.
              </p>
              <div className="mt-7 flex justify-end gap-3">
                <button onClick={() => setEditing(null)} className={btn.ghost}>Cancel</button>
                <button onClick={saveEditing} className={btn.ink}>Save numbers</button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* add modal */}
      <Modal open={adding} onClose={() => setAdding(false)} label="Add category">
        <div className="p-7 sm:p-8">
          <h2 className="font-display text-2xl text-ink">New category</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="Late-night snacks" autoFocus /></Field>
            <Field label="Budget"><input type="number" min={0} className={inputCls} value={newCat.budget} onChange={(e) => setNewCat({ ...newCat, budget: e.target.value })} placeholder="600" /></Field>
          </div>
          <div className="mt-7 flex justify-end gap-3">
            <button onClick={() => setAdding(false)} className={btn.ghost}>Cancel</button>
            <button onClick={addCategory} className={btn.ink}><Plus size={14} /> Add category</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
