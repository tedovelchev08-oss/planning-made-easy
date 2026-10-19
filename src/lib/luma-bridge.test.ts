import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Block 18a: public/designs/_shared/luma-bridge.js, run as the designs run
 * it (a plain script), against a small copy of a design's markup.
 */
const BRIDGE = readFileSync(resolve(__dirname, "../../public/designs/_shared/luma-bridge.js"), "utf8");
const TOKEN = "0b6f3a52-7d1e-4c55-9a51-2f0f4b1c9e11";

type W = Window & {
  lumaBoot: Promise<Record<string, unknown>>;
  lumaAfterRender: (d: Record<string, unknown>) => void;
  turnstile?: unknown;
};
const w = window as unknown as W;

const MARKUP = `
  <header><a href="#our-story">Our Story</a><a href="#schedule">Schedule</a><a href="#rsvp">RSVP</a></header>
  <p data-field="dateAndPlace"></p><span data-field="time"></span>
  <div id="details" class="grid md:grid-cols-3">
    <div class="md:border-r"><span data-field="dateFormatted"></span></div>
    <div class="md:border-r"><span data-field="venueName"></span></div>
    <div><span id="banner-dresscode"></span><span id="banner-dresscode-note"></span></div>
  </div>
  <section id="our-story"><div class="grid"><img data-field="heroPhoto"><div><p id="story-text-1"></p><p id="story-text-2"></p></div></div></section>
  <section id="schedule"></section>
  <section id="rsvp"><p id="rsvp-deadline-text"></p>
    <form id="rsvp-form"><input name="guest_names"><p id="rsvp-error"></p><button type="submit">Send</button></form>
  </section>
  <p id="footer-hashtag"></p>`;

const invitation = {
  partner1: "Ana", partner2: "Boris", date: "2027-06-12", time: "16:00",
  venueName: "Villa Lago", venueAddress: "", dressCode: "", dressCodeNote: "", rsvpDeadline: "",
  hashtag: "", story1: "", story2: "", schedule: [], faq: [], rsvpOpen: true,
  heroPhoto: "data:image/svg+xml;charset=utf-8,x",
};

let rsvpBodies: Record<string, unknown>[];
let network: ReturnType<typeof vi.fn>;

function boot(search: string, live: Record<string, unknown> = {}, reload?: () => void) {
  history.replaceState(null, "", `/designs/celestial/${search}`);
  document.documentElement.className = "";
  document.body.innerHTML = MARKUP;
  rsvpBodies = [];
  network = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/invitation")) {
      return new Response(JSON.stringify({
        status: "live", design: "celestial", slug: "ana-boris", turnstileSiteKey: "site-key",
        guest: { name: "Priya Shah" }, invitation: { ...invitation, ...live },
      }), { status: 200 });
    }
    if (url === "/api/rsvp") {
      rsvpBodies.push(JSON.parse(init!.body as string));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response("not here", { status: 404 });
  });
  vi.stubGlobal("fetch", network);
  // Turnstile, already loaded, passes straight away
  w.turnstile = { render: (_el: Element, o: { callback: (t: string) => void }) => { o.callback("human-ok"); return "w1"; }, reset: vi.fn() } as never;
  if (!reload) { new Function(BRIDGE)(); return; }
  // jsdom's location can't be stubbed: give the script a window whose location.reload is a spy
  const loc = { search: location.search, href: location.href, reload, replace: vi.fn() };
  const win = new Proxy(window, {
    get: (t, k) => {
      if (k === "location") return loc;
      const v = Reflect.get(t, k);
      return typeof v === "function" && !/^[A-Z]/.test(String(k)) ? v.bind(t) : v;
    },
    set: (t, k, v) => Reflect.set(t, k, v),
  });
  new Function("window", BRIDGE)(win);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("luma-bridge", () => {
  it("keeps the page hidden until the couple's details arrive, then loads them by token", async () => {
    boot(`?token=${TOKEN}&src=whatsapp`);
    expect(document.documentElement.classList.contains("luma-loading")).toBe(true);
    const data = await w.lumaBoot;
    expect(data.partner1).toBe("Ana");
    expect(network.mock.calls[0][0]).toBe(`/api/invitation?token=${TOKEN}`);
    w.lumaAfterRender(data);
    expect(document.documentElement.classList.contains("luma-loading")).toBe(false);
  });

  it("hides everything the couple hasn't filled in, and prefills the guest's name", async () => {
    boot(`?token=${TOKEN}`);
    w.lumaAfterRender(await w.lumaBoot);
    const hidden = (id: string) => document.getElementById(id)!.style.display === "none";
    expect(hidden("our-story")).toBe(true); // no story and no real photo
    expect(hidden("schedule")).toBe(true);
    expect(hidden("footer-hashtag")).toBe(true);
    expect(hidden("rsvp-deadline-text")).toBe(true);
    expect(document.getElementById("banner-dresscode")!.parentElement!.style.display).toBe("none");
    expect(document.getElementById("details")!.classList.contains("md:grid-cols-2")).toBe(true);
    expect((document.querySelector('a[href="#schedule"]') as HTMLElement).style.display).toBe("none");
    // no dangling bullet without an address... the venue stands in
    expect(document.querySelector('[data-field="dateAndPlace"]')!.textContent).toBe("June 12, 2027 • Villa Lago");
    expect((document.querySelector('input[name="guest_names"]') as HTMLInputElement).value).toBe("Priya Shah");
    expect(hidden("rsvp")).toBe(false);
  });

  it("shows the couple's photo alone when there's no story, and hides RSVP when they don't collect answers", async () => {
    boot("?slug=ana-boris", { heroPhoto: "https://x.supabase.co/p.jpg", rsvpOpen: false });
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.getElementById("our-story")!.style.display).toBe("");
    expect(document.getElementById("story-text-1")!.parentElement!.style.display).toBe("none");
    expect(document.getElementById("rsvp")!.style.display).toBe("none");
    expect((document.querySelector('a[href="#rsvp"]') as HTMLElement).style.display).toBe("none");
  });

  it("sends the design's RSVP form to /api/rsvp with a Turnstile token", async () => {
    boot(`?token=${TOKEN}&src=whatsapp`);
    await w.lumaBoot;
    const res = await fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "form-name=rsvp&guest_names=Priya+Shah&attending=yes&guest_count=2&plusone_name=Raj+Shah&notes=No+nuts",
    });
    expect(res.ok).toBe(true);
    expect(rsvpBodies).toEqual([{
      token: TOKEN, slug: "ana-boris", name: "Priya Shah", answer: "yes",
      note: "Party of 2 · No nuts", plusOne: "Raj Shah", meal: null, plusOneMeal: null,
      source: "whatsapp", turnstile: "human-ok",
    }]);
  });

  it("a decline sends no plus-one or party size", async () => {
    boot("?slug=ana-boris");
    await w.lumaBoot;
    await fetch("/", { method: "POST", body: "form-name=rsvp&guest_names=Priya&attending=no&guest_count=3&plusone_name=Raj" });
    expect(rsvpBodies[0]).toMatchObject({ token: null, slug: "ana-boris", answer: "no", plusOne: null, note: null, source: "link" });
  });

  it("shows the server's message when an answer is refused", async () => {
    boot("?slug=ana-boris");
    await w.lumaBoot;
    network.mockImplementationOnce(async () => new Response(JSON.stringify({ error: "Lots of answers just now." }), { status: 429 }));
    const res = await fetch("/", { method: "POST", body: "form-name=rsvp&guest_names=Priya&attending=yes" });
    expect(res.ok).toBe(false);
    expect(document.getElementById("rsvp-error")!.textContent).toBe("Lots of answers just now.");
  });

  it("the couple's preview reads the planner's copy and sends nothing", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation: { ...invitation, partner1: "Preview" } }));
    boot("?preview=1");
    expect((await w.lumaBoot).partner1).toBe("Preview");
    const res = await fetch("/", { method: "POST", body: "form-name=rsvp&guest_names=Ana&attending=yes" });
    expect(res.ok).toBe(false);
    expect(rsvpBodies).toEqual([]);
  });

  it("other requests pass through untouched", async () => {
    boot("?slug=ana-boris");
    await w.lumaBoot;
    expect((await fetch("/elsewhere")).status).toBe(404);
  });
});

describe("luma-bridge: the planner's preview follows the couple's edits", () => {
  it("reloads shortly after the preview copy changes, once", async () => {
    vi.useFakeTimers();
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    const reload = vi.fn();
    boot("?preview=1", {}, reload);
    window.dispatchEvent(new StorageEvent("storage", { key: "luma.designPreview" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "luma.designPreview" }));
    window.dispatchEvent(new StorageEvent("storage", { key: "luma.cache.x" }));
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
