import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Block 11: sign-up, sign-in, magic link and password reset carry a
 * Turnstile token, so Supabase Auth's captcha can refuse scripts. Tokens
 * are single-use, so the widget resets after every attempt.
 */
const app = { appMode: "cloud" as "cloud" | "demo" };
vi.mock("../lib/store", () => ({
  useApp: () => ({
    authOpen: true, setAuthOpen: vi.fn(), toast: vi.fn(), signupEmail: null,
    db: { wedding: { names: "Maya & Theo" } }, mode: app.appMode,
  }),
  usePrefersReducedMotion: () => true,
  useStats: () => ({ days: 120 }),
}));

const auth = {
  signIn: vi.fn(async () => ({ data: { session: {} }, error: null as { message: string } | null })),
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  magicLink: vi.fn(async () => ({ error: null })),
  reset: vi.fn(async () => ({ error: null })),
};
vi.mock("../lib/api", async (orig) => ({ ...(await orig<typeof import("../lib/api")>()), authApi: auth }));

const { AuthModal, authMessage } = await import("./ui");

let solve: ((token: string) => void) | null = null;
const reset = vi.fn();

beforeEach(() => {
  app.appMode = "cloud";
  Object.values(auth).forEach((f) => f.mockClear());
  reset.mockClear();
  solve = null;
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  window.turnstile = {
    render: vi.fn((_el: HTMLElement, opts: Record<string, unknown>) => { solve = opts.callback as (t: string) => void; return "w1"; }),
    reset, remove: vi.fn(),
  };
});
afterEach(() => { vi.unstubAllEnvs(); delete window.turnstile; });

const fill = () => {
  fireEvent.change(screen.getByPlaceholderText("you@example.com"), { target: { value: "couple@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "correct-horse" } });
};
const submitButton = () => screen.getByRole("button", { name: /step back in/i });

describe("AuthModal bot check", () => {
  it("shows the check, and signing in waits for it", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled());
    expect((window.turnstile!.render as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ action: "auth" });
    fill();
    expect(submitButton()).toHaveProperty("disabled", true);
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("signs in with the token, then resets the widget for the next attempt", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(solve).not.toBeNull());
    fill();
    solve!("token-1");
    await waitFor(() => expect(submitButton()).toHaveProperty("disabled", false));
    fireEvent.click(submitButton());
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("couple@example.com", "correct-horse", "token-1"));
    await waitFor(() => expect(reset).toHaveBeenCalled());
  });

  it("sign-up, magic link and reset carry the token too", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(solve).not.toBeNull());
    fill();

    solve!("token-magic");
    await waitFor(() => expect(screen.getByRole("button", { name: /magic link/i })).toHaveProperty("disabled", false));
    fireEvent.click(screen.getByRole("button", { name: /magic link/i }));
    await waitFor(() => expect(auth.magicLink).toHaveBeenCalledWith("couple@example.com", "token-magic"));
  });

  it("a captcha refusal becomes an instruction to redo the check", () => {
    expect(authMessage("captcha protection: request disallowed (timeout-or-duplicate)")).toMatch(/security check/i);
    expect(authMessage("Invalid login credentials")).toBe("Invalid login credentials");
  });

  it("the demo has no account to protect: no check, nothing blocked", async () => {
    app.appMode = "demo";
    render(<AuthModal />);
    fill();
    expect(window.turnstile!.render).not.toHaveBeenCalled();
    expect(submitButton()).toHaveProperty("disabled", false);
  });

  it("without a site key (local and demo builds) nothing is blocked and no token is sent", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    app.appMode = "cloud";
    render(<AuthModal />);
    fill();
    // no site key: the widget isn't needed and nothing is blocked
    expect(submitButton()).toHaveProperty("disabled", false);
    fireEvent.click(submitButton());
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("couple@example.com", "correct-horse", undefined));
  });
});
