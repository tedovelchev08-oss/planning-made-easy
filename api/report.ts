/**
 * POST /api/report — the fallback observability sink used when Sentry is not
 * configured (no VITE_SENTRY_DSN). Accepts two shapes from src/lib/report.ts:
 *
 *   { kind: "error", message, stack, ctx, route, ua, at }
 *   { kind: "event", event, props, route, at }        (funnel stages)
 *
 * Everything is written to the function log as one structured line, so both
 * errors and the signup→guest→share→rsvp→purchase funnel are queryable in
 * the Vercel dashboard (`vercel logs` / Log Drains). When you add Sentry,
 * this endpoint keeps working as the no-DSN fallback — forward to Sentry's
 * server SDK or a Slack webhook here if you want both.
 *
 * Deliberately unauthenticated (a crashing browser may have lost its
 * session), so payloads are size-capped and content-free of PII by contract,
 * and each visitor may send REPORTS_PER_HOUR (counted in api_rate, 0016,
 * by an HMAC of the IP). Past that, reports are accepted and dropped
 * unlogged: a script can't flood the logs, and a browser stuck in a crash
 * loop never sees an error from its own error reporter.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const MAX_BODY = 16 * 1024;
export const REPORTS_PER_HOUR = 60;

/** The first address in x-forwarded-for is the client; Vercel sets it. */
function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || "unknown";
}

/**
 * Counts this report against the visitor's hourly allowance. Fails open:
 * if the counter can't be reached, the report is logged as before, since
 * reports matter most exactly when things are failing.
 */
async function withinLimit(req: VercelRequest): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return true;
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const key = createHmac("sha256", serviceKey).update(clientIp(req)).digest("hex");
    const { data: hits, error } = await admin.rpc("api_rate_hit", { p_bucket: "report", p_key: key });
    if (error || typeof hits !== "number") return true;
    if (hits === REPORTS_PER_HOUR + 1) console.warn("[report] one visitor reached the hourly limit; their further reports this hour are dropped");
    return hits <= REPORTS_PER_HOUR;
  } catch {
    return true;
  }
}

/** A guest's RSVP token works like a password: never write one to the log, even from an old client. */
export const redactToken = (text: string): string => text.replace(/([?&#]token=)[^&#\s"]*/gi, "$1[redacted]");

const clip = (v: unknown, n: number): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return redactToken(s.length > n ? `${s.slice(0, n)}…` : s);
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const length = Number(req.headers["content-length"] ?? 0);
  if (length > MAX_BODY) return res.status(413).json({ error: "Payload too large" });

  if (!(await withinLimit(req))) return res.status(204).end();

  const body = (req.body ?? {}) as { kind?: string; [k: string]: unknown };
  const kind = body.kind === "event" ? "event" : "error";

  // one grep-able line per report
  console.log(
    `[report:${kind}]`,
    JSON.stringify({
      ...(kind === "error"
        ? { message: clip(body.message, 500), stack: clip(body.stack, 4000), ctx: clip(body.ctx, 2000), route: clip(body.route, 300), ua: body.ua }
        : { event: clip(body.event, 60), props: clip(body.props, 2000), route: clip(body.route, 300) }),
      at: body.at,
    }),
  );

  // 204: accepted, nothing to say back — the client never waits on this
  return res.status(204).end();
}
