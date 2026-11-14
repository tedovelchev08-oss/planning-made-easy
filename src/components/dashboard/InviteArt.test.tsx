import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { seedTemplates } from "../../lib/data";

/**
 * Editing on the invitation itself (A + C, step 2): the words are typed over
 * in place, the date opens a date picker, and missing parts offer "+ Add".
 * Guests never get any of it.
 */
vi.mock("../../lib/store", async () => {
  const actual = await vi.importActual<typeof import("../../lib/store")>("../../lib/store");
  return { ...actual, usePrefersReducedMotion: () => true };
});
const { InviteArt } = await import("./Invitations");

const template = seedTemplates[0];
const colors = { bg: template.bg, ink: template.ink, accent: template.accent };
const cfg = { names: "Maya & Theo", line1: "Together with their families", line2: "invite you", venueLine: "Villa Cimbrone", rsvp: true, meal: false, notes: false, photo: null };
const editor = () => ({ set: vi.fn(), onDate: vi.fn(), onPhoto: vi.fn(), onReplies: vi.fn(), onAddReplies: vi.fn() });

describe("InviteArt", () => {
  it("is plain text for guests", () => {
    render(<InviteArt template={template} colors={colors} serif cfg={cfg} animated={false} dateIso="2027-09-02T16:00:00Z" />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(/Villa Cimbrone/)).toBeTruthy();
  });

  it("lets the couple type over a name and keeps the other one", () => {
    const edit = editor();
    render(<InviteArt template={template} colors={colors} serif cfg={cfg} animated={false} dateIso="2027-09-02T16:00:00Z" edit={edit} />);
    const first = screen.getByRole("textbox", { name: "First name" });
    first.textContent = "Mia";
    fireEvent.input(first);
    expect(edit.set).toHaveBeenLastCalledWith({ names: "Mia & Theo" });
  });

  it("edits the wording lines and the venue in place", () => {
    const edit = editor();
    render(<InviteArt template={template} colors={colors} serif cfg={cfg} animated={false} dateIso="2027-09-02T16:00:00Z" edit={edit} />);
    const venue = screen.getByRole("textbox", { name: "Venue" });
    venue.textContent = "Lake Como";
    fireEvent.input(venue);
    expect(edit.set).toHaveBeenLastCalledWith({ venueLine: "Lake Como" });
  });

  it("changes the day from the date on the invitation", () => {
    const edit = editor();
    render(<InviteArt template={template} colors={colors} serif cfg={cfg} animated={false} dateIso="2027-09-02T16:00:00Z" edit={edit} />);
    fireEvent.change(screen.getByLabelText("Wedding date"), { target: { value: "2027-09-04" } });
    expect(edit.onDate).toHaveBeenCalledWith("2027-09-04");
  });

  it("offers to add a reply button when there isn't one, and opens reply settings when there is", () => {
    const edit = editor();
    const { rerender } = render(<InviteArt template={template} colors={colors} serif cfg={{ ...cfg, rsvp: false }} animated={false} dateIso="2027-09-02T16:00:00Z" edit={edit} />);
    fireEvent.click(screen.getByRole("button", { name: /Add a reply button/ }));
    expect(edit.onAddReplies).toHaveBeenCalled();
    rerender(<InviteArt template={template} colors={colors} serif cfg={cfg} animated={false} dateIso="2027-09-02T16:00:00Z" edit={edit} />);
    fireEvent.click(screen.getByRole("button", { name: "Reply settings" }));
    expect(edit.onReplies).toHaveBeenCalled();
  });
});
