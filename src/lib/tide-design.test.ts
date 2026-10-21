import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The Tide on Luma: luma-tide.js prints the card on the sand and sets the day as a tide table. */
const dir = resolve(__dirname, "../../public/designs/tide");
const HTML = readFileSync(resolve(dir, "index.html"), "utf8");
const JS = readFileSync(resolve(dir, "luma-tide.js"), "utf8");

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

describe("The Tide on Luma (luma-tide.js)", () => {
  it("prints the card lying on the sand", async () => {
    await render({ ...couple, cardLine: "We met on a beach." });
    expect(text("#cardAbove")).toBe("Together with their families");
    expect(text("#cardNames")).toBe("AnaandBoris");
    expect(document.querySelector("#cardNames em")!.textContent).toBe("and");
    expect(text("#cardDate")).toBe("12 June 2027");
    expect(document.getElementById("cardPlace")!.innerHTML).toBe("Villa Lago<br>Lenno");
    expect(text("#cardLine")).toBe("We met on a beach.");
  });

  it("the day, written out", async () => {
    await render(couple);
    expect(text("#dayTitle")).toBe("Saturday, 12 June");
    expect([...document.querySelectorAll("#the-day .facts dt")].map((e) => e.textContent)).toEqual(["Where", "Address", "Time", "Dress", "Reply by"]);
    expect(text("#the-day .facts div:nth-child(3) dd")).toBe("Five o’clock");
    expect(text("#replyBy")).toBe("Please reply by 1 May 2027");
  });

  it("the order of the day as a tide table, one mark on the water per moment", async () => {
    await render(couple);
    expect(text("#scheduleHeading")).toBe("From five o’clock, as the tide comes in");
    expect(document.querySelectorAll("#tlItems li")).toHaveLength(2);
    expect(document.querySelectorAll("#tideCurve circle.mark")).toHaveLength(2);
    expect(document.querySelectorAll("#tlItems li")[1].querySelector(".where")).toBeNull(); // no empty venue line
    const xs = [...document.querySelectorAll("#tideCurve circle.mark")].map((c) => +c.getAttribute("cx")!);
    expect(xs[1]).toBeGreaterThan(xs[0]); // later moments sit further along
  });

  it("without a photo the story stands alone; empty photographs and questions go", async () => {
    const after = await render(couple);
    expect(document.getElementById("beginning")!.classList.contains("nophoto")).toBe(true);
    expect(document.getElementById("gallery")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("faq")!.classList.contains("luma-empty")).toBe(true);
    expect(text("#sentTo")).toBe("It is on its way to Ana and Boris.");
    expect(text("#writtenNames")).toBe("Ana & Boris");
    expect(text("#closingLine")).toBe("We can’t wait to celebrate with you");
    expect(document.body.textContent).not.toMatch(/Ines|Mateo|Ibiza|Cala Salada/);
    expect(after).toHaveBeenCalledWith(couple);
  });

  it("their photo is the print on the sand, and theirs are the prints below", async () => {
    await render({ ...couple, heroPhoto: "https://x.supabase.co/p.jpg", gallery: [{ photo: "https://x.supabase.co/g.jpg", caption: "Sofia" }, { photo: "javascript:x" }] });
    expect(document.querySelector("#beginning img.couple")!.getAttribute("src")).toBe("https://x.supabase.co/p.jpg");
    expect(document.querySelectorAll("#gallery .prints img")).toHaveLength(1);
  });
});
