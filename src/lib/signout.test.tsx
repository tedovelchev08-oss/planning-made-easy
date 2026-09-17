import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * The cloud-mode sign-out reset (PR #13 / handoff P2).
 *
 * The bug: signOut() cleared the session but not `db`, so the previous
 * couple's guests, budget and plan survived in memory and in the offline
 * cache, and Shell fell back to the demo identity over real data.
 *
 * It has never been exercised end to end, because that needs a real
 * authenticated Supabase session. These tests force cloud mode by mocking the
 * module boundary instead, so the reset logic itself is covered. That is not
 * the same as a production sign-out, but it does verify every branch the fix
 * added — including the flush race, which is hard to hit by hand.
 */

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
      onAuthChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: signOutSpy,
    },
    acceptPendingInvites: vi.fn().mockResolvedValue(undefined),
    myWeddingId: vi.fn().mockResolvedValue(WEDDING_ID),
    fetchWorkspace: vi.fn().mockResolvedValue({
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
        music: { track: "serene", uploadName: null, uploadData: null },
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
const cacheKey = (email: string) => `luma.cache.${email}`;

/** Boot the provider and wait for the mocked cloud workspace to land. */
async function bootedCloud() {
  const hook = renderHook(() => useApp(), { wrapper });
  await waitFor(() => expect(hook.result.current.mode).toBe("cloud"));
  await waitFor(() => expect(hook.result.current.db.guests.length).toBe(1));
  return hook;
}

beforeEach(() => {
  localStorage.clear();
  signOutSpy.mockClear();
  signOutSpy.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signOut in cloud mode", () => {
  it("boots into cloud mode with the fetched workspace", async () => {
    const { result } = await bootedCloud();
    expect(result.current.mode).toBe("cloud");
    expect(result.current.db.guests[0].name).toBe("Priya Desai");
    expect(result.current.user?.email).toBe(EMAIL);
  });

  it("empties the workspace rather than leaving the previous couple loaded", async () => {
    const { result } = await bootedCloud();
    act(() => result.current.signOut());

    expect(result.current.db.guests).toHaveLength(0);
    expect(result.current.db.wedding.names).toBe("");
    expect(result.current.user).toBeNull();
  });

  it("clears the weddingId and onboarding flag", async () => {
    const { result } = await bootedCloud();
    act(() => result.current.signOut());

    expect(result.current.weddingId).toBeNull();
    expect(result.current.needsOnboarding).toBe(false);
  });

  it("removes the offline cache entry, which is keyed on email not id", async () => {
    const { result } = await bootedCloud();
    await waitFor(() => expect(localStorage.getItem(cacheKey(EMAIL))).not.toBeNull());

    act(() => result.current.signOut());
    expect(localStorage.getItem(cacheKey(EMAIL))).toBeNull();
  });

  it("resets even when the Supabase sign-out rejects", async () => {
    // The whole reason the reset does not wait on onAuthChange: the rejection
    // is swallowed, so without a local reset the UI would look signed out over
    // a still-loaded workspace.
    signOutSpy.mockRejectedValueOnce(new Error("network down"));
    const { result } = await bootedCloud();

    act(() => result.current.signOut());

    expect(result.current.user).toBeNull();
    expect(result.current.db.guests).toHaveLength(0);
    expect(localStorage.getItem(cacheKey(EMAIL))).toBeNull();
  });

  it("does not let a queued flush rewrite the cache it just cleared", async () => {
    // The race the fix addresses: flush() ends with writeCache(email, db) on a
    // ~700ms timer. Sign out, then run every pending timer — the entry must
    // stay gone.
    const { result } = await bootedCloud();

    act(() => {
      result.current.setDb((d) => ({
        ...d,
        guests: [...d.guests, { ...d.guests[0], id: "g2", name: "Late Edit" }],
      }));
    });

    act(() => result.current.signOut());
    expect(localStorage.getItem(cacheKey(EMAIL))).toBeNull();

    // Let anything still queued fire.
    await new Promise((r) => setTimeout(r, 1200));
    expect(localStorage.getItem(cacheKey(EMAIL))).toBeNull();
    expect(result.current.db.guests).toHaveLength(0);
  });

  it("leaves another account's cached workspace untouched", async () => {
    const other = cacheKey("someone-else@example.com");
    localStorage.setItem(other, JSON.stringify({ marker: "keep me" }));

    const { result } = await bootedCloud();
    act(() => result.current.signOut());

    expect(localStorage.getItem(cacheKey(EMAIL))).toBeNull();
    expect(localStorage.getItem(other)).toContain("keep me");
  });

  it("is safe to call twice", async () => {
    const { result } = await bootedCloud();
    act(() => result.current.signOut());
    act(() => result.current.signOut());

    expect(result.current.user).toBeNull();
    expect(result.current.db.guests).toHaveLength(0);
  });
});
