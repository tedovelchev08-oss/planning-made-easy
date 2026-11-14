import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import AuthLinks from "./AuthLinks";

/** A reset link opens "choose a new password" once, and then lets go. */
const at = (path: string, flags: { reset: boolean; linkError: boolean }) => render(
  <MemoryRouter initialEntries={[path]}>
    <AuthLinks {...flags} />
    <Routes>
      <Route path="/" element={<p>the homepage</p>} />
      <Route path="/new-password" element={<Link to="/">Home</Link>} />
      <Route path="/sign-in" element={<p>sign in</p>} />
    </Routes>
  </MemoryRouter>,
);

describe("AuthLinks", () => {
  it("takes a reset link to the new-password page, and Home still leads home", () => {
    at("/", { reset: true, linkError: false });
    fireEvent.click(screen.getByRole("link", { name: "Home" }));
    expect(screen.getByText("the homepage")).toBeTruthy();
  });

  it("takes an expired link to sign in", () => {
    at("/", { reset: false, linkError: true });
    expect(screen.getByText("sign in")).toBeTruthy();
  });

  it("does nothing for an ordinary visit", () => {
    at("/", { reset: false, linkError: false });
    expect(screen.getByText("the homepage")).toBeTruthy();
  });
});
