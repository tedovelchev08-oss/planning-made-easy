import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Download, Mail, MessageSquare, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { Guest, MEALS, Rsvp } from "../../lib/data";
import { useApp } from "../../lib/store";
import { parseCsvLine, toCsvRow } from "../../lib/csv";
import { FREE_GUEST_WARN_AT, PLANS, can, formatPrice, guestLimit } from "../../lib/plans";
import { useCurrency } from "../../lib/currency";
import { EmptyState, Field, Modal, btn, inputCls, selectCls } from "../ui";

const RSVPS: Rsvp[] = ["confirmed", "pending", "declined"];

const emptyForm = (): Guest => ({
  id: "", name: "", party: "A", rsvp: "pending", meal: null, table: null, seat: null, plusOneOf: null, dietary: null, notes: "",
});

export default function Guests() {
  const { db, setDb, toast, openUpgrade } = useApp();
  const [currency] = useCurrency();
  // room left on the free plan's guest list (Infinity once paid)
  const limit = guestLimit(db.plan);
  const room = limit - db.guests.length;
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

  // receive quick actions from the ⌘K palette and the mobile dock.
  // openEdit closes over db.guests (to load the plus-one draft), so it is a new
  // function every render — calling it through a ref keeps these window
  // listeners subscribed exactly once. Do NOT add openEdit to the deps array:
  // that would tear down and re-add the listeners on every render.
  const openEditRef = useRef<(g: Guest, fresh: boolean) => void>(() => {});
  useEffect(() => {
    const onFocus = (e: Event) => setQ(((e as CustomEvent).detail as string) ?? "");
    const onAdd = () => openEditRef.current(emptyForm(), true);
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
    // new rows this save would create: the guest, and/or a plus-one not yet on the list
    const addsPlusOne = !!plusOneDraft.name.trim() && !db.guests.some((x) => x.plusOneOf === editing.id);
    const needed = (isNew ? 1 : 0) + (addsPlusOne ? 1 : 0);
    if (needed > room) { openUpgrade("unlimitedGuests"); return; } // the form stays open; nothing typed is lost
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
  // keep the palette/dock listener (subscribed once, above) pointed at the
  // freshest openEdit without re-subscribing — see the comment there.
  useEffect(() => {
    openEditRef.current = openEdit;
  });

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
      toCsvRow([g.name, g.party, g.rsvp, g.meal, hostOf(g)?.name, g.table, g.dietary, g.notes]));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "twofold-guests.csv"; a.click();
    URL.revokeObjectURL(url);
    toast("CSV exported", `${rows.length} rows · open anywhere, but you'll miss Twofold.`);
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
    if (added.length > room) {
      // all or nothing: half an import is harder to untangle than none
      toast(
        "This file is bigger than your guest list",
        `It has ${added.length} guests and ${PLANS.essential.name} has room for ${Math.max(0, room)} more. Nothing was imported.`,
        "warn",
      );
      openUpgrade("unlimitedGuests");
      return;
    }
    setDb((d) => ({ ...d, guests: [...d.guests, ...added] }));
    toast("Guests imported", `${added.length} names joined the list.`);
  };

  // the answer, in the words a couple uses
  const ANSWER: Record<Rsvp, { word: string; dot: string }> = {
    confirmed: { word: "Coming", dot: "bg-[#7aa06a]" },
    pending: { word: "Waiting", dot: "bg-[var(--pl-gold)]" },
    declined: { word: "Can’t come", dot: "bg-[#b55a45]" },
  };
  const side = (g: Guest) => (g.party === "A" ? `${db.wedding.partnerA}’s side` : g.party === "B" ? `${db.wedding.partnerB}’s side` : "Both sides");
  const answerChip = (g: Guest) => (
    <button
      onClick={() => cycleRsvp(g)}
      title={g.plusOneOf ? "Follows their host’s answer" : "Tap to change the answer"}
      aria-label={`Change RSVP for ${g.name} — currently ${g.rsvp}; activates the next state`}
      className="inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border border-[var(--pl-line)] px-3 text-[13px] transition hover:border-[rgb(28_26_23/.3)] cursor-pointer"
    >
      <span className={`h-[7px] w-[7px] rounded-full ${ANSWER[g.rsvp].dot}`} aria-hidden="true" />
      {ANSWER[g.rsvp].word}
    </button>
  );
  const plSelect = "h-9 w-full max-w-[190px] rounded-[2px] border border-[var(--pl-line)] bg-transparent px-2 text-[13.5px] text-[var(--pl-ink)] outline-none transition hover:border-[rgb(28_26_23/.3)] focus-visible:border-[var(--pl-bronze)] cursor-pointer";
  const quiet = "inline-flex h-10 items-center gap-2 rounded-[2px] border border-[var(--pl-line)] bg-[var(--pl-card)] px-3.5 text-[13.5px] transition hover:border-[rgb(28_26_23/.3)] cursor-pointer";

  return (
    <div className="space-y-5">
      {/* the page's title, and what you can do here */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Guests</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            {counts.all} invited · {counts.confirmed} coming · {counts.pending} still to answer
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => (room > 0 ? openEdit(emptyForm(), true) : openUpgrade("unlimitedGuests"))} className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer">
            <Plus size={15} strokeWidth={1.8} /> Add a guest
          </button>
          <button onClick={() => (can(db.plan, "exports") ? exportCsv() : openUpgrade("exports"))} className={quiet} aria-label="Export the guest list"><Download size={15} strokeWidth={1.6} /><span className="hidden sm:inline">Export</span></button>
          <button onClick={() => fileRef.current?.click()} className={quiet} aria-label="Import a guest list"><Upload size={15} strokeWidth={1.6} /><span className="hidden sm:inline">Import a list</span></button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="Import CSV file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }} />
        </div>
      </header>

      {/* the free plan's guest limit, mentioned kindly before it's reached */}
      {limit !== Infinity && db.guests.length >= FREE_GUEST_WARN_AT && (
        <div role="status" className="pl-card flex flex-wrap items-center gap-3 px-5 py-4" style={{ boxShadow: `inset 3px 0 0 ${room > 0 ? "#c9a86a" : "#b55a45"}` }}>
          <p className="min-w-0 flex-1 text-[14.5px] text-[var(--pl-ink-2)]">
            {room > 0 ? (
              <><span className="text-[var(--pl-ink)]">Your list is growing.</span> {PLANS.essential.name} has room for {limit} guests, and {room} {room === 1 ? "place is" : "places are"} left.</>
            ) : (
              <><span className="text-[var(--pl-ink)]">You’ve reached the {PLANS.essential.name} guest limit.</span> Everyone on your list stays; upgrading lifts the limit.</>
            )}
          </p>
          <button onClick={() => openUpgrade("unlimitedGuests")} className={room > 0 ? quiet : "inline-flex h-10 items-center rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[13.5px] text-[var(--pl-ivory)] cursor-pointer"}>
            {room > 0 ? `About ${PLANS.celebration.name}` : `Upgrade to ${PLANS.celebration.name}, ${formatPrice(PLANS.celebration.price, currency)} once`}
          </button>
        </div>
      )}

      {/* find someone, or narrow the list by their answer */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pl-ink-2)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest, a note, a plus-one" aria-label="Search guests"
            className="h-10 w-full rounded-[2px] border border-[var(--pl-line)] bg-[var(--pl-card)] pl-9 pr-3 text-[14px] outline-none placeholder:text-[rgb(28_26_23/.42)] focus-visible:border-[var(--pl-bronze)]" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter by RSVP">
          {([["all", "Everyone"], ["confirmed", "Coming"], ["pending", "Waiting"], ["declined", "Can’t come"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
              className={`h-10 shrink-0 whitespace-nowrap rounded-full px-4 text-[13.5px] transition cursor-pointer ${filter === k ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : "border border-[var(--pl-line)] bg-[var(--pl-card)] hover:border-[rgb(28_26_23/.3)]"}`}>
              {label} <span className={`tabular-nums ${filter === k ? "text-[var(--pl-gold)]" : "text-[var(--pl-ink-2)]"}`}>{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* plates the kitchen needs: confirmed guests, plus-ones included */}
      {mealTally.length > 0 && (
        <p className="text-[13.5px] text-[var(--pl-ink-2)]" aria-label="Confirmed meal counts">
          For the kitchen:{" "}
          {mealTally.map(([meal, n], k) => (
            <span key={meal}>{k > 0 && " · "}<span className="text-[var(--pl-ink)]">{meal}</span> <span className="tabular-nums">{n}</span></span>
          ))}
        </p>
      )}

      {/* bulk bar */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="pl-card flex flex-wrap items-center gap-2 px-4 py-3"
          >
            <span className="text-[14px]">{selected.length} selected</span>
            <span className="mx-1 h-4 w-px bg-[var(--pl-line)]" />
            <button onClick={() => bulk((g) => ({ ...g, rsvp: "confirmed" }), "Marked as coming")} className={quiet}>Mark as coming</button>
            <button onClick={() => bulk((g) => ({ ...g, rsvp: "pending" }), "Set to waiting")} className={quiet}>Set to waiting</button>
            <select value={bulkTable} onChange={(e) => setBulkTable(e.target.value)} className={`${plSelect} !h-10`} aria-label="Choose table for bulk assign">
              <option value="">Seat at a table…</option>
              {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button disabled={!bulkTable} onClick={() => { bulk((g) => ({ ...g, table: bulkTable }), "Tables assigned"); setBulkTable(""); }} className={`${quiet} disabled:opacity-40`}>Seat them</button>
            <button onClick={() => { setDb((d) => ({ ...d, guests: d.guests.filter((g) => !selected.includes(g.id)) })); toast("Guests removed", `${selected.length} removed from the list`, "info"); setSelected([]); }} className={`${quiet} text-[#a53d28]`}>Remove</button>
            <button onClick={() => setSelected([])} aria-label="Clear selection" className="ml-auto rounded-full p-2 text-[var(--pl-ink-2)] hover:text-[var(--pl-ink)] cursor-pointer"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {db.guests.length === 0 ? (
        <EmptyState
          title="Your guest list is still empty"
          body="Add the first guest, or import a list you already have. Answers, meals and tables all live here."
          action={<button onClick={() => { setIsNew(true); setEditing(emptyForm()); }} className={btn.ink}><Plus size={15} /> Add the first guest</button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No one matches" body="Try a shorter search, or switch back to Everyone." />
      ) : (
        <>
        {/* phone: one line per guest. Tap the name to edit, the answer to change it */}
        <ul className="pl-card overflow-hidden md:hidden" aria-label="Guests">
          {rows.map((g) => {
            const isPlusOne = !!g.plusOneOf;
            const host = hostOf(g);
            const table = g.table ? db.tables.find((t) => t.id === g.table)?.name : null;
            return (
              <li key={g.id} className={`pl-row flex items-center gap-3 px-4 py-3 ${isPlusOne ? "pl-9" : ""}`}>
                <button onClick={() => openEdit(g, false)} className="min-w-0 flex-1 py-1 text-left cursor-pointer" aria-label={`Edit ${g.name}`}>
                  <span className="block truncate text-[15.5px]">{g.name}</span>
                  <span className="block truncate text-[12.5px] text-[var(--pl-ink-2)]">
                    {[isPlusOne ? `with ${host?.name.split(" ")[0] ?? "a guest"}` : null, g.meal, table ?? (g.rsvp === "confirmed" ? "not seated" : null), g.dietary].filter(Boolean).join(" · ") || side(g)}
                  </span>
                </button>
                {answerChip(g)}
              </li>
            );
          })}
        </ul>

        <div className="pl-card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-[var(--pl-line)] text-[12.5px] text-[var(--pl-ink-2)]">
                <th className="w-12 px-5 py-3.5 font-normal">
                  <input type="checkbox" aria-label="Select all visible guests" className="h-4 w-4 accent-[#0f0e0d]"
                    checked={selected.length > 0 && rows.every((r) => selected.includes(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])} />
                </th>
                <th className="px-3 py-3.5 font-normal">Guest</th>
                <th className="px-3 py-3.5 font-normal">Answer</th>
                <th className="px-3 py-3.5 font-normal">Meal</th>
                <th className="px-3 py-3.5 font-normal">Table</th>
                <th className="px-3 py-3.5 font-normal">Notes</th>
                <th className="px-3 py-3.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => {
                const isPlusOne = !!g.plusOneOf;
                const host = hostOf(g);
                return (
                  <tr key={g.id} className={`group border-b border-[var(--pl-line)] last:border-0 transition-colors ${selected.includes(g.id) ? "bg-[rgb(201_168_106/.12)]" : "hover:bg-[rgb(28_26_23/.025)]"}`}>
                    <td className="px-5 py-3">
                      <input type="checkbox" aria-label={`Select ${g.name}`} className="h-4 w-4 accent-[#0f0e0d]" checked={selected.includes(g.id)} onChange={() => toggleSelect(g.id)} />
                    </td>
                    <td className={`px-3 py-3 ${isPlusOne ? "pl-8" : ""}`}>
                      <span className="block">{g.name}</span>
                      <span className="block text-[12.5px] text-[var(--pl-ink-2)]">
                        {[isPlusOne ? `Plus-one of ${host?.name.split(" ")[0] ?? "a guest"}` : side(g), g.dietary].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">{answerChip(g)}</td>
                    <td className="px-3 py-3">
                      <select value={g.meal ?? ""} onChange={(e) => updateGuest({ ...g, meal: e.target.value || null })} className={plSelect} aria-label={`Meal for ${g.name}`}>
                        <option value="">Not chosen</option>
                        {MEALS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <select value={g.table ?? ""} onChange={(e) => updateGuest({ ...g, table: e.target.value || null, seat: null })} className={plSelect} aria-label={`Table for ${g.name}`}>
                        <option value="">Not seated</option>
                        {db.tables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-[13.5px] text-[var(--pl-ink-2)]">{g.notes || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button onClick={() => { setMessaging(g); setMsgBody(""); }} aria-label={`Message ${g.name}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)] cursor-pointer"><MessageSquare size={15} strokeWidth={1.6} /></button>
                        <button onClick={() => openEdit(g, false)} aria-label={`Edit ${g.name}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)] cursor-pointer"><Pencil size={15} strokeWidth={1.6} /></button>
                        <button onClick={() => remove(g.id)} aria-label={`Remove ${g.name}`} className="rounded-full p-2 text-[var(--pl-ink-2)] transition hover:bg-[rgb(181_90_69/.12)] hover:text-[#a53d28] cursor-pointer"><Trash2 size={15} strokeWidth={1.6} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <p className="text-[13px] text-[var(--pl-ink-2)]">Showing {rows.length} of {db.guests.length} guests. Tap an answer to change it.</p>

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
                  {RSVPS.map((r) => <option key={r} value={r}>{ANSWER[r].word}</option>)}
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
                  <p className="text-[14px] font-medium text-ink">Their plus-one, counted everywhere</p>
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
            {/* Twofold has no email sending — this used to say "Delivered by email via
                Resend" and toast "Message queued" while nothing was sent. */}
            <p className="mt-1 text-[0.82rem] font-semibold text-ink-mute">Write it here, then send it the way you usually reach {messaging.name.split(" ")[0]} — Twofold doesn't send it for you.</p>
            <textarea
              className={`${inputCls} mt-5 min-h-[130px]`} value={msgBody} onChange={(e) => setMsgBody(e.target.value)}
              placeholder={`Hi ${messaging.name.split(" ")[0]}, we can't wait to celebrate with you…`} autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setMessaging(null)} className={btn.ghost}>Cancel</button>
              <a
                href={`mailto:?body=${encodeURIComponent(msgBody)}`}
                onClick={(e) => { if (!msgBody.trim()) { e.preventDefault(); toast("Write a line or two first", undefined, "warn"); } }}
                className={btn.outline}
              >
                <Mail size={14} /> Open in email
              </a>
              <button
                onClick={async () => {
                  if (!msgBody.trim()) { toast("Write a line or two first", undefined, "warn"); return; }
                  try {
                    await navigator.clipboard.writeText(msgBody);
                    toast("Message copied", `Paste it wherever you talk to ${messaging.name.split(" ")[0]}.`);
                  } catch {
                    toast("Copy your message", msgBody, "info");
                  }
                  setMessaging(null);
                }}
                className={btn.ink}
              >
                <Copy size={14} /> Copy message
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
