import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/**
 * A new plan used to open empty: no tasks, an empty "This week". Setting up
 * the wedding now gives it its first steps, dated back from the day, and
 * sends them to the server like any other edit.
 */
const WEDDING_ID = "22222222-2222-4222-8222-222222222222";
const wedding = {
  names: "Mila & Theo", partnerA: "Mila", partnerB: "Theo",
  date: new Date(Date.now() + 330 * 86400000).toISOString(),
  venue: "Villa Lago", location: "", timezone: "UTC", locale: "en-US", currency: "USD", slug: "mila-theo-x1",
};

vi.mock("./supabase", () => ({ isSupabaseConfigured: true, sb: null, requireSb: () => { throw new Error("not used"); } }));

const syncEntitySpy = vi.fn().mockResolvedValue(undefined);
vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    authApi: {
      session: vi.fn().mockResolvedValue({ user: { id: "user-9", email: "mila@example.com" } }),
      onAuthChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    acceptPendingInvites: vi.fn().mockResolvedValue(0),
    myWeddingId: vi.fn().mockResolvedValue(null),
    createWedding: vi.fn().mockResolvedValue({ weddingId: WEDDING_ID, wedding }),
    fetchFreshRsvps: vi.fn().mockResolvedValue([]),
    syncEntity: syncEntitySpy,
  };
});

const { AppProvider, useApp } = await import("./store");
const wrapper = ({ children }: { children: React.ReactNode }) => <AppProvider>{children}</AppProvider>;

describe("setting up a new wedding", () => {
  it("opens the plan on its first steps, with this week filled in, and saves them", async () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    await waitFor(() => expect(result.current.needsOnboarding).toBe(true));
    await act(async () => {
      await result.current.completeOnboarding({ partnerA: "Mila", partnerB: "Theo", names: "Mila & Theo", date: wedding.date, venue: "Villa Lago" });
    });
    const tasks = result.current.db.tasks;
    expect(tasks.length).toBeGreaterThan(20);
    expect(tasks.filter((t) => t.week).map((t) => t.title)).toEqual(["Book the venue", "Hire a photographer", "Book a caterer tasting"]);
    await waitFor(() => expect(syncEntitySpy.mock.calls.some(([key]) => key === "tasks")).toBe(true), { timeout: 4000 });
  });
});
