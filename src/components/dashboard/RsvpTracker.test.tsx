import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * While the planner loads, the RSVP list is this device's last copy. It
 * used to look final for several seconds (seen on staging); now it says the
 * newest answers are still on their way.
 */
const app: Record<string, unknown> = { booting: true };
vi.mock("../../lib/store", async () => {
  const actual = await vi.importActual<typeof import("../../lib/store")>("../../lib/store");
  const db = actual.emptyDb({ names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris", date: "2027-06-12T14:00:00Z", venue: "", location: "", timezone: "UTC", locale: "en-GB", currency: "EUR", slug: "ana-boris" });
  return { ...actual, useApp: () => ({ db, patch: vi.fn(), toast: vi.fn(), openUpgrade: vi.fn(), ...app }) };
});
const { RsvpTracker } = await import("./Invitations");

const mount = () => render(<MemoryRouter><RsvpTracker /></MemoryRouter>);

describe("RsvpTracker while the planner loads", () => {
  it("says it's checking for new answers", () => {
    app.booting = true;
    mount();
    expect(screen.getByRole("status").textContent).toMatch(/Checking for new answers/);
  });

  it("once loaded, it's the usual line again", () => {
    app.booting = false;
    mount();
    expect(screen.queryByText(/Checking for new answers/)).toBeNull();
    expect(screen.getByText(/Every answer from your link/)).toBeTruthy();
  });
});
