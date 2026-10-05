import { describe, it, expect } from "vitest";

/**
 * Luma has no email or SMS sending. The app once told couples their
 * invitations, reminders and messages were "sent via Resend", and told
 * homepage visitors a welcome email was on its way — none of it happened.
 * This keeps that wording out of anything a person can see.
 */
const files = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true });

// strip comments: they may explain the history, they are not shown to anyone
const shown = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const CLAIMS = [
  /via resend/i,
  /delivered by email/i,
  /invitations sent/i,
  /reminders on their way/i,
  /message queued/i,
  /on its way to your inbox/i,
  /sealing .* envelopes/i,
];

describe("nothing claims Luma sent a message", () => {
  const own = Object.entries(files).filter(([path]) => !path.includes("no-fake-sending.test"));

  it("scans the source tree", () => {
    expect(own.length).toBeGreaterThan(20);
  });

  it.each(own)("%s", (_path, text) => {
    for (const claim of CLAIMS) expect(shown(text as string)).not.toMatch(claim);
  });
});

describe("no invented social proof", () => {
  const own = Object.entries(files).filter(([path]) => !/\.test\./.test(path));
  it.each(own)("%s", (_path, text) => {
    // a customer count needs a real source before it goes on a page
    expect(shown(text as string)).not.toMatch(/loved by [\d,.]+\+? couples/i);
  });
});
