import { describe, it, expect } from "vitest";
import { buildExport, exportFileName } from "./exportData";
import { emptyDb } from "./store";
import type { Guest } from "./data";

const wedding = { names: "Maya & Theo", partnerA: "Maya", partnerB: "Theo", date: "2027-06-12T15:00:00.000Z", venue: "The Old Mill", location: "Sofia", timezone: "Europe/Sofia", locale: "en-GB", currency: "EUR", slug: "maya-theo-7k3q" };
const guest: Guest = { id: "g1", name: "Priya", party: "A", rsvp: "confirmed", meal: "Fish", table: null, seat: null, plusOneOf: null, dietary: "Nut allergy", notes: "" };
const at = new Date("2026-10-15T20:00:00.000Z");

describe("buildExport — everything the couple has, in one file", () => {
  const db = { ...emptyDb(wedding), guests: [guest] };
  const out = buildExport(db, { name: "maya", email: "maya@example.com" }, "w-1", at);

  it("includes the people and the planning data", () => {
    expect(out.guests[0]).toMatchObject({ name: "Priya", dietary: "Nut allergy", meal: "Fish" });
    expect(out.wedding.names).toBe("Maya & Theo");
    for (const key of ["rsvps", "seating", "budget", "vendors", "tasks", "registry", "invitation", "website", "customDesigns"]) {
      expect(out).toHaveProperty(key);
    }
  });

  it("says what it is, whose it is, and when it was made", () => {
    expect(out).toMatchObject({ format: "luma-export", version: 1, exportedAt: "2026-10-15T20:00:00.000Z", account: { email: "maya@example.com" }, weddingId: "w-1" });
  });

  it("is plain JSON that round-trips", () => {
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it("drops a demo song's blob: address, which means nothing outside the tab", () => {
    const demo = { ...db, invitation: { ...db.invitation, music: { track: "upload" as const, uploadName: "x", uploadUrl: "blob:http://localhost/abc" } } };
    expect(buildExport(demo, null, null, at).invitation.music.uploadUrl).toBeNull();
  });

  it("keeps a real song's storage address", () => {
    const real = { ...db, invitation: { ...db.invitation, music: { track: "upload" as const, uploadName: "x", uploadUrl: "https://abc.supabase.co/storage/v1/object/public/media/w/music/s.mp3" } } };
    expect(buildExport(real, null, null, at).invitation.music.uploadUrl).toMatch(/^https:/);
  });
});

describe("exportFileName", () => {
  it("names the file after the wedding and the day", () => {
    expect(exportFileName(emptyDb(wedding), at)).toBe("luma-maya-theo-7k3q-2026-10-15.json");
  });
});
