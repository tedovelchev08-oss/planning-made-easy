import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Block 20: a short, honest note that Twofold uses no cookies. Shown once,
 * remembered after "Got it", never on a guest's invitation, and never a
 * consent banner (there's nothing to accept or reject).
 */
vi.mock("../lib/store", () => ({ usePrefersReducedMotion: () => true }));
const { default: CookieNotice, NOTICE_KEY } = await import("./CookieNotice");

const show = async (path = "/") => {
  const utils = render(<MemoryRouter initialEntries={[path]}><CookieNotice /></MemoryRouter>);
  await act(async () => { await vi.advanceTimersByTimeAsync(700); });
  return utils;
};

beforeEach(() => { localStorage.clear(); vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("CookieNotice", () => {
  it("appears on a first visit, with a link to the cookie policy and one button", async () => {
    await show();
    expect(screen.getByRole("region", { name: /about cookies/i })).toBeTruthy();
    expect(screen.getByText(/doesn't use cookies/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /cookie policy/i }).getAttribute("href")).toBe("/cookies");
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Got it"]); // no fake Accept/Reject
  });

  it("'Got it' hides it and it stays hidden on the next visit", async () => {
    const first = await show();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.queryByRole("region", { name: /about cookies/i })).toBeNull();
    expect(localStorage.getItem(NOTICE_KEY)).toBe("1");
    first.unmount();
    await show();
    expect(screen.queryByRole("region", { name: /about cookies/i })).toBeNull();
  });

  it("isn't shown on a guest's invitation", async () => {
    await show("/invite");
    expect(screen.queryByRole("region", { name: /about cookies/i })).toBeNull();
  });

  it("still works when storage is blocked (shown, dismissable, no crash)", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.queryByRole("region", { name: /about cookies/i })).toBeNull();
  });
});
