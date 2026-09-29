import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Block 3: the write-behind queue survives a reload, one rejected row does not
 * block every other save, and a tab coming back after a while reloads from
 * the server. Cloud mode is forced by mocking the module boundary, as in
 * signout.test.tsx.
 */

const EMAIL = "couple@example.com";
const WEDDING_ID = "11111111-1111-4111-8111-111111111111";
const G1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

vi.mock("./supabase", () => ({
  isSupabaseConfigured: true,
  sb: null,
  requireSb: () => { throw new Error("not used in these tests"); },
}));

const workspace = (guestName = "Priya Desai") => ({
  wedding: {
    names: "Maya & Theo", partnerA: "Maya", partnerB: "Theo",
    date: new Date(Date.now() + 200 * 86400000).toISOString(),
    venue: "The Old Orangery", location: "Brooklyn", timezone: "UTC", locale: "en-US", currency: "USD", slug: "maya-theo",
  },
  guests: [{ id: G1, token: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: guestName, party: "A", rsvp: "confirmed", meal: null, table: null, seat: null, plusOneOf: null, dietary: null, notes: "" }],
  budget: [],
  tasks: [{ id: T1, title: "Book the florist", due: "2027-01-01", done: false, phase: "Planning", owner: "Maya" }],
  vendors: [], tables: [], venueObjects: [], registry: [],
  plan: "celebration",
  invitation: {
    headline: "Maya & Theo", line1: "", line2: "", venueLine: "", rsvp: true, meal: true, notes: true,
    photo: null, colors: null, fontSerif: null,
    motion: { petals: "gentle", shimmer: true, type: true },
    music: { track: "serene", uploadName: null, uploadData: null },
  },
  website: { template: "serene", sections: {}, bg: "#FFF8F0" },
  customTemplates: [], rsvpLog: [],
});

const syncEntity = vi.fn<(key: string, wid: string, upserts: unknown[], deletes: string[]) => Promise<void>>();
const fetchWorkspace = vi.fn();

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    authApi: {
      session: vi.fn().mockResolvedValue({ user: { id: "user-1", email: EMAIL } }),
      onAuthChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn().mockResolvedValue(undefined),
    },
    acceptPendingInvites: vi.fn().mockResolvedValue(undefined),
    myWeddingId: vi.fn().mockResolvedValue(WEDDING_ID),
    fetchWorkspace: (...a: unknown[]) => fetchWorkspace(...a),
    fetchFreshRsvps: vi.fn().mockResolvedValue([]),
    syncEntity: (...a: Parameters<typeof syncEntity>) => syncEntity(...a),
  };
});

const { AppProvider, useApp } = await import("./store");
type Db = import("./store").Db;

const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

async function boot() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.booting).toBe(false));
  await waitFor(() => expect(hook.result.current.db.guests.length).toBe(1));
  return hook;
}

const rename = (name: string) => (d: Db): Db => ({ ...d, guests: d.guests.map((g) => ({ ...g, name })) });
const sentRows = (key: string) =>
  syncEntity.mock.calls.filter((c) => c[0] === key).flatMap((c) => c[2] as { name?: string; title?: string }[]);

beforeEach(() => {
  localStorage.clear();
  syncEntity.mockReset();
  syncEntity.mockResolvedValue(undefined);
  fetchWorkspace.mockReset();
  fetchWorkspace.mockImplementation(async () => workspace());
});

afterEach(() => { vi.useRealTimers(); });

describe("unsaved edits survive a reload", () => {
  it("persists an edit before the save debounce fires", async () => {
    const { result, unmount } = await boot();
    act(() => result.current.setDb(rename("Priya D.")));
    // closing the tab now used to lose it: it lived only in memory
    const stored = localStorage.getItem(`luma.pending.${EMAIL}`);
    expect(stored).toContain("Priya D.");
    unmount();
  });

  it("restores the queued edit on the next boot and sends it before loading server data", async () => {
    const first = await boot();
    act(() => first.result.current.setDb(rename("Priya D.")));
    first.unmount(); // the reload: nothing was sent yet
    expect(sentRows("guests")).toHaveLength(0);

    const order: string[] = [];
    syncEntity.mockImplementation(async (key) => { order.push(`send:${key}`); });
    fetchWorkspace.mockImplementation(async () => { order.push("fetch"); return workspace("Priya D."); });

    const second = await boot();
    await waitFor(() => expect(sentRows("guests").map((r) => r.name)).toContain("Priya D."));
    expect(order.indexOf("send:guests")).toBeLessThan(order.indexOf("fetch"));
    expect(second.result.current.db.guests[0].name).toBe("Priya D.");
    await waitFor(() => expect(localStorage.getItem(`luma.pending.${EMAIL}`)).toBeNull());
  });

  it("keeps showing the edit when it still can't be sent after the reload", async () => {
    const first = await boot();
    act(() => first.result.current.setDb(rename("Priya D.")));
    first.unmount();

    syncEntity.mockRejectedValue(new Error("Failed to fetch"));
    const second = await boot();
    // the server copy must not paint over the unsaved edit
    expect(second.result.current.db.guests[0].name).toBe("Priya D.");
    expect(localStorage.getItem(`luma.pending.${EMAIL}`)).toContain("Priya D.");
    expect(["error", "offline"]).toContain(second.result.current.sync.status);
  });
});

describe("one rejected row does not block every other save", () => {
  it("saves the task while the guest keeps failing, and names the problem", async () => {
    const { result } = await boot();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    syncEntity.mockImplementation(async (key) => {
      if (key === "guests") throw new Error("new row violates check constraint");
    });

    act(() => result.current.setDb((d) => ({
      ...rename("Bad Row")(d),
      tasks: d.tasks.map((t) => ({ ...t, done: true })),
    })));
    await act(async () => { await vi.advanceTimersByTimeAsync(800); });

    // the old loop stopped at the first failing entity; tasks never saved
    expect(sentRows("tasks").length).toBeGreaterThan(0);
    expect(result.current.sync.status).toBe("error");

    // retries on its own (2s, 5s): after three refusals it says which change
    await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5100); });
    expect(result.current.sync.problem).toMatch(/guests.*check constraint/);
    expect(result.current.sync.pending).toBe(1);

    // once the server accepts it, the problem clears
    syncEntity.mockResolvedValue(undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(15100); });
    expect(result.current.sync.status).toBe("saved");
    expect(result.current.sync.problem).toBeNull();
  });
});

describe("coming back to a tab that was away", () => {
  const setVisibility = (v: "hidden" | "visible") => {
    Object.defineProperty(document, "visibilityState", { value: v, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("reloads the workspace after more than two minutes away, without writing it back", async () => {
    const { result } = await boot();
    const now = Date.now();
    const spy = vi.spyOn(Date, "now");
    spy.mockReturnValue(now);
    act(() => setVisibility("hidden"));
    fetchWorkspace.mockImplementation(async () => workspace("Priya (edited by partner)"));
    spy.mockReturnValue(now + 3 * 60 * 1000);
    act(() => setVisibility("visible"));
    spy.mockRestore();

    await waitFor(() => expect(result.current.db.guests[0].name).toBe("Priya (edited by partner)"));
    // the raw setter was used: the refetch did not queue itself as writes
    expect(syncEntity).not.toHaveBeenCalled();
    expect(result.current.sync.pending).toBe(0);
  });

  it("does not reload after a short look away", async () => {
    await boot();
    const calls = fetchWorkspace.mock.calls.length;
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchWorkspace.mock.calls.length).toBe(calls);
  });
});

describe("saveNow — what sign-out checks before clearing unsaved edits", () => {
  it("sends queued edits immediately and reports nothing left", async () => {
    const { result } = await boot();
    act(() => result.current.setDb(rename("Priya D.")));
    let left = -1;
    await act(async () => { left = await result.current.saveNow(); });
    expect(left).toBe(0);
    expect(sentRows("guests").map((r) => r.name)).toContain("Priya D.");
  });

  it("reports what is still unsaved when it can't be sent", async () => {
    const { result } = await boot();
    syncEntity.mockRejectedValue(new Error("Failed to fetch"));
    act(() => result.current.setDb(rename("Priya D.")));
    let left = -1;
    await act(async () => { left = await result.current.saveNow(); });
    expect(left).toBe(1);
  });
});
