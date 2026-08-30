import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Check, FileText, Mail, Pencil, Phone, Plus, X } from "lucide-react";
import { Vendor, VendorStatus, VENDOR_CATEGORIES, fmtMoney } from "../../lib/data";
import { useApp } from "../../lib/store";
import { Field, Modal, Pill, Reveal, btn, inputCls, selectCls } from "../ui";

const STATUSES: VendorStatus[] = ["Inquiry", "Proposal", "Booked", "Declined"];

const blank = (): Vendor => ({
  id: "", category: VENDOR_CATEGORIES[0], company: "", contact: "", email: "", phone: "",
  price: 0, status: "Inquiry", contract: false, notes: "", payments: [],
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">Vendor Hub</h2>
          <p className="text-[0.85rem] font-semibold text-ink-2">
            {fmtMoney(bookedSpend)} booked · <span className="text-blush-deep">{proposals} proposal{proposals === 1 ? "" : "s"} awaiting a decision</span>
          </p>
        </div>
        <button onClick={() => { setIsNew(true); setEditing(blank()); }} className={`${btn.ink} !py-2.5`}><Plus size={15} /> Add vendor</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-2 text-[0.78rem] font-bold transition-all cursor-pointer ${statusFilter === s ? "bg-ink text-cream shadow-card" : "border border-ink/15 bg-white/60 text-ink-2 hover:border-ink/40"}`}>
            {s === "all" ? "All" : s}
          </button>
        ))}
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={`${selectCls} ml-auto`} aria-label="Filter by category">
          <option value="all">All categories</option>
          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[1.6rem] border border-dashed border-ink/15 bg-white/50 px-8 py-14 text-center">
          <p className="font-display text-xl text-ink">Nothing in this view</p>
          <p className="mt-2 text-[0.9rem] text-ink-2">Try another status, or add the vendor you're courting.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((v, i) => {
            const paidSum = v.payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
            return (
              <Reveal key={v.id} delay={(i % 3) * 0.06}>
                <article
                  id={`vendor-${v.id}`}
                  className={`group relative flex h-full flex-col rounded-[1.6rem] border p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-lift ${
                    flash === v.id ? "border-gold bg-gold-soft/40 shadow-lift" : "border-white/70 bg-white/65"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Pill tone="gold">{v.category}</Pill>
                    <div className="relative">
                      <button onClick={() => setMenuFor(menuFor === v.id ? null : v.id)} aria-label={`Change status of ${v.company}`} aria-expanded={menuFor === v.id} className="cursor-pointer transition hover:scale-105">
                        <Pill tone={v.status}>{v.status} ▾</Pill>
                      </button>
                      <AnimatePresence>
                        {menuFor === v.id && (
                          <>
                            <button className="fixed inset-0 z-20 cursor-default" aria-label="Close menu" onClick={() => setMenuFor(null)} />
                            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                              className="absolute right-0 z-30 mt-2 w-36 overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-lift">
                              {STATUSES.map((s) => (
                                <button key={s} onClick={() => { update({ ...v, status: s }); setMenuFor(null); toast(`${v.company} → ${s}`); }}
                                  className={`block w-full px-4 py-2.5 text-left text-[0.8rem] font-bold transition hover:bg-blush-soft/60 cursor-pointer ${v.status === s ? "text-blush-deep" : "text-ink-2"}`}>
                                  {s}
                                </button>
                              ))}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <h3 className="mt-3.5 font-display text-[1.35rem] leading-tight text-ink">{v.company}</h3>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[0.78rem] font-semibold text-ink-mute"><Building2 size={12} /> {v.contact || "—"}</p>

                  <div className="mt-3 flex flex-col gap-1 text-[0.78rem] font-semibold text-ink-2">
                    {v.email && <a href={`mailto:${v.email}`} className="flex w-fit items-center gap-1.5 transition hover:text-gold-deep"><Mail size={12} className="text-ink-mute" /> {v.email}</a>}
                    {v.phone && <a href={`tel:${v.phone}`} className="flex w-fit items-center gap-1.5 transition hover:text-gold-deep"><Phone size={12} className="text-ink-mute" /> {v.phone}</a>}
                  </div>

                  <p className="mt-4 font-display text-2xl text-ink">{fmtMoney(v.price)}</p>

                  {v.payments.length > 0 && (
                    <div className="mt-3">
                      <div className="h-1.5 overflow-hidden rounded-full bg-ink/8">
                        <div className="h-full rounded-full bg-gold transition-all duration-700" style={{ width: `${v.price ? (paidSum / v.price) * 100 : 0}%` }} />
                      </div>
                      <div className="mt-2 space-y-1">
                        {v.payments.map((p) => (
                          <p key={p.label} className="flex items-center justify-between text-[0.7rem] font-semibold text-ink-mute">
                            <span className="flex items-center gap-1.5">
                              {p.paid ? <Check size={11} className="text-sage-deep" /> : <span className="h-2 w-2 rounded-full border border-ink/25" />}
                              {p.label} · {p.due}
                            </span>
                            {fmtMoney(p.amount)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {v.notes && <p className="mt-3 line-clamp-2 text-[0.8rem] leading-relaxed text-ink-2">{v.notes}</p>}

                  <div className="mt-auto flex items-center justify-between pt-4">
                    <button
                      onClick={() => { update({ ...v, contract: !v.contract }); toast(v.contract ? "Contract unsigned" : "Contract signed", v.contract ? undefined : "Filed safely in the hub."); }}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.7rem] font-extrabold transition cursor-pointer ${v.contract ? "border-sage/60 bg-sage-soft text-sage-deep" : "border-dashed border-ink/25 text-ink-mute hover:border-gold hover:text-gold-deep"}`}
                    >
                      <FileText size={12} /> {v.contract ? "Contract signed" : "No contract yet"}
                    </button>
                    <button onClick={() => { setIsNew(false); setEditing({ ...v }); }} aria-label={`Edit ${v.company}`} className="rounded-full p-2 text-ink-mute transition hover:bg-gold-soft hover:text-gold-deep cursor-pointer"><Pencil size={14} /></button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
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
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="flex items-end pb-1">
                <button onClick={() => setEditing({ ...editing, contract: !editing.contract })}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[0.8rem] font-bold transition cursor-pointer ${editing.contract ? "border-sage/60 bg-sage-soft text-sage-deep" : "border-ink/15 text-ink-2"}`}>
                  <FileText size={13} /> {editing.contract ? "Contract signed" : "Mark contract signed"}
                </button>
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
