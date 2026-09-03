import { useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Gift, Heart, Plus } from "lucide-react";
import { fmtMoney } from "../../lib/data";
import { useApp, useCountUp } from "../../lib/store";
import { EmptyState, Field, Modal, Pill, Reveal, btn, inputCls } from "../ui";

export default function Registry() {
  const { db, setDb, toast } = useApp();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", store: "", price: "", url: "" });
  const [raised, setRaised] = useState(1850);
  const raisedShown = useCountUp(raised);

  const gifted = db.registry.filter((r) => r.purchased).length;
  const fundGoal = 5000;

  const toggle = (id: string) => {
    const item = db.registry.find((r) => r.id === id);
    setDb((d) => ({ ...d, registry: d.registry.map((r) => (r.id === id ? { ...r, purchased: !r.purchased } : r)) }));
    if (item && !item.purchased) toast("Marked as gifted", `${item.name} — someone has excellent taste.`);
  };

  const add = () => {
    if (!form.name.trim() || !form.store.trim()) { toast("Name and store, at least", undefined, "warn"); return; }
    setDb((d) => ({
      ...d,
      registry: [...d.registry, { id: `r-${Date.now()}`, name: form.name.trim(), store: form.store.trim(), price: Number(form.price) || 0, url: form.url || "#", purchased: false }],
    }));
    toast("Added to registry", form.name.trim());
    setAdding(false);
    setForm({ name: "", store: "", price: "", url: "" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl text-ink">Registry</h2>
          <p className="text-[0.85rem] font-semibold text-ink-2">{gifted} of {db.registry.length} promised · guests see this on your wedding website</p>
        </div>
        <button onClick={() => setAdding(true)} className={`${btn.ink} !py-2.5`}><Plus size={15} /> Add gift idea</button>
      </div>

      {/* honeymoon fund */}
      <Reveal>
        <section className="relative overflow-hidden rounded-[1.8rem] bg-ink p-7 text-cream shadow-lift sm:p-9">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blush/25 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 left-1/4 h-56 w-56 rounded-full bg-lav/20 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold">The honeymoon fund</p>
              <h3 className="mt-2 font-display text-3xl">Amalfi, <em className="text-blush">slowly.</em></h3>
              <p className="mt-2 max-w-sm text-[0.88rem] font-semibold text-cream/60">Guests contribute here instead of a toaster. Everyone wins.</p>
            </div>
            <div className="text-right">
              <p className="font-display text-[2.4rem] leading-none">{fmtMoney(raisedShown)}</p>
              <p className="text-[0.74rem] font-bold text-cream/50">of {fmtMoney(fundGoal)} dreamed</p>
            </div>
          </div>
          <div className="relative mt-6 h-2.5 overflow-hidden rounded-full bg-cream/15">
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (raised / fundGoal) * 100)}%` }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} className="h-full rounded-full bg-gradient-to-r from-gold via-blush to-lav" />
          </div>
          <button onClick={() => { setRaised((r) => r + 250); toast("Contribution received", `${fmtMoney(250)} toward Amalfi. The lemon groves await.`); }} className={`${btn.gold} relative mt-6 !py-2.5`}>
            <Gift size={14} /> Simulate a contribution
          </button>
        </section>
      </Reveal>

      {db.registry.length === 0 ? (
        <EmptyState title="No gifts yet" body="Add the things you'd actually love — from linen to a lemon grove fund." action={<button onClick={() => setAdding(true)} className={btn.ink}><Plus size={15} /> Add gift idea</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {db.registry.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 0.06}>
              <article className={`group flex h-full flex-col rounded-[1.5rem] border bg-white/65 p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lift ${r.purchased ? "border-sage/50 bg-sage-soft/40" : "border-white/70 hover:bg-white/90"}`}>
                <div className="flex items-start justify-between">
                  <Pill tone={r.purchased ? "confirmed" : "gold"}>{r.purchased ? "Gifted" : r.store}</Pill>
                  <a href={r.url === "#fund" ? undefined : r.url} target={r.url.startsWith("http") ? "_blank" : undefined} rel="noreferrer" aria-label={`View ${r.name} at ${r.store}`} className={`rounded-full p-2 transition ${r.url.startsWith("http") ? "text-ink-mute hover:bg-gold-soft hover:text-gold-deep" : "pointer-events-none opacity-30"}`}>
                    <ExternalLink size={14} />
                  </a>
                </div>
                <h3 className="mt-3 font-display text-[1.2rem] leading-snug text-ink">{r.name}</h3>
                <p className="mt-1 text-[0.8rem] font-semibold text-ink-mute">{r.store}{r.price > 0 && ` · ${fmtMoney(r.price)}`}</p>
                <div className="mt-auto flex items-center justify-between pt-5">
                  <button
                    onClick={() => toggle(r.id)}
                    aria-pressed={r.purchased}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.78rem] font-extrabold transition-all duration-300 cursor-pointer ${r.purchased ? "bg-sage text-ink" : "border border-ink/15 text-ink-2 hover:border-blush-deep hover:text-blush-deep"}`}
                  >
                    <motion.span animate={r.purchased ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.45 }}>
                      <Heart size={14} fill={r.purchased ? "#332B31" : "none"} />
                    </motion.span>
                    {r.purchased ? "Gifted with love" : "Mark gifted"}
                  </button>
                  <button onClick={() => { setDb((d) => ({ ...d, registry: d.registry.filter((x) => x.id !== r.id) })); toast("Removed from registry", undefined, "info"); }} className="text-[0.72rem] font-bold text-ink-mute transition hover:text-blush-deep cursor-pointer">
                    Remove
                  </button>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} label="Add registry item">
        <div className="p-7 sm:p-8">
          <h2 className="font-display text-2xl text-ink">A new wish</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Gift name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Walnut serving boards" autoFocus /></Field></div>
            <Field label="Store"><input className={inputCls} value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} placeholder="Etsy" /></Field>
            <Field label="Price (optional)"><input type="number" min={0} className={inputCls} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="120" /></Field>
            <div className="sm:col-span-2"><Field label="Link"><input className={inputCls} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></Field></div>
          </div>
          <div className="mt-7 flex justify-end gap-3">
            <button onClick={() => setAdding(false)} className={btn.ghost}>Cancel</button>
            <button onClick={add} className={btn.ink}><Plus size={14} /> Add to registry</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
