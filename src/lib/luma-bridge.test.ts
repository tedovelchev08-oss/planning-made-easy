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
  // like Cloudflare's widget: a token on render, and a fresh one after each reset
  let issue: (t: string) => void = () => {};
  w.turnstile = {
    render: (_el: Element, o: { callback: (t: string) => void }) => { issue = o.callback; issue("human-ok"); return "w1"; },
    reset: vi.fn(() => issue("human-ok")),
  } as never;
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

  it("opens straight onto the invitation in the planner's quiet preview", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1");
    document.body.insertAdjacentHTML("beforeend", `
      <div id="envelope-overlay"><div id="envelope-box-el"></div></div>
      <button id="introSkip">Skip</button>`);
    const skipped = vi.fn();
    document.getElementById("introSkip")!.addEventListener("click", skipped);
    w.lumaAfterRender(await w.lumaBoot);
    await new Promise((r) => setTimeout(r, 120));
    expect(document.getElementById("envelope-overlay")!.classList.contains("envelope-overlay-hidden")).toBe(true);
    expect(skipped).toHaveBeenCalled();
  });

  it("makes the couple's words editable on the planner's stage, mirror images included in step", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1&edit=1");
    document.body.insertAdjacentHTML("beforeend", `
      <h1><span data-sync="personOne">Ana</span> &amp; <span data-sync="personTwo">Boris</span></h1>
      <span class="reflect" aria-hidden="true" data-sync="personOne">Ana</span>
      <p data-field="venueName">Villa Lago</p>
      <p data-field="dateAndPlace">June 12, 2027</p>
      <p id="closing" data-edit="closingMsg">Until We Meet</p>`);
    w.lumaAfterRender(await w.lumaBoot);
    const first = document.querySelector('h1 [data-sync="personOne"]') as HTMLElement;
    expect(first.getAttribute("contenteditable")).toBe("true");
    expect(first.getAttribute("aria-label")).toBe("First name");
    expect(document.querySelector('[data-field="venueName"]')!.getAttribute("contenteditable")).toBe("true");
    expect(document.getElementById("closing")!.getAttribute("contenteditable")).toBe("true");
    // composite lines (date and place) and mirror images are not typed into
    expect(document.querySelector('[data-field="dateAndPlace"]')!.hasAttribute("contenteditable")).toBe(false);
    const reflection = document.querySelector('.reflect') as HTMLElement;
    expect(reflection.hasAttribute("contenteditable")).toBe(false);
    first.textContent = "Anna";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    expect(reflection.textContent).toBe("Anna");
    // let this preview's own "skip the opening" timer run before the next test builds its page
    await new Promise((r) => setTimeout(r, 120));
  });

  it("lets the lines with both names, and the monogram, follow a name as it's typed", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1&edit=1");
    document.body.insertAdjacentHTML("beforeend", `
      <h1><span data-field="partner1">Ana</span> &amp; <span data-field="partner2">Boris</span></h1>
      <p data-field="coupleNames">Ana &amp; Boris</p>
      <span data-field="initial1">A</span><span data-field="initial2">B</span>`);
    w.lumaAfterRender(await w.lumaBoot);
    const first = document.querySelector('h1 [data-field="partner1"]') as HTMLElement;
    first.textContent = "Mila";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelector('[data-field="coupleNames"]')!.textContent).toBe("Mila & Boris");
    expect(document.querySelector('[data-field="initial1"]')!.textContent).toBe("M");
    expect(document.querySelector('[data-field="coupleNames"]')!.hasAttribute("contenteditable")).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
  });

  it("lets repeated copies (a playing card, the credits) follow without being typed on", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1&edit=1");
    document.body.insertAdjacentHTML("beforeend", `
      <h1><span data-sync="one" data-edit="partner1">Ana</span></h1>
      <span class="card" data-sync="one" data-follow="partner1">Ana</span>
      <p id="v" data-edit="venueName">Villa Lago</p><p id="cr" data-follow="venueName">Villa Lago</p>`);
    w.lumaAfterRender(await w.lumaBoot);
    const first = document.querySelector('h1 [data-edit="partner1"]') as HTMLElement;
    first.textContent = "Mila";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    const venue = document.getElementById("v")!;
    venue.textContent = "Villa Cora";
    venue.dispatchEvent(new Event("input", { bubbles: true }));
    const card = document.querySelector(".card")!;
    expect(card.textContent).toBe("Mila");
    expect(card.hasAttribute("contenteditable")).toBe(false);
    expect(document.getElementById("cr")!.textContent).toBe("Villa Cora");
    expect(document.getElementById("cr")!.hasAttribute("contenteditable")).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
  });

  it("saves the letters as typed, not as a design's capitals show them, and keeps line breaks", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1&edit=1");
    document.body.insertAdjacentHTML("beforeend", `
      <h1 style="text-transform:uppercase"><span data-edit="partner1">Ana</span></h1>
      <p data-edit="story1">x</p>
      <div aria-hidden="true"><span id="n2" data-edit="partner1">Ana</span><p id="s2" data-edit="story1">x</p></div>`);
    w.lumaAfterRender(await w.lumaBoot);
    const name = document.querySelector('[data-edit="partner1"]') as HTMLElement;
    name.textContent = "Leo";
    // a real browser's innerText applies text-transform
    Object.defineProperty(name, "innerText", { get: () => "LEO", configurable: true });
    name.dispatchEvent(new Event("input", { bubbles: true }));
    const story = document.querySelector('[data-edit="story1"]') as HTMLElement;
    story.innerHTML = "We met.<div>Then again.</div>";
    story.dispatchEvent(new Event("input", { bubbles: true }));
    // the copies get exactly what is sent to the planner
    expect(document.getElementById("n2")!.textContent).toBe("Leo");
    expect(document.getElementById("s2")!.textContent).toBe("We met.\nThen again.");
    await new Promise((r) => setTimeout(r, 120));
  });

  it("offers a line a design hid for being empty as + Add, and keeps an empty story section to write in", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1&quiet=1&edit=1");
    document.body.insertAdjacentHTML("beforeend", `
      <section id="beg" data-luma-story><h2 id="h" data-edit="storyHeadline" data-edit-label="Story headline" hidden></h2>
        <p id="p" data-edit="story1" style="display:none"></p></section>
      <p id="c" data-edit="rsvpEmailText" data-edit-label="Contact for questions">hello@example.com</p>`);
    w.lumaAfterRender(await w.lumaBoot);
    const h = document.getElementById("h")!, p = document.getElementById("p")!;
    expect(h.hidden).toBe(false);
    expect(h.classList.contains("tf-add")).toBe(true);
    expect(h.getAttribute("data-ph")).toBe("+ Add story headline");
    expect(p.style.display).toBe("");
    expect(document.getElementById("beg")!.style.display).toBe("");
    expect(document.getElementById("c")!.classList.contains("tf-add")).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
  });

  it("still hides an empty story section from guests", async () => {
    boot(`?token=${TOKEN}`);
    document.body.insertAdjacentHTML("beforeend", `<section id="beg2" data-luma-story><p data-luma-story-text></p></section>`);
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.getElementById("beg2")!.style.display).toBe("none");
  });

  it("is never editable for guests", async () => {
    boot(`?token=${TOKEN}`);
    document.body.insertAdjacentHTML("beforeend", `<p data-field="venueName">Villa Lago</p>`);
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.querySelector('[data-field="venueName"]')!.hasAttribute("contenteditable")).toBe(false);
  });

  it("keeps the opening for a guest-style preview", async () => {
    localStorage.setItem("luma.designPreview", JSON.stringify({ invitation }));
    boot("?preview=1");
    document.body.insertAdjacentHTML("beforeend", `<div id="envelope-overlay"><div id="envelope-box-el"></div></div>`);
    w.lumaAfterRender(await w.lumaBoot);
    await new Promise((r) => setTimeout(r, 120));
    expect(document.getElementById("envelope-overlay")!.classList.contains("envelope-overlay-hidden")).toBe(false);
  });

  it("shows the couple's photo alone when there's no story, and hides RSVP when they don't collect answers", async () => {
    boot("?slug=ana-boris", { heroPhoto: "https://x.supabase.co/p.jpg", rsvpOpen: false });
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.getElementById("our-story")!.style.display).toBe("");
    expect(document.getElementById("story-text-1")!.parentElement!.style.display).toBe("none");
    expect(document.getElementById("rsvp")!.style.display).toBe("none");
    expect((document.querySelector('a[href="#rsvp"]') as HTMLElement).style.display).toBe("none");
  });

  it("hides a design's own story section without words or a photo, and its menu link", async () => {
    boot(`?token=${TOKEN}`);
    document.body.insertAdjacentHTML("beforeend", `
      <a href="#beginning">Us</a>
      <section id="beginning" data-luma-story><div data-luma-story-text><h2>How we met</h2><p></p></div>
        <figure><img src="data:image/svg+xml,initials"></figure></section>`);
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.getElementById("beginning")!.style.display).toBe("none");
    expect((document.querySelector('a[href="#beginning"]') as HTMLElement).style.display).toBe("none");
  });

  it("keeps a design's story section for the couple's photo, without its empty words", async () => {
    boot(`?token=${TOKEN}`);
    document.body.insertAdjacentHTML("beforeend", `
      <section id="act1" data-luma-story><div data-luma-story-text><p></p></div>
        <figure hidden><img src="https://x.supabase.co/missing.jpg"></figure>
        <figure><img src="https://x.supabase.co/us.jpg"></figure></section>`);
    w.lumaAfterRender(await w.lumaBoot);
    const sec = document.getElementById("act1")!;
    expect(sec.style.display).toBe("");
    expect((sec.querySelector("[data-luma-story-text]") as HTMLElement).style.display).toBe("none");
  });

  it("leaves a design's story section alone when the couple wrote one", async () => {
    boot(`?token=${TOKEN}`, { story1: "We met in a nursery." });
    document.body.insertAdjacentHTML("beforeend", `<section id="story" data-luma-story><div data-luma-story-text><p>x</p></div></section>`);
    w.lumaAfterRender(await w.lumaBoot);
    expect(document.getElementById("story")!.style.display).toBe("");
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

describe("luma-bridge: forms with a dietary field", () => {
  it("passes it on in the note, only for a yes", async () => {
    boot("?slug=ana-boris");
    await w.lumaBoot;
    await fetch("/", { method: "POST", body: "form-name=rsvp&guest_names=Priya&attending=yes&guest_count=1&dietary=Vegetarian&notes=See+you" });
    await fetch("/", { method: "POST", body: "form-name=rsvp&guest_names=Raj&attending=no&dietary=Vegan" });
    expect(rsvpBodies[0].note).toBe("Dietary: Vegetarian · See you");
    expect(rsvpBodies[1].note).toBeNull();
  });
});

describe("luma-bridge: never leaves an invitation hidden", () => {
  it("shows the page even if the design never calls back", async () => {
    vi.useFakeTimers();
    boot("?slug=ana-boris");
    await vi.waitFor(() => expect(network).toHaveBeenCalled());
    await w.lumaBoot;
    expect(document.documentElement.classList.contains("luma-loading")).toBe(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.documentElement.classList.contains("luma-loading")).toBe(false);
    vi.useRealTimers();
  });
});
