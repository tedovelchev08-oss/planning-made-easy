import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * Supabase reports SIGNED_IN / TOKEN_REFRESHED for the same person whenever
 * a tab comes back into view. The planner used to reload the whole workspace
 * each time: it repainted this device's older copy and then a fetch that
 * could predate an edit just saved, so the screen showed old data (seen on
 * staging: Art Deco chosen and saved, Celestial still shown). Only a
 * different person, or a sign-in after signing out, loads a workspace now.
 */
type AuthCb = (id: string | null, email: string | null) => void;
let authCb: AuthCb = () => {};
const fetchSpy = vi.fn();

const EMAIL = "couple@example.com";
const WEDDING_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("./supabase", () => ({
  isSupabaseConfigured: true,
  sb: null,
  requireSb: () => {
    throw new Error("not used in these tests");
  },
}));

const signOutSpy = vi.fn().mockResolvedValue(undefined);
const syncEntitySpy = vi.fn().mockResolvedValue(undefined);

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    authApi: {
      session: vi.fn().mockResolvedValue({ user: { id: "user-1", email: EMAIL } }),
      onAuthChange: vi.fn((cb: AuthCb) => { authCb = cb; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
      signOut: signOutSpy,
    },
    acceptPendingInvites: vi.fn().mockResolvedValue(undefined),
    myWeddingId: vi.fn().mockResolvedValue(WEDDING_ID),
    fetchWorkspace: fetchSpy.mockResolvedValue({
      wedding: {
        names: "Maya & Theo",
        partnerA: "Maya",
        partnerB: "Theo",
        date: new Date(Date.now() + 200 * 86400000).toISOString(),
        venue: "The Old Orangery",
        location: "Brooklyn",
        timezone: "UTC",
        locale: "en-US",
        currency: "USD",
        slug: "maya-theo",
      },
      guests: [
        {
          id: "g1",
          name: "Priya Desai",
          party: "A",
          rsvp: "confirmed",
          meal: null,
          table: null,
          seat: null,
          plusOneOf: null,
          dietary: null,
          notes: "",
        },
      ],
      budget: [],
      tasks: [],
      vendors: [],
      tables: [],
      venueObjects: [],
      registry: [],
      plan: "celebration",
      // Realistic enough for scheduleDiff, which reads invitation.music.*
      invitation: {
        headline: "Maya & Theo",
        line1: "",
        line2: "",
        venueLine: "",
        rsvp: true,
        meal: true,
        notes: true,
        photo: null,
        colors: null,
        fontSerif: null,
        motion: { petals: "gentle", shimmer: true, type: true },
        music: { track: "serene", uploadName: null, uploadUrl: null },
      },
      website: { template: "serene", sections: {}, bg: "#FFF8F0" },
      customTemplates: [],
      rsvpLog: [],
    }),
    fetchFreshRsvps: vi.fn().mockResolvedValue([]),
    syncEntity: syncEntitySpy,
  };
});

const { AppProvider, useApp } = await import("./store");
const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

async function booted() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.db.guests.length).toBe(1));
  await waitFor(() => expect(hook.result.current.booting).toBe(false));
  return hook;
}

beforeEach(() => { localStorage.clear(); fetchSpy.mockClear(); });

describe("sign-in events for the person already signed in", () => {
  it("don't reload and paint an older copy over an edit just made", async () => {
    const { result } = await booted();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const before = await fetchSpy.mock.results[0].value;

    // a reload, if one starts, is held in flight (as on a slow phone network)...
    let land: (v: unknown) => void = () => {};
    const usual = fetchSpy.getMockImplementation();
    fetchSpy.mockImplementation(() => new Promise((r) => { land = r; }));
    try {
      // ...when the tab comes back into view: SIGNED_IN, then TOKEN_REFRESHED, same person
      await act(async () => { authCb("user-1", EMAIL); authCb("user-1", EMAIL); });
      await act(async () => { await new Promise((r) => setTimeout(r, 100)); });

      // the couple picks Art Deco while it's in flight, then the old copy lands
      act(() => result.current.patch({ invitation: { ...result.current.db.invitation, templateId: "studio:art-deco" } }));
      await act(async () => { land(before); await new Promise((r) => setTimeout(r, 100)); });

      expect(result.current.db.invitation.templateId).toBe("studio:art-deco");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.current.booting).toBe(false);
    } finally {
      fetchSpy.mockImplementation(usual!);
    }
  });

  it("a different person signing in still loads their own workspace", async () => {
    await booted();
    await act(async () => { authCb("user-2", "partner@example.com"); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it("signing out and back in loads it again", async () => {
    await booted();
    await act(async () => { authCb(null, null); });
    await act(async () => { authCb("user-1", EMAIL); });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });
});
