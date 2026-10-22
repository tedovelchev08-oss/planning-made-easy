import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STUDIO_DESIGNS, designPath, toInvitationData } from "../../../api/_lib/studioDesigns";
import "./landing.css";

/* =====================================================================
   The landing page (Block 19). Twofold means folded in two, so the page
   opens as a folded card: scroll and it opens like stationery, and inside
   is the plan with both of you working in it. Then the invitations, then
   what your guests see, then the price.
   ===================================================================== */

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------ the duet ------------------------------ */

/**
 * The planner with both partners in it. Each takes a turn, a change lands,
 * and a quiet note says who did what. A loop, slowly; still for anyone
 * who has asked for less motion.
 */
export function Duet({ active = true }: { active?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const curA = useRef<HTMLDivElement>(null);
  const curB = useRef<HTMLDivElement>(null);
  const sofiaStatus = useRef<HTMLSpanElement>(null);
  const flowers = useRef<HTMLSpanElement>(null);
  const [sofiaComing, setSofiaComing] = useState(false);
  const [flowerSpend, setFlowerSpend] = useState(1800);
  const [note, setNote] = useState<{ who: "a" | "b"; text: string } | null>(null);
  const [flash, setFlash] = useState(0);
  const [clickA, setClickA] = useState(0);
  const [clickB, setClickB] = useState(0);

  useEffect(() => {
    if (!active || reduceMotion()) return;
    const timers: number[] = [];
    const at = (el: HTMLElement | null, cur: HTMLDivElement | null, dx = 12) => {
      if (!el || !cur || !root.current) return;
      const r = el.getBoundingClientRect(), p = root.current.getBoundingClientRect();
      cur.style.transform = `translate(${r.left - p.left + dx}px, ${r.top - p.top + r.height / 2}px)`;
    };
    const park = () => {
      const p = root.current?.getBoundingClientRect();
      if (!p || !curA.current || !curB.current) return;
      curA.current.style.transform = `translate(${p.width * 0.18}px, ${p.height * 0.86}px)`;
      curB.current.style.transform = `translate(${p.width * 0.78}px, ${p.height * 0.12}px)`;
    };
    const say = (who: "a" | "b", text: string) => {
      setNote({ who, text });
      timers.push(window.setTimeout(() => setNote(null), 2600));
    };
    const steps: [number, () => void][] = [
      [600, () => at(sofiaStatus.current, curB.current)],
      [1500, () => { setClickB((n) => n + 1); setSofiaComing(true); setFlash((n) => n + 1); say("b", "Boris marked the Lindqvists as coming"); }],
      [1600, () => at(flowers.current, curA.current, 30)],
      [1500, () => { setClickA((n) => n + 1); setFlowerSpend(2100); say("a", "Ana moved flowers to €2,100"); }],
      [2400, park],
      [2600, () => { setSofiaComing(false); setFlowerSpend(1800); }],
    ];
    const run = () => {
      let t = 0;
      for (const [wait, fn] of steps) { t += wait; timers.push(window.setTimeout(fn, t)); }
      timers.push(window.setTimeout(run, t + 600));
    };
    park();
    timers.push(window.setTimeout(run, 900));
    return () => timers.forEach(clearTimeout);
  }, [active]);

  const still = !active || reduceMotion();

  return (
    <div ref={root} className="tf-planner" aria-label="A shared plan: both partners see each other's changes as they happen">
      <div className="tf-p-top">
        <div>
          <p className="tf-p-who">Ana &amp; Boris</p>
          <p className="tf-p-when">Saturday 12 June 2027 · Lake Como</p>
        </div>
        <p className="tf-p-here"><span className="tf-av a" aria-hidden="true">A</span><span className="tf-av b" aria-hidden="true">B</span><span>both here</span></p>
      </div>
      <p className="tf-p-tabs" aria-hidden="true"><b>Guests</b><span>Budget</span><span>Seating</span></p>
      <ul className="tf-rows">
        <li><span><span className="tf-g-name">Amara &amp; Kwame Okafor</span><span className="tf-g-sub">2 · garden risotto</span></span><span className="tf-st yes">Coming</span></li>
        <li><span><span className="tf-g-name">Liam Bennett</span><span className="tf-g-sub">1 · best man</span></span><span className="tf-st yes">Coming</span></li>
        <li key={flash} className={flash ? "tf-flash" : ""}>
          <span><span className="tf-g-name">Sofia &amp; Erik Lindqvist</span><span className="tf-g-sub">2 · sea bass</span></span>
          <span ref={sofiaStatus} className={`tf-st ${sofiaComing ? "yes" : "wait"}`}>{sofiaComing ? "Coming" : "Not yet"}</span>
        </li>
        <li><span><span className="tf-g-name">Marcus Silva</span><span className="tf-g-sub">1 · vegan</span></span><span className="tf-st wait">Not yet</span></li>
      </ul>
      <div className="tf-p-budget">
        <span className="tf-lbl">Flowers</span>
        <span ref={flowers} className="tf-val">€{flowerSpend.toLocaleString("en-GB")} <small>of €2,500</small></span>
        <span className="tf-bar" aria-hidden="true"><i style={{ width: `${(flowerSpend / 2500) * 100}%` }} /></span>
      </div>
      <p className={`tf-feed ${note ? "on" : ""}`} aria-live="polite">
        {note && <><span className={`tf-av ${note.who}`} aria-hidden="true">{note.who === "a" ? "A" : "B"}</span><span>{note.text}</span><small>just now</small></>}
      </p>
      {!still && (
        <>
          <div ref={curA} className={`tf-cur a ${clickA ? (clickA % 2 ? "c1" : "c2") : ""}`} aria-hidden="true">
            <svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1l15 11-7 1.3L5.4 21z" fill="#9a7a3f" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            <span>Ana</span>
          </div>
          <div ref={curB} className={`tf-cur b ${clickB ? (clickB % 2 ? "c1" : "c2") : ""}`} aria-hidden="true">
            <svg width="18" height="22" viewBox="0 0 18 22"><path d="M1 1l15 11-7 1.3L5.4 21z" fill="#5f6a75" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" /></svg>
            <span>Boris</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ the fold ------------------------------ */

/**
 * The opening: a closed onyx card with the rings on it. Scrolling turns the
 * cover back, the way you open a folded card, and the plan is inside. With
 * reduced motion the card is simply open.
 */
export function FoldHero() {
  const stage = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(reduceMotion());

  useEffect(() => {
    if (reduceMotion()) return;
    const el = stage.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, (el.offsetHeight - window.innerHeight) * 0.7);
      let p = Math.min(1, Math.max(0, -r.top / span));
      p = 1 - Math.pow(1 - p, 2.2);
      el.style.setProperty("--fold", p.toFixed(4));
      setOpen(p > 0.6);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);

  const toInvitations = () => document.getElementById("invitations")?.scrollIntoView({ behavior: "smooth" });

  return (
    <section ref={stage} className={`tf-stage ${reduceMotion() ? "is-still" : ""}`} aria-label="Twofold">
      <div className="tf-sticky">
        <div className="tf-card">
          <div className="tf-inside">
            <div className="tf-copy">
              <h1>Two of you.<em>One plan.</em></h1>
              <p>The wedding planner you share. Guests, budget, seating and invitations, open for both of you and updated live.</p>
              <div className="tf-ctas">
                <Link to="/planner" className="tf-btn gold">Start planning, free</Link>
                <button type="button" onClick={toInvitations} className="tf-btn line-dark">See the invitations</button>
              </div>
            </div>
            <Duet active={open} />
          </div>
          <div className="tf-cover" aria-hidden="true">
            <div className="tf-face">
              <img src="/brand/twofold-wordmark-on-dark.svg" alt="" width={520} height={81} />
              <p>Two of you. One plan.</p>
            </div>
            <div className="tf-back" />
          </div>
        </div>
        <p className="tf-hint" aria-hidden="true">Scroll to open</p>
      </div>
    </section>
  );
}

/* ------------------------------ the invitations ------------------------------ */

const SHELF: { id: string; line: string }[] = [
  { id: "celestial", line: "the sky over your venue, that night" },
  { id: "palm-springs", line: "your initials set in the pool" },
  { id: "art-deco", line: "brass gates on a lacquer plaque" },
  { id: "riviera", line: "a postcard from the coast" },
  { id: "tide", line: "a card the sea washes clean" },
];

/** a sample couple, so a visitor can open a design and see it working */
function openSample(id: string) {
  const design = STUDIO_DESIGNS.find((d) => d.id === id);
  if (!design) return;
  const data = toInvitationData({
    slug: "sample", names: "Ana & Boris", partnerA: "Ana", partnerB: "Boris",
    date: "2027-06-12T15:00:00Z", venue: "Villa Lago", location: "Via Regina 40, Lenno, Lake Como",
    timezone: "Europe/Rome", locale: "en-GB", plan: "luxe",
    invitation: { template_id: `studio:${id}`, collect_rsvp: true, design_data: {} },
  } as Parameters<typeof toInvitationData>[0], design);
  try { localStorage.setItem("luma.designPreview", JSON.stringify({ design: id, invitation: data })); } catch { /* the page shows its own notice */ }
  window.open(`${designPath(design)}?preview=1`, "twofold-design-preview");
}

export function InvitationShelf() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = SHELF.length;
  useEffect(() => {
    if (paused || reduceMotion()) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % n), 3400);
    return () => clearInterval(t);
  }, [paused, n]);
  const cur = STUDIO_DESIGNS.find((d) => d.id === SHELF[i].id);
  const step = (d: number) => setI((x) => (x + d + n) % n);

  return (
    <section id="invitations" className="tf-shelf" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)}>
      <div className="tf-shelf-text">
        <h2>Not templates. <em>Each one is its own.</em></h2>
        <p>Invitations made like stationery and sent as a link. Each one is a page your guests can open, keep and reply on.</p>
      </div>
      <div className="tf-deck-wrap">
        <div className="tf-deck" aria-roledescription="carousel" aria-label="Invitation designs">
          {SHELF.map((s, k) => {
            let d = (k - i + n) % n;
            if (d > n / 2) d -= n;
            const name = STUDIO_DESIGNS.find((x) => x.id === s.id)?.name ?? s.id;
            return (
              <div key={s.id} className="tf-phone" data-pos={Math.max(-2, Math.min(2, d))} aria-hidden={d !== 0}>
                <img src={`/landing/inv-${s.id}.jpg`} alt={`${name} invitation`} width={600} height={1298} loading={k === 0 ? "eager" : "lazy"} />
              </div>
            );
          })}
        </div>
        <div className="tf-shelf-ctrl">
          <button type="button" className="tf-round" onClick={() => step(-1)} aria-label="Previous design"><ChevronLeft size={18} /></button>
          <p className="tf-shelf-name" aria-live="polite"><b>{cur?.name}</b><span>{SHELF[i].line}</span></p>
          <button type="button" className="tf-round" onClick={() => step(1)} aria-label="Next design"><ChevronRight size={18} /></button>
        </div>
        <button type="button" className="tf-btn line" onClick={() => openSample(SHELF[i].id)}>Open {cur?.name}</button>
      </div>
    </section>
  );
}

/* ------------------------------ the guest's side ------------------------------ */

/** a real sequence, so the steps are numbered: message, invitation, reply */
export function GuestSide() {
  return (
    <section id="guests" className="tf-guests">
      <h2>Your guests get an invitation, <em>not a form.</em></h2>
      <ol className="tf-steps">
        <li>
          <div className="tf-step-art tf-msg" aria-hidden="true">
            <p className="tf-bubble">We're getting married! Everything is here, and you can reply in a tap.<span>Open the invitation →</span></p>
          </div>
          <h3><span>1</span>You send one link</h3>
          <p>By WhatsApp, a text, an email or a family group chat. However you usually reach them.</p>
        </li>
        <li>
          <div className="tf-step-art tf-inv" aria-hidden="true"><img src="/landing/inv-tide.jpg" alt="" width={600} height={1298} loading="lazy" /></div>
          <h3><span>2</span>They open your invitation</h3>
          <p>Your design, your words, the day, the place, the schedule. No app, no account.</p>
        </li>
        <li>
          <div className="tf-step-art tf-reply" aria-hidden="true">
            <p className="tf-r-q">Will you be there?</p>
            <p className="tf-r-a">Joyfully, yes · 2 · sea bass</p>
            <p className="tf-r-land"><span className="tf-st yes">Coming</span> Sofia &amp; Erik Lindqvist</p>
          </div>
          <h3><span>3</span>Their reply lands in your list</h3>
          <p>Coming or not, how many, meals and notes, straight into the guest list you both share.</p>
        </li>
      </ol>
    </section>
  );
}

/* ------------------------------ honest notes ------------------------------ */

export function HonestNotes() {
  return (
    <section className="tf-notes" aria-label="What you can count on">
      <p><b>One payment, if you upgrade at all.</b> No subscription, nothing to cancel.</p>
      <p><b>No tracking.</b> No cookies, no ads, no selling your guest list.</p>
      <p><b>Yours to take.</b> Export everything, or delete it all, whenever you like.</p>
    </section>
  );
}
