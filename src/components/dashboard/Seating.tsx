import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "framer-motion";
import { AlertTriangle, ChevronDown, Lock, Plus, Printer, Search, Trash2, X } from "lucide-react";
import {
  FloorObject, FloorObjectKind, Guest, SeatTable, TableShape, TableSkin,
  TABLE_SKINS, VENUE_KINDS, initials, venueKind,
} from "../../lib/data";
import { useApp } from "../../lib/store";
import { PLANS, can } from "../../lib/plans";
import { playChime } from "../../lib/sound";
import { Field, Modal, inputCls, selectCls } from "../ui";
import SeatingSheet from "./SeatingSheet";

/**
 * Seating: the room coming together.
 *
 * Three views of one plan. The room (the floor seen from above) leads on a
 * laptop; table cards lead on a phone, where a whole floor is too small to
 * work on; the board is the A-to-Z "find your seat" list, which is also
 * what the venue gets. In every view you pick a guest, then a seat or a
 * table: no dragging needed, so it works the same with a thumb, a mouse
 * or a keyboard (dragging still works on a laptop).
 */

const SHAPES: { id: TableShape; label: string }[] = [
  { id: "round", label: "Round table" },
  { id: "rect", label: "Long table" },
  { id: "head", label: "Head table" },
  { id: "sweetheart", label: "Sweetheart table" },
];

/**
 * How each surface paints. Pure CSS gradients: the floor can hold twenty
 * tables and they cost nothing to download.
 */
const SKIN: Record<TableSkin, { surface: string; ring: string; ink: string; sub: string }> = {
  linen: { surface: "linear-gradient(145deg,#FFFDFA 0%,#FBF4EA 55%,#F4E9D8 100%)", ring: "rgb(122 92 40 / 0.32)", ink: "#1c1a17", sub: "#6b5d48" },
  marble: { surface: "linear-gradient(140deg,#FDFDFC 0%,#F2F1EE 40%,#FAFAF8 62%,#ECEBE7 100%)", ring: "rgb(120 120 130 / 0.3)", ink: "#2E2E33", sub: "#5f5f68" },
  oak: { surface: "linear-gradient(135deg,#C89B6A 0%,#B98A58 30%,#C49466 52%,#AE7E4D 100%)", ring: "rgb(90 58 28 / 0.4)", ink: "#2c1c0e", sub: "#4f3a22" },
  noir: { surface: "linear-gradient(145deg,#2A2621 0%,#1A1815 55%,#0F0E0D 100%)", ring: "rgb(201 168 106 / 0.5)", ink: "#f7f2e8", sub: "rgb(247 242 232 / 0.72)" },
};

const skinOf = (t: SeatTable): TableSkin => t.skin ?? "linen";

/** Snap a percentage to the same 1% grid dragging commits to. */
export const snapPct = (v: number) => Math.round(v * 100) / 100;

/**
 * Clamp a centre position so the whole element stays on the floor, measuring
 * the element rather than assuming a size. Shared by dragging and by the
 * keyboard nudge so both land in exactly the same place.
 */
function clampToFloor(el: HTMLElement | null, canvas: HTMLElement | null, xPct: number, yPct: number): { x: number; y: number } | null {
  if (!el || !canvas) return null;
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!c.width || !c.height) return null;
  const halfW = (r.width / 2 / c.width) * 100;
  const halfH = (r.height / 2 / c.height) * 100;
  return {
    x: snapPct(Math.min(100 - halfW, Math.max(halfW, xPct))),
    y: snapPct(Math.min(100 - halfH, Math.max(halfH, yPct))),
  };
}

/**
 * Arrow keys move whatever is focused; Shift jumps five times as far.
 * WCAG 2.2 (Dragging Movements) asks for a single-pointer alternative to any
 * drag; this is it for tables and room objects.
 */
export function arrowDelta(key: string, shift: boolean): { dx: number; dy: number } | null {
  const step = shift ? 5 : 1;
  if (key === "ArrowLeft") return { dx: -step, dy: 0 };
  if (key === "ArrowRight") return { dx: step, dy: 0 };
  if (key === "ArrowUp") return { dx: 0, dy: -step };
  if (key === "ArrowDown") return { dx: 0, dy: step };
  return null;
}

/**
 * A table's name with its numbers in lining figures: Italiana's old-style
 * "1" reads as "ı", which won't do on a chart the venue reads.
 */
function TableName({ name }: { name: string }) {
  return <>{name.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <span key={i} className="font-sans font-light tabular-nums" style={{ fontSize: "0.86em" }}>{part}</span> : part))}</>;
}

/** First names, or the whole name when there's only one word. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* ------------------------------ the room's furniture ------------------------------ */

/**
 * A room object (dance floor, bar…), drawn like an architect's plan: a
 * hairline outline and its name in italic, under the tables.
 */
function VenueNode({ obj, canvasRef, onMove, onOpen, announce }: {
  obj: FloorObject;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onMove: (x: number, y: number) => void;
  onOpen: () => void;
  announce: (msg: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const name = obj.label || venueKind(obj.kind).label;

  const commit = () => {
    const canvas = canvasRef.current;
    const el = ref.current;
    if (!canvas || !el) return;
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const next = clampToFloor(el, canvas, ((r.left + r.width / 2 - c.left) / c.width) * 100, ((r.top + r.height / 2 - c.top) / c.height) * 100);
    if (next) onMove(next.x, next.y);
    x.set(0);
    y.set(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const d = arrowDelta(e.key, e.shiftKey);
    if (!d) return;
    e.preventDefault();
    const next = clampToFloor(ref.current, canvasRef.current, obj.x + d.dx, obj.y + d.dy);
    if (!next) return;
    onMove(next.x, next.y);
    announce(`${name} moved to ${Math.round(next.x)} percent across, ${Math.round(next.y)} percent down`);
  };

  return (
    <motion.div
      drag dragMomentum={false} dragElastic={0.06} onDragEnd={commit} onKeyDown={onKeyDown}
      tabIndex={0} role="group" aria-label={`${name}. Arrow keys to move, shift for larger steps.`}
      style={{ left: `${obj.x}%`, top: `${obj.y}%`, width: `${obj.w}%`, height: `${obj.h}%`, x, y }}
      className="absolute z-0 cursor-grab focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pl-bronze)] active:cursor-grabbing"
    >
      <div ref={ref} className="h-full w-full -translate-x-1/2 -translate-y-1/2">
        <button
          onClick={onOpen}
          aria-label={`${name}: edit or remove`}
          className={`flex h-full w-full items-center justify-center rounded-[3px] border text-center transition hover:bg-white/40 ${obj.kind === "entrance" ? "border-dashed" : ""} ${obj.kind === "dance" ? "bg-[repeating-linear-gradient(45deg,rgb(122_92_40/.06)_0_12px,transparent_12px_24px)]" : "bg-white/25"}`}
          style={{ borderColor: "rgb(122 92 40 / 0.4)" }}
        >
          <span className="px-2 font-accent text-[15px] italic text-[#5c4a2e]">{name}</span>
        </button>
      </div>
    </motion.div>
  );
}

/** Rough sizes as a share of the floor, for keeping new things apart. */
const footprint = (shape: TableShape) =>
  shape === "head" ? { w: 30, h: 14 } : shape === "rect" ? { w: 26, h: 14 } : shape === "sweetheart" ? { w: 14, h: 10 } : { w: 17, h: 24 };

/**
 * The first spot on a loose grid that touches neither a table nor a room
 * object. It used to look only at tables, by a rough width, so a new table
 * could land on the stage or half on a neighbour.
 */
export function freeSpot(size: { w: number; h: number }, tables: SeatTable[], objects: FloorObject[]): { x: number; y: number } {
  const boxes = [
    ...tables.map((t) => ({ x: t.x, y: t.y, ...footprint(t.shape) })),
    ...objects.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h })),
  ];
  const inX = (x: number) => x >= size.w / 2 + 1 && x <= 100 - size.w / 2 - 1;
  const inY = (y: number) => y >= size.h / 2 + 1 && y <= 100 - size.h / 2 - 1;
  for (const y of [22, 40, 58, 76, 90].filter(inY)) {
    for (const x of [14, 32, 50, 68, 86].filter(inX)) {
      const clash = boxes.some((b) => Math.abs(b.x - x) < (b.w + size.w) / 2 + 1 && Math.abs(b.y - y) < (b.h + size.h) / 2 + 1);
      if (!clash) return { x, y };
    }
  }
  // no clear spot left: the one furthest from everything, never on top of a table
  let best = { x: 50, y: 50 }, room = -1;
  for (let y = 8; y <= 92; y += 4) {
    for (let x = 8; x <= 92; x += 4) {
      if (!inX(x) || !inY(y)) continue;
      const gap = Math.min(...boxes.map((bx) => Math.max(Math.abs(bx.x - x) / ((bx.w + size.w) / 2), Math.abs(bx.y - y) / ((bx.h + size.h) / 2))));
      if (gap > room) { room = gap; best = { x, y }; }
    }
  }
  return best;
}

/**
 * One draggable table. Its own component so each table owns its motion
 * values; the drop commits the element's measured centre, never the
 * pointer, so where it was grabbed doesn't matter.
 */
function TableNode({ table, canvasRef, onMove, announce, children }: {
  table: SeatTable;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onMove: (x: number, y: number) => void;
  announce: (msg: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const commit = () => {
    const canvas = canvasRef.current;
    const el = ref.current;
    if (!canvas || !el) return;
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const halfW = r.width / 2;
    const halfH = r.height / 2;
    const px = Math.min(c.width - halfW, Math.max(halfW, r.left + halfW - c.left));
    const py = Math.min(c.height - halfH, Math.max(halfH, r.top + halfH - c.top));
    onMove(snapPct((px / c.width) * 100), snapPct((py / c.height) * 100));
    x.set(0);
    y.set(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // a seat inside has its own keys
    const d = arrowDelta(e.key, e.shiftKey);
    if (!d) return;
    e.preventDefault();
    const next = clampToFloor(ref.current, canvasRef.current, table.x + d.dx, table.y + d.dy);
    if (!next) return;
    onMove(next.x, next.y);
    announce(`${table.name} moved to ${Math.round(next.x)} percent across, ${Math.round(next.y)} percent down`);
  };

  return (
    <motion.div
      drag dragMomentum={false} dragElastic={0.08} onDragEnd={commit} onKeyDown={onKeyDown}
      tabIndex={0} role="group" aria-label={`${table.name}. Arrow keys to move, shift for larger steps.`}
      style={{ left: `${table.x}%`, top: `${table.y}%`, x, y }}
      className="absolute z-10 cursor-grab rounded-full focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-[var(--pl-bronze)] active:z-30 active:cursor-grabbing"
    >
      <div ref={ref} className="-translate-x-1/2 -translate-y-1/2">{children}</div>
    </motion.div>
  );
}

/**
 * Where each table is drawn: where it was put, nudged just enough that no
 * two tables' chairs touch, and kept on the floor. Positions in %, sizes
 * as half-extents in px; a few rounds of pushing overlapping pairs apart.
 */
type Footprint = { id: string; x: number; y: number; hw: number; hh: number };

export function layoutTables(tables: Footprint[], floor: { w: number; h: number }): Map<string, { x: number; y: number }> {
  return settle(tables, floor).at;
}

/**
 * The room keeps its size and proportion. Tables are first nudged apart at
 * the natural scale; only a room genuinely too full for its floor draws its
 * furniture a little smaller, step by step, until no two chairs touch.
 */
export function roomLayout(footprints: (scale: number) => Footprint[], floor: { w: number; h: number }, base: number, min: number) {
  for (let sc = base; sc >= min - 1e-9; sc -= 0.04) {
    const r = settle(footprints(sc), floor);
    if (r.clear) return { scale: sc, at: r.at };
  }
  return { scale: min, at: settle(footprints(min), floor).at };
}

function settle(tables: Footprint[], floor: { w: number; h: number }): { at: Map<string, { x: number; y: number }>; clear: boolean } {
  const pts = tables.map((t) => ({ id: t.id, x: (t.x / 100) * floor.w, y: (t.y / 100) * floor.h, hw: t.hw, hh: t.hh }));
  const keepIn = (p: (typeof pts)[number]) => {
    p.x = Math.min(floor.w - p.hw, Math.max(p.hw, p.x));
    p.y = Math.min(floor.h - p.hh, Math.max(p.hh, p.y));
  };
  pts.forEach(keepIn);
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        const ox = a.hw + b.hw + 6 - Math.abs(a.x - b.x);
        const oy = a.hh + b.hh + 6 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        // push along the axis that needs the smaller move
        if (ox < oy) { const d = (ox / 2) * (a.x <= b.x ? 1 : -1); a.x -= d; b.x += d; }
        else { const d = (oy / 2) * (a.y <= b.y ? 1 : -1); a.y -= d; b.y += d; }
        keepIn(a); keepIn(b);
      }
    }
    if (!moved) break;
  }
  const clear = pts.every((a, i) => pts.every((b, j) => j <= i || Math.abs(a.x - b.x) >= a.hw + b.hw + 2 || Math.abs(a.y - b.y) >= a.hh + b.hh + 2));
  return { at: new Map(pts.map((p) => [p.id, { x: (p.x / floor.w) * 100, y: (p.y / floor.h) * 100 }])), clear };
}

/** the two of them, at the sweetheart table: two linked rings */
function CoupleRings({ a, b }: { a: string; b: string }) {
  return (
    <span className="flex items-center gap-1.5" aria-label={`${a} and ${b}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pl-onyx)] text-[11px] font-medium text-[var(--pl-gold)]">{initials(a)}</span>
      <svg width="22" height="14" viewBox="0 0 22 14" aria-hidden="true"><circle cx="7.5" cy="7" r="5.5" fill="none" stroke="#c9a86a" strokeWidth="1.4" /><circle cx="14.5" cy="7" r="5.5" fill="none" stroke="#7a5c28" strokeWidth="1.4" /></svg>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--pl-onyx)] text-[11px] font-medium text-[var(--pl-gold)]">{initials(b)}</span>
    </span>
  );
}

type View = "room" | "tables" | "board";

function useIsPhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 899px)").matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 899px)");
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone;
}

export default function Seating() {
  const { db, setDb, toast, openUpgrade } = useApp();
  const phone = useIsPhone();
  const [view, setView] = useState<View>(() => (typeof window !== "undefined" && window.matchMedia?.("(max-width: 899px)").matches ? "tables" : "room"));
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [floor, setFloor] = useState({ w: 1000, h: 640 });
  const [q, setQ] = useState("");
  /** the guest picked to seat next: then tap a seat or a table */
  const [picked, setPicked] = useState<string | null>(null);
  const [seatPicker, setSeatPicker] = useState<{ tableId: string; seat: number } | null>(null);
  const [pickerQ, setPickerQ] = useState("");
  const [tableOpen, setTableOpen] = useState<string | null>(null);
  const [settings, setSettings] = useState<SeatTable | null>(null);
  const [venueEdit, setVenueEdit] = useState<FloorObject | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** a removed table, kept for a few seconds so it can come back */
  const [undo, setUndo] = useState<{ table: SeatTable; seats: { id: string; seat: number | null }[] } | null>(null);
  const [liveMsg, setLiveMsg] = useState("");
  /** the seat just filled, for its small settling moment */
  const [justSeated, setJustSeated] = useState<string | null>(null);
  useEffect(() => {
    if (!justSeated) return;
    const t = window.setTimeout(() => setJustSeated(null), 1200);
    return () => window.clearTimeout(t);
  }, [justSeated]);
  const { partnerA, partnerB } = db.wedding;

  // the floor scales its furniture to its own width, so it never needs a sideways scroll
  useEffect(() => {
    // a phone's room has a fixed size to pan around; a laptop's follows its card
    if (phone) { setFloor({ w: 1200, h: 860 }); return; }
    const el = frameRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setFloor({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, phone]);

  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 9000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const confirmed = useMemo(() => db.guests.filter((g) => g.rsvp === "confirmed"), [db.guests]);
  const toPlace = useMemo(() => confirmed.filter((g) => !g.table), [confirmed]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return toPlace.filter((g) => !needle || g.name.toLowerCase().includes(needle));
  }, [toPlace, q]);
  const seatedCount = confirmed.length - toPlace.length;
  const pickedGuest = picked ? db.guests.find((g) => g.id === picked) ?? null : null;
  const guestsAt = (tableId: string) => db.guests.filter((g) => g.table === tableId);
  const isSweet = (t: SeatTable) => t.shape === "sweetheart";

  /** seat a guest: at a given seat if it's free, otherwise the lowest free one */
  const assign = (guestId: string, tableId: string, seat?: number) => {
    const t = db.tables.find((x) => x.id === tableId);
    const guest = db.guests.find((x) => x.id === guestId);
    if (!t || !guest) return;
    if (isSweet(t)) { toast("That's your table", `${partnerA} and ${partnerB} sit there.`, "info"); return; }
    const taken = new Set(db.guests.filter((g) => g.table === tableId && g.id !== guestId && g.seat !== null).map((g) => g.seat as number));
    let next = seat !== undefined && seat < t.capacity && !taken.has(seat) ? seat : undefined;
    if (next === undefined) for (let i = 0; i < t.capacity; i++) if (!taken.has(i)) { next = i; break; }
    if (next === undefined) { toast(`${t.name} is full`, "Make it bigger, or choose another table.", "warn"); return; }
    setDb((d) => ({ ...d, guests: d.guests.map((g) => (g.id === guestId ? { ...g, table: tableId, seat: next ?? null } : g)) }));
    playChime("place");
    setPicked(null);
    setJustSeated(guestId);
    setLiveMsg(`${guest.name} seated at ${t.name}, seat ${next + 1}`);
    toast(`${guest.name} → ${t.name}`, `Seat ${next + 1}`);
  };

  const unassign = (guestId: string) => {
    const g = db.guests.find((x) => x.id === guestId);
    setDb((d) => ({ ...d, guests: d.guests.map((x) => (x.id === guestId ? { ...x, table: null, seat: null } : x)) }));
    toast(`${g?.name ?? "Guest"} is back on the list`, undefined, "info");
  };

  const addTable = (shape: TableShape) => {
    const n = db.tables.filter((t) => t.shape === "round" || t.shape === "rect").length + 1;
    const t: SeatTable = {
      id: `t-${Date.now()}`,
      name: shape === "round" || shape === "rect" ? `Table ${n}` : shape === "head" ? "Head Table" : "Sweetheart",
      shape,
      capacity: shape === "sweetheart" ? 2 : 8,
      ...freeSpot(footprint(shape), db.tables, db.venueObjects ?? []),
    };
    setDb((d) => ({ ...d, tables: [...d.tables, t] }));
    setAddOpen(false);
    toast(`${t.name} added`, view === "room" ? "Drag it, or use the arrow keys, to place it." : undefined);
  };

  const addVenueObject = (kind: FloorObjectKind) => {
    const meta = venueKind(kind);
    const o: FloorObject = { id: `vo-${Date.now()}`, kind, label: "", w: meta.w, h: meta.h, ...freeSpot({ w: meta.w, h: meta.h }, db.tables, db.venueObjects ?? []) };
    setDb((d) => ({ ...d, venueObjects: [...(d.venueObjects ?? []), o] }));
    setAddOpen(false);
    if (view !== "room") setView("room");
    toast(`${meta.label} added`, "Drag it into place.");
  };

  const removeTable = (t: SeatTable) => {
    const seats = db.guests.filter((g) => g.table === t.id).map((g) => ({ id: g.id, seat: g.seat }));
    setDb((d) => ({ ...d, tables: d.tables.filter((x) => x.id !== t.id), guests: d.guests.map((g) => (g.table === t.id ? { ...g, table: null, seat: null } : g)) }));
    setUndo({ table: t, seats });
    setSettings(null);
    setTableOpen(null);
  };
  const restoreTable = () => {
    if (!undo) return;
    const back = new Map(undo.seats.map((s) => [s.id, s.seat]));
    setDb((d) => ({
      ...d,
      tables: [...d.tables, undo.table],
      guests: d.guests.map((g) => (back.has(g.id) && !g.table ? { ...g, table: undo.table.id, seat: back.get(g.id) ?? null } : g)),
    }));
    toast(`${undo.table.name} is back`);
    setUndo(null);
  };

  const moveVenueObject = (id: string) => (x: number, y: number) =>
    setDb((d) => ({ ...d, venueObjects: d.venueObjects.map((o) => (o.id === id ? { ...o, x, y } : o)) }));
  const moveTable = (id: string) => (x: number, y: number) =>
    setDb((d) => ({ ...d, tables: d.tables.map((t) => (t.id === id ? { ...t, x, y } : t)) }));

  const SEAT = 32;
  const tableSize = (t: SeatTable) => {
    if (t.shape === "round") { const s = t.capacity > 8 ? 132 : 116; return { w: s, h: s }; }
    if (t.shape === "head") return { w: Math.max(280, t.capacity * 46), h: 70 };
    if (t.shape === "rect") return { w: Math.max(250, Math.ceil(t.capacity / 2) * 66), h: 70 };
    return { w: 150, h: 76 };
  };
  // a phone pans across a room drawn at full size, so every seat is a thumb's
  // width; a laptop draws it a little smaller, never below 80%, and moves
  // tables apart rather than shrinking the room into specks
  const layout = useMemo(() => roomLayout((sc) => db.tables.map((t) => {
    const z = tableSize(t);
    const ring = t.shape === "round" ? 16 + SEAT : t.shape === "sweetheart" ? 0 : SEAT + 4;
    return { id: t.id, x: t.x, y: t.y, hw: (z.w / 2 + (t.shape === "round" ? ring : 0)) * sc, hh: (z.h / 2 + ring) * sc };
  }), floor, phone ? 1 : Math.max(0.8, Math.min(1, floor.w / 1080)), phone ? 0.9 : 0.62),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [db.tables, floor.w, floor.h, phone]);
  const scale = layout.scale;
  const placed = layout.at;

  // a phone opens the room on its tables, not on an empty corner of the floor
  const framed = useRef(false);
  useEffect(() => {
    if (!phone || view !== "room" || framed.current || placed.size === 0) return;
    const el = frameRef.current;
    if (!el) return;
    const pts = [...placed.values()];
    const cx = (pts.reduce((a, p) => a + p.x, 0) / pts.length / 100) * floor.w;
    const cy = (pts.reduce((a, p) => a + p.y, 0) / pts.length / 100) * floor.h;
    el.scrollTo({ left: Math.max(0, cx - el.clientWidth / 2), top: Math.max(0, cy - el.clientHeight / 2) });
    framed.current = true;
  }, [phone, view, placed, floor.w, floor.h]);
  useEffect(() => { if (view !== "room") framed.current = false; }, [view]);

  const seatPositions = (t: SeatTable, size: { w: number; h: number }, n: number) => {
    const pts: { x: number; y: number }[] = [];
    if (t.shape === "round") {
      const r = size.w / 2 + 16 + SEAT / 2 - 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: size.w / 2 + Math.cos(a) * r - SEAT / 2, y: size.h / 2 + Math.sin(a) * r - SEAT / 2 });
      }
    } else {
      const top = Math.ceil(n / 2);
      for (let i = 0; i < top; i++) pts.push({ x: ((i + 0.5) / top) * size.w - SEAT / 2, y: -SEAT - 4 });
      for (let i = 0; i < n - top; i++) pts.push({ x: ((i + 0.5) / (n - top)) * size.w - SEAT / 2, y: size.h + 4 });
    }
    return pts;
  };

  const pickerTable = seatPicker ? db.tables.find((t) => t.id === seatPicker.tableId) : null;
  const openTable = tableOpen ? db.tables.find((t) => t.id === tableOpen) ?? null : null;
  const assignable = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase();
    return confirmed.filter((g) => !needle || g.name.toLowerCase().includes(needle));
  }, [confirmed, pickerQ]);

  /** seat chosen from the picker: seat this guest exactly here; whoever held it goes back to the list */
  const seatHere = (g: Guest, tableId: string, seat: number) => {
    const t = db.tables.find((x) => x.id === tableId);
    if (!t) return;
    const holder = db.guests.find((x) => x.table === tableId && x.seat === seat && x.id !== g.id);
    setDb((d) => ({
      ...d,
      guests: d.guests.map((x) => {
        if (holder && x.id === holder.id) return { ...x, table: null, seat: null };
        if (x.id === g.id) return { ...x, table: tableId, seat };
        return x;
      }),
    }));
    playChime("place");
    setJustSeated(g.id);
    toast(`${g.name} → ${t.name}`, `Seat ${seat + 1}`);
    setSeatPicker(null);
    setPicked(null);
  };

  const onSeat = (t: SeatTable, i: number, holder: Guest | undefined) => {
    if (pickedGuest && !holder) { assign(pickedGuest.id, t.id, i); return; }
    setSeatPicker({ tableId: t.id, seat: i });
    setPickerQ("");
  };

  const print = () => (can(db.plan, "exports") ? window.print() : openUpgrade("exports"));
  const quiet = "inline-flex h-10 items-center gap-2 rounded-[2px] border border-[var(--pl-line)] bg-[var(--pl-card)] px-3.5 text-[13.5px] transition hover:border-[rgb(28_26_23/.3)] cursor-pointer";
  const sideOf = (g: Guest) => (g.party === "A" ? `${partnerA}’s side` : g.party === "B" ? `${partnerB}’s side` : "Both sides");
  const everyone = confirmed.length > 0 && toPlace.length === 0;

  /* ------------------------------ pieces ------------------------------ */

  /** one guest waiting for a seat: tap to pick, drag on a laptop */
  const guestChip = (g: Guest, compact = false) => {
    const on = picked === g.id;
    return (
      <button
        key={g.id}
        type="button"
        draggable={!phone}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", g.id)}
        onClick={() => setPicked(on ? null : g.id)}
        aria-pressed={on}
        className={`flex shrink-0 items-center gap-2.5 text-left transition cursor-pointer ${compact ? "h-11 rounded-full px-4 text-[14px]" : "w-full px-5 py-2.5 text-[14.5px]"} ${
          on ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : compact ? "bg-[var(--pl-card)] ring-1 ring-[var(--pl-line)] hover:ring-[rgb(28_26_23/.3)]" : "hover:bg-[rgb(28_26_23/.04)]"
        }`}
      >
        {!compact && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${on ? "bg-[var(--pl-gold)] text-[var(--pl-onyx)]" : "bg-[#e4d6bb] text-[#5c4a2e]"}`} aria-hidden="true">
            {g.plusOneOf ? "+1" : initials(g.name)}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate">{g.name}</span>
        {!compact && g.dietary && <span className={`shrink-0 font-accent text-[14px] italic ${on ? "text-[var(--pl-gold)]" : "text-[#6b5d48]"}`}>{g.dietary.toLowerCase()}</span>}
      </button>
    );
  };

  /** the list of guests still to place, grouped by side */
  const toPlaceList = (
    <section className="pl-card flex min-h-0 flex-col" aria-labelledby="toplace-h">
      <div className="px-5 pb-3 pt-5">
        <h2 id="toplace-h" className="flex items-baseline justify-between font-display text-[26px] leading-none">
          To place <span className="font-sans text-[13px] tabular-nums text-[var(--pl-ink-2)]">{toPlace.length}</span>
        </h2>
        <div className="relative mt-3">
          <Search size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pl-ink-2)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest" aria-label="Search guests still to place"
            className="h-11 w-full rounded-[2px] border border-[var(--pl-line)] bg-transparent pl-9 pr-3 text-[14px] outline-none placeholder:text-[rgb(28_26_23/.5)] focus-visible:border-[var(--pl-bronze)]" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {toPlace.length === 0 ? (
          <p className="px-5 py-4 text-[14.5px] text-[var(--pl-ink-2)]">Everyone who's coming has a seat.</p>
        ) : shown.length === 0 ? (
          <p className="px-5 py-4 text-[14.5px] text-[var(--pl-ink-2)]">No one by that name is waiting for a seat.</p>
        ) : (
          (["A", "B", "S"] as const).map((p) => {
            const list = shown.filter((g) => g.party === p);
            if (!list.length) return null;
            return (
              <div key={p}>
                <p className="px-5 pb-1 pt-3 text-[13px] text-[var(--pl-ink-2)]">{p === "A" ? `${partnerA}’s side` : p === "B" ? `${partnerB}’s side` : "Both sides"}</p>
                {list.map((g) => guestChip(g))}
              </div>
            );
          })
        )}
      </div>
      <p className="border-t border-[var(--pl-line)] px-5 py-3 text-[13px] leading-snug text-[var(--pl-ink-2)]">
        {pickedGuest ? <>Now tap a seat or a table for <span className="text-[var(--pl-ink)]">{firstName(pickedGuest.name)}</span>.</> : "Tap a name, then a seat. Or drag it onto a table."}
      </p>
    </section>
  );

  /** a table drawn on the floor */
  const tableOnFloor = (t: SeatTable) => {
    const at = guestsAt(t.id);
    const size = tableSize(t);
    const sweet = isSweet(t);
    const over = at.length > t.capacity;
    const n = sweet ? 0 : Math.max(t.capacity, at.length);
    const seats = seatPositions(t, size, n);
    // anyone without a numbered seat, or beyond the last one, still gets a place to be seen
    const bySeat = new Map(at.filter((g) => g.seat !== null && g.seat < n).map((g) => [g.seat as number, g]));
    const loose = at.filter((g) => g.seat === null || g.seat >= n || bySeat.get(g.seat) !== g);
    let li = 0;
    const skin = SKIN[skinOf(t)];
    const hot = !!pickedGuest && !sweet && at.length < t.capacity;
    return (
      <TableNode key={t.id} table={{ ...t, ...(placed.get(t.id) ?? {}) }} canvasRef={canvasRef} onMove={moveTable(t.id)} announce={setLiveMsg}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "center" }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) assign(id, t.id); }}
            className={`relative transition-shadow ${t.shape === "round" ? "rounded-full" : "rounded-[6px]"}`}
            style={{
              width: size.w, height: size.h,
              background: sweet ? "linear-gradient(145deg,#1c1a17,#0f0e0d)" : skin.surface,
              boxShadow: `0 0 0 ${hot ? 2 : 1}px ${hot ? "#c9a86a" : over ? "#b55a45" : sweet ? "rgb(201 168 106 / .55)" : skin.ring}, 0 16px 26px -18px rgb(60 40 15 / .55), inset 0 1px 0 rgb(255 255 255 / .5)`,
            }}
          >
            <button
              type="button"
              onClick={() => (pickedGuest && !sweet ? assign(pickedGuest.id, t.id) : setTableOpen(t.id))}
              aria-label={pickedGuest && !sweet ? `Seat ${pickedGuest.name} at ${t.name}` : `${t.name}: ${at.length} of ${t.capacity}${over ? ", over capacity" : ""}. Open the table`}
              className={`absolute inset-3 flex flex-col items-center justify-center text-center cursor-pointer ${t.shape === "round" ? "rounded-full" : "rounded-[4px]"}`}
            >
              {sweet ? (
                <>
                  <CoupleRings a={partnerA} b={partnerB} />
                  <span className="mt-1 font-accent text-[13px] italic text-[var(--pl-gold)]">{partnerA} &amp; {partnerB}</span>
                </>
              ) : (
                <>
                  <span className="max-w-[90%] truncate font-display text-[19px] leading-tight" style={{ color: skin.ink }}><TableName name={t.name} /></span>
                  <span className="mt-0.5 flex items-center gap-1 text-[12px] tabular-nums" style={{ color: over ? "#a53d28" : skin.sub }}>
                    {over && <AlertTriangle size={11} aria-hidden="true" />}
                    {at.length} of {t.capacity}{over && <span> · too many</span>}
                  </span>
                </>
              )}
            </button>
            {seats.map((pos, i) => {
              const g = bySeat.get(i) ?? (i >= t.capacity ? loose[li++] : undefined);
              const extra = i >= t.capacity;
              return (
                <button
                  key={i} type="button"
                  onClick={() => onSeat(t, i, g)}
                  aria-label={g ? `Seat ${i + 1} at ${t.name}: ${g.name}${g.plusOneOf ? " (plus-one)" : ""}${g.dietary ? `, ${g.dietary}` : ""}` : pickedGuest ? `Seat ${pickedGuest.name} in seat ${i + 1} at ${t.name}` : `Empty seat ${i + 1} at ${t.name}`}
                  title={g ? `${g.name}${g.dietary ? ` · ${g.dietary}` : ""}` : undefined}
                  className={`absolute z-10 flex items-center justify-center rounded-full text-[11.5px] font-medium transition-transform hover:scale-110 ${g && g.id === justSeated ? "pl-seat-in" : ""} ${phone ? "before:absolute before:-inset-[5px] before:content-['']" : ""} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pl-bronze)] cursor-pointer ${
                    g
                      ? `${extra ? "bg-[#7c2f22] text-[#f6e3dc]" : "bg-[var(--pl-onyx)] text-[var(--pl-gold)]"} ${g.plusOneOf ? "ring-2 ring-[var(--pl-gold)]" : ""}`
                      : hot ? "bg-[rgb(201_168_106/.2)] ring-2 ring-[var(--pl-gold)]" : "bg-[rgb(255_255_255/.45)] ring-[1.4px] ring-[rgb(122_92_40/.6)]"
                  }`}
                  style={{ left: pos.x, top: pos.y, width: SEAT, height: SEAT }}
                >
                  {g ? (g.plusOneOf ? "+1" : initials(g.name)) : <Plus size={12} className="text-[#7a5c28]" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </TableNode>
    );
  };

  const room = (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:h-[calc(100dvh-210px)] lg:min-h-[600px] lg:grid-cols-[290px_minmax(0,1fr)]">
      <div className="hidden min-h-0 lg:flex">{toPlaceList}</div>
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div ref={frameRef} className={`pl-card relative min-h-0 ${phone ? "h-[calc(100svh-360px)] min-h-[320px] flex-none overflow-auto overscroll-contain" : "flex-1 overflow-hidden"}`}>
          <div
            ref={canvasRef}
            className={phone ? "relative h-[860px] w-[1200px]" : "relative h-full min-h-[480px] w-full"}
            style={{ background: "radial-gradient(120% 90% at 50% 0%, #fbf6ec, #f1e8d6)", backgroundImage: "radial-gradient(rgb(122 92 40 / .12) 1px, transparent 1.2px), radial-gradient(120% 90% at 50% 0%, #fbf6ec, #f1e8d6)", backgroundSize: "22px 22px, auto" }}
            aria-label="The room, seen from above"
          >
            <p className="sr-only" role="status" aria-live="polite">{liveMsg}</p>
            {(db.venueObjects ?? []).map((o) => (
              <VenueNode key={o.id} obj={o} canvasRef={canvasRef} onMove={moveVenueObject(o.id)} onOpen={() => setVenueEdit({ ...o })} announce={setLiveMsg} />
            ))}
            {db.tables.map(tableOnFloor)}
          </div>
        </div>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-[var(--pl-ink-2)]">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--pl-onyx)]" aria-hidden="true" /> seated</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-[1.4px] ring-[rgb(122_92_40/.6)]" aria-hidden="true" /> empty seat</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--pl-onyx)] ring-2 ring-[var(--pl-gold)]" aria-hidden="true" /> plus-one</span>
          <span>{phone ? "Swipe to move around the room. Tap a name below, then a seat." : "Drag a table, or select it and use the arrow keys."}</span>
        </p>
      </div>
    </div>
  );

  const tables = (
    <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
      <div className="hidden lg:block lg:max-h-[calc(100dvh-210px)] lg:min-h-0 [&>section]:h-full">{toPlaceList}</div>
      <div className="gap-3 sm:columns-2 xl:columns-3 [&>section]:mb-3 [&>section]:break-inside-avoid">
        {db.tables.map((t) => {
          const at = guestsAt(t.id);
          const sweet = isSweet(t);
          const over = at.length > t.capacity;
          const room = Math.max(0, t.capacity - at.length);
          const canTake = !!pickedGuest && !sweet && room > 0;
          return (
            <section
              key={t.id} className={`pl-card flex flex-col transition-shadow ${canTake ? "shadow-[0_0_0_2px_#c9a86a]" : over ? "shadow-[0_0_0_1.5px_#b55a45]" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) assign(id, t.id); }}
              aria-label={t.name}
            >
              <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
                <h3 className="truncate font-display text-[26px] leading-none"><TableName name={t.name} /></h3>
                <span className={`shrink-0 text-[13px] tabular-nums ${over ? "text-[#a53d28]" : "text-[var(--pl-ink-2)]"}`}>{sweet ? "the two of you" : `${at.length} of ${t.capacity}`}</span>
              </div>
              {!sweet && (
                <div className="mx-5 mt-3 flex gap-[3px]" aria-hidden="true">
                  {Array.from({ length: Math.max(t.capacity, at.length) }, (_, i) => (
                    <span key={i} className={`h-[4px] flex-1 rounded-full ${i < at.length ? (i >= t.capacity ? "bg-[#b55a45]" : "bg-[var(--pl-bronze)]") : "bg-[rgb(28_26_23/.1)]"}`} />
                  ))}
                </div>
              )}
              <ul className="mt-2 flex-1 px-2 pb-2">
                {sweet ? (
                  <li className="flex items-center gap-3 px-3 py-2"><CoupleRings a={partnerA} b={partnerB} /><span className="font-accent text-[16px] italic text-[var(--pl-ink-2)]">{partnerA} &amp; {partnerB}</span></li>
                ) : at.map((g) => (
                  <li key={g.id} className={`group flex items-center gap-2 rounded-[2px] px-3 py-1.5 hover:bg-[rgb(28_26_23/.03)] ${g.id === justSeated ? "pl-row-in" : ""}`}>
                    <span className="min-w-0 flex-1 truncate text-[14.5px]">{g.name}</span>
                    {g.dietary && <span className="shrink-0 font-accent text-[14px] italic text-[#6b5d48]">{g.dietary.toLowerCase()}</span>}
                    <button type="button" onClick={() => unassign(g.id)} aria-label={`Take ${g.name} off ${t.name}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.06)] hover:text-[var(--pl-ink)] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 cursor-pointer">
                      <X size={15} strokeWidth={1.6} />
                    </button>
                  </li>
                ))}
              </ul>
              {!sweet && (
                <div className="flex items-center gap-2 border-t border-[var(--pl-line)] px-3 py-2">
                  {canTake ? (
                    <button type="button" onClick={() => assign(pickedGuest!.id, t.id)} className="h-11 flex-1 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[14px] text-[var(--pl-ivory)] cursor-pointer">
                      Seat {firstName(pickedGuest!.name)} here
                    </button>
                  ) : (
                    <span className="flex-1 px-2 text-[13px] text-[var(--pl-ink-2)]">{over ? `${at.length - t.capacity} too many` : room ? `Room for ${room}` : "Full"}</span>
                  )}
                  <button type="button" onClick={() => setSettings({ ...t })} className="h-11 rounded-[2px] px-3 text-[13.5px] text-[var(--pl-bronze)] underline underline-offset-4 cursor-pointer">Edit</button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );

  // the A-to-Z board guests read at the door, and the quickest place to fix one name
  const board = (() => {
    const bySurname = [...confirmed].sort((a, b) => (a.name.split(" ").slice(-1)[0] ?? "").localeCompare(b.name.split(" ").slice(-1)[0] ?? "") || a.name.localeCompare(b.name));
    const letters = new Map<string, Guest[]>();
    for (const g of bySurname) {
      const L = (g.name.split(" ").slice(-1)[0]?.[0] ?? "#").toUpperCase();
      letters.set(L, [...(letters.get(L) ?? []), g]);
    }
    return (
      <section className="pl-card relative px-5 py-7 sm:px-10" aria-label="The seating board">
        <span className="pointer-events-none absolute inset-2.5 border border-[rgb(122_92_40/.3)]" aria-hidden="true" />
        <h2 className="text-center font-display text-[34px] leading-none">Please find <i className="font-accent text-[0.62em] text-[var(--pl-bronze)]">your</i> seat</h2>
        <p className="mt-2 text-center font-accent text-[17px] italic text-[var(--pl-ink-2)]">{db.wedding.names}</p>
        <div className="mt-7 gap-10 sm:columns-2 xl:columns-3">
          {[...letters.entries()].map(([L, list]) => (
            <div key={L} className="mb-4 break-inside-avoid">
              <p className="font-display text-[26px] leading-none text-[var(--pl-bronze)]">{L}</p>
              <ul className="mt-1">
                {list.map((g) => {
                  const surname = g.name.split(" ").slice(-1)[0];
                  const given = g.name.split(" ").slice(0, -1).join(" ");
                  return (
                    <li key={g.id} className="flex items-center gap-2 py-1 text-[14.5px]">
                      <span className="shrink-0">{given ? `${surname}, ${given}` : g.name}</span>
                      <span className="min-w-[10px] flex-1 translate-y-[3px] border-b border-dotted border-[rgb(122_92_40/.5)]" aria-hidden="true" />
                      <select
                        value={g.table ?? ""} aria-label={`Table for ${g.name}`}
                        onChange={(e) => (e.target.value ? assign(g.id, e.target.value) : unassign(g.id))}
                        className={`max-w-[150px] shrink-0 cursor-pointer appearance-none rounded-full bg-transparent py-1 text-right outline-none focus-visible:ring-2 focus-visible:ring-[var(--pl-bronze)] ${g.table ? "pr-1 font-accent text-[16px] italic text-[var(--pl-bronze)]" : "border border-dashed border-[rgb(122_92_40/.6)] px-3 text-[13px] text-[#6b4a14]"}`}
                      >
                        <option value="">choose a table</option>
                        {db.tables.filter((t) => !isSweet(t)).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    );
  })();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[40px] leading-none sm:text-[46px]">Seating</h1>
          <p className="mt-2 text-[15px] text-[var(--pl-ink-2)]">
            <span className="tabular-nums text-[var(--pl-ink)]">{seatedCount} of {confirmed.length}</span> seated · {db.tables.length} tables
            {toPlace.length > 0 && <> · <span className="tabular-nums text-[var(--pl-ink)]">{toPlace.length}</span> still to place</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full bg-[var(--pl-card)] p-1 ring-1 ring-[var(--pl-line)]" role="tablist" aria-label="View">
            {(["room", "tables", "board"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`h-9 rounded-full px-4 text-[13.5px] transition cursor-pointer ${view === v ? "bg-[var(--pl-onyx)] text-[var(--pl-ivory)]" : "hover:bg-[rgb(28_26_23/.05)]"}`}>
                {v === "room" ? "Room" : v === "tables" ? "Tables" : "Board"}
              </button>
            ))}
          </div>
          <button onClick={print} className={quiet}><Printer size={15} strokeWidth={1.6} /> <span className="hidden sm:inline">Print for the venue</span><span className="sm:hidden">Print</span></button>
          <div className="relative">
            <button onClick={() => setAddOpen((o) => !o)} aria-expanded={addOpen} className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[12px] font-medium uppercase tracking-[0.14em] text-[var(--pl-ivory)] transition hover:bg-[#2a2622] cursor-pointer">
              <Plus size={15} strokeWidth={1.8} /> Add <ChevronDown size={14} strokeWidth={1.6} />
            </button>
            <AnimatePresence>
              {addOpen && (
                <>
                  <motion.button className="fixed inset-0 z-30 cursor-default" exit={{ pointerEvents: "none" }} aria-label="Close" onClick={() => setAddOpen(false)} />
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-[3px] bg-[var(--pl-card)] py-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/.45)] ring-1 ring-[var(--pl-line)]">
                    <p className="px-4 pb-1 pt-1.5 text-[12.5px] text-[var(--pl-ink-2)]">A table</p>
                    {SHAPES.map((s) => <button key={s.id} onClick={() => addTable(s.id)} className="block w-full px-4 py-2.5 text-left text-[14px] hover:bg-[rgb(28_26_23/.05)] cursor-pointer">{s.label}</button>)}
                    <p className="mt-1 border-t border-[var(--pl-line)] px-4 pb-1 pt-2.5 text-[12.5px] text-[var(--pl-ink-2)]">Something in the room</p>
                    {VENUE_KINDS.map((v) => <button key={v.id} onClick={() => addVenueObject(v.id)} title={v.hint} className="block w-full px-4 py-2.5 text-left text-[14px] hover:bg-[rgb(28_26_23/.05)] cursor-pointer">{v.label}</button>)}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* everyone has a seat: the two rings close */}
      {everyone && (
        <section className="pl-card flex flex-wrap items-center gap-5 px-6 py-5" aria-live="polite">
          <svg width="64" height="40" viewBox="0 0 64 40" aria-hidden="true" className="shrink-0">
            <circle cx="24" cy="20" r="15" fill="none" stroke="#c9a86a" strokeWidth="1.6" />
            <circle cx="40" cy="20" r="15" fill="none" stroke="#7a5c28" strokeWidth="1.6" className="pl-rings-close" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[28px] leading-none">Everyone has a seat</p>
            <p className="mt-1.5 text-[14.5px] text-[var(--pl-ink-2)]">All {confirmed.length} guests who are coming have a place.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView("board")} className={quiet}>See the board</button>
            <button onClick={print} className="inline-flex h-10 items-center gap-2 rounded-[2px] bg-[var(--pl-onyx)] px-4 text-[13.5px] text-[var(--pl-ivory)] cursor-pointer"><Printer size={15} strokeWidth={1.6} /> Print for the venue</button>
          </div>
        </section>
      )}

      {undo && (
        <div className="pl-card flex items-center gap-3 px-5 py-3 text-[14.5px]" role="status">
          <span className="flex-1">{undo.table.name} removed{undo.seats.length ? `; ${undo.seats.length} ${undo.seats.length === 1 ? "guest is" : "guests are"} back on the list` : ""}.</span>
          <button onClick={restoreTable} className="h-10 rounded-[2px] px-3 text-[14px] text-[var(--pl-bronze)] underline underline-offset-4 cursor-pointer">Undo</button>
        </div>
      )}

      {view === "room" ? room : view === "tables" ? tables : board}

      {/* phone: who's still to place, always at hand above the tabs */}
      {phone && view !== "board" && toPlace.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-30 border-t border-[var(--pl-line)] bg-[var(--pl-card)] shadow-[0_-12px_30px_-18px_rgb(0_0_0/.45)]" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
          <p className="px-4 pt-2.5 text-[13px] text-[var(--pl-ink-2)]">
            {pickedGuest ? <>Seating <span className="text-[var(--pl-ink)]">{pickedGuest.name}</span>: tap a {view === "room" ? "seat" : "table"}. <button onClick={() => setPicked(null)} className="text-[var(--pl-bronze)] underline underline-offset-4">Cancel</button></> : <>To place · <span className="tabular-nums">{toPlace.length}</span>. Tap a name, then a table.</>}
          </p>
          <div className="flex items-center gap-2 px-4 pt-2">
            <div className="relative min-w-0 flex-1">
              <Search size={15} strokeWidth={1.6} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--pl-ink-2)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a guest" aria-label="Search guests still to place"
                className="h-11 w-full rounded-full border border-[var(--pl-line)] bg-transparent pl-9 pr-3 text-[15px] outline-none placeholder:text-[rgb(28_26_23/.5)] focus-visible:border-[var(--pl-bronze)]" />
            </div>
          </div>
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-2">
            {shown.length ? shown.map((g) => guestChip(g, true)) : <span className="py-3 text-[14px] text-[var(--pl-ink-2)]">No one by that name is waiting for a seat.</span>}
          </div>
        </div>
      )}
      {phone && view !== "board" && toPlace.length > 0 && <div className="h-40" aria-hidden="true" />}

      {/* one table, opened: who sits there */}
      <Modal open={!!openTable} onClose={() => setTableOpen(null)} label={openTable?.name ?? "Table"}>
        {openTable && (() => {
          const at = guestsAt(openTable.id);
          const sweet = isSweet(openTable);
          return (
            <div className="p-7 sm:p-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[30px] leading-none text-ink"><TableName name={openTable.name} /></h2>
                <span className="text-[13.5px] text-ink-2">{sweet ? "the two of you" : `${at.length} of ${openTable.capacity}`}</span>
              </div>
              {sweet ? (
                <div className="mt-5 flex items-center gap-3"><CoupleRings a={partnerA} b={partnerB} /><span className="font-accent text-[17px] italic text-ink-2">Kept for {partnerA} and {partnerB}.</span></div>
              ) : (
                <ul className="mt-4 divide-y divide-ink/10">
                  {at.length === 0 && <li className="py-3 text-[14.5px] text-ink-2">No one here yet. Pick a name on the list, then tap this table.</li>}
                  {at.map((g) => (
                    <li key={g.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1"><span className="block text-[15px]">{g.name}</span><span className="block text-[12.5px] text-ink-2">{[g.plusOneOf ? "plus-one" : sideOf(g), g.meal, g.dietary].filter(Boolean).join(" · ")}</span></span>
                      <button onClick={() => unassign(g.id)} className="h-10 rounded-[2px] px-3 text-[13.5px] text-[#7a5c28] underline underline-offset-4 cursor-pointer">Take off</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex flex-wrap justify-between gap-3">
                <button onClick={() => removeTable(openTable)} className="inline-flex h-10 items-center gap-1.5 rounded-[2px] px-3 text-[14px] text-[#a53d28] hover:bg-[rgb(181_90_69/.1)] cursor-pointer"><Trash2 size={15} strokeWidth={1.6} /> Remove table</button>
                <div className="flex gap-2">
                  <button onClick={() => { setSettings({ ...openTable }); setTableOpen(null); }} className="inline-flex h-11 items-center rounded-[2px] border border-ink/15 px-4 text-[14px] transition hover:border-ink/35 cursor-pointer">Edit table</button>
                  <button onClick={() => setTableOpen(null)} className="inline-flex h-11 items-center rounded-[2px] bg-[#0f0e0d] px-5 text-[14px] text-[#ede3cf] transition hover:bg-[#2a2622] cursor-pointer">Done</button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* choose who sits in this seat */}
      <Modal open={!!seatPicker} onClose={() => setSeatPicker(null)} label="Choose a guest for this seat">
        {seatPicker && pickerTable && (() => {
          const occupant = db.guests.find((g) => g.table === pickerTable.id && g.seat === seatPicker.seat) ?? null;
          const list = assignable.filter((g) => g.table === null || g.table === pickerTable.id);
          return (
            <div className="p-7 sm:p-8">
              <h2 className="font-display text-[28px] leading-none text-ink"><TableName name={pickerTable.name} />, seat <span className="font-sans font-light tabular-nums">{seatPicker.seat + 1}</span></h2>
              <p className="mt-2 text-[14px] text-ink-2">{occupant ? `${occupant.name} sits here now.` : "No one sits here yet."}</p>
              {occupant && (
                <button onClick={() => { unassign(occupant.id); setSeatPicker(null); }} className="mt-3 h-10 rounded-[2px] px-0 text-[14px] text-[#7a5c28] underline underline-offset-4 cursor-pointer">Take {firstName(occupant.name)} off this seat</button>
              )}
              <input value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Find a guest who's coming" className={`${inputCls} mt-4`} aria-label="Search guests to seat" autoFocus />
              <div className="mt-3 max-h-72 overflow-y-auto">
                {list.slice(0, 50).map((g) => (
                  <button key={g.id} onClick={() => seatHere(g, pickerTable.id, seatPicker.seat)}
                    className="flex w-full items-center gap-3 border-b border-ink/8 px-1 py-2.5 text-left transition hover:bg-ink/[.03] cursor-pointer">
                    <span className="min-w-0 flex-1"><span className="block text-[15px] text-ink">{g.name}</span><span className="block text-[12.5px] text-ink-2">{[sideOf(g), g.dietary].filter(Boolean).join(" · ")}</span></span>
                    {g.table === pickerTable.id && <span className="text-[12.5px] text-ink-2">at this table</span>}
                  </button>
                ))}
                {list.filter((g) => g.table === null).length === 0 && <p className="px-1 py-5 text-[14px] text-ink-2">No one who's coming is waiting for a seat.</p>}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* edit a table */}
      <Modal open={!!settings} onClose={() => setSettings(null)} label="Edit table">
        {settings && (
          <div className="p-7 sm:p-8">
            <h2 className="font-display text-[28px] leading-none text-ink">Edit <TableName name={settings.name} /></h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Name"><input className={inputCls} value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} /></Field>
              <Field label="Shape">
                <select className={`${selectCls} w-full`} value={settings.shape} onChange={(e) => setSettings({ ...settings, shape: e.target.value as TableShape })}>
                  {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </Field>
              {settings.shape !== "sweetheart" && (
                <Field label="Seats">
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label="One seat fewer" onClick={() => setSettings({ ...settings, capacity: Math.max(2, settings.capacity - 1) })} className="h-11 w-11 rounded-full border border-ink/15 text-lg text-ink transition hover:border-ink/40 cursor-pointer">−</button>
                    <span className="w-8 text-center text-[20px] tabular-nums text-ink">{settings.capacity}</span>
                    <button type="button" aria-label="One seat more" onClick={() => setSettings({ ...settings, capacity: Math.min(16, settings.capacity + 1) })} className="h-11 w-11 rounded-full border border-ink/15 text-lg text-ink transition hover:border-ink/40 cursor-pointer">+</button>
                  </div>
                </Field>
              )}
            </div>
            <div className="mt-7">
              <p className="text-[14px] font-medium text-ink-2">Table linen</p>
              <div className="mt-3 grid grid-cols-4 gap-2.5">
                {TABLE_SKINS.map((sk) => {
                  const locked = !!sk.lockedBy && !can(db.plan, "premiumSkins");
                  const active = skinOf(settings) === sk.id;
                  return (
                    <button key={sk.id} type="button" aria-pressed={active} title={locked ? `${sk.label}, part of ${PLANS.luxe.name}` : sk.note}
                      onClick={() => (locked ? openUpgrade("premiumSkins") : setSettings({ ...settings, skin: sk.id }))}
                      className={`relative overflow-hidden rounded-[3px] p-1.5 text-left transition ${active ? "ring-2 ring-[#7a5c28]" : "ring-1 ring-ink/10 hover:ring-ink/30"} cursor-pointer`}>
                      <span className="block h-12 w-full rounded-[2px]" style={{ background: SKIN[sk.id].surface, boxShadow: `inset 0 0 0 1px ${SKIN[sk.id].ring}` }} />
                      <span className="mt-1.5 flex items-center gap-1 px-0.5 text-[12.5px] text-ink-2">{locked && <Lock size={10} className="shrink-0 text-[#7a5c28]" aria-hidden="true" />}{sk.label}</span>
                      {locked && <span className="sr-only">, part of {PLANS.luxe.name}</span>}
                    </button>
                  );
                })}
              </div>
              {!can(db.plan, "premiumSkins") && <p className="mt-2.5 text-[13px] text-ink-2">Marble, oak and noir come with {PLANS.luxe.name}.</p>}
            </div>
            <div className="mt-7 flex justify-between">
              <button onClick={() => removeTable(settings)} className="inline-flex h-10 items-center gap-1.5 rounded-[2px] px-3 text-[14px] text-[#a53d28] hover:bg-[rgb(181_90_69/.1)] cursor-pointer"><Trash2 size={15} strokeWidth={1.6} /> Remove table</button>
              <div className="flex gap-3">
                <button onClick={() => setSettings(null)} className="inline-flex h-11 items-center rounded-[2px] px-4 text-[14px] text-[#7a5c28] underline underline-offset-4 cursor-pointer">Cancel</button>
                <button
                  onClick={() => {
                    // shrinking a table must not strand guests beyond its last seat
                    const stranded = db.guests.filter((g) => g.table === settings.id && g.seat !== null && g.seat >= settings.capacity).length;
                    setDb((d) => ({
                      ...d,
                      tables: d.tables.map((t) => (t.id === settings.id ? settings : t)),
                      guests: d.guests.map((g) => (g.table === settings.id && g.seat !== null && g.seat >= settings.capacity ? { ...g, table: null, seat: null } : g)),
                    }));
                    toast("Table saved", stranded > 0 ? `${stranded} ${stranded > 1 ? "guests are" : "guest is"} back on the list.` : undefined);
                    setSettings(null);
                  }}
                  className="inline-flex h-11 items-center rounded-[2px] bg-[#0f0e0d] px-5 text-[14px] text-[#ede3cf] transition hover:bg-[#2a2622] cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* edit something in the room. It used to sit inside the table modal, so it never opened */}
      <Modal open={!!venueEdit} onClose={() => setVenueEdit(null)} label="Edit room object">
        {venueEdit && (
          <div className="p-7 sm:p-8">
            <h2 className="font-display text-[28px] leading-none text-ink">{venueEdit.label || venueKind(venueEdit.kind).label}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{venueKind(venueEdit.kind).hint}</p>
            <div className="mt-6"><Field label="Name"><input className={inputCls} placeholder={venueKind(venueEdit.kind).label} value={venueEdit.label} onChange={(e) => setVenueEdit({ ...venueEdit, label: e.target.value })} /></Field></div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Field label="Width"><input type="range" min={6} max={60} step={1} className="w-full accent-[#7a5c28]" value={venueEdit.w} onChange={(e) => setVenueEdit({ ...venueEdit, w: Number(e.target.value) })} /></Field>
              <Field label="Depth"><input type="range" min={5} max={50} step={1} className="w-full accent-[#7a5c28]" value={venueEdit.h} onChange={(e) => setVenueEdit({ ...venueEdit, h: Number(e.target.value) })} /></Field>
            </div>
            <div className="mt-7 flex justify-between">
              <button
                onClick={() => { setDb((d) => ({ ...d, venueObjects: d.venueObjects.filter((o) => o.id !== venueEdit.id) })); toast(`${venueEdit.label || venueKind(venueEdit.kind).label} removed`, undefined, "info"); setVenueEdit(null); }}
                className="inline-flex h-10 items-center gap-1.5 rounded-[2px] px-3 text-[14px] text-[#a53d28] hover:bg-[rgb(181_90_69/.1)] cursor-pointer"
              >
                <Trash2 size={15} strokeWidth={1.6} /> Remove
              </button>
              <div className="flex gap-3">
                <button onClick={() => setVenueEdit(null)} className="inline-flex h-11 items-center rounded-[2px] px-4 text-[14px] text-[#7a5c28] underline underline-offset-4 cursor-pointer">Cancel</button>
                <button onClick={() => { setDb((d) => ({ ...d, venueObjects: d.venueObjects.map((o) => (o.id === venueEdit.id ? venueEdit : o)) })); setVenueEdit(null); }} className="inline-flex h-11 items-center rounded-[2px] bg-[#0f0e0d] px-5 text-[14px] text-[#ede3cf] transition hover:bg-[#2a2622] cursor-pointer">Save</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden on screen; @media print swaps the app out for this. */}
      <SeatingSheet />
    </div>
  );
}
