import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Turnstile } from "./Turnstile";

/** The widget must fit the RSVP card: 300px normal, 150px compact. */
const renderSpy = vi.fn((_el: HTMLElement, _opts: Record<string, unknown>) => "widget-1");

function mountWithWidth(width: number) {
  const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  render(<Turnstile onToken={() => {}} />);
  return spy;
}

beforeEach(() => {
  renderSpy.mockClear();
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
  window.turnstile = { render: renderSpy, reset: vi.fn(), remove: vi.fn() };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); delete window.turnstile; });

describe("Turnstile widget size", () => {
  it("is compact in a 277px phone-width form", async () => {
    mountWithWidth(277);
    await waitFor(() => expect(renderSpy).toHaveBeenCalled());
    expect(renderSpy.mock.calls[0][1]).toMatchObject({ size: "compact", action: "rsvp" });
  });

  it("is normal where 300px fits", async () => {
    mountWithWidth(420);
    await waitFor(() => expect(renderSpy).toHaveBeenCalled());
    expect(renderSpy.mock.calls[0][1]).toMatchObject({ size: "normal" });
  });

  it("reports unavailable instead of rendering without a site key", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const onUnavailable = vi.fn();
    render(<Turnstile onToken={() => {}} onUnavailable={onUnavailable} />);
    await waitFor(() => expect(onUnavailable).toHaveBeenCalled());
    expect(renderSpy).not.toHaveBeenCalled();
  });
});
