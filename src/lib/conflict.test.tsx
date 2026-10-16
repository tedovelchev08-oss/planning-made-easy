import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Block 13a: every save carries the version the edit was made from (0018).
 * The store keeps those versions current (after its own saves too, so it
 * never conflicts with itself), and when the server refuses a stale row it
 * drops that edit, loads the partner's version and says so.
 * Cloud mode is forced by mocking the module boundary, as in sync.test.tsx.
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

const syncEntity = vi.fn<(key: string, wid: string, upserts: unknown[], deletes: string[]) => Promise<Record<string, string> | void>>();
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
const { ConflictError } = await import("./api");
type Db = import("./store").Db;

const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;
const rename = (name: string) => (d: Db): Db => ({ ...d, guests: d.guests.map((g) => ({ ...g, name })) });
const guestSends = () =>
  syncEntity.mock.calls.filter((c) => c[0] === "guests").flatMap((c) => c[2] as { name: string; updated_at: string | null }[]);

/** the server's copy, and the version it reports for the guest */
let serverName = "Priya Desai";
let serverVersion = "v1";

async function boot() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.booting).toBe(false));
  await waitFor(() => expect(hook.result.current.db.guests.length).toBe(1));
  return hook;
}

beforeEach(() => {
  localStorage.clear();
  serverName = "Priya Desai";
  serverVersion = "v1";
  syncEntity.mockReset();
  syncEntity.mockImplementation(async (key, _w, upserts) =>
    key === "guests" ? Object.fromEntries((upserts as { id: string }[]).map((r) => [r.id, (serverVersion = `${serverVersion}+`)])) : {});
  fetchWorkspace.mockReset();
  fetchWorkspace.mockImplementation(async (_w: string, _u: string, versions?: Map<string, string>) => {
    versions?.set(`guests:${G1}`, serverVersion);
    return workspace(serverName);
  });
});

describe("saves carry the version they were made from", () => {
  it("an edit is sent with the version this tab loaded", async () => {
    const { result } = await boot();
    act(() => result.current.setDb(rename("Priya D.")));
    await waitFor(() => expect(guestSends()).toHaveLength(1));
    expect(guestSends()[0]).toMatchObject({ name: "Priya D.", updated_at: "v1" });
  });

  it("the next edit is based on the version our own save produced", async () => {
    const { result } = await boot();
    act(() => result.current.setDb(rename("Priya D.")));
    await waitFor(() => expect(guestSends()).toHaveLength(1));
    act(() => result.current.setDb(rename("Priya Desai-Khan")));
    await waitFor(() => expect(guestSends()).toHaveLength(2));
    expect(guestSends()[1]).toMatchObject({ name: "Priya Desai-Khan", updated_at: "v1+" });
  });

  it("an edit made while a save is on the wire is re-based, so we never conflict with ourselves", async () => {
    const { result } = await boot();
    let release: (v: Record<string, string>) => void = () => {};
    syncEntity.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    act(() => result.current.setDb(rename("First")));
    await waitFor(() => expect(guestSends()).toHaveLength(1));
    act(() => result.current.setDb(rename("Second"))); // queued while "First" is in flight
    await act(async () => { release({ [G1]: "v2" }); });
    await waitFor(() => expect(guestSends()).toHaveLength(2));
    expect(guestSends()[1]).toMatchObject({ name: "Second", updated_at: "v2" });
  });
});

describe("a partner's newer change is never overwritten", () => {
  it("a refused edit isn't retried; the partner's version is loaded and the couple is told", async () => {
    const { result } = await boot();
    // meanwhile, the partner renamed the guest on their own device
    serverName = "Priya (partner's edit)";
    serverVersion = "v9";
    syncEntity.mockImplementation(async (key) => {
      if (key === "guests") throw new ConflictError("this was changed by someone else");
      return {};
    });

    act(() => result.current.setDb(rename("My stale edit")));

    await waitFor(() => expect(result.current.db.guests[0].name).toBe("Priya (partner's edit)"));
    expect(result.current.toasts.map((t) => t.title)).toContain("Your partner changed this");
    expect(guestSends()).toHaveLength(1); // sent once, refused, never retried
    expect(result.current.sync.problem ?? null).toBeNull();
    await waitFor(() => expect(localStorage.getItem(`luma.pending.${EMAIL}`)).toBeNull());
  });
});
