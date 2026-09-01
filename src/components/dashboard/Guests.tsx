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
  id: "", name: "", party: "A", rsvp: "pending", meal: null, table: null, seat: null, plusOneOf: null, dietary: null, notes: "",
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
  /** draft for the host's linked plus-one while the edit modal is open */
  const [plusOneDraft, setPlusOneDraft] = useState<{ name: string; meal: string | null }>({ name: "", meal: null });

  const hostOf = (g: Guest) => (g.plusOneOf ? db.guests.find((x) => x.id === g.plusOneOf) ?? null : null);
  const plusOneOfHost = (hostId: string) => db.guests.find((x) => x.plusOneOf === hostId) ?? null;

  /** filtered rows, with each plus-one tucked directly under its host */
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = (g: Guest, host?: Guest | null) =>
      (filter === "all" || g.rsvp === filter || (host != null && host.rsvp === filter)) &&
      (!needle
        || g.name.toLowerCase().includes(needle)
        || g.notes.toLowerCase().includes(needle)
        || (host?.name.toLowerCase().includes(needle) ?? false));
    const out: Guest[] = [];
    for (const g of db.guests) {
      if (g.plusOneOf) continue; // plus-ones are emitted beside their host
      if (!matches(g)) continue;
      out.push(g);
      const po = plusOneOfHost(g.id);
      if (po && matches(po, g)) out.push(po);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.guests, q, filter]);

  /** confirmed headcount per meal — plus-ones count as real plates */
  const mealTally = useMemo(() => {
    const t = new Map<string, number>();
    for (const g of db.guests) {
      if (g.rsvp === "confirmed" && g.meal) t.set(g.meal, (t.get(g.meal) ?? 0) + 1);
    }
    return [...t.entries()].sort((a, b) => b[1] - a[1]);
  }, [db.guests]);

  // receive quick actions from the ⌘K palette and the mobile dock
  useEffect(() => {
    const onFocus = (e: Event) => setQ(((e as CustomEvent).detail as string) ?? "");
    const onAdd = () => openEdit(emptyForm(), true);
    window.addEventListener("luma:guest-focus", onFocus);
    window.addEventListener("luma:guest-add", onAdd);
    return () => { window.removeEventListener("luma:guest-focus", onFocus); window.removeEventListener("luma:guest-add", onAdd); };
  }, []);

  const counts = useMemo(() => ({
    all: db.guests.length,
    confirmed: db.guests.filter((g) => g.rsvp === "confirmed").length,
    pending: db.guests.filter((g) => g.rsvp === "pending").length,
    declined: db.guests.filter((g) => g.rsvp === "declined").length,
  }), [db.guests]);

  const updateGuest = (g: Guest) => setDb((d) => ({ ...d, guests: d.guests.map((x) => (x.id === g.id ? g : x)) }));

  /** cycling a host's RSVP carries their plus-one along — one answer, one party */
  const cycleRsvp = (g: Guest) => {
    const next = RSVPS[(RSVPS.indexOf(g.rsvp) + 1) % 3];
    setDb((d) => ({
      ...d,
      guests: d.guests.map((x) =>
        x.id === g.id ? { ...x, rsvp: next } : x.plusOneOf === g.id ? { ...x, rsvp: next } : x,
      ),
    }));
  };

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulk = (fn: (g: Guest) => Guest, message: string) => {
    setDb((d) => ({ ...d, guests: d.guests.map((g) => (selected.includes(g.id) ? fn(g) : g)) }));
    toast(message, `${selected.length} guests updated`);
    setSelected([]);
  };

  /** create / update / drop the linked plus-one record to match the draft */
  const reconcilePlusOne = (guests: Guest[], hostId: string, host: Guest): Guest[] => {
    const existing = guests.find((x) => x.plusOneOf === hostId);
    const wantName = plusOneDraft.name.trim();
    if (!wantName) return existing ? guests.filter((x) => x.id !== existing.id) : guests;
    if (existing) {
      return guests.map((x) => (x.id === existing.id ? { ...x, name: wantName, meal: plusOneDraft.meal, rsvp: host.rsvp, party: host.party } : x));
    }
    const po: Guest = {
      id: `g-${Date.now()}-po`, name: wantName, party: host.party, rsvp: host.rsvp,
      meal: plusOneDraft.meal, table: host.table, seat: null, plusOneOf: hostId,
      dietary: null, notes: `Plus-one of ${host.name.split(" ")[0]}`,
    };
    return [...guests, po];
  };

  const saveEditing = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast("A name makes it real", "Add the guest's name to save.", "warn"); return; }
    if (isNew) {
      const id = `g-${Date.now()}`;
      const host = { ...editing, id };
      setDb((d) => ({ ...d, guests: reconcilePlusOne([host, ...d.guests], id, host) }));
      toast(`${editing.name} added`, plusOneDraft.name.trim() ? "Plus-one saved as a real guest." : "Your guest list just grew warmer.");
    } else {
      setDb((d) => ({
        ...d,
        guests: reconcilePlusOne(d.guests.map((x) => (x.id === editing.id ? editing : x)), editing.id, editing),
      }));
      toast("Guest updated");
    }
    setEditing(null);
  };

  const openEdit = (g: Guest, fresh: boolean) => {
    setIsNew(fresh);
    setEditing({ ...g });
    const po = fresh ? null : db.guests.find((x) => x.plusOneOf === g.id);
    setPlusOneDraft({ name: po?.name ?? "", meal: po?.meal ?? null });
  };

  /** removing a host also releases their plus-one */
  const remove = (id: string) => {
    const g = db.guests.find((x) => x.id === id);
    setDb((d) => ({ ...d, guests: d.guests.filter((x) => x.id !== id && x.plusOneOf !== id) }));
    setSelected((s) => s.filter((x) => x !== id));
    toast(`${g?.name ?? "Guest"} removed`, undefined, "info");
  };

  const exportCsv = () => {
    const header = "name,party,rsvp,meal,plus_one_of,table,dietary,notes";
    const lines = rows.map((g) =>
      [g.name, g.party, g.rsvp, g.meal ?? "", hostOf(g)?.name ?? "", g.table ?? "", g.dietary ?? "", g.notes]
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
    // imported guests that name a table land in its lowest free seat
    const seatCount = new Map<string, number>();
    for (const g of db.guests) if (g.table && g.seat !== null) seatCount.set(g.table, Math.max(seatCount.get(g.table) ?? 0, g.seat + 1));
    for (const line of lines.slice(start)) {
      const [name, party, rsvp, meal, plusOneOf, table, dietary, notes] = parseCsvLine(line);
      if (!name) continue;
      const tbl = table || null;
      let seat: number | null = null;
      if (tbl) { seat = seatCount.get(tbl) ?? 0; seatCount.set(tbl, seat + 1); }
      // link plus-ones to an already-imported host by name
      const host = plusOneOf ? added.find((a) => a.name.toLowerCase() === plusOneOf.toLowerCase()) : null;
      added.push({
        id: `g-${Date.now()}-${added.length}`,
        name,
        party: party === "B" ? "B" : party === "S" ? "S" : "A",
        rsvp: (["confirmed", "pending", "declined"] as Rsvp[]).includes(rsvp as Rsvp) ? (rsvp as Rsvp) : "pending",
        meal: meal || null, table: tbl, seat, plusOneOf: host?.id ?? null, dietary: dietary || null, notes: notes || "",
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
        <button onClick={() => openEdit(emptyForm(), true)} className={`${btn.ink} !py-2.5`}><Plus size={15} /> Add guest</button>
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
      {/* confirmed plates per meal — plus-ones count as real guests */}
      {mealTally.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Confirmed meal counts">
          <span className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-ink-mute">Plates</span>
          {mealTally.map(([meal, n]) => (
            <span key={meal} className="rounded-full border border-sage/50 bg-sage-soft/60 px-3 py-1 text-[0.72rem] font-extrabold text-sage-deep">
              {meal} · {n}
            </span>
          ))}
        </div>
      )}

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
              {rows.map((g) => {
                const isPlusOne = !!g.plusOneOf;
                const host = hostOf(g);
                const ownPlusOne = isPlusOne ? null : plusOneOfHost(g.id);
                return (
                  <tr key={g.id} className={`group border-b border-ink/5 transition-colors duration-200 ${isPlusOne ? "bg-cream/60" : ""} ${selected.includes(g.id) ? "bg-gold-soft/30" : !isPlusOne ? "hover:bg-blush-soft/30" : ""}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" aria-label={`Select ${g.name}`} className="accent-[#332B31]" checked={selected.includes(g.id)} onChange={() => toggleSelect(g.id)} />
                    </td>
                    <td className="px-3 py-3">
                      <div className={`flex items-center gap-3 ${isPlusOne ? "pl-6" : ""}`}>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-extrabold ${isPlusOne ? "bg-gold-soft text-gold-deep" : g.party === "A" ? "bg-blush-soft text-blush-deep" : g.party === "B" ? "bg-sage-soft text-sage-deep" : "bg-lav-soft text-lav-deep"}`}>
                          {isPlusOne ? "+1" : initials(g.name)}
                        </span>
                        <div>
                          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                            {g.name}
                            {isPlusOne
                              ? <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[0.58rem] font-extrabold text-gold-deep">+1 of {host?.name.split(" ")[0] ?? "guest"}</span>
                              : partyTag(g.party)}
                          </p>
                          {g.dietary && <p className="text-[0.66rem] font-semibold text-gold-deep">{g.dietary}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button onClick={() => cycleRsvp(g)} title={isPlusOne ? "Mirrors the host's RSVP" : "Click to change RSVP"} aria-label={`Change RSVP for ${g.name} — currently ${g.rsvp}; activates the next state`} className="cursor-pointer transition hover:scale-105">
                        <Pill tone={g.rsvp}>{g.rsvp === "confirmed" ? "✓ confirmed" : g.rsvp}</Pill>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <select value={g.meal ?? ""} onChange={(e) => updateGuest({ ...g, meal: e.target.value || null })} className={`${selectCls} !py-1.5 text-[0.78rem]`} aria-label={`Meal for ${g.name}`}>
                        <option value="">—</option>
                        {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3 font-semibold text-ink-2">
                      {isPlusOne
                        ? <span className="text-ink-mute/60">—</span>
                        : ownPlusOne ? ownPlusOne.name : <span className="text-ink-mute/60">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <select value={g.table ?? ""} onChange={(e) => updateGuest({ ...g, table: e.target.value || null, seat: null })} className={`${selectCls} !py-1.5 text-[0.78rem]`} aria-label={`Table for ${g.name}`}>
                        <option value="">Unseated</option>
                        {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-3 text-[0.8rem] font-semibold text-ink-2">{g.notes || <span className="text-ink-mute/60">—</span>}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
                        <button onClick={() => { setMessaging(g); setMsgBody(""); }} aria-label={`Message ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-lav-soft hover:text-lav-deep cursor-pointer"><MessageSquare size={14} /></button>
                        <button onClick={() => openEdit(g, false)} aria-label={`Edit ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-gold-soft hover:text-gold-deep cursor-pointer"><Pencil size={14} /></button>
                        <button onClick={() => remove(g.id)} aria-label={`Remove ${g.name}`} className="rounded-full p-2 text-ink-mute transition hover:bg-blush-soft hover:text-blush-deep cursor-pointer"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              <Field label="Dietary"><input className={inputCls} value={editing.dietary ?? ""} onChange={(e) => setEditing({ ...editing, dietary: e.target.value || null })} placeholder="Vegetarian, allergies…" /></Field>
              <div className="sm:col-span-2">
                <Field label="Notes"><textarea className={`${inputCls} min-h-[80px]`} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Seat near the dance floor, old college crew…" /></Field>
              </div>
              {editing.plusOneOf === null && (
                <div className="rounded-2xl border border-gold/35 bg-gold-soft/35 p-4 sm:col-span-2">
                  <p className="text-[0.66rem] font-extrabold uppercase tracking-[0.16em] text-gold-deep">Plus-one · counted everywhere</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <input className={inputCls} value={plusOneDraft.name} onChange={(e) => setPlusOneDraft({ ...plusOneDraft, name: e.target.value })} placeholder="Their name (blank = no plus-one)" aria-label="Plus-one name" />
                    <select className={`${selectCls} w-full`} value={plusOneDraft.meal ?? ""} onChange={(e) => setPlusOneDraft({ ...plusOneDraft, meal: e.target.value || null })} aria-label="Plus-one meal">
                      <option value="">Meal — not chosen</option>
                      {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <p className="mt-2 text-[0.68rem] font-semibold text-ink-2">Saved as a real guest — included in headcount, meals and seating. Mirrors this guest's RSVP.</p>
                </div>
              )}
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
