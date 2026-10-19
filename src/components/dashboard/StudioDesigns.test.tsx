import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React, { useState } from "react";
import type { Db, InvitationConfig } from "../../lib/store";
import { invitationToRow } from "../../lib/api";

/**
 * Block 18b: choosing one of the owner's own designs in the planner, filling
 * in what it shows, and previewing the real page.
 */
const app = { db: null as unknown as Db, openUpgrade: vi.fn(), toast: vi.fn() };
vi.mock("../../lib/store", async () => ({
  ...(await vi.importActual<typeof import("../../lib/store")>("../../lib/store")),
  useApp: () => app,
}));
vi.mock("../../lib/sound", () => ({ playChime: vi.fn() }));

const { emptyDb } = await import("../../lib/store");
const { StudioDetails, StudioGallery, previewData, openStudioPreview } = await import("./StudioDesigns");
const { STUDIO_DESIGNS } = await import("../../../api/_lib/studioDesigns");
const celestial = STUDIO_DESIGNS[0];

function makeDb(plan: Db["plan"], invitation: Partial<InvitationConfig> = {}): Db {
  const db = emptyDb({
    names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris", date: "2027-06-12T14:00:00Z",
    venue: "Villa Lago", location: "Lake Como", timezone: "Europe/Rome", locale: "en-GB", currency: "EUR", slug: "ana-boris",
  });
  return { ...db, plan, invitation: { ...db.invitation, ...invitation } };
}

/** the component with real state, as the planner holds it */
function Harness({ initial, children }: { initial: InvitationConfig; children: (cfg: InvitationConfig, set: (p: Partial<InvitationConfig>) => void) => React.ReactNode }) {
  const [cfg, setCfg] = useState(initial);
  latest = cfg;
  return <>{children(cfg, (p) => setCfg((c) => ({ ...c, ...p })))}</>;
}
let latest: InvitationConfig;

beforeEach(() => { app.openUpgrade.mockClear(); app.toast.mockClear(); localStorage.clear(); });

describe("StudioGallery", () => {
  it("on Luxe, choosing Celestial selects it and drops any template's stock photo", () => {
    app.db = makeDb("luxe", { photo: "/photos/stock.jpg" });
    render(<Harness initial={app.db.invitation}>{(cfg, set) => <StudioGallery cfg={cfg} setCfg={set} />}</Harness>);
    fireEvent.click(screen.getByRole("button", { name: /Celestial/ }));
    expect(latest.templateId).toBe("studio:celestial");
    expect(latest.photo).toBeNull();
    expect(screen.getByRole("button", { name: /Celestial/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("on a smaller plan, it explains the upgrade and changes nothing", () => {
    app.db = makeDb("celebration");
    render(<Harness initial={app.db.invitation}>{(cfg, set) => <StudioGallery cfg={cfg} setCfg={set} />}</Harness>);
    fireEvent.click(screen.getByRole("button", { name: /Celestial/ }));
    expect(app.openUpgrade).toHaveBeenCalledWith("premiumDesigns");
    expect(latest.templateId).not.toBe("studio:celestial");
  });
});

describe("StudioDetails", () => {
  const mount = (invitation: Partial<InvitationConfig> = {}) => {
    app.db = makeDb("luxe", { templateId: "studio:celestial", ...invitation });
    render(<Harness initial={app.db.invitation}>{(cfg, set) => <StudioDetails cfg={cfg} setCfg={set} design={celestial} />}</Harness>);
  };

  it("saves the dress code, deadline, story and hashtag into the design details", () => {
    mount();
    fireEvent.change(screen.getByPlaceholderText("Black tie"), { target: { value: "Black tie" } });
    fireEvent.change(screen.getByPlaceholderText("1 May 2027"), { target: { value: "1 May 2027" } });
    fireEvent.change(screen.getByLabelText("Your story, first paragraph"), { target: { value: "We met in Sofia." } });
    fireEvent.change(screen.getByPlaceholderText("#AnaAndBoris"), { target: { value: "#AnaAndBoris" } });
    expect(latest.designData).toEqual({ dressCode: "Black tie", rsvpDeadline: "1 May 2027", story1: "We met in Sofia.", hashtag: "#AnaAndBoris" });
  });

  it("adds, fills and removes moments of the schedule, up to 12", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Add a moment/ }));
    fireEvent.change(screen.getByLabelText("Moment 1: time"), { target: { value: "16:00" } });
    fireEvent.change(screen.getByLabelText("Moment 1: what happens"), { target: { value: "Ceremony" } });
    fireEvent.change(screen.getByLabelText("Moment 1: icon"), { target: { value: "fa-ring" } });
    expect(latest.designData?.schedule).toEqual([{ time: "16:00", title: "Ceremony", venue: "", icon: "fa-ring" }]);
    fireEvent.click(screen.getByRole("button", { name: "Remove moment 1" }));
    expect(latest.designData?.schedule).toEqual([]);
    for (let i = 0; i < 12; i++) fireEvent.click(screen.getByRole("button", { name: /Add a moment/ }));
    expect(latest.designData?.schedule).toHaveLength(12);
    expect(screen.queryByRole("button", { name: /Add a moment/ })).toBeNull();
  });

  it("adds questions guests ask", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Add a question/ }));
    fireEvent.change(screen.getByLabelText("Question 1"), { target: { value: "Kids?" } });
    fireEvent.change(screen.getByLabelText("Answer 1"), { target: { value: "Adults only." } });
    expect(latest.designData?.faq).toEqual([{ question: "Kids?", answer: "Adults only." }]);
  });

  it("is quiet until a track is picked; picking one takes over from an uploaded song", () => {
    mount({ music: { track: "upload", uploadName: "Our waltz", uploadUrl: "https://x.supabase.co/song.mp3" } });
    expect(screen.getByText(/“Our waltz” plays/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Clair de lune/ }));
    expect(latest.designData?.musicTrack).toBe("clairdelune");
    // the song stays stored, it just isn't played
    expect(latest.music).toEqual({ track: "serene", uploadName: "Our waltz", uploadUrl: "https://x.supabase.co/song.mp3" });
    expect(screen.getByRole("button", { name: /Clair de lune/ }).getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the preview", () => {
  it("builds what the design page would receive from the planner's own copy", () => {
    const db = makeDb("luxe", { templateId: "studio:celestial", designData: { dressCode: "Black tie", musicTrack: "nocturne" } });
    expect(previewData(db, celestial)).toMatchObject({
      partner1: "Ana", partner2: "Boris", date: "2027-06-12", time: "16:00",
      venueName: "Villa Lago", dressCode: "Black tie", music: { enabled: true, track: "nocturne" },
    });
  });

  it("opens the real design page with ?preview=1 in its own tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openStudioPreview(makeDb("luxe", { templateId: "studio:celestial" }), celestial);
    expect(open).toHaveBeenCalledWith("/designs/celestial/index.html?preview=1", "luma-design-preview");
    expect(JSON.parse(localStorage.getItem("luma.designPreview")!).invitation.partner1).toBe("Ana");
  });
});

describe("saving", () => {
  it("the design details are saved with the invitation (0020 design_data)", () => {
    const db = makeDb("luxe", { designData: { dressCode: "Black tie" } });
    expect(invitationToRow(db.invitation, "w1").design_data).toEqual({ dressCode: "Black tie" });
    expect(invitationToRow({ ...db.invitation, designData: undefined }, "w1").design_data).toEqual({});
  });
});
