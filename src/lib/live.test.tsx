import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Block 13b: a partner's change reaches an open planner live (0019).
 * Echoes of our own saves are ignored, deletes from other weddings are
 * ignored, bursts become one reload, and a reload never paints over edits
 * that haven't been saved yet.
 */
const EMAIL = "couple@example.com";
const WEDDING_ID = "11111111-1111-4111-8111-111111111111";
const G1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
  budget: [], tasks: [], vendors: [], tables: [], venueObjects: [], registry: [],
  plan: "celebration",
  invitation: {
    headline: "Maya & Theo", line1: "", line2: "", venueLine: "", rsvp: true, meal: true, notes: true,
    photo: null, colors: null, fontSerif: null,
    motion: { petals: "gentle", shimmer: true, type: true },
    music: { track: "serene", uploadName: null, uploadUrl: null },
  },
  website: { template: "serene", sections: {}, bg: "#FFF8F0" },
  customTemplates: [], rsvpLog: [],
});

type Change = import("./api").RemoteChange;
let emit: (c: Change) => void = () => {};
const unsubscribe = vi.fn();
const syncEntity = vi.fn();
const fetchWorkspace = vi.fn();
let serverName = "Priya Desai";

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
    syncEntity: (...a: unknown[]) => syncEntity(...a),
    subscribeToWedding: (_w: string, cb: (c: Change) => void) => { emit = cb; return unsubscribe; },
  };
});

const { AppProvider, useApp } = await import("./store");
const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

async function boot() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.booting).toBe(false));
  await waitFor(() => expect(hook.result.current.db.guests.length).toBe(1));
  vi.useFakeTimers({ shouldAdvanceTime: true });
  return hook;
}
const fetches = () => fetchWorkspace.mock.calls.length;
const settle = async (ms = 1600) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  localStorage.clear();
  serverName = "Priya Desai";
  emit = () => {};
  unsubscribe.mockClear();
  syncEntity.mockReset();
  syncEntity.mockResolvedValue({});
  fetchWorkspace.mockReset();
  fetchWorkspace.mockImplementation(async (_w: string, _u: string, versions?: Map<string, string>) => {
    versions?.set(`guests:${G1}`, "2026-10-16T10:00:00.000000+00:00");
    return workspace(serverName);
  });
});
afterEach(() => { vi.useRealTimers(); });

describe("live updates", () => {
  it("a partner's edit appears without switching tabs, with a quiet note", async () => {
    const { result } = await boot();
    const before = fetches();
    serverName = "Priya (partner's edit)";
    act(() => emit({ type: "UPDATE", table: "guests", id: G1, updatedAt: "2026-10-16T10:05:00.000000+00:00" }));
    await settle();
    await waitFor(() => expect(result.current.db.guests[0].name).toBe("Priya (partner's edit)"));
    expect(fetches()).toBe(before + 1);
    expect(result.current.toasts.map((t) => t.title)).toContain("Updated with the latest changes");
  });

  it("our own save, echoed back with the version we already have, is ignored", async () => {
    await boot();
    const before = fetches();
    act(() => emit({ type: "UPDATE", table: "guests", id: G1, updatedAt: "2026-10-16T10:00:00Z" }));
    await settle();
    expect(fetches()).toBe(before);
  });

  it("a delete from another wedding is ignored; a delete of one of our rows reloads", async () => {
    await boot();
    const before = fetches();
    act(() => emit({ type: "DELETE", table: "guests", id: "99999999-9999-4999-8999-999999999999", updatedAt: null }));
    await settle();
    expect(fetches()).toBe(before);
    act(() => emit({ type: "DELETE", table: "guests", id: G1, updatedAt: null }));
    await settle();
    expect(fetches()).toBe(before + 1);
  });

  it("a burst of changes becomes one reload", async () => {
    await boot();
    const before = fetches();
    act(() => {
      for (let i = 1; i <= 5; i++) emit({ type: "UPDATE", table: "guests", id: G1, updatedAt: `2026-10-16T10:0${i}:00Z` });
      emit({ type: "INSERT", table: "tasks", id: "t-new", updatedAt: "2026-10-16T10:09:00Z" });
    });
    await settle();
    expect(fetches()).toBe(before + 1);
  });

  it("never paints over edits that haven't saved yet; reloads once they have", async () => {
    const { result } = await boot();
    syncEntity.mockRejectedValue(new Error("Failed to fetch")); // our edit can't be saved right now
    act(() => result.current.setDb((d) => ({ ...d, guests: d.guests.map((g) => ({ ...g, name: "My unsaved edit" })) })));
    const before = fetches();
    serverName = "Priya (partner's edit)";
    act(() => emit({ type: "UPDATE", table: "guests", id: G1, updatedAt: "2026-10-16T10:05:00Z" }));
    await settle();
    expect(result.current.db.guests[0].name).toBe("My unsaved edit");
    expect(fetches()).toBe(before);

    syncEntity.mockResolvedValue({}); // the connection is back
    await settle(3100);
    await waitFor(() => expect(fetches()).toBe(before + 1));
  });

  it("stops listening when the planner closes", async () => {
    const { unmount } = await boot();
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
