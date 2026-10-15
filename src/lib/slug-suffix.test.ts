import { describe, it, expect } from "vitest";
import { slugSuffix } from "./api";

describe("slugSuffix — new wedding addresses can't be guessed from first names", () => {
  it("is four characters from an alphabet without look-alikes", () => {
    for (let i = 0; i < 200; i++) expect(slugSuffix()).toMatch(/^[abcdefghjkmnpqrstvwxyz0-9]{4}$/);
  });

  it("varies: 200 draws give well over 190 distinct endings", () => {
    const seen = new Set(Array.from({ length: 200 }, () => slugSuffix()));
    expect(seen.size).toBeGreaterThan(190);
  });

  it("uses the whole alphabet, ends included", () => {
    expect(slugSuffix(() => 0)).toBe("aaaa");
    expect(slugSuffix(() => 0.999999)).toBe("9999");
  });
});
