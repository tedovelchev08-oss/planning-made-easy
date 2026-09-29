import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  bucketOf, clearQueue, countQueue, emptyQueue, loadQueue, mergeUnder, pendingKey, persistQueue, retryDelay, sendQueue,
  type Queue,
} from "./syncQueue";

const W = "11111111-1111-4111-8111-111111111111";
const OTHER_W = "22222222-2222-4222-8222-222222222222";

function queueOf(rows: Record<string, string[]>, deletes: Record<string, string[]> = {}): Queue {
  const q = emptyQueue();
  for (const [key, ids] of Object.entries(rows)) for (const id of ids) bucketOf(q, key as never).upserts.set(id, { id });
  for (const [key, ids] of Object.entries(deletes)) for (const id of ids) bucketOf(q, key as never).deletes.add(id);
  return q;
}

beforeEach(() => localStorage.clear());

describe("persistQueue / loadQueue", () => {
  it("round-trips the queue and the snapshot", () => {
    persistQueue("a@x.com", W, queueOf({ guests: ["g1", "g2"] }, { tasks: ["t9"] }), { hello: "world" });
    const back = loadQueue<{ hello: string }>("a@x.com", W);
    expect(back?.snapshot).toEqual({ hello: "world" });
    expect([...back!.queue.get("guests")!.upserts.keys()]).toEqual(["g1", "g2"]);
    expect([...back!.queue.get("tasks")!.deletes]).toEqual(["t9"]);
  });

  it("restores nothing for a different wedding", () => {
    persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), null);
    expect(loadQueue("a@x.com", OTHER_W)).toBeNull();
  });

  it("restores nothing for a different user", () => {
    persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), null);
    expect(loadQueue("b@x.com", W)).toBeNull();
  });

  it("clears storage once the queue is empty", () => {
    persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), null);
    persistQueue("a@x.com", W, emptyQueue(), null);
    expect(localStorage.getItem(pendingKey("a@x.com"))).toBeNull();
  });

  it("keeps the queue when the snapshot is too big to store", () => {
    // A song uploaded as a data URL can blow the quota. The edits matter more.
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (v.includes("HUGE")) throw new DOMException("full", "QuotaExceededError");
      return real.call(this, k, v);
    });
    expect(persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), { big: "HUGE" })).toBe(true);
    spy.mockRestore();
    const back = loadQueue("a@x.com", W);
    expect(back?.snapshot).toBeNull();
    expect(countQueue(back!.queue)).toBe(1);
  });

  it("reports not durable when storage refuses everything", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), null)).toBe(false);
    spy.mockRestore();
  });

  it("clearQueue removes it", () => {
    persistQueue("a@x.com", W, queueOf({ guests: ["g1"] }), null);
    clearQueue("a@x.com");
    expect(loadQueue("a@x.com", W)).toBeNull();
  });
});

describe("mergeUnder", () => {
  it("keeps the newer live version of a row edited again after failing", () => {
    const live = emptyQueue();
    bucketOf(live, "guests").upserts.set("g1", { v: "new" });
    const failed = emptyQueue();
    bucketOf(failed, "guests").upserts.set("g1", { v: "old" });
    bucketOf(failed, "guests").upserts.set("g2", { v: "only" });
    mergeUnder(live, failed);
    expect(live.get("guests")!.upserts.get("g1")).toEqual({ v: "new" });
    expect(live.get("guests")!.upserts.get("g2")).toEqual({ v: "only" });
  });

  it("does not resurrect a row deleted since its save failed", () => {
    const live = queueOf({}, { guests: ["g1"] });
    mergeUnder(live, queueOf({ guests: ["g1"] }));
    expect(live.get("guests")!.upserts.has("g1")).toBe(false);
    expect(live.get("guests")!.deletes.has("g1")).toBe(true);
  });
});

describe("sendQueue — one bad row must not block the rest", () => {
  it("saves every other entity when one is rejected", async () => {
    const sent: string[] = [];
    const send = vi.fn(async (key: string, upserts: unknown[]) => {
      if (key === "guests") throw new Error("violates check constraint");
      sent.push(`${key}:${upserts.length}`);
    });
    const { failed, failures } = await sendQueue(queueOf({ guests: ["g1"], tasks: ["t1"], budget: ["b1"] }), send);
    expect(sent).toEqual(["tasks:1", "budget:1"]);
    expect(countQueue(failed)).toBe(1);
    expect(failures).toEqual([{ key: "guests", id: "g1", message: "violates check constraint" }]);
  });

  it("isolates the bad row inside a rejected batch", async () => {
    const saved: string[] = [];
    const send = vi.fn(async (_key: string, upserts: unknown[], deletes: string[]) => {
      const ids = [...(upserts as { id: string }[]).map((r) => r.id), ...deletes];
      if (ids.includes("bad")) throw new Error("rejected");
      saved.push(...ids);
    });
    const { failed } = await sendQueue(queueOf({ guests: ["g1", "bad", "g3"] }, { guests: ["gone"] }), send);
    expect(saved.sort()).toEqual(["g1", "g3", "gone"]);
    expect([...failed.get("guests")!.upserts.keys()]).toEqual(["bad"]);
    expect(failed.get("guests")!.deletes.size).toBe(0);
  });

  it("offline, keeps the whole batch without firing it row by row", async () => {
    const send = vi.fn(async () => { throw new Error("Failed to fetch"); });
    const { failed } = await sendQueue(queueOf({ guests: ["g1", "g2", "g3"] }), send, false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(countQueue(failed)).toBe(3);
  });
});

describe("retryDelay", () => {
  it("backs off 2s, 5s, 15s, then holds at 30s", () => {
    expect([0, 1, 2, 3, 4, 9].map(retryDelay)).toEqual([2000, 5000, 15000, 30000, 30000, 30000]);
  });
});
