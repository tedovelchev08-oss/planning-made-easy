import React from "react";
import { Check, Crown, ExternalLink, Lock, Music, Plus, Sparkles, Trash2 } from "lucide-react";
import {
  DESIGN_LIMITS, STUDIO_DESIGNS, STUDIO_PREFIX, STUDIO_TRACKS, designPath, planAllows, toInvitationData,
  type DesignData, type StudioDesign,
} from "../../../api/_lib/studioDesigns";
import { useApp, type Db, type InvitationConfig } from "../../lib/store";
import { PLANS } from "../../lib/plans";
import { playChime } from "../../lib/sound";
import { Field, Pill, btn, inputCls } from "../ui";

/**
 * The owner's own invitation designs in the planner (Block 18b): a gallery
 * row to choose one, the details it shows (dress code, schedule, FAQ...),
 * its music, and a preview of the real design page.
 */

const PREVIEW_KEY = "luma.designPreview";

/** what the design page would receive from /api/invitation, built from the planner's own copy */
export function previewData(db: Db, design: StudioDesign): Record<string, unknown> {
  const cfg = db.invitation;
  return toInvitationData({
    slug: db.wedding.slug ?? "",
    names: db.wedding.names,
    partnerA: db.wedding.partnerA,
    partnerB: db.wedding.partnerB,
    date: db.wedding.date,
    venue: db.wedding.venue,
    location: db.wedding.location,
    timezone: db.wedding.timezone,
    locale: db.wedding.locale,
    plan: db.plan,
    invitation: {
      template_id: cfg.templateId,
      photo: cfg.photo,
      collect_rsvp: cfg.rsvp,
      music: { track: cfg.music.track, uploadName: cfg.music.uploadName, url: cfg.music.uploadUrl },
      design_data: cfg.designData ?? {},
    },
  }, design);
}

/**
 * Opens the real design page in its own tab, reading the planner's copy
 * (luma-bridge.js, ?preview=1). Kept up to date: the page reloads when the
 * copy changes. Nothing is sent from it.
 */
export function openStudioPreview(db: Db, design: StudioDesign): void {
  writePreview(db, design);
  window.open(`${designPath(design)}?preview=1`, "luma-design-preview");
}

export function writePreview(db: Db, design: StudioDesign): void {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify({ design: design.id, invitation: previewData(db, design) }));
  } catch { /* storage blocked: the preview tab says there's nothing to show */ }
}

/* ------------------------------ the gallery row ------------------------------ */

/** a design's card: its colours and the couple's initials, no screenshot to go stale */
function StudioCard({ design, initials }: { design: StudioDesign; initials: string }) {
  const { from, to, ink } = design.placeholder;
  return (
    <span className="relative flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 overflow-hidden" style={{ background: `linear-gradient(180deg, ${from}, ${to})`, color: ink }}>
      {design.motif === "stars" ? (
        <span aria-hidden="true" className="absolute inset-0 opacity-60" style={{ backgroundImage: `radial-gradient(1px 1px at 20% 30%, ${ink}, transparent), radial-gradient(1px 1px at 70% 20%, ${ink}, transparent), radial-gradient(1.5px 1.5px at 80% 70%, ${ink}, transparent), radial-gradient(1px 1px at 35% 80%, ${ink}, transparent), radial-gradient(1px 1px at 55% 55%, ${ink}, transparent)` }} />
      ) : (
        <span aria-hidden="true" className="absolute inset-2.5 border" style={{ borderColor: `${ink}80`, outline: `1px solid ${ink}40`, outlineOffset: "3px" }} />
      )}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full border font-display text-xl" style={{ borderColor: `${ink}99` }}>{initials}</span>
      <span className="relative text-[0.5rem] font-extrabold uppercase tracking-[0.3em]">{design.name}</span>
    </span>
  );
}

export function StudioGallery({ cfg, setCfg }: { cfg: InvitationConfig; setCfg: (p: Partial<InvitationConfig>) => void }) {
  const { db, openUpgrade, toast } = useApp();
  const initials = [db.wedding.partnerA, db.wedding.partnerB].map((n) => (n ?? "").trim()[0] ?? "").filter(Boolean).join(" & ") || "A & B";

  const choose = (d: StudioDesign) => {
    if (!planAllows(db.plan, d)) { openUpgrade("premiumDesigns"); return; }
    // never a template's stock photo on the owner's designs: the couple's own, or their initials
    setCfg({ templateId: `${STUDIO_PREFIX}${d.id}`, colors: null, fontSerif: null, photo: null });
    playChime("place");
    toast(`Design: ${d.name}`, "Add your details on the right, then preview it.");
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-gold-deep">
          <Sparkles size={12} /> Studio designs · {STUDIO_DESIGNS.length}
        </p>
        <p className="text-[0.68rem] font-semibold text-ink-mute">Hand-made invitations with their own music and motion</p>
      </div>
      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
        {STUDIO_DESIGNS.map((d) => {
          const active = cfg.templateId === `${STUDIO_PREFIX}${d.id}`;
          const locked = !planAllows(db.plan, d);
          return (
            <button key={d.id} onClick={() => choose(d)} aria-pressed={active} title={d.blurb}
              className={`group relative w-36 shrink-0 overflow-hidden rounded-[1.1rem] border-2 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-lift cursor-pointer ${active ? "border-gold shadow-card" : "border-transparent"}`}>
              <span className={`block ${locked ? "opacity-80 saturate-[0.55]" : ""}`}><StudioCard design={d} initials={initials} /></span>
              {locked && (
                <span className="absolute inset-x-0 top-0 flex aspect-[4/5] items-center justify-center bg-ink/25">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cream/90 text-gold-deep shadow-card"><Lock size={13} /><span className="sr-only">{PLANS[d.plan].name}</span></span>
                </span>
              )}
              <span className="flex items-center justify-between bg-white/95 px-2.5 py-1.5">
                <span className="truncate text-[0.68rem] font-extrabold text-ink">{d.name}</span>
                {active ? <Check size={11} strokeWidth={3.5} className="shrink-0 text-gold-deep" /> : <Crown size={11} className="shrink-0 text-gold-deep" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ the preview pane ------------------------------ */

export function StudioPreviewPane({ design }: { design: StudioDesign }) {
  const { db } = useApp();
  const initials = [db.wedding.partnerA, db.wedding.partnerB].map((n) => (n ?? "").trim()[0] ?? "").filter(Boolean).join(" & ") || "A & B";
  return (
    <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
      <StudioCard design={design} initials={initials} />
      <div className="flex flex-col justify-center gap-3 bg-white px-6 py-6">
        <p className="font-display text-2xl text-ink">{design.name}</p>
        <p className="text-[0.85rem] leading-relaxed text-ink-2">{design.blurb}. Your names, date and venue come from your wedding; the details on the right fill the rest.</p>
        <p className="text-[0.76rem] font-semibold text-ink-mute">Anything you leave empty is simply left out, so guests never see placeholder text.</p>
        <button onClick={() => openStudioPreview(db, design)} className={`${btn.ink} self-start !py-2.5`}>
          <ExternalLink size={14} /> Open the preview
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ the details ------------------------------ */

const ICONS = [
  ["fa-ring", "Rings"], ["fa-champagne-glasses", "Toast"], ["fa-utensils", "Dinner"], ["fa-music", "Music"],
  ["fa-camera", "Photos"], ["fa-cake-candles", "Cake"], ["fa-heart", "Heart"], ["fa-moon", "Night"], ["fa-car-side", "Send-off"],
] as const;

const L = DESIGN_LIMITS;
const label = "text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute";
const card = "rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md";
const small = `${inputCls} !px-3 !py-2 !text-[0.85rem]`;

export function StudioDetails({ cfg, setCfg, design }: {
  cfg: InvitationConfig; setCfg: (p: Partial<InvitationConfig>) => void; design: StudioDesign;
}) {
  const dd: DesignData = cfg.designData ?? {};
  const set = (p: Partial<DesignData>) => setCfg({ designData: { ...dd, ...p } });
  const schedule = dd.schedule ?? [];
  const faq = dd.faq ?? [];
  const setItem = <T,>(list: T[], i: number, p: Partial<T>) => list.map((x, j) => (j === i ? { ...x, ...p } : x));

  const uploaded = cfg.music.track === "upload" && !!cfg.music.uploadUrl;
  const track = uploaded ? "upload" : dd.musicTrack ?? "none";
  const pickTrack = (id: string) => {
    // a design track (or silence) takes over from an uploaded song, which stays stored
    setCfg({ music: { ...cfg.music, track: cfg.music.track === "upload" ? "serene" : cfg.music.track }, designData: { ...dd, musicTrack: id } });
    if (id !== "none") playChime("place");
  };

  return (
    <>
      <section className={`${card} space-y-3`} aria-label={`${design.name} details`}>
        <h3 className={label}>The details</h3>
        <p className="text-[0.76rem] font-semibold text-ink-mute">Names, date, time and venue come from your wedding settings.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dress code"><input className={inputCls} maxLength={L.dressCode} placeholder="Black tie" value={dd.dressCode ?? ""} onChange={(e) => set({ dressCode: e.target.value })} /></Field>
          <Field label="Reply by"><input className={inputCls} maxLength={L.rsvpDeadline} placeholder="1 May 2027" value={dd.rsvpDeadline ?? ""} onChange={(e) => set({ rsvpDeadline: e.target.value })} /></Field>
        </div>
        <Field label="Dress code note"><input className={inputCls} maxLength={L.dressCodeNote} placeholder="Midnight colours welcome" value={dd.dressCodeNote ?? ""} onChange={(e) => set({ dressCodeNote: e.target.value })} /></Field>
        <Field label="Hashtag"><input className={inputCls} maxLength={L.hashtag} placeholder="#AnaAndBoris" value={dd.hashtag ?? ""} onChange={(e) => set({ hashtag: e.target.value })} /></Field>
      </section>

      <section className={`${card} space-y-3`}>
        <h3 className={label}>How you met</h3>
        <textarea className={inputCls} rows={3} maxLength={L.story} placeholder="A few lines about the two of you" aria-label="Your story, first paragraph" value={dd.story1 ?? ""} onChange={(e) => set({ story1: e.target.value })} />
        <textarea className={inputCls} rows={3} maxLength={L.story} placeholder="A second paragraph, if you like" aria-label="Your story, second paragraph" value={dd.story2 ?? ""} onChange={(e) => set({ story2: e.target.value })} />
      </section>

      <section className={`${card} space-y-3`}>
        <h3 className={label}>The day's schedule</h3>
        {schedule.map((s, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-3">
            <div className="grid grid-cols-[84px_1fr_auto] gap-2">
              <input className={small} maxLength={L.time} placeholder="16:00" aria-label={`Moment ${i + 1}: time`} value={s.time ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { time: e.target.value }) })} />
              <input className={small} maxLength={L.title} placeholder="Ceremony" aria-label={`Moment ${i + 1}: what happens`} value={s.title ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { title: e.target.value }) })} />
              <button onClick={() => set({ schedule: schedule.filter((_, j) => j !== i) })} aria-label={`Remove moment ${i + 1}`} className="rounded-full p-2 text-ink-mute transition hover:text-blush-deep cursor-pointer"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <input className={small} maxLength={L.venue} placeholder="Where (optional)" aria-label={`Moment ${i + 1}: where`} value={s.venue ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { venue: e.target.value }) })} />
              <select className={small} aria-label={`Moment ${i + 1}: icon`} value={s.icon ?? "fa-heart"} onChange={(e) => set({ schedule: setItem(schedule, i, { icon: e.target.value }) })}>
                {ICONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
          </div>
        ))}
        {schedule.length < L.items && (
          <button onClick={() => set({ schedule: [...schedule, { time: "", title: "", venue: "", icon: "fa-heart" }] })} className={`${btn.outline} w-full !py-2 text-[0.8rem]`}>
            <Plus size={14} /> Add a moment
          </button>
        )}
      </section>

      <section className={`${card} space-y-3`}>
        <h3 className={label}>Questions guests ask</h3>
        {faq.map((f, i) => (
          <div key={i} className="space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className={small} maxLength={L.question} placeholder="Are children welcome?" aria-label={`Question ${i + 1}`} value={f.question ?? ""} onChange={(e) => set({ faq: setItem(faq, i, { question: e.target.value }) })} />
              <button onClick={() => set({ faq: faq.filter((_, j) => j !== i) })} aria-label={`Remove question ${i + 1}`} className="rounded-full p-2 text-ink-mute transition hover:text-blush-deep cursor-pointer"><Trash2 size={14} /></button>
            </div>
            <textarea className={small} rows={2} maxLength={L.answer} placeholder="Your answer" aria-label={`Answer ${i + 1}`} value={f.answer ?? ""} onChange={(e) => set({ faq: setItem(faq, i, { answer: e.target.value }) })} />
          </div>
        ))}
        {faq.length < L.items && (
          <button onClick={() => set({ faq: [...faq, { question: "", answer: "" }] })} className={`${btn.outline} w-full !py-2 text-[0.8rem]`}>
            <Plus size={14} /> Add a question
          </button>
        )}
      </section>

      <section className={`${card} space-y-2`} aria-label="Music">
        <div className="flex items-center justify-between">
          <h3 className={label}>Music</h3>
          {uploaded && <Pill tone="gold"><Music size={10} /> your song</Pill>}
        </div>
        {uploaded && (
          <p className="text-[0.76rem] font-semibold text-ink-2">“{cfg.music.uploadName}” plays when guests open it. Pick a track below to use that instead.</p>
        )}
        {[{ id: "none", name: "No music", composer: "Quiet" }, ...STUDIO_TRACKS].map((t) => (
          <button key={t.id} onClick={() => pickTrack(t.id)} aria-pressed={track === t.id}
            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition cursor-pointer ${track === t.id ? "border-gold/60 bg-gold-soft/50" : "border-ink/12 hover:border-ink/30"}`}>
            <span className="flex-1">
              <span className="block text-[0.8rem] font-extrabold text-ink">{t.name}</span>
              <span className="text-[0.66rem] font-semibold text-ink-mute">{t.composer}</span>
            </span>
            {track === t.id && <Check size={13} strokeWidth={3.4} className="text-gold-deep" />}
          </button>
        ))}
      </section>
    </>
  );
}
