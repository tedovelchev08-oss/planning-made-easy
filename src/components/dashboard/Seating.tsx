import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Armchair, Leaf, Plus, Search, Settings2, Trash2, Wheat } from "lucide-react";
import { Guest, SeatTable, TableShape, initials } from "../../lib/data";
import { useApp } from "../../lib/store";
import { playChime } from "../../lib/sound";
import { Field, Modal, Pill, btn, inputCls, selectCls } from "../ui";

const SHAPES: { id: TableShape; label: string }[] = [
  { id: "round", label: "Round" },
  { id: "rect", label: "Rectangle" },
  { id: "head", label: "Head table" },
  { id: "sweetheart", label: "Sweetheart" },
];

export default function Seating() {
  const { db, setDb, toast } = useApp();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [seatPicker, setSeatPicker] = useState<{ tableId: string; seat: number } | null>(null);
  const [pickerQ, setPickerQ] = useState("");
  const [settings, setSettings] = useState<SeatTable | null>(null);
  const [addingShape, setAddingShape] = useState(false);

  const seated = useMemo(() => db.guests.filter((g) => g.table), [db.guests]);
  const unassigned = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.guests.filter((g) => g.rsvp === "confirmed" && !g.table && (!needle || g.name.toLowerCase().includes(needle)));
  }, [db.guests, q]);

  const guestsAt = (tableId: string) => db.guests.filter((g) => g.table === tableId);

  const assign = (guestId: string, tableId: string, seat?: number) => {
    const t = db.tables.find((x) => x.id === tableId);
    if (!t) return;
    const at = guestsAt(tableId);
    if (at.length >= t.capacity && !at.some((g) => g.id === guestId)) {
      toast(`${t.name} is full`, "Expand its capacity or choose another table.", "warn");
      return;
    }
    setDb((d) => ({
      ...d,
      guests: d.guests.map((g) => (g.id === guestId ? { ...g, table: tableId, seat } : g)),
    }));
    const g = db.guests.find((x) => x.id === guestId);
    playChime("place");
    toast(`${g?.name} → ${t.name}`, seat !== undefined ? `Seat ${seat + 1}` : undefined);
  };

  const unassign = (guestId: string) => {
    const g = db.guests.find((x) => x.id === guestId);
    setDb((d) => ({ ...d, guests: d.guests.map((x) => (x.id === guestId ? { ...x, table: null } : x)) }));
    toast(`${g?.name ?? "Guest"} unseated`, undefined, "info");
  };

  const addTable = (shape: TableShape) => {
    const n = db.tables.length + 1;
    const t: SeatTable = {
      id: `t-${Date.now()}`,
      name: shape === "round" || shape === "rect" ? `Table ${n}` : shape === "head" ? "Head Table" : "Sweetheart",
      shape,
      capacity: shape === "sweetheart" ? 2 : shape === "head" ? 8 : 8,
      x: 20 + Math.random() * 60,
      y: 20 + Math.random() * 55,
    };
    setDb((d) => ({ ...d, tables: [...d.tables, t] }));
    setAddingShape(false);
    toast(`${t.name} added`, "Drag it anywhere on the floor.");
  };

  const endDrag = (id: string) => (_e: unknown, info: { point: { x: number; y: number } }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((info.point.x - rect.left) / rect.width) * 100));
    const y = Math.min(92, Math.max(8, ((info.point.y - rect.top) / rect.height) * 100));
    setDb((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, x, y } : t)) }));
  };

  const seatPositions = (t: SeatTable, size: { w: number; h: number }) => {
    const pts: { x: number; y: number }[] = [];
    if (t.shape === "round") {
      const r = size.w / 2 + 16;
      for (let i = 0; i < t.capacity; i++) {
        const a = (i / t.capacity) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: size.w / 2 + Math.cos(a) * r - 14, y: size.h / 2 + Math.sin(a) * r - 14 });
      }
    } else if (t.shape === "rect" || t.shape === "head") {
      const top = Math.ceil(t.capacity / 2);
      for (let i = 0; i < top; i++) pts.push({ x: ((i + 0.5) / top) * size.w - 14, y: -22 });
      for (let i = 0; i < t.capacity - top; i++) pts.push({ x: ((i + 0.5) / (t.capacity - top)) * size.w - 14, y: size.h - 6 });
    } else {
      pts.push({ x: size.w / 2 - 42, y: size.h / 2 - 14 });
      pts.push({ x: size.w / 2 + 14, y: size.h / 2 - 14 });
    }
    return pts;
  };

  const tableSize = (t: SeatTable) => {
    if (t.shape === "round") { const s = t.capacity > 8 ? 184 : 156; return { w: s, h: s }; }
    if (t.shape === "head") return { w: Math.max(268, t.capacity * 42), h: 68 };
    if (t.shape === "rect") return { w: Math.max(248, Math.ceil(t.capacity / 2) * 64), h: 68 };
    return { w: 136, h: 70 };
  };

  const pickerTable = seatPicker ? db.tables.find((t) => t.id === seatPicker.tableId) : null;
  const assignable = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase();
    return db.guests.filter((g) => g.rsvp === "confirmed" && (!needle || g.name.toLowerCase().includes(needle)));
  }, [db.guests, pickerQ]);

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-118px)] lg:min-h-[620px] lg:grid-cols-[300px_1fr]">
      {/* left rail */}
      <div className="space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:space-y-0 lg:gap-4">
        <div className="rounded-[1.6rem] border border-white/70 bg-white/60 p-5 backdrop-blur-md lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Unassigned</h2>
            <Pill tone="pending">{unassigned.length}</Pill>
          </div>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest…" className={`${inputCls} !py-2 pl-9 text-[0.85rem]`} aria-label="Search unassigned guests" />
          </div>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:min-h-0 lg:flex-1 lg:flex-col lg:flex-nowrap lg:overflow-x-visible lg:overflow-y-auto lg:pb-0 lg:pr-1">
            {unassigned.length === 0 && (
              <p className="w-full shrink-0 rounded-xl border border-dashed border-ink/15 px-4 py-5 text-center text-[0.8rem] font-semibold text-ink-mute">
                {db.guests.some((g) => g.rsvp === "confirmed" && !g.table) ? "No matches — try another name." : "Everyone confirmed has a seat. Lovely."}
              </p>
            )}
            {unassigned.slice(0, 60).map((g) => (
              <div
                key={g.id} draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", g.id)}
                className="flex shrink-0 cursor-grab items-center gap-2.5 rounded-2xl border border-ink/10 bg-white/85 px-3 py-2 transition hover:border-gold/60 hover:shadow-card active:cursor-grabbing"
                title={g.dietary ? `Dietary: ${g.dietary}` : undefined}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-extrabold ${g.party === "A" ? "bg-blush-soft text-blush-deep" : "bg-sage-soft text-sage-deep"}`}>{initials(g.name)}</span>
                <span className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-ink">{g.name}</span>
                {g.dietary && <span className="text-gold-deep" title={g.dietary}>{g.dietary.toLowerCase().includes("nut") ? <Wheat size={12} /> : <Leaf size={12} />}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/70 bg-white/60 p-5 backdrop-blur-md lg:shrink-0">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.18em] text-ink-mute">Add a table</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {SHAPES.map((s) => (
              <button key={s.id} onClick={() => addTable(s.id)} className="rounded-xl border border-ink/12 bg-white/80 px-3 py-2.5 text-[0.78rem] font-bold text-ink-2 transition hover:border-gold/60 hover:text-ink hover:shadow-sm cursor-pointer">
                + {s.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[0.72rem] leading-relaxed text-ink-mute">
            Drag tables around the floor. Drag guests onto a table, or click any seat to choose who sits there.
          </p>
        </div>
      </div>

      {/* canvas */}
      <div className="overflow-x-auto overscroll-x-contain rounded-[1.8rem] lg:h-full lg:min-h-0">
      <div
        ref={canvasRef}
        className="dotted-canvas relative h-[560px] min-w-[1080px] rounded-[1.8rem] border border-white/70 bg-[#FDF6EA]/70 shadow-inner sm:h-[640px] lg:h-full"
        aria-label="Seating floor — scroll horizontally on smaller screens"
      >
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-ink/90 px-4 py-1.5 text-[0.7rem] font-bold text-cream">
          {seated.length} seated · {db.tables.length} tables
        </div>

        {db.tables.map((t) => {
          const at = guestsAt(t.id);
          const size = tableSize(t);
          const seats = seatPositions(t, size);
          const isSweet = t.shape === "sweetheart";
          return (
            <motion.div
              key={t.id}
              drag
              dragMomentum={false}
              dragElastic={0.08}
              onDragEnd={endDrag(t.id)}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-grab active:z-30 active:cursor-grabbing"
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) assign(id, t.id); }}
                className={`relative shadow-card transition-shadow hover:shadow-lift ${t.shape === "round" ? "rounded-full border-2 border-dashed border-gold/60 bg-white/85" : isSweet ? "rounded-[2rem] border-2 border-blush-deep/50 bg-blush-soft/80" : "rounded-[1.4rem] border-2 border-dashed border-gold/60 bg-white/85"}`}
                style={{ width: size.w, height: size.h }}
              >
                <button onClick={() => setSettings({ ...t })} aria-label={`Settings for ${t.name}`} className="absolute -right-2 -top-2 z-10 rounded-full bg-ink p-1.5 text-cream opacity-70 shadow-card transition hover:bg-gold-deep hover:opacity-100 cursor-pointer">
                  <Settings2 size={12} />
                </button>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="max-w-[80%] truncate font-display text-[0.95rem] text-ink">{t.name}</p>
                  <p className={`text-[0.62rem] font-extrabold ${at.length >= t.capacity ? "text-blush-deep" : "text-ink-mute"}`}>{at.length}/{t.capacity}</p>
                  {isSweet && <span className="mt-0.5 font-display text-[0.68rem] italic text-blush-deep">just the two of us</span>}
                </div>

                {seats.map((pos, i) => {
                  const g = at[i];
                  return (
                    <button
                      key={i}
                      onClick={() => { setSeatPicker({ tableId: t.id, seat: i }); setPickerQ(""); }}
                      aria-label={g ? `Seat ${i + 1} at ${t.name}: ${g.name}` : `Empty seat ${i + 1} at ${t.name}`}
                      title={g ? `${g.name}${g.dietary ? ` · ${g.dietary}` : ""}` : "Empty seat — click to fill"}
                      className={`absolute z-10 flex h-7 w-7 items-center justify-center rounded-full text-[0.56rem] font-extrabold transition-all duration-200 hover:scale-110 cursor-pointer ${
                        g
                          ? `${g.party === "A" ? "bg-blush text-ink" : "bg-sage text-ink"} ring-2 ring-white shadow-sm`
                          : "border-2 border-dashed border-ink/25 bg-cream/60 text-ink-mute/70 hover:border-gold"
                      }`}
                      style={{ left: pos.x, top: pos.y }}
                    >
                      {g ? (
                        <span className="flex items-center gap-0.5">{initials(g.name)}{g.dietary && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}</span>
                      ) : (
                        <Plus size={11} />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}

        <div className="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-white/80 px-5 py-2 text-[0.68rem] font-bold text-ink-mute shadow-sm backdrop-blur">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blush" /> {db.wedding.partnerA}'s side</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-sage" /> {db.wedding.partnerB}'s side</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> dietary note</span>
        </div>
      </div>
      </div>

      {/* seat picker modal */}
      <Modal open={!!seatPicker} onClose={() => setSeatPicker(null)} label="Choose a guest for this seat">
        {seatPicker && pickerTable && (
          <div className="p-7 sm:p-8">
            <h2 className="font-display text-2xl text-ink">Seat at {pickerTable.name}</h2>
            <p className="mt-1 text-[0.82rem] font-semibold text-ink-mute">Seat {seatPicker.seat + 1} · {guestsAt(pickerTable.id)[seatPicker.seat] ? "currently held by " + guestsAt(pickerTable.id)[seatPicker.seat]!.name : "empty"}</p>
            {guestsAt(pickerTable.id)[seatPicker.seat] && (
              <button onClick={() => { unassign(guestsAt(pickerTable.id)[seatPicker.seat]!.id); setSeatPicker(null); }} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blush-soft px-4 py-2 text-[0.78rem] font-bold text-blush-deep transition hover:brightness-105 cursor-pointer">
                <Trash2 size={12} /> Unseat current guest
              </button>
            )}
            <input value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Search confirmed guests…" className={`${inputCls} mt-4`} aria-label="Search guests to seat" autoFocus />
            <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {assignable.filter((g) => g.table === null || g.table === pickerTable.id).slice(0, 40).map((g) => (
                <button
                  key={g.id}
                  onClick={() => { assign(g.id, pickerTable.id); setSeatPicker(null); }}
                  className="flex w-full items-center gap-3 rounded-xl border border-ink/8 bg-white/80 px-3 py-2.5 text-left transition hover:border-gold/60 hover:shadow-sm cursor-pointer"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.58rem] font-extrabold ${g.party === "A" ? "bg-blush-soft text-blush-deep" : "bg-sage-soft text-sage-deep"}`}>{initials(g.name)}</span>
                  <span className="flex-1">
                    <span className="block text-[0.85rem] font-bold text-ink">{g.name}</span>
                    {g.dietary && <span className="text-[0.68rem] font-semibold text-gold-deep">{g.dietary}</span>}
                  </span>
                  {g.table === pickerTable.id && <Pill tone="confirmed">here</Pill>}
                </button>
              ))}
              {assignable.filter((g) => g.table === null).length === 0 && (
                <p className="rounded-xl border border-dashed border-ink/15 px-4 py-6 text-center text-[0.82rem] font-semibold text-ink-mute">No unseated confirmed guests match.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* table settings modal */}
      <Modal open={!!settings} onClose={() => setSettings(null)} label="Table settings">
        {settings && (
          <div className="p-7 sm:p-8">
            <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink"><Armchair size={20} className="text-gold-deep" /> {settings.name}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input className={inputCls} value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} />
              </Field>
              <Field label="Shape">
                <select className={`${selectCls} w-full`} value={settings.shape} onChange={(e) => setSettings({ ...settings, shape: e.target.value as TableShape })}>
                  {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Capacity">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSettings({ ...settings, capacity: Math.max(2, settings.capacity - 1) })} className="h-10 w-10 rounded-full border border-ink/15 text-lg font-bold text-ink transition hover:border-ink/40 cursor-pointer">−</button>
                  <span className="w-8 text-center font-display text-xl text-ink">{settings.capacity}</span>
                  <button onClick={() => setSettings({ ...settings, capacity: Math.min(14, settings.capacity + 1) })} className="h-10 w-10 rounded-full border border-ink/15 text-lg font-bold text-ink transition hover:border-ink/40 cursor-pointer">+</button>
                </div>
              </Field>
            </div>
            <div className="mt-7 flex justify-between">
              <button
                onClick={() => {
                  setDb((d) => ({ ...d, tables: d.tables.filter((t) => t.id !== settings.id), guests: d.guests.map((g) => (g.table === settings.id ? { ...g, table: null } : g)) }));
                  toast(`${settings.name} removed`, "Its guests are back in the tray.", "info");
                  setSettings(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.8rem] font-bold text-blush-deep transition hover:bg-blush-soft cursor-pointer"
              >
                <Trash2 size={13} /> Remove table
              </button>
              <div className="flex gap-3">
                <button onClick={() => setSettings(null)} className={btn.ghost}>Cancel</button>
                <button onClick={() => { setDb((d) => ({ ...d, tables: d.tables.map((t) => (t.id === settings.id ? settings : t)) })); toast("Table updated"); setSettings(null); }} className={btn.ink}>Save</button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
