import { describe, it, expect } from "vitest";
import { emptyDb } from "../../lib/store";
import { STUDIO_DESIGNS } from "../../../api/_lib/studioDesigns";
import { studioEditPatch } from "./studioEdit";

/** Words typed on a studio design in the planner, saved to the right place. */
const db = emptyDb({ names: "Maya & Theo", partnerA: "Maya", partnerB: "Theo", date: "2027-09-02T16:00:00Z", venue: "Villa", location: "Florence", timezone: "UTC", locale: "en-GB", currency: "EUR", slug: "maya-theo" });
const mirror = STUDIO_DESIGNS.find((d) => d.id === "mirror-palace")!;
const celestial = STUDIO_DESIGNS.find((d) => d.id === "celestial")!;

describe("studioEditPatch", () => {
  it("renames one partner and keeps the couple's names together", () => {
    const p = studioEditPatch(db, celestial, "partner1", "Mia")!;
    expect(p.wedding).toMatchObject({ partnerA: "Mia", partnerB: "Theo", names: "Mia & Theo" });
    expect(p.invitation!.names).toBe("Mia & Theo");
  });

  it("keeps the venue and address with the wedding", () => {
    expect(studioEditPatch(db, celestial, "venueName", "Villa  Cora")!.wedding!.venue).toBe("Villa Cora");
    expect(studioEditPatch(db, celestial, "venueAddress", "Viale Machiavelli 18")!.wedding!.location).toBe("Viale Machiavelli 18");
  });

  it("keeps the story's paragraphs, and a one-block story replaces both", () => {
    expect(studioEditPatch(db, celestial, "story1", "We met.\n\nThen again.")!.invitation!.designData!.story1).toBe("We met.\n\nThen again.");
    const one = studioEditPatch(db, mirror, "story", "All of it")!.invitation!.designData!;
    expect(one).toMatchObject({ story1: "All of it", story2: "" });
  });

  it("saves a design's own wording, up to its limit", () => {
    const p = studioEditPatch(db, mirror, "closingMsg", "x".repeat(100))!;
    expect(p.invitation!.designData!.texts!.closingMsg).toHaveLength(40);
  });

  it("saves Riviera's and Palm Springs' own lines", () => {
    const riviera = STUDIO_DESIGNS.find((d) => d.id === "riviera")!;
    const springs = STUDIO_DESIGNS.find((d) => d.id === "palm-springs")!;
    expect(studioEditPatch(db, riviera, "heroPlace", "Portovenere")!.invitation!.designData!.texts!.heroPlace).toBe("Portovenere");
    expect(studioEditPatch(db, springs, "inviteLine", "poolside, at dusk")!.invitation!.designData!.texts!.inviteLine).toBe("poolside, at dusk");
    expect(studioEditPatch(db, springs, "heroPlace", "Portovenere")).toBeNull();
  });

  it("saves Palm Shadow's and The Tide's own lines", () => {
    const shadow = STUDIO_DESIGNS.find((d) => d.id === "palm-shadow")!;
    const tide = STUDIO_DESIGNS.find((d) => d.id === "tide")!;
    expect(studioEditPatch(db, shadow, "cardAbove", "With their families")!.invitation!.designData!.texts!.cardAbove).toBe("With their families");
    expect(studioEditPatch(db, tide, "cardLine", "We met on a beach.")!.invitation!.designData!.texts!.cardLine).toBe("We met on a beach.");
    expect(studioEditPatch(db, shadow, "cardLine", "x")).toBeNull();
  });

  it("saves Cinema's slate and All In's place", () => {
    const cinema = STUDIO_DESIGNS.find((d) => d.id === "cinema")!;
    const allIn = STUDIO_DESIGNS.find((d) => d.id === "all-in")!;
    expect(studioEditPatch(db, cinema, "heroEyebrow", "Scene 01 — Lake Como")!.invitation!.designData!.texts!.heroEyebrow).toBe("Scene 01 — Lake Como");
    expect(studioEditPatch(db, allIn, "heroPlace", "Villa Aurelia, Rome")!.invitation!.designData!.texts!.heroPlace).toBe("Villa Aurelia, Rome");
    expect(studioEditPatch(db, cinema, "heroPlace", "x")).toBeNull();
  });

  it("saves Red Thread's and Glasshouse's own lines", () => {
    const red = STUDIO_DESIGNS.find((d) => d.id === "red-thread")!;
    const glass = STUDIO_DESIGNS.find((d) => d.id === "glasshouse")!;
    expect(studioEditPatch(db, red, "heroQuote", "It never breaks.")!.invitation!.designData!.texts!.heroQuote).toBe("It never breaks.");
    expect(studioEditPatch(db, glass, "glassNote", "Still growing")!.invitation!.designData!.texts!.glassNote).toBe("Still growing");
    expect(studioEditPatch(db, red, "glassNote", "x")).toBeNull();
  });

  it("saves Liquid Gold's and Inscription's own lines", () => {
    const gold = STUDIO_DESIGNS.find((d) => d.id === "liquid-gold")!;
    const ins = STUDIO_DESIGNS.find((d) => d.id === "inscription")!;
    expect(studioEditPatch(db, gold, "heroQuote", "Two lives. One promise.")!.invitation!.designData!.texts!.heroQuote).toBe("Two lives. One promise.");
    expect(studioEditPatch(db, ins, "inscriptionAbove", "They are to be married")!.invitation!.designData!.texts!.inscriptionAbove).toBe("They are to be married");
    expect(studioEditPatch(db, gold, "inscriptionAbove", "x")).toBeNull();
  });

  it("saves Map's and Plaster's own lines", () => {
    const map = STUDIO_DESIGNS.find((d) => d.id === "map")!;
    const plaster = STUDIO_DESIGNS.find((d) => d.id === "plaster")!;
    expect(studioEditPatch(db, map, "fromPlace", "Hydra")!.invitation!.designData!.texts!.fromPlace).toBe("Hydra");
    expect(studioEditPatch(db, map, "scheduleLede", "Walkable.\nThen a boat.")!.invitation!.designData!.texts!.scheduleLede).toBe("Walkable.\nThen a boat.");
    expect(studioEditPatch(db, plaster, "storyHeadline", "A flat tyre.")!.invitation!.designData!.texts!.storyHeadline).toBe("A flat tyre.");
    expect(studioEditPatch(db, plaster, "fromPlace", "x")).toBeNull();
  });

  it("ignores keys a design wasn't given, and anything that isn't text", () => {
    expect(studioEditPatch(db, celestial, "closingMsg", "Until then")).toBeNull();
    expect(studioEditPatch(db, celestial, "plan", "luxe")).toBeNull();
    expect(studioEditPatch(db, celestial, "partner1", 42)).toBeNull();
  });
});
