import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

/**
 * Cloudflare Turnstile: proves a person is on the other end. On the RSVP
 * form the token is verified by api/rsvp.ts; on sign-up, sign-in, magic
 * link and password reset, by Supabase Auth (its captcha setting). Tokens
 * are single-use and expire after five minutes, so the widget is reset
 * after every attempt.
 *
 * The site key is public (VITE_TURNSTILE_SITE_KEY). Preview and local builds
 * use Cloudflare's always-passing test key, set in their environment — never
 * hardcoded here.
 */

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: TurnstileApi } }

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
      s.onerror = () => { loading = null; reject(new Error("Turnstile did not load")); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

/** below this width the 300px widget doesn't fit, so the compact one is used */
export const COMPACT_BELOW = 300;

export const turnstileSiteKey = (): string | null =>
  ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "").trim() || null;

export interface TurnstileHandle { reset: () => void }

export const Turnstile = forwardRef<TurnstileHandle, {
  onToken: (token: string | null) => void;
  onUnavailable?: () => void;
  /** shown in Cloudflare's analytics, to tell the forms apart */
  action?: "rsvp" | "auth";
  /**
   * "interaction-only": invisible unless Cloudflare needs the person to tick
   * a box, and then as wide as the form. "always": the visible widget.
   */
  appearance?: "always" | "interaction-only";
}>(function Turnstile({ onToken, onUnavailable, action = "rsvp", appearance = "always" }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  // the latest callbacks, without re-rendering the widget when they change
  const cb = useRef({ onToken, onUnavailable });
  cb.current = { onToken, onUnavailable };

  useImperativeHandle(ref, () => ({
    reset: () => {
      cb.current.onToken(null);
      if (widget.current && window.turnstile) window.turnstile.reset(widget.current);
    },
  }), []);

  useEffect(() => {
    const sitekey = turnstileSiteKey();
    if (!sitekey) { cb.current.onUnavailable?.(); return; }
    let alive = true;
    loadTurnstile()
      .then((t) => {
        if (!alive || !box.current) return;
        widget.current = t.render(box.current, {
          sitekey,
          action,
          theme: "light",
          // the normal widget is 300px wide; the RSVP card on a 375px phone
          // leaves 277px, so it stuck out of the card. Compact is 150px wide.
          appearance,
          size: appearance === "interaction-only" ? "flexible" : box.current.clientWidth < COMPACT_BELOW ? "compact" : "normal",
          callback: (token: string) => cb.current.onToken(token),
          "expired-callback": () => cb.current.onToken(null),
          "error-callback": () => cb.current.onToken(null),
        });
      })
      .catch(() => cb.current.onUnavailable?.());
    return () => {
      alive = false;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [action, appearance]);

  // w-full so clientWidth measures the space the form gives it, not the widget;
  // an invisible check takes no room until Cloudflare shows it
  return <div ref={box} className={`flex w-full justify-center ${appearance === "always" ? "min-h-[65px]" : ""}`} />;
});
