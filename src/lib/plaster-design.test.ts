import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Plaster on Luma: luma-plaster.js addresses the envelope and prints the card on the real page. */
const dir = resolve(__dirname, "../../public/designs/plaster");
const HTML = readFileSync(resolve(dir, "index.html"), "utf8");
const JS = readFileSync(resolve(dir, "luma-plaster.js"), "utf8");

const couple = {
  partner1: "Ana", partner2: "Boris", date: "2027-06-12", time: "17:00",
  venueName: "Villa Lago", venueAddress: "Via Regina 40, 22016 Lenno", dressCode: "Summer formal", dressCodeNote: "", rsvpDeadline: "1 May 2027",
  story1: "We met at a jazz bar in Sofia.", story2: "", heroPhoto: "", gallery: [], faq: [],
  schedule: [{ time: "17:00", title: "The ceremony", venue: "The loggia" }, { time: "19:30", title: "Dinner", venue: "" }],
};

async function render(data: Record<string, unknown>) {
  document.documentElement.innerHTML = HTML.replace(/^<!DOCTYPE html>/i, "").replace(/<script[\s\S]*?<\/script>/g, "");
  const w = window as unknown as Record<string, unknown>;
  w.lumaBoot = Promise.resolve(data);
  w.lumaAfterRender = vi.fn();
  new Function(JS)();
  await new Promise((r) => setTimeout(r, 0));
  return w.lumaAfterRender as ReturnType<typeof vi.fn>;
}
const text = (sel: string) => document.querySelector(sel)!.textContent!.replace(/\s+/g, " ").trim();

describe("Plaster on Luma (luma-plaster.js)", () => {
  it("prints the card and addresses the envelope", async () => {
    await render(couple);
    expect(text("#cardWhen")).toBe("Saturday 12 June");
    expect(text("#cardNames")).toBe("Ana&Boris");
    expect(document.getElementById("cardWhere")!.innerHTML).toBe("Villa Lago<br>Lenno");
    expect(text("#cardYear")).toBe("2027");
    expect(document.getElementById("envFrom")!.innerHTML).toBe("Ana &amp; Boris<br>Villa Lago<br>Lenno");
    expect(text("#frankDay") + " " + text("#frankMonth")).toBe("12 VI · 27");
    expect([...document.querySelectorAll(".seal b.initials")].map((b) => b.textContent)).toEqual(["AB", "AB", "AB", "AB"]);
    expect(text(".index .ix-mono")).toBe("AB");
  });

  it("pins the hours and what to know beside the envelope", async () => {
    await render(couple);
    expect(document.getElementById("noteL")!.innerHTML).toBe("The ceremony at five o’clock<br>Dinner at half past seven");
    expect(document.getElementById("noteR")!.innerHTML).toBe("Summer formal<br>Reply by 1 May 2027");
  });

  it("the day, its postmark, and the order of it", async () => {
    await render(couple);
    expect(text("#bigDate")).toBe("12 June 2027");
    expect(text("#markPlace")).toBe("LENNO");
    expect(text("#markWhen")).toBe("Saturday · 17:00");
    expect([...document.querySelectorAll("#the-day .facts span")].map((e) => e.textContent)).toEqual(["Where", "Address", "Dress", "Reply by"]);
    expect(text("#scheduleHeading")).toBe("Saturday, from five o’clock");
    expect(document.querySelectorAll("#tlItems .stop")).toHaveLength(2);
    expect(document.querySelector("#tlItems .thread")).not.toBeNull();
    expect(document.querySelectorAll("#tlItems .stop")[1].querySelector(".note")).toBeNull(); // no empty venue line
  });

  it("without a photo the leaf hangs alone; empty photographs and questions go", async () => {
    const after = await render(couple);
    expect(document.getElementById("beginning")!.classList.contains("nophoto")).toBe(true);
    expect(document.getElementById("gallery")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("faq")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("storyP2")!.hidden).toBe(true);
    expect(text("#sentTo")).toBe("It is on its way to Ana and Boris.");
    expect(document.body.textContent).not.toMatch(/Alma|Rafael|Granada|Cortijo/);
    expect(after).toHaveBeenCalledWith(couple);
  });

  it("their photo is the print on the wall, and theirs are the prints below", async () => {
    await render({ ...couple, heroPhoto: "https://x.supabase.co/p.jpg", gallery: [{ photo: "https://x.supabase.co/g.jpg", caption: "Sofia" }, { photo: "javascript:x" }] });
    expect(document.querySelector("#beginning img.couple")!.getAttribute("src")).toBe("https://x.supabase.co/p.jpg");
    expect(document.getElementById("beginning")!.classList.contains("nophoto")).toBe(false);
    expect(document.querySelectorAll("#gallery .gallery-grid img")).toHaveLength(1);
  });
});
