import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The Crossing (Map) on Twofold: luma-map.js writes the couple into the real
 * page (public/designs/map/index.html), every copy of the folded sheet alike.
 */
const dir = resolve(__dirname, "../../public/designs/map");
const HTML = readFileSync(resolve(dir, "index.html"), "utf8");
const JS = readFileSync(resolve(dir, "luma-map.js"), "utf8");

const couple = {
  partner1: "Ana", partner2: "Boris", date: "2027-06-12", time: "16:00",
  venueName: "Villa Lago", venueAddress: "Via Regina 40, Lake Como",
  dressCode: "Black tie", rsvpDeadline: "1 May 2027",
  story1: "We met at a jazz bar in Sofia.", story2: "",
  heroPhoto: "", gallery: [], faq: [],
  schedule: [
    { time: "16:00", title: "Ceremony", venue: "The chapel" },
    { time: "17:30", title: "Drinks", venue: "The terrace", photo: "https://x.supabase.co/m.jpg" },
    { time: "19:00", title: "Dinner", venue: "" },
    { time: "22:00", title: "Dancing", venue: "The boathouse" },
  ],
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
const texts = (sel: string) => [...document.querySelectorAll(sel)].map((e) => e.textContent!.replace(/\s+/g, " ").trim());

describe("The Crossing on Twofold (luma-map.js)", () => {
  it("prints the couple on all three panels of the sheet alike", async () => {
    await render(couple);
    expect(texts(".face .title .nm")).toEqual(["AnaandBoris", "AnaandBoris", "AnaandBoris"]);
    expect(texts(".face .passage")).toEqual(Array(3).fill("Lake Como to Villa Lago"));
    expect(texts(".face .when")).toEqual(Array(3).fill("Saturday 12 June 2027"));
    expect(texts(".face .sheetno")[0]).toBe("No. 120627Ed. 1");
  });

  it("sailing directions: the first three moments, then the reply-by date", async () => {
    await render(couple);
    const dl = document.querySelector(".face .detail dl")!;
    expect(texts(".face .detail dl dt").slice(0, 4)).toEqual(["Ceremony", "Drinks", "Dinner", "Reply by"]);
    expect(dl.querySelectorAll("dd")[0].textContent).toBe("16:00, The chapel");
  });

  it("one stop per moment: a piece of the chart, or the couple's photo", async () => {
    await render(couple);
    const stops = [...document.querySelectorAll("#tlItems .stop")];
    expect(stops).toHaveLength(4);
    expect(stops[0].querySelector(".art.excerpt")).not.toBeNull();
    expect(stops[1].querySelector("img")?.getAttribute("src")).toBe("https://x.supabase.co/m.jpg");
    expect(stops[1].querySelector(".art.excerpt")).toBeNull();
    expect(stops.every((s) => s.hasAttribute("data-reveal"))).toBe(true);
    expect(stops[2].querySelector(".note .col")).toBeNull(); // no venue, no empty line
  });

  it("hides what the couple left empty, and keeps no sample couple", async () => {
    await render(couple);
    expect(document.getElementById("gallery")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("notes")!.classList.contains("luma-empty")).toBe(true);
    expect(document.getElementById("beginning")!.classList.contains("charted")).toBe(true);
    expect(document.getElementById("storyHeadline")!.hidden).toBe(true);
    expect(document.body.textContent).not.toMatch(/Marit|Jonas|on the boat|last boat|the crossing in/i);
  });

  it("the day, written out, and the bridge's after-render step", async () => {
    const after = await render(couple);
    expect(document.getElementById("dayTitle")!.textContent).toBe("Saturday the twelfth of June, 2027.");
    expect(texts("#the-day .facts dt")).toEqual(["Ceremony", "Where", "Dress", "Reply by"]);
    expect(after).toHaveBeenCalledWith(couple);
    expect((window as unknown as { __lumaMap: { when: unknown } }).__lumaMap.when).toEqual({ y: 2027, m: 6, d: 12, startH: 16, startM: 0, hours: 10 });
  });
});
