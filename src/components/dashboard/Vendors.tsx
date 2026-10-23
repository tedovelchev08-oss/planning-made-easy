import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, FileText, Mail, Phone, Plus, X } from "lucide-react";
import { Vendor, VendorStatus, VENDOR_CATEGORIES, fmtDate, fmtMoney, toDayKey } from "../../lib/data";
import { useApp } from "../../lib/store";
import { Field, Modal, btn, inputCls, selectCls } from "../ui";

const STATUSES: VendorStatus[] = ["Inquiry", "Proposal", "Booked", "Declined"];

const blank = (): Vendor => ({
  id: "", category: VENDOR_CATEGORIES[0], company: "", contact: "", email: "", phone: "",
  price: 0, status: "Inquiry", contract: false, notes: "", budgetId: null, payments: [],
});

export default function Vendors() {
  const { db, setDb, toast } = useApp();
  const [statusFilter, setStatusFilter] = useState<"all" | VendorStatus>("all");
  const [catFilter, setCatFilter] = useState("all");
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // ⌘K palette / quick actions: flash & scroll to a vendor card
  useEffect(() => {
    const on = (e: Event) => {
      const company = (e as CustomEvent).detail as string;
      const v = db.vendors.find((x: Vendor) => x.company === company);
      if (!v) return;
      setFlash(v.id);
      requestAnimationFrame(() =>
        document.getElementById(`vendor-${v.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
      window.setTimeout(() => setFlash(null), 1800);
    };
    window.addEventListener("luma:vendor-focus", on);
    return () => window.removeEventListener("luma:vendor-focus", on);
  }, [db.vendors]);

  const rows = useMemo(
    () => db.vendors.filter((v) => (statusFilter === "all" || v.status === statusFilter) && (catFilter === "all" || v.category === catFilter)),
    [db.vendors, statusFilter, catFilter],
  );

  const bookedSpend = db.vendors.filter((v) => v.status === "Booked").reduce((s, v) => s + v.price, 0);
  const proposals = db.vendors.filter((v) => v.status === "Proposal").length;

  const update = (v: Vendor) => setDb((d) => ({ ...d, vendors: d.vendors.map((x) => (x.id === v.id ? v : x)) }));

  const save = () => {
    if (!editing) return;
    if (!editing.company.trim()) { toast("Which company?", "Give the vendor a name to save.", "warn"); return; }
    if (isNew) {
      setDb((d) => ({ ...d, vendors: [{ ...editing, id: `v-${Date.now()}` }, ...d.vendors] }));
      toast(`${editing.company} added`, "They're in the hub now.");
    } else {
      update(editing);
      toast("Vendor updated");
    }
    setEditing(null);
  };

  // what needs a decision comes first, then what's settled, then the rest
  const ORDER: Record<VendorStatus, number> = { Proposal: 0, Booked: 1, Inquiry: 2, Declined: 3 };
  const sorted = [...rows].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const STATUS_DOT: Record<VendorStatus, string> = {
    Proposal: "bg-[var(--pl-gold)]", Booked: "bg-[#7aa06a]", Inquiry: "bg-[rgb(28_26_23/.3)]", Declined: "bg-[#b55a45]",
  };
  const fmtDue = (d: string) => fmtDate(`${d}T12:00:00`, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Vendors</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            {fmtMoney(bookedSpend)} booked{proposals > 0 && <> · {proposals} {proposals === 1 ? "proposal waits" : "proposals wait"} for a decision</>}
          </p>
        </div>
        <button onClick={() => { setIsNew(true); setEditing(blank()); }} className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer">
          <Plus size={15} strokeWidth={1.8} /> Add a vendor
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by status">
          {(["all", ...STATUSES] as const).map((st) => (
            <button key={st} role="tab" aria-selected={statusFilter === st} onClick={() => setStatusFilter(st)}
              className={`h-10 shrink-0 rounded-full px-4 text-[13.5px] transition cursor-pointer ${statusFilter === st ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : "border border-[var(--pl-line)] bg-[var(--pl-card)] hover:border-[rgb(28_26_23/.3)]"}`}>
              {st === "all" ? "Everyone" : st === "Proposal" ? "Proposals" : st === "Inquiry" ? "Asked" : st}
            </button>
          ))}
        </div>
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="h-10 rounded-[2px] border border-[var(--pl-line)] bg-[var(--pl-card)] px-3 text-[13.5px] sm:ml-auto cursor-pointer" aria-label="Filter by category">
          <option value="all">Every kind</option>
          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-[rgb(28_26_23/.2)] px-8 py-14 text-center">
          <p className="font-display text-[24px]">No vendors here</p>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">Try another filter, or add the vendor you're talking to.</p>
        </div>
      ) : (
        <ul className="pl-card">
          {sorted.map((v) => {
            const paidSum = v.payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount, 0);
            const next = v.payments.find((p) => !p.paid);
            return (
              <li key={v.id} id={`vendor-${v.id}`} className={`pl-row px-5 py-4 transition-colors sm:px-6 ${flash === v.id ? "bg-[rgb(201_168_106/.18)]" : ""}`}>
                <div className="grid gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1.5fr)_150px_minmax(0,1.4fr)_220px] md:items-center">
                  {/* who */}
                  <div className="min-w-0">
                    <button onClick={() => { setIsNew(false); setEditing({ ...v }); }} className="block max-w-full truncate text-left font-display text-[22px] leading-tight hover:underline hover:decoration-[rgb(28_26_23/.3)] hover:underline-offset-4 cursor-pointer" aria-label={`Edit ${v.company}`}>
                      {v.company}
                    </button>
                    <p className="mt-0.5 truncate text-[13px] text-[var(--pl-ink-2)]">{[v.category, v.contact].filter(Boolean).join(" · ")}</p>
                  </div>

                  {/* where it stands */}
                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === v.id ? null : v.id)} aria-label={`Change status of ${v.company}`} aria-expanded={menuFor === v.id}
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--pl-line)] px-3 text-[13px] transition hover:border-[rgb(28_26_23/.3)] cursor-pointer">
                      <span className={`h-[7px] w-[7px] rounded-full ${STATUS_DOT[v.status]}`} aria-hidden="true" />
                      {v.status === "Inquiry" ? "Asked" : v.status}
                      <ChevronDown size={13} strokeWidth={1.6} className="text-[var(--pl-ink-2)]" />
                    </button>
                    <AnimatePresence>
                      {menuFor === v.id && (
                        <>
                          <motion.button className="fixed inset-0 z-20 cursor-default" exit={{ pointerEvents: "none" }} aria-label="Close menu" onClick={() => setMenuFor(null)} />
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className="absolute left-0 z-30 mt-1.5 w-40 overflow-hidden rounded-[3px] bg-[var(--pl-card)] shadow-[0_18px_40px_-16px_rgb(0_0_0/.45)] ring-1 ring-[var(--pl-line)]">
                            {STATUSES.map((st) => (
                              <button key={st} onClick={() => { update({ ...v, status: st }); setMenuFor(null); toast(`${v.company}: ${st === "Inquiry" ? "asked" : st.toLowerCase()}`); }}
                                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[14px] transition hover:bg-[rgb(28_26_23/.05)] cursor-pointer ${v.status === st ? "text-[var(--pl-bronze)]" : ""}`}>
                                <span className={`h-[7px] w-[7px] rounded-full ${STATUS_DOT[st]}`} aria-hidden="true" />
                                {st === "Inquiry" ? "Asked" : st}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* the money */}
                  <div className="min-w-0">
                    <p className="font-display text-[22px] leading-tight tabular-nums">{fmtMoney(v.price)}</p>
                    <p className="text-[13px] text-[var(--pl-ink-2)]">
                      {v.payments.length === 0
                        ? (v.status === "Booked" ? "No payments scheduled yet" : v.notes ? v.notes : "—")
                        : next
                          ? `${fmtMoney(paidSum)} paid · next ${fmtMoney(next.amount)} on ${fmtDue(next.due)}`
                          : "Paid in full"}
                    </p>
                    {v.payments.length > 0 && (
                      <div className="mt-2 flex h-[3px] max-w-[260px] overflow-hidden rounded-full bg-[rgb(28_26_23/.1)]" aria-hidden="true">
                        <span className="bg-[var(--pl-ink)]" style={{ width: `${v.price ? Math.min(100, (paidSum / v.price) * 100) : 0}%` }} />
                      </div>
                    )}
                  </div>

                  {/* contract and contact */}
                  <div className="flex items-center gap-1 md:justify-end">
                    <button
                      onClick={() => { update({ ...v, contract: !v.contract }); toast(v.contract ? "Contract unsigned" : "Contract signed", v.contract ? undefined : "Noted against this vendor."); }}
                      aria-pressed={v.contract}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition cursor-pointer ${v.contract ? "text-[#4f7a43]" : "border border-dashed border-[rgb(28_26_23/.25)] text-[var(--pl-ink-2)] hover:border-[var(--pl-bronze)]"}`}
                    >
                      {v.contract ? <Check size={14} strokeWidth={2} /> : <FileText size={14} strokeWidth={1.6} />}
                      {v.contract ? "Signed" : "No contract"}
                    </button>
                    {v.email && <a href={`mailto:${v.email}`} aria-label={`Email ${v.company}`} className="rounded-full p-2.5 text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)]"><Mail size={15} strokeWidth={1.6} /></a>}
                    {v.phone && <a href={`tel:${v.phone}`} aria-label={`Call ${v.company}`} className="rounded-full p-2.5 text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)]"><Phone size={15} strokeWidth={1.6} /></a>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} label={isNew ? "Add vendor" : "Edit vendor"}>
        {editing && (
          <div className="p-7 sm:p-8">
            <h2 className="font-display text-2xl text-ink">{isNew ? "Add a vendor" : `Edit ${editing.company}`}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className={`${selectCls} w-full`} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Company"><input className={inputCls} value={editing.company} onChange={(e) => setEditing({ ...editing, company: e.target.value })} placeholder="Aria Studio" autoFocus /></Field>
              <Field label="Contact"><input className={inputCls} value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} placeholder="June Park" /></Field>
              <Field label="Price (USD)"><input type="number" min={0} className={inputCls} value={editing.price || ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} placeholder="4800" /></Field>
              <Field label="Email"><input className={inputCls} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="hello@…" /></Field>
              <Field label="Phone"><input className={inputCls} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="+1 …" /></Field>
              <Field label="Status">
                <select className={`${selectCls} w-full`} value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as VendorStatus })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s === "Inquiry" ? "Asked" : s}</option>)}
                </select>
              </Field>
              <div className="flex items-end pb-1">
                <button onClick={() => setEditing({ ...editing, contract: !editing.contract })}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[0.8rem] font-bold transition cursor-pointer ${editing.contract ? "border-sage/60 bg-sage-soft text-sage-deep" : "border-ink/15 text-ink-2"}`}>
                  <FileText size={13} /> {editing.contract ? "Contract signed" : "Mark contract signed"}
                </button>
              </div>
              <div className="sm:col-span-2">
                <Field label="Budget category">
                  <select className={`${selectCls} w-full`} value={editing.budgetId ?? ""} onChange={(e) => setEditing({ ...editing, budgetId: e.target.value || null })}>
                    <option value="">Untracked — doesn't post into the budget</option>
                    {db.budget.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
                {editing.status === "Booked" && !editing.budgetId && (
                  <p className="mt-2 text-[0.72rem] font-semibold text-gold-deep">Booked without a category — this commitment won't show in Budget until you link one.</p>
                )}
              </div>

              {/* payment schedule — drives the paid figure in Budget */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="mb-1.5 block text-[0.85rem] font-medium text-ink-2">Payment schedule</span>
                  <button
                    onClick={() => setEditing({ ...editing, payments: [...editing.payments, { label: editing.payments.length === 0 ? "Deposit" : `Payment ${editing.payments.length + 1}`, amount: 0, due: toDayKey(new Date().toISOString()), paid: false }] })}
                    className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-[0.7rem] font-extrabold text-ink-2 transition hover:border-gold hover:text-gold-deep cursor-pointer"
                  >
                    <Plus size={11} /> Add payment
                  </button>
                </div>
                {editing.payments.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-ink/15 px-4 py-4 text-center text-[0.78rem] font-semibold text-ink-mute">
                    No schedule yet — add the deposit and balances so Budget knows what's paid.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editing.payments.map((p, i) => {
                      const set = (patchP: Partial<typeof p>) =>
                        setEditing({ ...editing, payments: editing.payments.map((x, xi) => (xi === i ? { ...x, ...patchP } : x)) });
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white/70 p-2.5">
                          <button
                            onClick={() => set({ paid: !p.paid })}
                            aria-pressed={p.paid}
                            aria-label={`Mark ${p.label} ${p.paid ? "unpaid" : "paid"}`}
                            title={p.paid ? "Paid — click to undo" : "Mark paid"}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition cursor-pointer ${p.paid ? "border-sage-deep bg-sage-deep text-cream" : "border-ink/25 bg-white text-transparent hover:border-gold"}`}
                          >
                            <Check size={13} strokeWidth={3.5} />
                          </button>
                          <input className={`${inputCls} !w-32 !py-1.5 text-[0.8rem]`} value={p.label} onChange={(e) => set({ label: e.target.value })} aria-label="Payment label" placeholder="Deposit" />
                          <input type="number" min={0} className={`${inputCls} !w-24 !py-1.5 text-[0.8rem]`} value={p.amount || ""} onChange={(e) => set({ amount: Number(e.target.value) })} aria-label="Payment amount" placeholder="0" />
                          <input type="date" className={`${inputCls} !w-36 !py-1.5 text-[0.8rem]`} value={p.due} onChange={(e) => set({ due: e.target.value })} aria-label="Payment due date" />
                          <button
                            onClick={() => setEditing({ ...editing, payments: editing.payments.filter((_, xi) => xi !== i) })}
                            aria-label={`Delete payment ${p.label}`}
                            className="ml-auto rounded-full p-1.5 text-ink-mute transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                    <p className="text-[0.7rem] font-semibold text-ink-mute">
                      {fmtMoney(editing.payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0))} paid of {fmtMoney(editing.payments.reduce((s, p) => s + p.amount, 0))} scheduled
                      {editing.payments.reduce((s, p) => s + p.amount, 0) !== editing.price && editing.payments.length > 0 && (
                        <span className="text-gold-deep"> · price is {fmtMoney(editing.price)}</span>
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2">
                <Field label="Notes"><textarea className={`${inputCls} min-h-[80px]`} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Vibe, questions, negotiation notes…" /></Field>
              </div>
            </div>
            <div className="mt-7 flex justify-between">
              {!isNew ? (
                <button onClick={() => { setDb((d) => ({ ...d, vendors: d.vendors.filter((x) => x.id !== editing.id) })); toast(`${editing.company} removed`, undefined, "info"); setEditing(null); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.8rem] font-bold text-blush-deep transition hover:bg-blush-soft cursor-pointer">
                  <X size={13} /> Remove
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button onClick={() => setEditing(null)} className={btn.ghost}>Cancel</button>
                <button onClick={save} className={btn.ink}>{isNew ? "Add vendor" : "Save"}</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
