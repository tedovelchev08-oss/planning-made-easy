import type { EntityKey } from "./api";

/**
 * The write-behind queue: edits waiting to reach Supabase.
 *
 * It used to live only in memory, and the offline cache was written only
 * after a successful save — so closing the tab on bad wifi, or refreshing
 * inside the 700 ms debounce, silently lost every edit since the last save.
 * Now the queue is persisted on every change, together with the workspace it
 * produced, and restored on the next boot for the same user and wedding.
 */

export interface Bucket { upserts: Map<string, unknown>; deletes: Set<string> }
export type Queue = Map<EntityKey, Bucket>;

export const emptyQueue = (): Queue => new Map();

export function bucketOf(q: Queue, key: EntityKey): Bucket {
  let b = q.get(key);
  if (!b) { b = { upserts: new Map(), deletes: new Set() }; q.set(key, b); }
  return b;
}

export function countQueue(q: Queue): number {
  let n = 0;
  q.forEach((b) => { n += b.upserts.size + b.deletes.size; });
  return n;
}

/**
 * Put rows that failed back underneath the live queue. A row edited again
 * since the failure keeps its newer version; a delete always survives.
 */
export function mergeUnder(live: Queue, failed: Queue): void {
  for (const [key, b] of failed) {
    const l = bucketOf(live, key);
    for (const [id, row] of b.upserts) if (!l.upserts.has(id) && !l.deletes.has(id)) l.upserts.set(id, row);
    for (const id of b.deletes) l.deletes.add(id);
  }
  for (const [key, b] of [...live]) if (b.upserts.size === 0 && b.deletes.size === 0) live.delete(key);
}

/* ------------------------------ persistence ------------------------------ */

type Stored<S> = {
  v: 1;
  weddingId: string;
  queue: [EntityKey, { upserts: [string, unknown][]; deletes: string[] }][];
  /** the workspace as the couple last saw it, edits included */
  snapshot: S | null;
};

export const pendingKey = (user: string) => `luma.pending.${user}`;

/**
 * Save the queue for this user and wedding, or clear it when empty. Returns
 * whether it is now durable. A snapshot too big for localStorage (an uploaded
 * song, say) is dropped before the queue is: the queue alone still replays.
 */
export function persistQueue<S>(user: string, weddingId: string, q: Queue, snapshot: S): boolean {
  try {
    if (countQueue(q) === 0) { localStorage.removeItem(pendingKey(user)); return true; }
    const queue: Stored<S>["queue"] = [...q].map(([k, b]) => [k, { upserts: [...b.upserts], deletes: [...b.deletes] }]);
    const write = (snap: S | null) =>
      localStorage.setItem(pendingKey(user), JSON.stringify({ v: 1, weddingId, queue, snapshot: snap } satisfies Stored<S>));
    try { write(snapshot); } catch { write(null); }
    return true;
  } catch {
    return false;
  }
}

/** The saved queue for this user — only if it belongs to this wedding. */
export function loadQueue<S>(user: string, weddingId: string): { queue: Queue; snapshot: S | null } | null {
  try {
    const raw = localStorage.getItem(pendingKey(user));
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored<S>;
    if (s?.v !== 1 || s.weddingId !== weddingId || !Array.isArray(s.queue)) return null;
    const queue: Queue = new Map(
      s.queue.map(([k, b]) => [k, { upserts: new Map(b.upserts), deletes: new Set(b.deletes) }]),
    );
    return countQueue(queue) ? { queue, snapshot: s.snapshot ?? null } : null;
  } catch {
    return null;
  }
}

export function clearQueue(user: string): void {
  try { localStorage.removeItem(pendingKey(user)); } catch { /* nothing to clear */ }
}

/* ------------------------------ sending ------------------------------ */

export type Send = (key: EntityKey, upserts: unknown[], deletes: string[]) => Promise<void>;

export interface RowFailure { key: EntityKey; id: string; message: string }

/**
 * Send a queue, isolating failures. The old loop stopped at the first entity
 * that threw, so one row the server kept rejecting blocked every later save.
 * Now each entity is sent on its own; if its batch is rejected, it is retried
 * row by row so the good rows land and only the bad ones stay queued.
 */
export async function sendQueue(
  batch: Queue,
  send: Send,
  /** false while offline: every row would fail, so don't fire them one by one */
  isolate = true,
): Promise<{ failed: Queue; failures: RowFailure[] }> {
  const failed = emptyQueue();
  const failures: RowFailure[] = [];
  const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  for (const [key, b] of batch) {
    const upserts = [...b.upserts];
    const deletes = [...b.deletes];
    try {
      await send(key, upserts.map(([, row]) => row), deletes);
      continue;
    } catch (e) {
      if (!isolate || upserts.length + deletes.length === 1) {
        if (!isolate) {
          const f = bucketOf(failed, key);
          for (const id of deletes) f.deletes.add(id);
          for (const [id, row] of upserts) f.upserts.set(id, row);
          failures.push({ key, id: "*", message: msg(e) });
          continue;
        }
        const f = bucketOf(failed, key);
        if (deletes[0]) f.deletes.add(deletes[0]); else f.upserts.set(upserts[0][0], upserts[0][1]);
        failures.push({ key, id: deletes[0] ?? upserts[0][0], message: msg(e) });
        continue;
      }
    }
    for (const id of deletes) {
      try { await send(key, [], [id]); }
      catch (e) { bucketOf(failed, key).deletes.add(id); failures.push({ key, id, message: msg(e) }); }
    }
    for (const [id, row] of upserts) {
      try { await send(key, [row], []); }
      catch (e) { bucketOf(failed, key).upserts.set(id, row); failures.push({ key, id, message: msg(e) }); }
    }
  }
  return { failed, failures };
}

/** Retry delays while saving keeps failing: 2s, 5s, 15s, then every 30s. */
export const RETRY_DELAYS = [2000, 5000, 15000, 30000];
export const retryDelay = (attempt: number) => RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
