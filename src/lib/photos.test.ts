import { describe, it, expect } from "vitest";
import { PHOTO_MAX_BYTES, isUploadedPhoto, photoFileProblem, photoPath, photoPathFromUrl } from "./api";
import { PHOTO_MAX_SIDE, fitWithin } from "./images";

/** The couple's own invitation photo: what's accepted, where it's stored, what's ever deleted. */
const W = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const url = (path: string) => `https://abc.supabase.co/storage/v1/object/public/media/${path}`;

describe("photoFileProblem", () => {
  it("accepts phone and web photos, HEIC included", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(photoFileProblem({ type, size: 8_000_000 })).toBeNull();
    }
  });
  it("refuses other files and anything absurdly large", () => {
    expect(photoFileProblem({ type: "image/svg+xml", size: 1000 })).toMatch(/JPEG/);
    expect(photoFileProblem({ type: "application/pdf", size: 1000 })).toMatch(/JPEG/);
    expect(photoFileProblem({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 })).toMatch(/30 MB/);
  });
});

describe("where a photo is stored", () => {
  it("is <wedding>/photos/<random>.jpg, a fresh name every time", () => {
    expect(photoPath(W, "abc")).toBe(`${W}/photos/abc.jpg`);
    expect(photoPath(W)).not.toBe(photoPath(W));
  });
  it("only this wedding's photos are ever deleted", () => {
    expect(photoPathFromUrl(url(`${W}/photos/abc.jpg`), W)).toBe(`${W}/photos/abc.jpg`);
    expect(photoPathFromUrl(url(`${OTHER}/photos/abc.jpg`), W)).toBeNull();
    expect(photoPathFromUrl(url(`${W}/music/abc.mp3`), W)).toBeNull();
    expect(photoPathFromUrl("/images/couple.jpg", W)).toBeNull();
  });
  it("tells an uploaded photo from a built-in one", () => {
    expect(isUploadedPhoto(url(`${W}/photos/abc.jpg`))).toBe(true);
    expect(isUploadedPhoto("blob:http://localhost/123")).toBe(true);
    expect(isUploadedPhoto("/images/couple.jpg")).toBe(false);
    expect(isUploadedPhoto(url(`${W}/music/a.mp3`))).toBe(false);
    expect(isUploadedPhoto(null)).toBe(false);
  });
});

describe("fitWithin: the size a photo is stored at", () => {
  it("shrinks the longest side to the cap, keeping the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: PHOTO_MAX_SIDE, height: 1500 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: PHOTO_MAX_SIDE });
  });
  it("never enlarges a small photo", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
