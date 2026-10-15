import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderMarkdown, isLegalPlaceholder } from "./markdown";

const html = (md: string) => render(<div>{renderMarkdown(md)}</div>).container;

describe("renderMarkdown — the legal pages' renderer", () => {
  it("renders headings, paragraphs and both kinds of list", () => {
    const c = html("# Title\n\nFirst line\nsame paragraph.\n\n## Section\n\n- one\n- two\n\n1. first\n2. second");
    expect(c.querySelector("h1")?.textContent).toBe("Title");
    expect(c.querySelector("h2")?.textContent).toBe("Section");
    expect(c.querySelector("p")?.textContent).toBe("First line same paragraph.");
    expect(c.querySelectorAll("ul li")).toHaveLength(2);
    expect(c.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders bold, italic, and safe links", () => {
    const c = html("Read **this** and *that* at [our site](https://example.com) or [email](mailto:a@b.co).");
    expect(c.querySelector("strong")?.textContent).toBe("this");
    expect(c.querySelector("em")?.textContent).toBe("that");
    expect([...c.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual(["https://example.com", "mailto:a@b.co"]);
  });

  it("never turns pasted HTML or script links into live elements", () => {
    const c = html('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))');
    expect(c.querySelector("script")).toBeNull();
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("a")).toBeNull();
    expect(c.textContent).toContain("<script>alert(1)</script>");
  });

  it("drops HTML comments, including the placeholder marker", () => {
    const c = html("<!-- LEGAL-PLACEHOLDER: replace -->\n# Privacy policy");
    expect(c.textContent).toBe("Privacy policy");
  });
});

describe("isLegalPlaceholder", () => {
  it("spots the marker CI refuses to ship", () => {
    expect(isLegalPlaceholder("<!-- LEGAL-PLACEHOLDER -->\n# x")).toBe(true);
    expect(isLegalPlaceholder("# Privacy policy\n\nReal text.")).toBe(false);
  });
});
