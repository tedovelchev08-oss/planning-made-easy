import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The Inscription on Twofold: luma-ins.js cuts the couple into the real page. */
const dir = resolve(__dirname, "../../public/designs/inscription");
const HTML = readFileSync(resolve(dir, "index.html"), "utf8");
const JS = readFileSync(resolve(dir, "luma-ins.js"), "utf8");

const couple = {
  partner1: "Ana", partner2: "Boris", date: "2027-06-12", time: "16:30",
  venueName: "Villa Lago", venueAddress: "Via Regina 40, Lake Como", dressCode: "Formal", rsvpDeadline: "1 May 2027",
  story1: "We met at a jazz bar in Sofia.", story2: "", heroPhoto: "", gallery: [], faq: [],
  schedule: [{ time: "16:30", title: "The ceremony", venue: "The loggia" }, { time: "19:00", title: "Dinner", venue: "" }],
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

describe("The Inscription on Twofold (luma-ins.js)", () => {
  it("cuts the names, and the date in words, the way the original was cut", async () => {
    await render(couple);
    expect(text(".inscription h1")).toBe("AnaandBoris");
    expect(document.querySelector(".inscription .below")!.innerHTML).toBe("The twelfth of June<br>Two thousand and twenty seven");
    expect(text(".inscription .above")).toBe("They are to be married");
    expect(text(".index .mono")).toBe("AB");
  });

  it("the order of the day, headed by its first hour in words", async () => {
    await render(couple);
    expect(text("#scheduleHeading")).toBe("From half past four");
    expect(document.querySelectorAll("#tlItems .hour")).toHaveLength(2);
    expect(document.querySelector("#tlItems .channel")).not.toBeNull();
    expect(document.querySelectorAll("#tlItems .hour")[1].querySelectorAll("p")).toHaveLength(1); // no empty venue line
  });

  it("the day, written out", async () => {
    await render(couple);
    expect(text("#dayTitle")).toBe("Saturday the twelfth of June");
    expect([...document.querySelectorAll("#the-day .facts dt")].map((e) => e.textContent)).toEqual(["Where", "Address", "Time", "Dress", "Reply by"]);
    expect(text("#the-day .facts div:nth-child(3) dd")).toBe("Half past four");
    expect(text("#cutLead")).toBe("Cut, the twelfth of June");
  });

  it("without a photo the story stands alone; empty plates and questions go", async () => {
    const after = await render(couple);
    expect(document.getElementById("beginning")!.classList.contains("nophoto")).toBe(true);
    expect(document.getElementById("gallery")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("faq")!.classList.contains("luma-empty")).toBe(true);
    expect(document.body.textContent).not.toMatch(/Vera|Aurelio|Balbianello/);
    expect(after).toHaveBeenCalledWith(couple);
  });

  it("their photo goes into the niche, and their plates into the row", async () => {
    await render({ ...couple, heroPhoto: "https://x.supabase.co/p.jpg", gallery: [{ photo: "https://x.supabase.co/g.jpg", caption: "Sofia" }, { photo: "javascript:x" }] });
    expect(document.querySelector("#beginning img.couple")!.getAttribute("src")).toBe("https://x.supabase.co/p.jpg");
    expect(document.querySelectorAll("#gallery .plates img")).toHaveLength(1);
  });
});
