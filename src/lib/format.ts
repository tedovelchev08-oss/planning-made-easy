/* ------------------------------------------------------------------ */
/* Locale-aware formatting                                             */
/*                                                                     */
/* Driven by the wedding record (locale · currency · timezone) via     */
/* configureFormat(), wired from the store. Keeping the config at      */
/* module level means the ~60 existing fmtMoney/fmtDate call sites     */
/* stay untouched — they simply stop being en-US/USD-hardcoded.        */
/* ------------------------------------------------------------------ */

export interface FormatConfig {
  locale: string;
  currency: string;
  /** IANA zone, e.g. "America/New_York" · undefined = viewer's local zone */
  timeZone?: string;
}

const FALLBACK: FormatConfig = { locale: "en-US", currency: "USD" };

let cfg: FormatConfig = { ...FALLBACK };

export const configureFormat = (p: Partial<FormatConfig>) => {
  cfg = { ...FALLBACK, ...p };
};

export const getFormatConfig = (): FormatConfig => ({ ...cfg });

/** guards against invalid currency codes crashing Intl at render time */
const safeCurrency = (c: string) => (/^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : "USD");

export const fmtMoney = (n: number): string => {
  try {
    return n.toLocaleString(cfg.locale, { style: "currency", currency: safeCurrency(cfg.currency), maximumFractionDigits: 0 });
  } catch {
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
};

const mergeOpts = (opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => {
  const merged = { ...(opts ?? {}) };
  // wedding timezone wins unless the caller explicitly overrode it
  if (!merged.timeZone && cfg.timeZone) merged.timeZone = cfg.timeZone;
  return merged;
};

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions): string => {
  try {
    return new Date(iso).toLocaleDateString(cfg.locale, mergeOpts(opts ?? { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  } catch {
    return new Date(iso).toLocaleDateString("en-US", opts);
  }
};

export const fmtDateShort = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(cfg.locale, mergeOpts({ month: "short", day: "numeric", year: "numeric" }));
  } catch {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
};
