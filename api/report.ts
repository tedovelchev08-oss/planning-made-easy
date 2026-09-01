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
 * session), so payloads are size-capped and content-free of PII by contract.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const MAX_BODY = 16 * 1024;

const clip = (v: unknown, n: number): string => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const length = Number(req.headers["content-length"] ?? 0);
  if (length > MAX_BODY) return res.status(413).json({ error: "Payload too large" });

  const body = (req.body ?? {}) as { kind?: string; [k: string]: unknown };
  const kind = body.kind === "event" ? "event" : "error";

  // one grep-able line per report
  console.log(
    `[report:${kind}]`,
    JSON.stringify({
      ...(kind === "error"
        ? { message: clip(body.message, 500), stack: clip(body.stack, 4000), ctx: body.ctx, route: body.route, ua: body.ua }
        : { event: clip(body.event, 60), props: body.props, route: body.route }),
      at: body.at,
    }),
  );

  // 204: accepted, nothing to say back — the client never waits on this
  return res.status(204).end();
}
