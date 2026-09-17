import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TESTIMONIALS, TIERS } from "../../lib/data";
import { AppProvider } from "../../lib/store";
import { Pricing, Stories } from "./Social";

/**
 * Guards against unverifiable marketing claims reappearing on a page that
 * takes payment.
 *
 * The page previously carried four invented testimonials — fictional couples
 * and cities, five stars each — and advertised a "14-day happiness promise"
 * with no refund path behind it.
 */

const mount = (ui: React.ReactElement) =>
  render(
    <MemoryRouter>
      <AppProvider>{ui}</AppProvider>
    </MemoryRouter>,
  );

describe("testimonials", () => {
  it("ships none that are not real", () => {
    // Deliberately empty. If real quotes are added this test should be updated
    // to check they carry genuine attribution, not simply deleted.
    expect(TESTIMONIALS).toHaveLength(0);
  });

  it("renders no Stories section while there is nothing real to show", () => {
    const { container, queryByText } = mount(<Stories />);
    expect(container.querySelector("#stories")).toBeNull();
    expect(queryByText(/Love notes/i)).toBeNull();
  });

  it("does not crash on an empty testimonial list", () => {
    // The carousel indexes TESTIMONIALS[0..3] directly, so the early return is
    // load-bearing rather than cosmetic.
    expect(() => mount(<Stories />)).not.toThrow();
  });
});

describe("pricing claims", () => {
  it("promises no refund window without a refund path", () => {
    const { queryByText } = mount(<Pricing />);
    expect(queryByText(/happiness promise/i)).toBeNull();
    expect(queryByText(/money.?back/i)).toBeNull();
    expect(queryByText(/\brefund\b/i)).toBeNull();
  });

  it("still states what is actually true about checkout", () => {
    const { getByText } = mount(<Pricing />);
    expect(getByText(/Secure checkout via Stripe/i)).toBeTruthy();
  });

  it("quotes a price for every tier", () => {
    const { container } = mount(<Pricing />);
    for (const t of TIERS) {
      expect(container.textContent).toContain(String(t.price));
    }
  });
});
