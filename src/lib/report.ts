import * as Sentry from "@sentry/react";

/* ------------------------------------------------------------------ */
/* Observability — one small layer, two jobs:                          */
/*   captureError()  → render crashes, window errors, 3D failures      */
/*   track()         → the five-step acquisition funnel                */
/*                                                                     */
/* Routing:                                                            */
/*   · VITE_SENTRY_DSN set  → Sentry (full traces, source maps)        */
/*   · otherwise            → POST /api/report → Vercel function logs  */
/* Both paths also hit the console so local development is never dark. */
/*                                                                     */
/* The sink is same-origin, so it needs no CSP connect-src change.     */
/* ------------------------------------------------------------------ */

export type FunnelEvent = "signup" | "first_guest" | "share_link" | "first_rsvp" | "purchase";
type Props = Record<string, string | number | boolean | null | undefined>;

const FUNNEL_KEY = "luma:funnel";
const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim();

let sentryOn = false;
let booted = false;

/** Call once at startup (main.tsx). Safe to call twice. */
export function initReporting() {
  if (booted || typeof window === "undefined") return;
  booted = true;

  if (dsn) {
    try {
      Sentry.init({
        dsn,
        // this is an engagement tool, not an APM target — errors only
        tracesSampleRate: 0,
        environment: window.location.hostname === "localhost" ? "development" : "production",
        beforeSend(event) {
          return event;
        },
      });
      sentryOn = true;
    } catch (err) {
      // never let the reporter break the app
      console.warn("[luma] Sentry init failed:", err);
    }
  }

  // crashes outside React's tree — module init, async handlers, timers
  window.addEventListener("error", (e) => {
    captureError(e.error ?? new Error(e.message), { scope: "window", at: `${e.filename}:${e.lineno}` });
  });
  window.addEventListener("unhandledrejection", (e) => {
    captureError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)), { scope: "promise" });
  });
}

/* ------------------------------ error capture ------------------------------ */

const recent = new Map<string, number>(); // dedupe identical errors within a window
let sentInMinute = 0;
let minuteStart = Date.now();

const throttleOk = (): boolean => {
  const now = Date.now();
  if (now - minuteStart > 60_000) { sentInMinute = 0; minuteStart = now; }
  return ++sentInMinute <= 10; // a crash loop must not DDoS the sink
};

export function captureError(error: unknown, ctx: Props = {}) {
  const err = error instanceof Error ? error : new Error(String(error));
  // always visible locally — the console is the one sink that never fails
  console.error("[luma:error]", { ...ctx, message: err.message }, err);

  if (sentryOn) {
    Sentry.withScope((scope) => {
      Object.entries(ctx).forEach(([k, v]) => v != null && scope.setExtra(k, v));
      scope.setTag("route", window.location.hash || "/");
      Sentry.captureException(err);
    });
    return;
  }

  const key = `${err.message}::${(err.stack ?? "").slice(0, 120)}`;
  const last = recent.get(key) ?? 0;
  if (Date.now() - last < 20_000) return; // same failure already reported
  recent.set(key, Date.now());
  if (recent.size > 50) recent.clear();
  if (!throttleOk()) return;

  void fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "error",
      message: err.message.slice(0, 2000),
      stack: (err.stack ?? "").slice(0, 8000),
      ctx,
      route: window.location.hash || "/",
      ua: navigator.userAgent.slice(0, 200),
      at: new Date().toISOString(),
    }),
  }).catch(() => { /* the sink itself is down — nothing left to do */ });
}

/* ------------------------------ funnel ------------------------------ */

const funnelDone = (): Set<string> => {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(FUNNEL_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
};

/**
 * Record a funnel stage exactly once per browser. Fire-and-forget; the
 * funnel must never block (or break) the moment being measured.
 */
export function track(event: FunnelEvent, props: Props = {}) {
  const done = funnelDone();
  if (done.has(event)) return;
  done.add(event);
  try { localStorage.setItem(FUNNEL_KEY, JSON.stringify([...done])); } catch { /* private mode */ }

  const payload = { kind: "event", event, props, route: window.location.hash || "/", at: new Date().toISOString() };
  console.info("[luma:funnel]", payload);

  if (sentryOn) {
    Sentry.addBreadcrumb({ category: "funnel", message: event, data: props as Record<string, unknown>, level: "info" });
    return;
  }
  void fetch("/api/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

/** Which funnel stages this browser has already reached — for dashboards/tests. */
export const funnelState = funnelDone;
