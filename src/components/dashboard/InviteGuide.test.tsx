import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuideField, GuideSwitch, InviteGuide, guideSeen, markGuideSeen, type GuideStep } from "./InviteGuide";

/** The first-time walk-through on the Invitation page: one question at a time. */
const steps = (onName = () => {}): GuideStep[] => [
  { id: "names", question: "Your names", help: "First names.", point: ["partner1", "partner2"], body: <GuideField label="First name" value="Maya" onChange={onName} /> },
  { id: "story", question: "How did you meet?", help: "A few lines.", point: ["story1"] },
  { id: "share", question: "Ready when you are", help: "Saved.", point: [] },
];

beforeEach(() => localStorage.clear());

describe("InviteGuide", () => {
  it("asks one question at a time and points the invitation at it", () => {
    const onPoint = vi.fn();
    render(<InviteGuide steps={steps()} onPoint={onPoint} onClose={() => {}} onShare={() => {}} />);
    expect(screen.getByRole("heading", { name: "Your names" })).toBeTruthy();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(onPoint).toHaveBeenLastCalledWith(["partner1", "partner2"]);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Skip this" }));
    expect(screen.getByRole("heading", { name: "How did you meet?" })).toBeTruthy();
    expect(onPoint).toHaveBeenLastCalledWith(["story1"]);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Your names" })).toBeTruthy();
  });

  it("doesn't point again while the couple types, only when the step changes", () => {
    const onPoint = vi.fn();
    const { rerender } = render(<InviteGuide steps={steps()} onPoint={onPoint} onClose={() => {}} onShare={() => {}} />);
    rerender(<InviteGuide steps={steps()} onPoint={onPoint} onClose={() => {}} onShare={() => {}} />);
    expect(onPoint).toHaveBeenCalledTimes(1);
  });

  it("ends on sharing, or keeps editing; Escape and the cross close it", () => {
    const onClose = vi.fn(), onShare = vi.fn();
    render(<InviteGuide steps={steps()} onPoint={() => {}} onClose={onClose} onShare={onShare} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share it" }));
    expect(onShare).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close the walk-through" }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("saves each answer as it's typed", () => {
    const onName = vi.fn();
    render(<InviteGuide steps={steps(onName)} onPoint={() => {}} onClose={() => {}} onShare={() => {}} />);
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Mia" } });
    expect(onName).toHaveBeenLastCalledWith("Mia");
  });
});

describe("GuideField", () => {
  it("keeps a space typed at the end while the field has focus, and follows changes otherwise", () => {
    const { rerender } = render(<GuideField label="First name" value="Mary" onChange={() => {}} />);
    const box = screen.getByLabelText("First name") as HTMLInputElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "Mary " } });
    // the saved names are tidied: the field doesn't jump back while typing
    rerender(<GuideField label="First name" value="Mary" onChange={() => {}} />);
    expect(box.value).toBe("Mary ");
    fireEvent.blur(box);
    rerender(<GuideField label="First name" value="Mary Ann" onChange={() => {}} />);
    expect(box.value).toBe("Mary Ann");
  });

  it("never saves an empty date", () => {
    const onChange = vi.fn();
    render(<GuideField label="Date" type="date" value="2027-09-02" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("GuideSwitch and the seen flag", () => {
  it("is a switch", () => {
    const onToggle = vi.fn();
    render(<GuideSwitch label="Reply form" on onToggle={onToggle} />);
    const sw = screen.getByRole("switch", { name: "Reply form" });
    expect(sw.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalled();
  });

  it("is offered once per wedding on this device", () => {
    expect(guideSeen("w1")).toBe(false);
    markGuideSeen("w1");
    expect(guideSeen("w1")).toBe(true);
    expect(guideSeen("w2")).toBe(false);
  });
});
