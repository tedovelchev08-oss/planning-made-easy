import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Block 22: the bell counts what needs attention, the panel lists it, a
 * reminder can be hidden for the day, and the most important one pops up
 * once a day.
 */
const yesterday = new Date(Date.now() - 86400000);
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const db = {
  wedding: { date: new Date(Date.now() + 400 * 86400000).toISOString() },
  guests: [{ id: "g1" }],
  invitation: { live: true },
  tasks: [{ id: "t1", title: "Book the florist", done: false, due: day(yesterday) }],
  vendors: [],
  rsvpLog: [{ id: "r1", name: "Priya", answer: "yes", synced: false }],
};
vi.mock("../../lib/store", () => ({ useApp: () => ({ db, weddingId: "w1" }), usePrefersReducedMotion: () => true }));
const { default: Reminders } = await import("./Reminders");

const mount = () => render(<MemoryRouter><Reminders /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); });

describe("Reminders", () => {
  it("the bell shows how many reminders there are, and the panel lists them", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Reminders, 2 new" }));
    const panel = screen.getByRole("dialog", { name: "Reminders" });
    expect(panel.textContent).toContain("A task is overdue");
    expect(panel.textContent).toContain("A new RSVP answer");
  });

  it("'Hide for today' removes one and remembers it on this device", () => {
    const first = mount();
    fireEvent.click(screen.getByRole("button", { name: "Reminders, 2 new" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Hide for today" })[0]);
    expect(screen.getByRole("button", { name: "Reminders, 1 new" })).toBeTruthy();
    first.unmount();
    mount();
    expect(screen.getByRole("button", { name: "Reminders, 1 new" })).toBeTruthy();
  });

  it("the most important reminder pops up once a day", async () => {
    const first = mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    const card = screen.getByRole("status", { name: "Reminder" });
    expect(card.textContent).toContain("A task is overdue");
    expect(card.textContent).toContain("See all 2 reminders");
    first.unmount();
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(screen.queryByRole("status", { name: "Reminder" })).toBeNull();
  });

  it("the card goes by itself after a few seconds, and the bell still has it", async () => {
    mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1300); });
    expect(screen.getByRole("status", { name: "Reminder" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(9100); });
    expect(screen.queryByRole("status", { name: "Reminder" })).toBeNull();
    expect(screen.getByRole("button", { name: /Reminders, 2 new/ })).toBeTruthy();
  });
});
