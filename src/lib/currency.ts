import { useSyncExternalStore } from "react";
import { CURRENCIES, DEFAULT_CURRENCY, currencyForCountry, type Currency } from "./plans";

/**
 * Which currency prices are shown — and charged — in.
 *
 * Order of precedence: what the visitor picked (remembered on this device),
 * then their country (from /api/geo, which reads the header Vercel sets on
 * every request), then euros. Never the browser language: a French speaker
 * in New York should see dollars.
 */

const KEY = "luma.currency";
let current: Currency = DEFAULT_CURRENCY;
let chosen = false;
let detecting: Promise<void> | null = null;
const listeners = new Set<() => void>();

const isCurrency = (v: unknown): v is Currency => typeof v === "string" && v in CURRENCIES;

function emit() { listeners.forEach((l) => l()); }

function init() {
  try {
    const saved = localStorage.getItem(KEY);
    if (isCurrency(saved)) { current = saved; chosen = true; return; }
  } catch { /* storage blocked — fall through to detection */ }
  if (!detecting && typeof fetch !== "undefined") {
    detecting = fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { country?: string | null } | null) => {
        if (chosen) return; // the visitor picked one while we were asking
        const next = currencyForCountry(j?.country);
        if (next !== current) { current = next; emit(); }
      })
      .catch(() => { /* offline or local dev — keep the default */ });
  }
}

let started = false;
function subscribe(l: () => void) {
  if (!started) { started = true; init(); }
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function setCurrency(c: Currency) {
  current = c;
  chosen = true;
  try { localStorage.setItem(KEY, c); } catch { /* not remembered, still applied */ }
  emit();
}

export function useCurrency(): [Currency, (c: Currency) => void] {
  const c = useSyncExternalStore(subscribe, () => current, () => DEFAULT_CURRENCY);
  return [c, setCurrency];
}

/** for tests */
export function __resetCurrency() { current = DEFAULT_CURRENCY; chosen = false; detecting = null; started = false; listeners.clear(); }
