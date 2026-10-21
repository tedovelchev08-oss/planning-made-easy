import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React, { useState } from "react";
import type { Db, InvitationConfig } from "../../lib/store";

/**
 * Block 18d: a design with more to fill in (Mirror Palace) gets its own
 * photo slots, a gallery and its own wording in the planner, all saved in
 * the invitation's design details.
 */
const app = { db: null as unknown as Db, openUpgrade: vi.fn(), toast: vi.fn() };
vi.mock("../../lib/store", async () => ({ ...(await vi.importActual<object>("../../lib/store")), useApp: () => app }));
vi.mock("../../lib/sound", () => ({ playChime: vi.fn() }));
// the uploader itself is tested on its own (PhotoUpload.test.tsx): here, a stand-in
vi.mock("./PhotoUpload", () => ({
  PhotoUpload: ({ label = "your invitation photo", photo, onChange }: { label?: string; photo: string | null; onChange: (u: string | null) => void }) => (
    <span>
      <button onClick={() => onChange(`https://abc.supabase.co/storage/v1/object/public/media/w1/photos/${label.replace(/\W+/g, "-")}.jpg`)}>Upload {label}</button>
      {photo && <button onClick={() => onChange(null)}>Remove {label}</button>}
    </span>
  ),
}));

const { emptyDb } = await import("../../lib/store");
const { StudioDetails } = await import("./StudioDesigns");
const { STUDIO_DESIGNS } = await import("../../../api/_lib/studioDesigns");
const mp = STUDIO_DESIGNS.find((d) => d.id === "mirror-palace")!;
const celestial = STUDIO_DESIGNS.find((d) => d.id === "celestial")!;

let latest: InvitationConfig;
function Harness({ design }: { design: typeof mp }) {
  const [cfg, setCfg] = useState<InvitationConfig>(app.db.invitation);
  latest = cfg;
  return <StudioDetails cfg={cfg} setCfg={(p) => setCfg((c) => ({ ...c, ...p }))} design={design} />;
}
const mount = (design = mp) => {
  const db = emptyDb({ names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris", date: "2027-06-12T14:00:00Z", venue: "", location: "", timezone: "UTC", locale: "en-GB", currency: "EUR", slug: "ana-boris" });
  app.db = { ...db, plan: "luxe", invitation: { ...db.invitation, templateId: `studio:${design.id}` } };
  render(<Harness design={design} />);
};
const url = (label: string) => `https://abc.supabase.co/storage/v1/object/public/media/w1/photos/${label.replace(/\W+/g, "-")}.jpg`;

describe("a design's own photos, gallery and wording", () => {
  it("each extra photo is saved under its own slot, and removed from it", () => {
    mount();
    const photos = screen.getByRole("region", { name: "Mirror Palace photos" });
    fireEvent.click(within(photos).getByRole("button", { name: "Upload The ceremony venue" }));
    fireEvent.click(within(photos).getByRole("button", { name: "Upload The two of you" }));
    expect(latest.designData?.photos).toEqual({ ceremonyPhoto: url("The ceremony venue"), storyPhotoTogether: url("The two of you") });
    fireEvent.click(within(photos).getByRole("button", { name: "Remove The ceremony venue" }));
    expect(latest.designData?.photos).toEqual({ storyPhotoTogether: url("The two of you") });
  });

  it("a gallery of up to five, with captions; removing a photo removes its place", () => {
    mount();
    const gallery = screen.getByRole("region", { name: "Gallery" });
    for (let i = 0; i < 5; i++) fireEvent.click(within(gallery).getByRole("button", { name: "Upload New gallery photo" }));
    expect(latest.designData?.gallery).toHaveLength(5);
    expect(within(gallery).queryByRole("button", { name: "Upload New gallery photo" })).toBeNull();
    fireEvent.change(within(gallery).getByLabelText("Gallery photo 2: caption"), { target: { value: "The proposal" } });
    expect(latest.designData?.gallery?.[1].caption).toBe("The proposal");
    fireEvent.click(within(gallery).getByRole("button", { name: "Remove Gallery photo 1" }));
    expect(latest.designData?.gallery).toHaveLength(4);
    expect(latest.designData?.gallery?.[0].caption).toBe("The proposal");
  });

  it("its own wording, within each line's limit", () => {
    mount();
    const wording = screen.getByRole("region", { name: "Mirror Palace wording" });
    fireEvent.change(within(wording).getByPlaceholderText("Florence"), { target: { value: "Lake Como" } });
    fireEvent.change(within(wording).getByPlaceholderText("Until We Meet"), { target: { value: "Until June" } });
    expect(latest.designData?.texts).toEqual({ heroCity: "Lake Como", closingMsg: "Until June" });
    expect(within(wording).getByPlaceholderText("Florence").getAttribute("maxlength")).toBe("40");
  });

  it("offers the design's own music", () => {
    mount();
    const music = screen.getByRole("region", { name: "Music" });
    fireEvent.click(within(music).getByRole("button", { name: /Prelude in E-flat minor/ }));
    expect(latest.designData?.musicTrack).toBe("prelude-ebm");
    expect(within(music).queryByRole("button", { name: /Clair de lune/ })).toBeNull();
  });

  it("a design's own choices (The Glasshouse's backdrop): the first is chosen until another is picked", () => {
    mount(STUDIO_DESIGNS.find((d) => d.id === "glasshouse")!);
    const pick = screen.getByRole("region", { name: "The glasshouse" });
    expect(within(pick).getByRole("button", { name: "Palm canopy" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(pick).getByRole("button", { name: "Misted panes" }));
    expect(latest.designData?.choices).toEqual({ backdrop: "assets/backdrops/backdrop-1.jpg" });
    expect(within(pick).getByRole("button", { name: "Misted panes" }).getAttribute("aria-pressed")).toBe("true");
    // no extra photo slots: no "More photos" section
    expect(screen.queryByRole("region", { name: /photos$/ })).toBeNull();
  });

  it("The Crossing: a photo per moment, and no music section (it has no player)", () => {
    mount(STUDIO_DESIGNS.find((d) => d.id === "map")!);
    fireEvent.click(screen.getByRole("button", { name: /Add a moment/ }));
    fireEvent.click(screen.getByRole("button", { name: "Upload Moment 1: photo" }));
    expect(latest.designData?.schedule?.[0].photo).toBe(url("Moment 1: photo"));
    expect(screen.queryByRole("region", { name: "Music" })).toBeNull();
  });

  it("a design without extras doesn't show them", () => {
    mount(celestial);
    expect(screen.queryByRole("region", { name: /photos$/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Gallery" })).toBeNull();
    expect(screen.getByRole("region", { name: "Music" }).textContent).toContain("Clair de lune");
  });
});
