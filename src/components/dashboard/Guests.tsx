import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Mail, MessageSquare, Pencil, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { Guest, MEALS, Rsvp, initials } from "../../lib/data";
import { useApp } from "../../lib/store";
import { EmptyState, Field, Modal, Pill, btn, inputCls, selectCls } from "../ui";

const RSVPS: Rsvp[] = ["confirmed", "pending", "declined"];

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const emptyForm = (): Guest => ({
  id: "", name: "", party: "A", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "",
});

export default function Guests() {
  const { db, setDb, toast } = useApp();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Rsvp>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [messaging, setMessaging] = useState<Guest | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [bulkTable, setBulkTable] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // receive quick actions from the ⌘K palette and the mobile dock
  useEffect(() => {
    const onFocus = (e: Event) => setQ(((e as CustomEvent).detail as string) ?? "");
    const onAdd = () => { setIsNew(true); setEditing(emptyForm()); };
    window.addEventListener("luma:guest-focus", onFocus);
    window.addEventListener("luma:guest-add", onAdd);
    return () => { window.removeEventListener("luma:guest-focus", onFocus); window.removeEventListener("luma:guest-add", onAdd); };
  }, []);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.guests.filter((g) =>
      (filter === "all" || g.rsvp === filter) &&
      (!needle || g.name.toLowerCase().includes(needle) || g.notes.toLowerCase().includes(needle) || (g.plusOne ?? "").toLowerCase().includes(needle)),
    );
  }, [db.guests, q, filter]);

  const counts = useMemo(() => ({
    all: db.guests.length,
    confirmed: db.guests.filter((g) => g.rsvp === "confirmed").length,
    pending: db.guests.filter((g) => g.rsvp === "pending").length,
    declined: db.guests.filter((g) => g.rsvp === "declined").length,
  }), [db.guests]);

  const updateGuest = (g: Guest) => setDb((d) => ({ ...d, guests: d.guests.map((x) => (x.id === g.id ? g : x)) }));
  const cycleRsvp = (g: Guest) => updateGuest({ ...g, rsvp: RSVPS[(RSVPS.indexOf(g.rsvp) + 1) % 3] });

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulk = (fn: (g: Guest) => Guest, message: string) => {
    setDb((d) => ({ ...d, guests: d.guests.map((g) => (selected.includes(g.id) ? fn(g) : g)) }));
    toast(message, `${selected.length} guests updated`);
    setSelected([]);
  };

  const saveEditing = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast("A name makes it real", "Add the guest's name to save.", "warn"); return; }
    if (isNew) {
      setDb((d) => ({ ...d, guests: [{ ...editing, id: `g-${Date.now()}` }, ...d.guests] }));
      toast(`${editing.name} added`, "Your guest list just grew warmer.");
    } else {
      updateGuest(editing);
      toast("Guest updated");
    }
    setEditing(null);
  };

  const remove = (id: string) => {
    const g = db.guests.find((x) => x.id === id);
    setDb((d) => ({ ...d, guests: d.guests.filter((x) => x.id !== id) }));
    setSelected((s) => s.filter((x) => x !== id));
    toast(`${g?.name ?? "Guest"} removed`, undefined, "info");
  };

  const exportCsv = () => {
    const header = "name,party,rsvp,meal,plus_one,table,dietary,notes";
    const lines = rows.map((g) =>
      [g.name, g.party, g.rsvp, g.meal ?? "", g.plusOne ?? "", g.table ?? "", g.dietary ?? "", g.notes]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "luma-guests.csv"; a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported", `${rows.length} rows · open anywhere, but you'll miss Luma.`);
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const start = lines[0]?.toLowerCase().includes("name") ? 1 : 0;
    const added: Guest[] = [];
    for (const line of lines.slice(start)) {
      const [name, party, rsvp, meal, plusOne, table, dietary, notes] = parseCsvLine(line);
      if (!name) continue;
      added.push({
        id: `g-${Date.now()}-${added.length}`,
        name,
        party: party === "B" ? "B" : party === "S" ? "S" : "A",
        rsvp: (["confirmed", "pending", "declined"] as Rsvp[]).includes(rsvp as Rsvp) ? (rsvp as Rsvp) : "pending",
        meal: meal || null, plusOne: plusOne || null, table: table || null, dietary: dietary || null, notes: notes || "",
      });
    }
    if (!added.length) { toast("Nothing to import", "Check that the first column holds guest names.", "warn"); return; }
    setDb((d) => ({ ...d, guests: [...d.guests, ...added] }));
    toast("Guests imported", `${added.length} names joined the list.`);
  };

  const partyTag = (p: Guest["party"]) =>
    p === "A" ? <span className="rounded-full bg-blush-soft px-1.5 py-0.5 text-[0.58rem] font-extrabold text-blush-deep">{db.wedding.partnerA}</span>
    : p === "B" ? <span className="rounded-full bg-sage-soft px-1.5 py-0.5 text-[0.58rem] font-extrabold text-sage-deep">{db.wedding.partnerB}</span>
    : <span className="rounded-full bg-lav-soft px-1.5 py-0.5 text-[0.58rem] font-extrabold text-lav-deep">Shared</span>;

  return (
    <div className="space-y-5">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guests, notes, plus-ones…" className={`${inputCls} pl-10`} aria-label="Search guests" />
        </div>
        <button onClick={() => { setIsNew(true); setEditing(emptyForm()); }} className={`${btn.ink} !py-2.5`}><Plus size={15} /> Add guest</button>
        <button onClick={exportCsv} className={`${btn.outline} !py-2.5`}><Download size={14} /> Export</button>
        <button onClick={() => fileRef.current?.click()} className={`${btn.outline} !py-2.5`}><Upload size={14} /> Import CSV</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="Import CSV file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by RSVP">
        {([["all", "All"], ["confirmed", "Confirmed"], ["pending", "Pending"], ["declined", "Declined"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-2 text-[0.8rem] font-bold transition-all duration-300 cursor-pointer ${filter === k ? "bg-ink text-cream shadow-card" : "border border-ink/15 bg-white/60 text-ink-2 hover:border-ink/40"}`}>
            {label} <span className={filter === k ? "text-gold" : "text-ink-mute"}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* bulk bar */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-gold/40 bg-gold-soft/50 px-4 py-3"
          >
            <span className="text-[0.82rem] font-extrabold text-ink">{selected.length} selected</span>
            <span className="mx-1 h-4 w-px bg-ink/15" />
            <button onClick={() => bulk((g) => ({ ...g, rsvp: "confirmed" }), "Marked confirmed")} className="rounded-full bg-sage px-3.5 py-1.5 text-[0.74rem] font-bold text-ink transition hover:brightness-105 cursor-pointer">Confirm</button>
            <button onClick={() => bulk((g) => ({ ...g, rsvp: "pending" }), "Set to pending")} className="rounded-full bg-blush px-3.5 py-1.5 text-[0.74rem] font-bold text-ink transition hover:brightness-105 cursor-pointer">Pending</button>
            <select value={bulkTable} onChange={(e) => setBulkTable(e.target.value)} className={selectCls} aria-label="Choose table for bulk assign">
              <option value="">Assign table…</option>
              {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button disabled={!bulkTable} onClick={() => { bulk((g) => ({ ...g, table: bulkTable }), "Tables assigned"); setBulkTable(""); }} className="rounded-full bg-lav px-3.5 py-1.5 text-[0.74rem] font-bold text-ink transition hover:brightness-105 disabled:opacity-40 cursor-pointer">Apply table</button>
            <button onClick={() => { setDb((d) => ({ ...d, guests: d.guests.filter((g) => !selected.includes(g.id)) })); toast("Guests removed", `${selected.length} removed from the list`, "info"); setSelected([]); }} className="rounded-full bg-ink/85 px-3.5 py-1.5 text-[0.74rem] font-bold text-cream transition hover:bg-ink cursor-pointer">Delete</button>
            <button onClick={() => setSelected([])} aria-label="Clear selection" className="ml-auto rounded-full p-1.5 text-ink-mute hover:text-ink cursor-pointer"><X size={15} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* table */}
      {db.guests.length === 0 ? (
        <EmptyState
          title="Your guest list is still quiet."
          body="Add your first guest and we'll take it from there — RSVPs, meals, tables, the works."
          action={<button onClick={() => { setIsNew(true); setEditing(emptyForm()); }} className={btn.ink}><Plus size={15} /> Add your first guest</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No guests match" body="Loosen the search or switch the RSVP filter — they're probably in there somewhere." />
      ) : (
        <div className="overflow-x-auto rounded-[1.6rem] border border-white/70 bg-white/60 shadow-sm backdrop-blur-md">
          <table className="w-full min-w-[860px] text-left text-[0.88rem]">
            <thead>
              <tr className="border-b border-ink/8 text-[0.66rem] uppercase tracking-[0.16em] text-ink-mute">
                <th className="w-10 px-4 py-3.5">
                  <input type="checkbox" aria-label="Select all visible guests" className="accent-[#332B31]"
                    checked={selected.length > 0 && rows.every((r) => selected.includes(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                </th>
                <th className="px-3 py-3.5 font-extrabold">Guest</th>
                <th className="px-3 py-3.5 font-extrabold">RSVP</th>
                <th className="px-3 py-3.5 font-extrabold">Meal</th>
                <th className="px-3 py-3.5 font-extrabold">Plus one</th>
                <th className="px-3 py-3.5 font-extrabold">Table</th>
                <th className="px-3 py-3.5 font-extrabold">Notes</th>
                <th className="px-3 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className={`group border-b border-ink/5 transition-colors duration-200 ${selected.includes(g.id) ? "bg-gold-soft/30" : "hover:bg-blush-soft/30"}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${g.name}`} className="accent-[#332B31]" checked={selected.includes(g.id)} onChange={() => toggleSelect(g.id)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-extrabold ${g.party === "A" ? "bg-blush-soft text-blush-deep" : g.party === "B" ? "bg-sage-soft text-sage-deep" : "bg-lav-soft text-lav-deep"}`}>{initials(g.name)}</span>
                      <div>
                        <p className="flex items-center gap-2 font-bold text-ink">{g.name} {partyTag(g.party)}</p>
                        {g.dietary && <p className="text-[0.66rem] font-semibold text-gold-deep">{g.dietary}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => cycleRsvp(g)} title="Click to change RSVP" aria-label={`Change RSVP for ${g.name} — currently ${g.rsvp}; activates the next state`} className="cursor-pointer transition hover:scale-105">
                      <Pill tone={g.rsvp}>{g.rsvp === "confirmed" ? "✓ confirmed" : g.rsvp}</Pill>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <select value={g.meal ?? ""} onChange={(e) => updateGuest({ ...g, meal: e.target.value || null })} className={`${selectCls} !py-1.5 text-[0.78rem]`} aria-label={`Meal for ${g.name}`}>
                      <option value="">—</option>
                      {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 font-semibold text-ink-2">{g.plusOne ?? <span className="text-ink-mute/60">—</span>}</td>
                  <td className="px-3 py-3">
                    <select value={g.table ?? ""} onChange={(e) => updateGuest({ ...g, table: e.target.value || null })} className={`${selectCls} !py-1.5 text-[0.78rem]`} aria-label={`Table for ${g.name}`}>
                      <option value="">Unseated</option>
                      {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-3 text-[0.8rem] font-semibold text-ink-2">{g.notes || <span className="text-ink-mute/60">—</span>}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                      <button onClick={() => { setMessaging(g); setMsgBody(""); }} aria-label={`Message ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-lav-soft hover:text-lav-deep cursor-pointer"><MessageSquare size={14} /></button>
                      <button onClick={() => { setIsNew(false); setEditing({ ...g }); }} aria-label={`Edit ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-gold-soft hover:text-gold-deep cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => remove(g.id)} aria-label={`Remove ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-[0.74rem] font-semibold text-ink-mute"><Users size={13} /> Showing {rows.length} of {db.guests.length} guests · click an RSVP pill to cycle its state</p>

      {/* add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} label={isNew ? "Add guest" : "Edit guest"}>
        {editing && (
          <div className="p-7 sm:p-8">
            <h2 className="font-display text-2xl text-ink">{isNew ? "Add a guest" : `Edit ${editing.name}`}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Full name"><input className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ava Andersson" autoFocus /></Field>
              </div>
              <Field label="Side">
                <select className={`${selectCls} w-full`} value={editing.party} onChange={(e) => setEditing({ ...editing, party: e.target.value as Guest["party"] })}>
                  <option value="A">{db.wedding.partnerA}'s side</option>
                  <option value="B">{db.wedding.partnerB}'s side</option>
                  <option value="S">Shared</option>
                </select>
              </Field>
              <Field label="RSVP">
                <select className={`${selectCls} w-full`} value={editing.rsvp} onChange={(e) => setEditing({ ...editing, rsvp: e.target.value as Rsvp })}>
                  {RSVPS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Meal">
                <select className={`${selectCls} w-full`} value={editing.meal ?? ""} onChange={(e) => setEditing({ ...editing, meal: e.target.value || null })}>
                  <option value="">Not chosen</option>
                  {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Table">
                <select className={`${selectCls} w-full`} value={editing.table ?? ""} onChange={(e) => setEditing({ ...editing, table: e.target.value || null })}>
                  <option value="">Unseated</option>
                  {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
              <Field label="Plus one"><input className={inputCls} value={editing.plusOne ?? ""} onChange={(e) => setEditing({ ...editing, plusOne: e.target.value || null })} placeholder="Partner's name" /></Field>
              <Field label="Dietary"><input className={inputCls} value={editing.dietary ?? ""} onChange={(e) => setEditing({ ...editing, dietary: e.target.value || null })} placeholder="Vegetarian, allergies…" /></Field>
              <div className="sm:col-span-2">
                <Field label="Notes"><textarea className={`${inputCls} min-h-[80px]`} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Seat near the dance floor, old college crew…" /></Field>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-3">
              <button onClick={() => setEditing(null)} className={btn.ghost}>Cancel</button>
              <button onClick={saveEditing} className={btn.ink}>{isNew ? "Add guest" : "Save changes"}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* message modal */}
      <Modal open={!!messaging} onClose={() => setMessaging(null)} label="Message guest">
        {messaging && (
          <div className="p-7 sm:p-8">
            <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink"><Mail size={20} className="text-lav-deep" /> Message {messaging.name.split(" ")[0]}</h2>
            <p className="mt-1 text-[0.82rem] font-semibold text-ink-mute">Delivered by email via Resend — warm, on-brand, trackable.</p>
            <textarea
              className={`${inputCls} mt-5 min-h-[130px]`} value={msgBody} onChange={(e) => setMsgBody(e.target.value)}
              placeholder={`Hi ${messaging.name.split(" ")[0]}, we can't wait to celebrate with you…`} autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setMessaging(null)} className={btn.ghost}>Cancel</button>
              <button
                onClick={() => { if (!msgBody.trim()) { toast("Write a line or two first", undefined, "warn"); return; } setMessaging(null); toast("Message queued", `On its way to ${messaging.name}.`); }}
                className={btn.ink}
              >
                <Mail size={14} /> Send message
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
