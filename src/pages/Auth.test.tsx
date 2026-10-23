import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

/**
 * Sign in, begin your plan, and the password pages: no sign-in link by
 * email, the password can be shown, the names typed on "begin" travel with
 * the account, every attempt carries a fresh human-check token, and a reset
 * link ends on "choose a new password", not the homepage.
 */
const app = {
  mode: "cloud" as "cloud" | "demo", user: null as { name: string; email: string } | null,
  booting: false, signupEmail: null as string | null,
};
const toast = vi.fn();
vi.mock("../lib/store", () => ({
  useApp: () => ({ ...app, toast, db: { wedding: { names: "Maya & Theo" } } }),
}));

const auth = {
  signIn: vi.fn(async () => ({ data: { session: {} }, error: null as { message: string } | null })),
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  reset: vi.fn(async () => ({ error: null })),
  updatePassword: vi.fn(async () => ({ data: {}, error: null as { message: string } | null })),
};
vi.mock("../lib/api", async (orig) => ({ ...(await orig<typeof import("../lib/api")>()), authApi: auth }));

const { SignInPage, BeginPage, ForgottenPasswordPage, NewPasswordPage, authMessage, rememberedCouple } = await import("./Auth");

let solve: ((token: string) => void) | null = null;
const reset = vi.fn();

beforeEach(() => {
  Object.assign(app, { mode: "cloud", user: null, booting: false, signupEmail: null });
  Object.values(auth).forEach((f) => f.mockClear());
  toast.mockClear();
  reset.mockClear();
  localStorage.clear();
  solve = null;
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  window.turnstile = {
    render: vi.fn((_el: HTMLElement, opts: Record<string, unknown>) => { solve = opts.callback as (t: string) => void; return "w1"; }),
    reset, remove: vi.fn(),
  };
});
afterEach(() => { vi.unstubAllEnvs(); delete window.turnstile; });

const at = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/begin" element={<BeginPage />} />
      <Route path="/forgotten-password" element={<ForgottenPasswordPage />} />
      <Route path="/new-password" element={<NewPasswordPage />} />
      <Route path="/planner" element={<p>the planner</p>} />
      <Route path="/planner/guests" element={<p>the guest list</p>} />
    </Routes>
  </MemoryRouter>,
);
const box = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string | RegExp, value: string) => fireEvent.change(box(label), { target: { value } });
const button = (name: RegExp) => screen.getByRole("button", { name });

describe("sign in", () => {
  it("has no emailed sign-in link, and the password can be shown and hidden", () => {
    at("/sign-in");
    expect(screen.queryByText(/sign-in link/i)).toBeNull();
    expect(box("Password").type).toBe("password");
    fireEvent.click(button(/^show$/i));
    expect(box("Password").type).toBe("text");
    expect(button(/^hide$/i).getAttribute("aria-pressed")).toBe("true");
  });

  it("waits for the check, then sends its token and resets for the next attempt", async () => {
    at("/sign-in");
    await waitFor(() => expect(solve).not.toBeNull());
    type("Email", "couple@example.com");
    type("Password", "correct-horse");
    fireEvent.click(button(/^sign in$/i));
    expect(auth.signIn).not.toHaveBeenCalled();
    await act(async () => { solve!("token-1"); });
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("couple@example.com", "correct-horse", "token-1"));
    await waitFor(() => expect(reset).toHaveBeenCalled());
  });

  it("a wrong password says what to do, and marks both fields", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    auth.signIn.mockResolvedValueOnce({ data: { session: null } as never, error: { message: "Invalid login credentials" } });
    at("/sign-in");
    type("Email", "couple@example.com");
    type("Password", "wrong");
    fireEvent.click(button(/^sign in$/i));
    expect((await screen.findByRole("alert")).textContent).toMatch(/don’t match.*Forgotten your password/);
    expect(box("Password").getAttribute("aria-invalid")).toBe("true");
  });

  it("greets a couple whose plan is still on this device, and only them", () => {
    localStorage.setItem("luma.cache.mila@example.com", JSON.stringify({ wedding: { partnerA: "Mila", partnerB: "Theo", date: "2027-09-18T12:00:00Z" } }));
    at("/sign-in");
    expect(screen.getByRole("heading", { name: "Welcome back, Mila" })).toBeTruthy();
    localStorage.setItem("luma.cache.other@example.com", JSON.stringify({ wedding: { partnerA: "Ana" } }));
    expect(rememberedCouple()).toBeNull(); // two plans on one device: say nothing
  });

  it("shows nothing from the demo wedding to a signed-out visitor", () => {
    at("/sign-in");
    expect(screen.queryByText(/Maya/)).toBeNull();
    expect(screen.queryByText(/Supabase/)).toBeNull();
  });

  it("once signed in, goes back to where the planner sent them", () => {
    app.user = { name: "mila", email: "mila@example.com" };
    at("/sign-in?next=/planner/guests");
    expect(screen.getByText("the guest list")).toBeTruthy();
  });

  it("never follows a next address outside the app", () => {
    app.user = { name: "mila", email: "mila@example.com" };
    at("/sign-in?next=//evil.example");
    expect(screen.getByText("the planner")).toBeTruthy();
  });

  it("'Forgotten your password?' starts from the address being signed in with", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    at("/sign-in");
    type("Email", "me@example.com");
    fireEvent.click(screen.getByRole("link", { name: /forgotten your password/i }));
    expect(box("Email").value).toBe("me@example.com");
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});

describe("begin your plan", () => {
  it("sends the names and the day with the account, with the token, then asks them to check their inbox", async () => {
    at("/begin");
    await waitFor(() => expect(solve).not.toBeNull());
    type("Your name", "Mila");
    type(/your partner/i, "Theo");
    type(/your wedding day/i, "2027-09-18");
    type("Email", "mila@example.com");
    type(/^password/i, "Longer-pass1");
    await act(async () => { solve!("token-2"); });
    fireEvent.click(button(/begin our plan/i));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith("mila@example.com", "Longer-pass1", "token-2", {
      partner_a: "Mila", partner_b: "Theo", wedding_date: "2027-09-18",
    }));
    expect(await screen.findByRole("heading", { name: /check your inbox/i })).toBeTruthy();
  });

  it("the names appear as they're typed", () => {
    at("/begin");
    type("Your name", "Mila");
    type(/your partner/i, "Theo");
    expect(document.querySelector(".tf-auth-names")?.textContent).toBe("Mila&Theo");
  });

  it("the homepage's email box arrives filled in", () => {
    app.signupEmail = "new@example.com";
    at("/begin");
    expect(box("Email").value).toBe("new@example.com");
  });

  it("asks for a name before anything is sent", () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    at("/begin");
    type("Email", "mila@example.com");
    type(/^password/i, "Longer-pass1");
    fireEvent.click(button(/begin our plan/i));
    expect(screen.getByRole("alert").textContent).toMatch(/your name/i);
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("the demo has no account to protect: no check, and it says so", () => {
    app.mode = "demo";
    at("/begin");
    expect(window.turnstile!.render).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /demo planner/i })).toBeTruthy();
  });
});

describe("passwords", () => {
  it("the forgotten-password page sends the link with a token", async () => {
    at("/forgotten-password");
    await waitFor(() => expect(solve).not.toBeNull());
    type("Email", "mila@example.com");
    await act(async () => { solve!("token-3"); });
    fireEvent.click(button(/send the link/i));
    await waitFor(() => expect(auth.reset).toHaveBeenCalledWith("mila@example.com", "token-3"));
    expect(await screen.findByRole("heading", { name: /check your inbox/i })).toBeTruthy();
  });

  it("after a reset link, choosing a new password saves it and opens the planner", async () => {
    app.user = { name: "mila", email: "mila@example.com" };
    at("/new-password");
    expect(screen.getByText("mila@example.com")).toBeTruthy();
    fireEvent.change(document.getElementById("auth-password")!, { target: { value: "a-new-one-2027" } });
    fireEvent.click(button(/save the new password/i));
    await waitFor(() => expect(auth.updatePassword).toHaveBeenCalledWith("a-new-one-2027"));
    expect(await screen.findByText("the planner")).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Password changed", expect.any(String));
  });

  it("without the link's session, it explains the link has expired", () => {
    at("/new-password");
    expect(screen.getByRole("heading", { name: /expired/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /send a new link/i })).toBeTruthy();
  });
});

describe("words", () => {
  it("Supabase's refusals become instructions", () => {
    expect(authMessage("captcha protection: request disallowed (timeout-or-duplicate)")).toMatch(/security check/i);
    expect(authMessage("User already registered")).toMatch(/sign in instead/i);
    expect(authMessage("Email not confirmed")).toMatch(/confirm your email/i);
    expect(authMessage("Something new")).toBe("Something new");
  });
});
