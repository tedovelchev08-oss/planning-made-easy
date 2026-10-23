import React, { useEffect, useId, useRef, useState } from "react";

/**
 * The wedding day on "begin your plan". On a laptop, a month card that opens
 * under the field, the chosen day circled by two linked rings like the logo.
 * On a phone, three dials (day, month, year) turned with a thumb. Either way
 * the value is yyyy-mm-dd, or "" when they haven't decided.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

type Ymd = { y: number; m: number; d: number }; // m is 0-11

const pad = (n: number) => String(n).padStart(2, "0");
export const toIso = ({ y, m, d }: Ymd) => `${y}-${pad(m + 1)}-${pad(d)}`;
export function fromIso(iso: string): Ymd | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return r ? { y: +r[1], m: +r[2] - 1, d: +r[3] } : null;
}
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const weekday = ({ y, m, d }: Ymd) => new Date(y, m, d).getDay();
/** "Saturday, 18 September 2027" */
export const spell = (v: Ymd) => `${DAYS[weekday(v)]}, ${v.d} ${MONTHS[v.m]} ${v.y}`;
function todayYmd(): Ymd {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}
const before = (a: Ymd, b: Ymd) => toIso(a) < toIso(b);
function daysFromToday(v: Ymd) {
  const t = todayYmd();
  return Math.round((new Date(v.y, v.m, v.d).getTime() - new Date(t.y, t.m, t.d).getTime()) / 864e5);
}

function usePhone() {
  const query = "(max-width: 959px)";
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return phone;
}

export function WeddingDayPicker({ id, value, onChange }: { id: string; value: string; onChange: (iso: string) => void }) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const picked = fromIso(value);

  // a click anywhere else, or Escape, puts the card away
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); field.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const choose = (iso: string, close: boolean) => {
    onChange(iso);
    if (close) { setOpen(false); field.current?.focus(); }
  };

  return (
    <div className="tf-day" ref={wrap}>
      <button
        type="button" id={id} ref={field} className={`tf-day-field${picked ? "" : " is-empty"}`}
        aria-expanded={open} aria-controls={panelId} aria-haspopup="dialog" onClick={() => setOpen((o) => !o)}
      >
        {picked ? spell(picked) : "Choose the day"}
      </button>
      {open && (
        <div className="tf-day-panel" id={panelId} role="dialog" aria-label="Your wedding day">
          {phone
            ? <Dials value={picked} onChange={(v) => choose(v, false)} onDone={() => { setOpen(false); field.current?.focus(); }} />
            : <RingCalendar value={picked} onPick={(v) => choose(v, true)} />}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ laptop: the ring calendar ------------------------------ */

function RingCalendar({ value, onPick }: { value: Ymd | null; onPick: (iso: string) => void }) {
  const today = todayYmd();
  const start = value ?? today;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [focus, setFocus] = useState<Ymd>(start);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  // arrow keys move the focused day; the month follows it
  useEffect(() => {
    if (!moved.current) return;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toIso(focus)}"]`)?.focus();
  }, [focus, view]);

  const shift = (months: number) => setView((v) => {
    const n = new Date(v.y, v.m + months, 1);
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const canGoBack = view.y > today.y || (view.y === today.y && view.m > today.m);

  const step = (days: number) => {
    const n = new Date(focus.y, focus.m, focus.d + days);
    const next = { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() };
    if (before(next, today)) return;
    moved.current = true;
    setFocus(next);
    setView({ y: next.y, m: next.m });
  };
  const onKey = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in keys) { e.preventDefault(); step(keys[e.key]); }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const n = new Date(focus.y, focus.m + (e.key === "PageUp" ? -1 : 1), Math.min(focus.d, daysIn(focus.y, focus.m + (e.key === "PageUp" ? -1 : 1))));
      step(Math.round((n.getTime() - new Date(focus.y, focus.m, focus.d).getTime()) / 864e5));
    }
  };

  // Monday-first weeks, padded with the neighbouring months
  const lead = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const total = daysIn(view.y, view.m);
  const cells: (Ymd | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => ({ y: view.y, m: view.m, d: i + 1 }))];
  while (cells.length % 7) cells.push(null);
  const focusInView = focus.y === view.y && focus.m === view.m;
  const tabbable = focusInView ? focus.d : (value && value.y === view.y && value.m === view.m ? value.d : 1);

  return (
    <div className="tf-cal">
      <div className="tf-cal-head">
        <button type="button" onClick={() => shift(-1)} disabled={!canGoBack} aria-label="Previous month">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
        </button>
        <p aria-live="polite">{MONTHS[view.m]} <i>{view.y}</i></p>
        <button type="button" onClick={() => shift(1)} aria-label="Next month">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
        </button>
      </div>
      <div className="tf-cal-grid" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} ref={grid} onKeyDown={onKey}>
        <div role="row" className="tf-cal-row">
          {WEEK.map((w, i) => <span key={i} role="columnheader" className="tf-cal-dn" aria-label={DAYS[(i + 1) % 7]}>{w}</span>)}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, r) => (
          <div role="row" className="tf-cal-row" key={r}>
            {cells.slice(r * 7, r * 7 + 7).map((c, i) => {
              if (!c) return <span key={i} role="gridcell" className="tf-cal-pad" />;
              const iso = toIso(c);
              const past = before(c, today);
              const isToday = iso === toIso(today);
              const selected = !!value && iso === toIso(value);
              return (
                <span key={i} role="gridcell" aria-selected={selected}>
                  <button
                    type="button" data-day={iso} disabled={past} tabIndex={c.d === tabbable ? 0 : -1}
                    className={`tf-cal-day${selected ? " is-picked" : ""}${isToday ? " is-today" : ""}`}
                    aria-label={`${spell(c)}${isToday ? ", today" : ""}`} aria-pressed={selected}
                    onClick={() => onPick(iso)} onFocus={() => setFocus(c)}
                  >
                    {c.d}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <div className="tf-cal-foot">
        <span>{value ? countdown(value) : "Pick the day, or leave it for later."}</span>
        <button type="button" onClick={() => onPick("")}>Not decided yet</button>
      </div>
    </div>
  );
}

function countdown(v: Ymd) {
  const n = daysFromToday(v);
  return n === 0 ? "Today" : `${n} ${n === 1 ? "day" : "days"} from today`;
}

/* ------------------------------ phone: three dials ------------------------------ */

const ROW = 42; // px, one line on a dial

function Dials({ value, onChange, onDone }: { value: Ymd | null; onChange: (iso: string) => void; onDone: () => void }) {
  const today = todayYmd();
  // with nothing chosen yet, the dials start a year out
  const [v, setV] = useState<Ymd>(() => value ?? { y: today.y + 1, m: today.m, d: Math.min(today.d, daysIn(today.y + 1, today.m)) });
  const undecided = !value;
  const years = Array.from({ length: Math.max(6, v.y - today.y + 1) }, (_, i) => today.y + i);

  const set = (next: Ymd) => {
    const d = Math.min(next.d, daysIn(next.y, next.m));
    let fixed = { ...next, d };
    if (before(fixed, today)) fixed = today; // never a day already gone
    setV(fixed);
    onChange(toIso(fixed));
  };

  return (
    <div className="tf-dials-wrap">
      <p className="tf-dials-spelled" aria-hidden="true">{undecided ? "Turn the dials to choose" : spell(v)}</p>
      <div className={`tf-dials${undecided ? " is-off" : ""}`}>
        <Dial label="Day" items={Array.from({ length: daysIn(v.y, v.m) }, (_, i) => String(i + 1))} index={v.d - 1}
          onIndex={(i) => set({ ...v, d: i + 1 })} />
        <Dial label="Month" items={MONTHS} index={v.m} onIndex={(i) => set({ ...v, m: i })} />
        <Dial label="Year" items={years.map(String)} index={Math.max(0, years.indexOf(v.y))}
          onIndex={(i) => set({ ...v, y: years[i] })} />
      </div>
      <div className="tf-dials-foot">
        <label className="tf-switch">
          <input type="checkbox" checked={undecided} onChange={(e) => (e.target.checked ? onChange("") : set(v))} />
          <span aria-hidden="true" />
          We haven’t decided yet
        </label>
        <button type="button" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

/**
 * One dial: a scroll-snapped column. Flick it with a thumb; with a keyboard
 * it is a spin button (arrow keys, Home, End).
 */
function Dial({ label, items, index, onIndex }: {
  label: string; items: string[]; index: number; onIndex: (i: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const ours = useRef(false);

  // keep the dial on the chosen line when the value changes from elsewhere
  useEffect(() => {
    const el = box.current;
    if (!el || ours.current) { ours.current = false; return; }
    el.scrollTop = index * ROW;
  }, [index, items.length]);

  const onScroll = () => {
    if (settle.current) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = box.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
      if (i !== index) { ours.current = true; onIndex(i); }
    }, 90);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    onIndex(Math.max(0, Math.min(items.length - 1, to)));
  };

  return (
    <div
      className="tf-dial" ref={box} onScroll={onScroll} onKeyDown={onKey}
      role="spinbutton" tabIndex={0} aria-label={label} aria-valuenow={index + 1} aria-valuetext={items[index]}
      aria-valuemin={1} aria-valuemax={items.length}
    >
      <div className="tf-dial-pad" />
      {items.map((t, i) => (
        <button key={t} type="button" tabIndex={-1} className={i === index ? "is-on" : ""} onClick={() => onIndex(i)} aria-hidden="true">{t}</button>
      ))}
      <div className="tf-dial-pad" />
    </div>
  );
}
