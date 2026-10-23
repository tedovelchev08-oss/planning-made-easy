import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { BudgetCategory, Vendor, catCommitted, catPaid, fmtMoney } from "../../lib/data";
import { useApp, useCountUp } from "../../lib/store";
import { Field, Modal, btn, inputCls } from "../ui";

const PALETTE = ["#c9a86a", "#b8964f", "#8c826f", "#66704f", "#e3cfa5", "#cfc6b4", "#b4b99f", "#4a443b"];

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

  const share = (part: number) => `${total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0}%`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Budget</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            {fmtMoney(total)} in all, matched against your booked vendors.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer">
          <Plus size={15} strokeWidth={1.8} /> Add a category
        </button>
      </header>

      {/* where the money is */}
      <section className="pl-card px-6 py-6 sm:px-8" aria-label="Where the money is">
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Paid", shownPaid, "bg-[var(--pl-ink)]"],
            ["Still to pay", shownCommitted - shownPaid, "bg-[var(--pl-gold)]"],
            ["Left to commit", shownRemaining, "bg-[rgb(28_26_23/.12)]"],
          ].map(([label, value, dot]) => (
            <div key={label as string}>
              <p className="flex items-center gap-2 text-[13px] text-[var(--pl-ink-2)]"><span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />{label}</p>
              <p className={`mt-1.5 font-display text-[24px] leading-none tabular-nums sm:text-[34px] ${(value as number) < 0 ? "text-[#a53d28]" : ""}`}>{fmtMoney(value as number)}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex h-[6px] overflow-hidden rounded-full bg-[rgb(28_26_23/.1)]" aria-hidden="true">
          <motion.span initial={{ width: 0 }} animate={{ width: share(paid) }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} className="bg-[var(--pl-ink)]" />
          <motion.span initial={{ width: 0 }} animate={{ width: share(committed - paid) }} transition={{ duration: 1.2, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} className="bg-[var(--pl-gold)]" />
        </div>
        {remaining < 0 && <p className="mt-3 text-[14px] text-[#a53d28]">You've promised {fmtMoney(-remaining)} more than the budget.</p>}
      </section>

      {/* categories */}
      <section className="pl-card" aria-labelledby="cats-h">
        <div className="pl-card-h"><h2 id="cats-h">Categories</h2><small>{db.budget.length}</small></div>
        {db.budget.length === 0 ? (
          <p className="px-6 py-6 text-[15px] text-[var(--pl-ink-2)]">No categories yet. Add the first, like Venue or Flowers, and give it a number.</p>
        ) : (
          <ul>
            {db.budget.map((c) => {
              const cCommitted = catCommitted(c, db.vendors);
              const cPaid = catPaid(c, db.vendors);
              const over = cCommitted > c.budget;
              const linked = db.vendors.filter((v) => v.budgetId === c.id);
              const booked = linked.filter((v) => v.status === "Booked");
              const proposed = linked.filter((v) => v.status === "Proposal");
              const of = (n: number) => `${c.budget > 0 ? Math.min(100, (n / c.budget) * 100) : 0}%`;
              const from = [
                ...booked.map((v) => `${v.company} ${fmtMoney(v.price)}`),
                ...proposed.map((v) => `${v.company}, a proposal`),
                ...(c.manualCommitted > 0 ? [`other costs ${fmtMoney(c.manualCommitted)}`] : []),
              ];
              return (
                <li key={c.id} className="pl-row group px-6 py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-5 gap-y-2 md:grid-cols-[200px_minmax(0,1fr)_170px_120px_76px]">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="h-2.5 w-2.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: c.color }} aria-hidden="true" />
                      <span className="truncate text-[15.5px]">{c.name}</span>
                    </div>
                    <div className="order-last col-span-3 md:order-none md:col-span-1">
                      <div className="flex h-[5px] overflow-hidden rounded-full bg-[rgb(28_26_23/.1)]" aria-hidden="true">
                        <span className="bg-[var(--pl-ink)]" style={{ width: of(cPaid) }} />
                        <span className={over ? "bg-[#b55a45]" : "bg-[var(--pl-gold)]"} style={{ width: of(Math.max(0, cCommitted - cPaid)) }} />
                      </div>
                    </div>
                    <span className="hidden text-right text-[14px] tabular-nums text-[var(--pl-ink-2)] md:block">{fmtMoney(cCommitted)} <span className="text-[13px]">of</span> {fmtMoney(c.budget)}</span>
                    <span className={`text-right text-[14px] tabular-nums ${over ? "text-[#a53d28]" : ""}`}>
                      {over ? `over by ${fmtMoney(cCommitted - c.budget)}` : `${fmtMoney(c.budget - cCommitted)} left`}
                    </span>
                    <span className="flex justify-end gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:focus-within:opacity-100">
                      <button onClick={() => setEditing({ ...c })} aria-label={`Adjust ${c.name}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)] cursor-pointer"><Pencil size={15} strokeWidth={1.6} /></button>
                      <button
                        onClick={() => { setDb((d) => ({ ...d, budget: d.budget.filter((x) => x.id !== c.id), vendors: d.vendors.map((v) => (v.budgetId === c.id ? { ...v, budgetId: null } : v)) })); toast(`${c.name} removed`, linked.length ? `${linked.length} vendor${linked.length > 1 ? "s" : ""} unlinked — their commitments now show as untraced.` : undefined, "info"); }}
                        aria-label={`Remove ${c.name}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(181_90_69/.12)] hover:text-[#a53d28] cursor-pointer"
                      >
                        <Trash2 size={15} strokeWidth={1.6} />
                      </button>
                    </span>
                  </div>
                  <p className="mt-1.5 pl-[22px] text-[13px] text-[var(--pl-ink-2)]">
                    <span className="md:hidden">{fmtMoney(cCommitted)} of {fmtMoney(c.budget)} · </span>
                    {from.length ? from.join(" · ") : "Nothing promised yet"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[13px] leading-relaxed text-[var(--pl-ink-2)]">
        Booked vendors fill this in by themselves: mark a payment paid in Vendors and it shows here. Dark is paid; gold is promised but still to pay.
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
              <p className="mt-4 rounded-[3px] border border-ink/10 px-4 py-3 text-[0.82rem] leading-relaxed text-ink-2">
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
