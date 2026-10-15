import { describe, it, expect } from "vitest";
import { MUSIC_MAX_BYTES, invitationToRow, musicFileProblem, musicPath, musicPathFromUrl } from "./api";
import type { InvitationConfig } from "./store";

const W = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const url = (path: string) => `https://abc.supabase.co/storage/v1/object/public/media/${path}`;

describe("musicFileProblem — what the browser checks before uploading", () => {
  it("accepts the formats the bucket accepts, up to 8 MB", () => {
    for (const type of ["audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/wav", "audio/ogg"]) {
      expect(musicFileProblem({ type, size: 3_000_000 })).toBeNull();
    }
    expect(musicFileProblem({ type: "audio/mpeg", size: MUSIC_MAX_BYTES })).toBeNull();
  });
  it("refuses other types, and anything over 8 MB", () => {
    expect(musicFileProblem({ type: "video/mp4", size: 1000 })).toMatch(/MP3/);
    expect(musicFileProblem({ type: "audio/flac", size: 1000 })).toMatch(/MP3/);
    expect(musicFileProblem({ type: "audio/mpeg", size: MUSIC_MAX_BYTES + 1 })).toMatch(/8 MB/);
  });
});

describe("musicPath — the folder the storage policies allow", () => {
  it("is <wedding>/music/<id>.<ext>", () => {
    expect(musicPath(W, "audio/mpeg", "abc")).toBe(`${W}/music/abc.mp3`);
    expect(musicPath(W, "audio/x-m4a", "abc")).toBe(`${W}/music/abc.m4a`);
  });
  it("gets a fresh random name each time, so a replaced song never overwrites", () => {
    expect(musicPath(W, "audio/mpeg")).not.toBe(musicPath(W, "audio/mpeg"));
  });
});

describe("musicPathFromUrl — only this wedding's songs are ever deleted", () => {
  it("finds the storage path of one of this wedding's songs", () => {
    expect(musicPathFromUrl(url(`${W}/music/abc.mp3`), W)).toBe(`${W}/music/abc.mp3`);
  });
  it("refuses another wedding's song, other folders, and non-storage addresses", () => {
    expect(musicPathFromUrl(url(`${OTHER}/music/abc.mp3`), W)).toBeNull();
    expect(musicPathFromUrl(url(`${W}/photos/abc.jpg`), W)).toBeNull();
    expect(musicPathFromUrl("blob:http://localhost/123", W)).toBeNull();
    expect(musicPathFromUrl(null, W)).toBeNull();
  });
});

describe("invitationToRow — the song's address is saved, not dropped", () => {
  const cfg = {
    templateId: "tp13", names: "A & B", line1: "", line2: "", venueLine: "", rsvp: true, meal: true, notes: true,
    photo: null, colors: null, fontSerif: null, motion: { petals: "gentle", shimmer: true, type: true },
    music: { track: "upload", uploadName: "Our song", uploadUrl: url(`${W}/music/abc.mp3`) }, live: true,
  } as InvitationConfig;

  it("writes the address to music_url (it used to be set to null on every save)", () => {
    expect(invitationToRow(cfg, W).music_url).toBe(url(`${W}/music/abc.mp3`));
  });
  it("keeps the music blob to what to play and its name", () => {
    expect(invitationToRow(cfg, W).music).toEqual({ track: "upload", uploadName: "Our song" });
  });
});
