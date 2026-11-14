import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Editable, joinNames, splitNames } from "./Editable";

/** Words on the invitation the couple clicks and types over. */
describe("Editable", () => {
  it("shows the words and reports what's typed", () => {
    const onChange = vi.fn();
    render(<Editable value="Maya" onChange={onChange} label="First name" placeholder="First name" />);
    const box = screen.getByRole("textbox", { name: "First name" });
    expect(box.textContent).toBe("Maya");
    box.textContent = "Mia";
    fireEvent.input(box);
    expect(onChange).toHaveBeenLastCalledWith("Mia");
  });

  it("tidies spaces when you leave it, and Enter finishes the line", () => {
    const onChange = vi.fn();
    render(<Editable value="Villa" onChange={onChange} label="Venue" placeholder="Venue" />);
    const box = screen.getByRole("textbox", { name: "Venue" });
    box.focus();
    box.textContent = "  Villa   Cimbrone ";
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.blur(box);
    expect(box.textContent).toBe("Villa Cimbrone");
    expect(onChange).toHaveBeenLastCalledWith("Villa Cimbrone");
  });

  it("follows a change made elsewhere", () => {
    const { rerender } = render(<Editable value="Maya" onChange={() => {}} label="First name" placeholder="First name" />);
    rerender(<Editable value="Maria" onChange={() => {}} label="First name" placeholder="First name" />);
    expect(screen.getByRole("textbox", { name: "First name" }).textContent).toBe("Maria");
  });

  it("splits and joins the couple's names", () => {
    expect(splitNames("Maya & Theo")).toEqual(["Maya", "Theo"]);
    expect(splitNames("Maya")).toEqual(["Maya", ""]);
    expect(joinNames(" Maya ", "Theo")).toBe("Maya & Theo");
  });
});
