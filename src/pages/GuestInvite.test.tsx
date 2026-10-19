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
    music: { track: "serene", uploadName: null, uploadUrl: null },
  },
  custom: null,
  website: { published: false },
} as unknown as PublicInvitation;

let payload: unknown = unpublished;

vi.mock("../lib/api", () => ({
  getPublicInvitation: vi.fn(async () => payload),
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
const leaveFor = vi.fn();
vi.mock("../lib/links", async () => ({ ...(await vi.importActual<typeof import("../lib/links")>("../lib/links")), leaveFor: (u: string) => leaveFor(u) }));
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

describe("GuestInvite — an invitation the couple hasn't opened yet (0011)", () => {
  it("says it isn't open, and shows none of the wedding's details", async () => {
    payload = { slug: "ana-and-ben-7k3q", live: false };
    render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben-7k3q"]}>
        <GuestInvite />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: /isn't open yet/i })).toBeTruthy();
    expect(screen.queryByText(/Ana/)).toBeNull();
    expect(screen.queryByText(/The Old Mill/)).toBeNull();
    expect(screen.queryByText("Will you join us?")).toBeNull();
    payload = unpublished;
  });
});

describe("GuestInvite — the couple's uploaded song (Block 6)", () => {
  const withSong = (plan: string) => ({
    ...(unpublished as object),
    plan,
    invitation: {
      ...((unpublished as { invitation: object }).invitation),
      music: { track: "upload", uploadName: "Our first dance", url: "https://abc.supabase.co/storage/v1/object/public/media/w/music/song.mp3" },
    },
  });

  it("plays it from storage on a Luxe wedding", async () => {
    payload = withSong("luxe");
    const { container } = render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben"]}><GuestInvite /></MemoryRouter>,
    );
    await screen.findByText("Will you join us?");
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("https://abc.supabase.co/storage/v1/object/public/media/w/music/song.mp3");
    expect(screen.getByRole("button", { name: /play music/i }).textContent).toMatch(/Our first dance/);
    payload = unpublished;
  });

  it("doesn't play it once the wedding's plan no longer includes music", async () => {
    payload = withSong("celebration");
    const { container } = render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben"]}><GuestInvite /></MemoryRouter>,
    );
    await screen.findByText("Will you join us?");
    expect(container.querySelector("audio")).toBeNull();
    payload = unpublished;
  });
});

describe("GuestInvite — a wedding using one of the owner's own designs (Block 18)", () => {
  const studio = (plan: string) => ({ ...unpublished, plan, invitation: { ...unpublished.invitation, template_id: "studio:celestial" } });

  it("sends the guest to the design's page, keeping their link", async () => {
    payload = studio("luxe");
    leaveFor.mockClear();
    render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben&src=whatsapp"]}>
        <GuestInvite />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(leaveFor).toHaveBeenCalledWith("/designs/celestial/index.html?slug=ana-and-ben&src=whatsapp"));
    expect(screen.queryByText("Will you join us?")).toBeNull();
    payload = unpublished;
  });

  it("stays on Luma's own page when the plan no longer includes the design", async () => {
    payload = studio("celebration");
    leaveFor.mockClear();
    render(
      <MemoryRouter initialEntries={["/invite?slug=ana-and-ben"]}>
        <GuestInvite />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Will you join us?")).toBeTruthy();
    expect(leaveFor).not.toHaveBeenCalled();
    payload = unpublished;
  });
});
