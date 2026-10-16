import { describe, it, expect, vi } from "vitest";

/** subscribeToWedding: what it listens to, and what it reports (0019). */
type Handler = (p: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => void;
const listeners: { opts: { event: string; table: string; filter?: string }; handler: Handler }[] = [];
const channel = {
  on: vi.fn((_kind: string, opts: { event: string; table: string; filter?: string }, handler: Handler) => {
    listeners.push({ opts, handler });
    return channel;
  }),
  subscribe: vi.fn(() => channel),
};
const removeChannel = vi.fn(async () => "ok");
vi.mock("./supabase", () => ({ requireSb: () => ({ channel: () => channel, removeChannel }) }));

const { subscribeToWedding } = await import("./api");
const W = "11111111-1111-4111-8111-111111111111";

describe("subscribeToWedding", () => {
  const changes: unknown[] = [];
  const stop = subscribeToWedding(W, (c) => changes.push(c));

  it("filters inserts and updates to this wedding, and takes every delete (they can't be filtered)", () => {
    const guests = listeners.filter((l) => l.opts.table === "guests").map((l) => [l.opts.event, l.opts.filter ?? null]);
    expect(guests).toEqual([["INSERT", `wedding_id=eq.${W}`], ["UPDATE", `wedding_id=eq.${W}`], ["DELETE", null]]);
    expect(listeners.find((l) => l.opts.table === "weddings")!.opts.filter).toBe(`id=eq.${W}`);
    expect(new Set(listeners.map((l) => l.opts.table)).size).toBe(11);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("reports the row id and its new version; config rows by wedding id; deletes by their old id", () => {
    listeners.find((l) => l.opts.table === "guests" && l.opts.event === "UPDATE")!
      .handler({ eventType: "UPDATE", new: { id: "g1", updated_at: "v2" }, old: {} });
    listeners.find((l) => l.opts.table === "invitation_config" && l.opts.event === "UPDATE")!
      .handler({ eventType: "UPDATE", new: { wedding_id: W, updated_at: "v3" }, old: {} });
    listeners.find((l) => l.opts.table === "guests" && l.opts.event === "DELETE")!
      .handler({ eventType: "DELETE", new: {}, old: { id: "g9" } });
    expect(changes).toEqual([
      { type: "UPDATE", table: "guests", id: "g1", updatedAt: "v2" },
      { type: "UPDATE", table: "invitation_config", id: W, updatedAt: "v3" },
      { type: "DELETE", table: "guests", id: "g9", updatedAt: null },
    ]);
  });

  it("unsubscribing removes the channel", () => {
    stop();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
