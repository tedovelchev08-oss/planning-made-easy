import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = { mode: "cloud", user: null as null | { name: string; email: string }, booting: false };
const setAuthOpen = vi.fn();

vi.mock("../../lib/store", () => ({
  useApp: () => ({ ...state, setAuthOpen }),
}));
vi.mock("./Shell", () => ({ default: () => <div>PLANNER</div> }));
vi.mock("../ui", () => ({
  Logo: () => <span>luma</span>,
  btn: { ink: "", ghost: "" },
}));

import PlannerGate from "./PlannerGate";

const renderGate = () => render(<MemoryRouter><PlannerGate /></MemoryRouter>);

beforeEach(() => {
  setAuthOpen.mockClear();
  Object.assign(state, { mode: "cloud", user: null, booting: false });
});

describe("PlannerGate", () => {
  it("asks a signed-out visitor to sign in instead of showing an empty planner", () => {
    renderGate();
    expect(screen.queryByText("PLANNER")).toBeNull();
    expect(screen.getByRole("heading", { name: "Sign in to your planner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(setAuthOpen).toHaveBeenCalledWith(true);
  });

  it("shows the planner to a signed-in couple", () => {
    state.user = { name: "maya", email: "maya@example.com" };
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
    expect(setAuthOpen).not.toHaveBeenCalled();
  });

  it("lets the planner show its own loading state while the session boots", () => {
    state.booting = true;
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
    expect(setAuthOpen).not.toHaveBeenCalled();
  });

  it("always shows the planner in demo mode, which has no accounts", () => {
    state.mode = "demo";
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
  });
});
