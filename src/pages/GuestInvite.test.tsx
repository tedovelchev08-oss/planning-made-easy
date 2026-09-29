import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PublicInvitation } from "../lib/api";

/**
 * What get_public_wedding returns for a wedding whose website is NOT yet
 * published: `website` shrinks to { published: false } and `registry` is
 * absent. The guest page read pub.registry.map(...) and crashed into the
 * error screen for every such couple.
 */
const unpublished = {
  slug: "ana-and-ben", names: "Ana & Ben", partnerA: "Ana", partnerB: "Ben",
  date: "2027-06-12T15:00:00.000Z", venue: "The Old Mill", location: "Sofia",
  timezone: "Europe/Sofia", locale: "en-GB", currency: "EUR", plan: "essential",
  invitation: {
    template_id: "tp13", line1: "Together with their families", line2: "request the pleasure of your company",
    venue_line: "The Old Mill · Sofia", collect_rsvp: true, collect_meal: true, collect_notes: true,
    photo: null, colors: null, font_serif: null,
    motion: { petals: "gentle", shimmer: true, type: true },
    music: { track: "serene", uploadName: null, uploadData: null },
  },
  custom: null,
  website: { published: false },
} as unknown as PublicInvitation;

vi.mock("../lib/api", () => ({
  getPublicInvitation: vi.fn(async () => unpublished),
  getGuestByToken: vi.fn(async () => null),
  submitRsvp: vi.fn(),
}));
vi.mock("../lib/store", async () => {
  const actual = await vi.importActual<typeof import("../lib/store")>("../lib/store");
  return {
    ...actual,
    useApp: () => ({
      // the signed-out visitor's placeholder workspace; the page must render
      // from the public record, not from this
      db: actual.emptyDb({ names: "", partnerA: "", partnerB: "", date: "2027-01-01T00:00:00.000Z", venue: "", location: "", timezone: "UTC", locale: "en-US", currency: "USD", slug: "" }),
      patch: vi.fn(), toast: vi.fn(), mode: "cloud",
    }),
    usePrefersReducedMotion: () => true,
  };
});
vi.mock("../lib/sound", () => ({ playChime: vi.fn(), useChimeLoop: () => ({ playing: false, toggle: vi.fn(), stop: vi.fn() }) }));

import GuestInvite from "./GuestInvite";

describe("GuestInvite — a wedding whose site is not published yet", () => {
  it("renders the invitation instead of crashing", async () => {
    render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben"]}>
        <GuestInvite />
      </MemoryRouter>,
    );
    // the couple's own venue line and the RSVP form: rendered from the public record
    expect(await screen.findByText("The Old Mill · Sofia")).toBeTruthy();
    expect(screen.getByText("Will you join us?")).toBeTruthy();
    expect(screen.queryByText(/can't be found/i)).toBeNull();
    expect(screen.queryByText(/hiccuped/i)).toBeNull();
  });
});
