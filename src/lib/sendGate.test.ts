import { describe, it, expect } from "vitest";
import { emptyDb, type Db, type InvitationConfig } from "./store";
import { seedTemplates } from "./data";
import { FREE_DESIGN_ID } from "./plans";
import { sendGate, sendableNow } from "./sendGate";

/** Build anything; send what the plan includes (owner, 2026-11-15: "block until they pay"). */
const base = emptyDb({ names: "Maya & Theo", partnerA: "Maya", partnerB: "Theo", date: "2027-09-02T16:00:00Z", venue: "Villa", location: "Ravello", timezone: "UTC", locale: "en-GB", currency: "EUR", slug: "maya-theo" });
const make = (plan: Db["plan"], invitation: Partial<InvitationConfig>) => ({ plan, invitation: { ...base.invitation, ...invitation } });
const plain = seedTemplates.find((t) => !t.luxe && t.id !== FREE_DESIGN_ID && t.photo)!;
const luxe = seedTemplates.find((t) => t.luxe)!;
const rose = { bg: "#fff0f3", ink: "#3a2a30", accent: "#c98a9a" };

describe("sendGate", () => {
  it("lets the free design go out as it is", () => {
    expect(sendGate(make("essential", { templateId: FREE_DESIGN_ID, colors: null, fontSerif: null }))).toBeNull();
  });

  it("holds a design the plan doesn't include, naming it and the plan that sends it", () => {
    expect(sendGate(make("essential", { templateId: plain.id }))).toEqual({ plan: "celebration", feature: "allDesigns", what: `the ${plain.name} design` });
    expect(sendGate(make("celebration", { templateId: luxe.id }))).toMatchObject({ plan: "luxe", feature: "premiumDesigns" });
    expect(sendGate(make("celebration", { templateId: "studio:celestial" }))).toMatchObject({ plan: "luxe", what: "the Celestial design" });
    expect(sendGate(make("luxe", { templateId: "studio:celestial" }))).toBeNull();
  });

  it("holds the couple's own colours, lettering or photo on the free plan, not on Celebration", () => {
    const own = { plan: "celebration", feature: "customize", what: "your own colours and photo" };
    expect(sendGate(make("essential", { templateId: FREE_DESIGN_ID, colors: rose }))).toEqual(own);
    expect(sendGate(make("essential", { templateId: FREE_DESIGN_ID, fontSerif: false }))).toEqual(own);
    expect(sendGate(make("celebration", { templateId: plain.id, colors: rose, photo: "https://x.supabase.co/storage/v1/object/public/media/w/p.jpg" }))).toBeNull();
  });

  it("doesn't count a design's own photo as the couple's", () => {
    expect(sendGate(make("celebration", { templateId: plain.id, photo: plain.photo! }))).toBeNull();
  });
});

describe("sendableNow", () => {
  it("goes back to the free design and the design's own look, keeping the words", () => {
    const next = sendableNow(make("essential", { templateId: plain.id, colors: rose, fontSerif: true, line1: "With love" }));
    expect(next).toEqual({ templateId: FREE_DESIGN_ID, colors: null, fontSerif: null, photo: null });
    expect(sendGate({ plan: "essential", invitation: { ...base.invitation, templateId: plain.id, colors: rose, ...next } })).toBeNull();
  });

  it("on Celebration, only a Luxe design changes; the couple's colours stay", () => {
    expect(sendableNow(make("celebration", { templateId: luxe.id, colors: rose }))).toEqual({ templateId: FREE_DESIGN_ID });
  });
});
