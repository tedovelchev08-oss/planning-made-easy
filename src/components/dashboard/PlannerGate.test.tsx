import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const state = { mode: "cloud", user: null as null | { name: string; email: string }, booting: false };

vi.mock("../../lib/store", () => ({
  useApp: () => ({ ...state }),
}));
vi.mock("./Shell", () => ({ default: () => <div>PLANNER</div> }));

import PlannerGate from "./PlannerGate";

function SignIn() {
  const { search } = useLocation();
  return <p>SIGN IN {search}</p>;
}

const renderGate = (path = "/planner") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/planner/*" element={<PlannerGate />} />
      <Route path="/sign-in" element={<SignIn />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  Object.assign(state, { mode: "cloud", user: null, booting: false });
});

describe("PlannerGate", () => {
  it("sends a signed-out visitor to sign in instead of showing an empty planner, and back after", () => {
    renderGate("/planner/guests");
    expect(screen.queryByText("PLANNER")).toBeNull();
    expect(screen.getByText(/SIGN IN/).textContent).toContain("next=%2Fplanner%2Fguests");
  });

  it("shows the planner to a signed-in couple", () => {
    state.user = { name: "maya", email: "maya@example.com" };
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
  });

  it("lets the planner show its own loading state while the session boots", () => {
    state.booting = true;
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
  });

  it("always shows the planner in demo mode, which has no accounts", () => {
    state.mode = "demo";
    renderGate();
    expect(screen.getByText("PLANNER")).toBeTruthy();
  });
});
