import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * The sign-in window (Block 17): each tab keeps its own fields, the human
 * check is invisible and only asks for interaction when Cloudflare needs it,
 * every auth call carries a fresh token, and nothing from the demo wedding
 * shows to a signed-out visitor.
 */
const app = { appMode: "cloud" as "cloud" | "demo", signupEmail: null as string | null };
vi.mock("../lib/store", () => ({
  useApp: () => ({
    authOpen: true, setAuthOpen: vi.fn(), toast: vi.fn(), signupEmail: app.signupEmail,
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
  app.signupEmail = null;
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

const emailBox = () => screen.getByLabelText("Email") as HTMLInputElement;
const passwordBox = () => screen.getByLabelText("Password") as HTMLInputElement;
const tab = (name: RegExp) => screen.getByRole("tab", { name });
const fill = (email = "couple@example.com", password = "correct-horse") => {
  fireEvent.change(emailBox(), { target: { value: email } });
  fireEvent.change(passwordBox(), { target: { value: password } });
};
const submitButton = (name: RegExp) => screen.getByRole("button", { name });

describe("each tab keeps its own fields", () => {
  it("what you type on Sign in doesn't appear on Create account, and passwords never carry over", () => {
    render(<AuthModal />);
    fill("me@example.com", "secret-123");
    fireEvent.click(tab(/create account/i));
    expect(emailBox().value).toBe("");
    expect(passwordBox().value).toBe("");
    fireEvent.click(tab(/sign in/i));
    expect(emailBox().value).toBe("me@example.com");
    expect(passwordBox().value).toBe(""); // cleared when you left the tab
  });

  it("the homepage's 'Get started' email opens Create account with it filled in", () => {
    app.signupEmail = "new@example.com";
    render(<AuthModal />);
    expect(tab(/create account/i).getAttribute("aria-selected")).toBe("true");
    expect(emailBox().value).toBe("new@example.com");
  });

  it("'Forgot password?' starts from the address you were signing in with", () => {
    render(<AuthModal />);
    fill("me@example.com");
    fireEvent.click(screen.getByRole("button", { name: /forgot password/i }));
    expect(emailBox().value).toBe("me@example.com");
    expect(screen.queryByLabelText("Password")).toBeNull();
  });

  it("the password can be shown and hidden", () => {
    render(<AuthModal />);
    expect(passwordBox().type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(passwordBox().type).toBe("text");
  });

  it("shows nothing from the demo wedding to a signed-out visitor", () => {
    render(<AuthModal />);
    expect(screen.queryByText(/Maya & Theo/)).toBeNull();
    expect(screen.queryByText(/Supabase/)).toBeNull();
  });
});

describe("the human check", () => {
  it("is invisible unless Cloudflare needs interaction", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled());
    expect((window.turnstile!.render as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({
      action: "auth", appearance: "interaction-only", size: "flexible",
    });
  });

  it("signing in waits for the check, then sends its token and resets for the next attempt", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(solve).not.toBeNull());
    fill();
    fireEvent.click(submitButton(/^sign in$/i)); // before the check has finished
    expect(auth.signIn).not.toHaveBeenCalled();
    await act(async () => { solve!("token-1"); });
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("couple@example.com", "correct-horse", "token-1"));
    await waitFor(() => expect(reset).toHaveBeenCalled());
  });

  it("creating an account carries the token, then asks them to check their inbox", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(solve).not.toBeNull());
    fireEvent.click(tab(/create account/i));
    fill("new@example.com", "Longer-pass1");
    await act(async () => { solve!("token-2"); });
    fireEvent.click(submitButton(/^create account$/i));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith("new@example.com", "Longer-pass1", "token-2"));
    // no session yet: the window asks them to confirm by email
    expect(await screen.findByText(/check your inbox/i)).toBeTruthy();
  });

  it("the sign-in link carries the token", async () => {
    render(<AuthModal />);
    await waitFor(() => expect(solve).not.toBeNull());
    fill("me@example.com");
    await act(async () => { solve!("token-3"); });
    fireEvent.click(screen.getByRole("button", { name: /email me a sign-in link/i }));
    await waitFor(() => expect(auth.magicLink).toHaveBeenCalledWith("me@example.com", "token-3"));
  });

  it("a captcha refusal becomes an instruction to try again", () => {
    expect(authMessage("captcha protection: request disallowed (timeout-or-duplicate)")).toMatch(/security check/i);
    expect(authMessage("Invalid login credentials")).toBe("Invalid login credentials");
  });

  it("the demo has no account to protect: no check at all", async () => {
    app.appMode = "demo";
    render(<AuthModal />);
    fill();
    expect(window.turnstile!.render).not.toHaveBeenCalled();
  });

  it("without a site key (local builds) signing in goes ahead without a token", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    render(<AuthModal />);
    fill();
    fireEvent.click(submitButton(/^sign in$/i));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith("couple@example.com", "correct-horse", undefined));
  });
});
