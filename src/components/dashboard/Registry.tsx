import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Plus, X } from "lucide-react";
import { fmtMoney } from "../../lib/data";
import { useApp } from "../../lib/store";
import { Field, Modal, inputCls } from "../ui";
import { Lining } from "./Panel";

/** only real web links open; anything else is just a note on the gift */
const isWeb = (url: string) => /^https?:\/\//i.test(url);

export default function Registry() {
  const { db, setDb, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", store: "", price: "", url: "" });

  const given = db.registry.filter((r) => r.purchased).length;
  const open = db.invitation.live;

  const toggle = (id: string) => {
    const item = db.registry.find((r) => r.id === id);
    setDb((d) => ({ ...d, registry: d.registry.map((r) => (r.id === id ? { ...r, purchased: !r.purchased } : r)) }));
    if (item && !item.purchased) toast("Marked as given", item.name);
  };

  const add = () => {
    if (!form.name.trim() || !form.store.trim()) { toast("Add the gift's name and where it's from", undefined, "warn"); return; }
    const url = form.url.trim();
    setDb((d) => ({
      ...d,
      registry: [...d.registry, { id: `r-${Date.now()}`, name: form.name.trim(), store: form.store.trim(), price: Number(form.price) || 0, url: url && !isWeb(url) ? `https://${url}` : url, purchased: false }],
    }));
    toast("Added to your registry", form.name.trim());
    setAdding(false);
    setForm({ name: "", store: "", price: "", url: "" });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Registry</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            {db.registry.length === 0
              ? "The gifts you'd love, for guests who ask."
              : <><span className="tabular-nums text-[var(--pl-ink)]">{given} of {db.registry.length}</span> already given. Guests see the list under your invitation{open ? "" : " once it's open"}.</>}
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="pl-act"><Plus size={15} strokeWidth={1.8} /> Add a gift</button>
      </header>

      {db.registry.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-[rgb(28_26_23/.2)] px-8 py-14 text-center">
          <p className="font-display text-[24px]">No gifts yet</p>
          <p className="mx-auto mt-2 max-w-sm text-[15px] text-[var(--pl-ink-2)]">Add the things you'd actually use, from linen to a fund for the honeymoon. Each one can link to its shop.</p>
          <button onClick={() => setAdding(true)} className="pl-quiet mt-6"><Plus size={14} strokeWidth={1.8} /> Add the first gift</button>
        </div>
      ) : (
        <section className="pl-card" aria-label="Your registry">
          <ul>
            {db.registry.map((r) => (
              <li key={r.id} className="pl-row flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-6">
                <button
                  onClick={() => toggle(r.id)}
                  aria-pressed={r.purchased}
                  aria-label={r.purchased ? `${r.name}: given. Mark as not given` : `Mark ${r.name} as given`}
                  className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-[rgb(28_26_23/.05)] cursor-pointer"
                >
                  <span className={`pl-ring${r.purchased ? " is-done" : ""}`} aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate font-display text-[21px] leading-tight sm:text-[22px] ${r.purchased ? "text-[var(--pl-ink-2)]" : ""}`}><Lining text={r.name} /></p>
                  <p className="mt-0.5 truncate text-[13px] text-[var(--pl-ink-2)]">
                    {r.store}{r.price > 0 && <span className="tabular-nums"> · {fmtMoney(r.price)}</span>}
                    {r.purchased && <span className="pl-who ml-2 !text-[15px]">given</span>}
                  </p>
                </div>
                {isWeb(r.url) && (
                  <a href={r.url} target="_blank" rel="noreferrer" aria-label={`Open ${r.name} at ${r.store}`}
                    className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-[var(--pl-bronze)] transition hover:bg-[rgb(28_26_23/.05)] hover:text-[var(--pl-ink)]">
                    <ExternalLink size={14} strokeWidth={1.6} /><span className="hidden sm:inline">Shop</span>
                  </a>
                )}
                <button
                  onClick={() => { setDb((d) => ({ ...d, registry: d.registry.filter((x) => x.id !== r.id) })); toast("Removed from your registry", r.name, "info"); }}
                  aria-label={`Remove ${r.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.05)] hover:text-[#a53d28] cursor-pointer"
                >
                  <X size={15} strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-[var(--pl-line)] px-4 py-3.5 text-[13px] text-[var(--pl-ink-2)] sm:px-6">
            Tick a gift once it's been given; guests see it as taken. <Link to="/planner/invitation" className="pl-link !text-[13px]">See the invitation</Link>
          </p>
        </section>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} label="Add a gift">
        <div className="p-7 sm:p-8">
          <h2 className="font-display text-[28px] leading-none">A gift you'd love</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="The gift"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Walnut serving boards" autoFocus /></Field></div>
            <Field label="Shop"><input className={inputCls} value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="Etsy" /></Field>
            <Field label="Price (optional)"><input type="number" min={0} inputMode="decimal" className={inputCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120" /></Field>
            <div className="sm:col-span-2"><Field label="Link (optional)"><input type="url" inputMode="url" className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field></div>
          </div>
          <div className="mt-7 flex items-center justify-end gap-5">
            <button onClick={() => setAdding(false)} className="pl-link">Cancel</button>
            <button onClick={add} className="pl-act"><Plus size={14} strokeWidth={1.8} /> Add the gift</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
