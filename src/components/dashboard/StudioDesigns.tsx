import React from "react";
import { Check, ExternalLink, Lock, Music, Plus, Trash2 } from "lucide-react";
import {
  DESIGN_LIMITS, STUDIO_DESIGNS, STUDIO_PREFIX, designPath, planAllows, toInvitationData, tracksOf,
  type DesignData, type StudioDesign,
} from "../../../api/_lib/studioDesigns";
import { useApp, type Db, type InvitationConfig } from "../../lib/store";
import { PLANS } from "../../lib/plans";
import { playChime } from "../../lib/sound";
import { Field, inputCls } from "../ui";
import { Panel } from "./Panel";
import { PhotoUpload } from "./PhotoUpload";
import { deletePhoto, isUploadedPhoto } from "../../lib/api";

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
    registry: db.registry.map((r) => ({ name: r.name, store: r.store, url: r.url, purchased: r.purchased })),
  }, design);
}

/**
 * Opens the real design page in its own tab, reading the planner's copy
 * (luma-bridge.js, ?preview=1). Kept up to date: the page reloads when the
 * copy changes. Nothing is sent from it.
 */
export function openStudioPreview(db: Db, design: StudioDesign): void {
  writePreview(db, design);
  window.open(`${designPath(design)}?preview=1`, "twofold-design-preview");
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
      <span className="relative text-[0.5rem] uppercase tracking-[0.3em]">{design.name}</span>
    </span>
  );
}

export function StudioGallery({ cfg, setCfg }: { cfg: InvitationConfig; setCfg: (p: Partial<InvitationConfig>) => void }) {
  const { db, openUpgrade, toast } = useApp();
  const initials = [db.wedding.partnerA, db.wedding.partnerB].map((n) => (n ?? "").trim()[0] ?? "").filter(Boolean).join(" & ") || "A & B";

  const choose = (d: StudioDesign) => {
    if (!planAllows(db.plan, d)) { openUpgrade("premiumDesigns"); return; }
    // never a template's stock photo on the owner's designs: the couple's own, or their initials
    setCfg({ templateId: `${STUDIO_PREFIX}${d.id}`, colors: null, fontSerif: null, photo: isUploadedPhoto(cfg.photo) ? cfg.photo : null });
    playChime("place");
    toast(`Design: ${d.name}`, "Add your details on the right, then preview it.");
  };

  return (
    <div>
      <h3 className="font-display text-[22px] leading-none">Studio designs</h3>
      <p className="mt-1.5 text-[13px] text-[var(--pl-ink-2)]">Made by hand, each with its own music and movement.</p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
        {STUDIO_DESIGNS.map((d) => {
          const active = cfg.templateId === `${STUDIO_PREFIX}${d.id}`;
          const locked = !planAllows(db.plan, d);
          return (
            <button key={d.id} onClick={() => choose(d)} aria-pressed={active} title={d.blurb}
              className={`group relative w-36 shrink-0 overflow-hidden rounded-[3px] bg-[var(--pl-card)] text-left shadow-[0_14px_30px_-24px_rgb(60_40_15/.6)] transition cursor-pointer ${active ? "ring-2 ring-[var(--pl-gold)] ring-offset-2 ring-offset-[var(--pl-paper)]" : "ring-1 ring-[var(--pl-line)] hover:ring-[rgb(28_26_23/.3)]"}`}>
              <span className={`block ${locked ? "opacity-80 saturate-[0.55]" : ""}`}><StudioCard design={d} initials={initials} /></span>
              {locked && (
                <span className="absolute inset-x-0 top-0 flex aspect-[4/5] items-center justify-center bg-[rgb(15_14_13/.25)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pl-card)] text-[var(--pl-bronze)]"><Lock size={13} strokeWidth={1.8} /><span className="sr-only">{PLANS[d.plan].name}</span></span>
                </span>
              )}
              <span className="flex items-center justify-between gap-2 px-2.5 py-2">
                <span className="truncate text-[13px]">{d.name}</span>
                {active && <Check size={13} strokeWidth={2} className="shrink-0 text-[var(--pl-bronze)]" aria-label="Chosen" />}
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
      <div className="flex flex-col justify-center gap-3 bg-[var(--pl-card)] px-6 py-6">
        <p className="font-display text-[28px] leading-none">{design.name}</p>
        <p className="text-[14.5px] leading-relaxed text-[var(--pl-ink-2)]">{design.blurb}. Your names, date and venue come from your wedding; the details beside it fill the rest.</p>
        <p className="text-[13px] text-[var(--pl-ink-2)]">Anything you leave empty is left out, so guests never see sample text.</p>
        <button onClick={() => openStudioPreview(db, design)} className="pl-quiet self-start">
          <ExternalLink size={14} strokeWidth={1.6} /> Open it in a new tab
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
const small = `${inputCls} !px-3 !py-2 !text-[14px]`;
/** one repeated thing in a list (a moment, a question, a photo) */
const item = "space-y-2 border-t border-[var(--pl-line)] pt-3 first:border-t-0 first:pt-0";
const addBtn = "pl-quiet w-full";

export function StudioDetails({ cfg, setCfg, design }: {
  cfg: InvitationConfig; setCfg: (p: Partial<InvitationConfig>) => void; design: StudioDesign;
}) {
  const { mode, weddingId } = useApp();
  const dd: DesignData = cfg.designData ?? {};
  const momentPhotos = !!design.extras?.schedulePhotos;
  /** a removed moment takes its uploaded photo with it */
  const forgetPhoto = (url?: string) => {
    if (url && isUploadedPhoto(url) && mode === "cloud" && weddingId) void deletePhoto(weddingId, url).catch(() => {});
  };
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
      <Panel title={design.extras ? "Main photo" : "Your photo"} label="Your photo">
        <div className="space-y-3">
        <PhotoUpload photo={cfg.photo} onChange={(photo) => setCfg({ photo })} />
        {!isUploadedPhoto(cfg.photo) && <p className="text-[13px] text-[var(--pl-ink-2)]">Until you add one, {design.name} shows your initials.</p>}
        </div>
      </Panel>

      <Panel title="The details" label={`${design.name} details`}>
        <div className="space-y-3">
        <p className="text-[13px] text-[var(--pl-ink-2)]">Names, date, time and venue come from your wedding settings.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dress code"><input className={inputCls} maxLength={L.dressCode} placeholder="Black tie" value={dd.dressCode ?? ""} onChange={(e) => set({ dressCode: e.target.value })} /></Field>
          <Field label="Reply by"><input className={inputCls} maxLength={L.rsvpDeadline} placeholder="1 May 2027" value={dd.rsvpDeadline ?? ""} onChange={(e) => set({ rsvpDeadline: e.target.value })} /></Field>
        </div>
        <Field label="Dress code note"><input className={inputCls} maxLength={L.dressCodeNote} placeholder="Midnight colours welcome" value={dd.dressCodeNote ?? ""} onChange={(e) => set({ dressCodeNote: e.target.value })} /></Field>
        <Field label="Hashtag"><input className={inputCls} maxLength={L.hashtag} placeholder="#AnaAndBoris" value={dd.hashtag ?? ""} onChange={(e) => set({ hashtag: e.target.value })} /></Field>
        </div>
      </Panel>

      {design.extras && <StudioExtras cfg={cfg} setCfg={setCfg} design={design} />}

      <Panel title="How you met">
        <div className="space-y-3">
        <textarea className={inputCls} rows={3} maxLength={L.story} placeholder="A few lines about the two of you" aria-label="Your story, first paragraph" value={dd.story1 ?? ""} onChange={(e) => set({ story1: e.target.value })} />
        <textarea className={inputCls} rows={3} maxLength={L.story} placeholder="A second paragraph, if you like" aria-label="Your story, second paragraph" value={dd.story2 ?? ""} onChange={(e) => set({ story2: e.target.value })} />
        </div>
      </Panel>

      <Panel title="The day's schedule">
        <div className="space-y-3">
        {schedule.map((s, i) => (
          <div key={i} className={item}>
            <div className="grid grid-cols-[84px_1fr_auto] gap-2">
              <input className={small} maxLength={L.time} placeholder="16:00" aria-label={`Moment ${i + 1}: time`} value={s.time ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { time: e.target.value }) })} />
              <input className={small} maxLength={L.title} placeholder="Ceremony" aria-label={`Moment ${i + 1}: what happens`} value={s.title ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { title: e.target.value }) })} />
              <button onClick={() => { forgetPhoto(s.photo); set({ schedule: schedule.filter((_, j) => j !== i) }); }} aria-label={`Remove moment ${i + 1}`} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.05)] hover:text-[#a53d28] cursor-pointer"><Trash2 size={14} /></button>
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <input className={small} maxLength={L.venue} placeholder="Where (optional)" aria-label={`Moment ${i + 1}: where`} value={s.venue ?? ""} onChange={(e) => set({ schedule: setItem(schedule, i, { venue: e.target.value }) })} />
              <select className={small} aria-label={`Moment ${i + 1}: icon`} value={s.icon ?? "fa-heart"} onChange={(e) => set({ schedule: setItem(schedule, i, { icon: e.target.value }) })}>
                {ICONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </div>
            {momentPhotos && (
              <PhotoUpload compact photo={s.photo ?? null} label={`Moment ${i + 1}: photo`}
                onChange={(url) => set({ schedule: setItem(schedule, i, { photo: url ?? undefined }) })} />
            )}
          </div>
        ))}
        {schedule.length < L.items && (
          <button onClick={() => set({ schedule: [...schedule, { time: "", title: "", venue: "", icon: "fa-heart" }] })} className={addBtn}>
            <Plus size={14} /> Add a moment
          </button>
        )}
        </div>
      </Panel>

      <Panel title="Questions guests ask">
        <div className="space-y-3">
        {faq.map((f, i) => (
          <div key={i} className={item}>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input className={small} maxLength={L.question} placeholder="Are children welcome?" aria-label={`Question ${i + 1}`} value={f.question ?? ""} onChange={(e) => set({ faq: setItem(faq, i, { question: e.target.value }) })} />
              <button onClick={() => set({ faq: faq.filter((_, j) => j !== i) })} aria-label={`Remove question ${i + 1}`} className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--pl-ink-2)] transition hover:bg-[rgb(28_26_23/.05)] hover:text-[#a53d28] cursor-pointer"><Trash2 size={14} /></button>
            </div>
            <textarea className={small} rows={2} maxLength={L.answer} placeholder="Your answer" aria-label={`Answer ${i + 1}`} value={f.answer ?? ""} onChange={(e) => set({ faq: setItem(faq, i, { answer: e.target.value }) })} />
          </div>
        ))}
        {faq.length < L.items && (
          <button onClick={() => set({ faq: [...faq, { question: "", answer: "" }] })} className={addBtn}>
            <Plus size={14} /> Add a question
          </button>
        )}
        </div>
      </Panel>

      {tracksOf(design).length > 0 && (
      <Panel title="Music" aside={uploaded ? <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--pl-bronze)]"><Music size={13} strokeWidth={1.6} aria-hidden="true" /> your song</span> : undefined}>
        <div className="space-y-2">
        {uploaded && (
          <p className="text-[13.5px] text-[var(--pl-ink-2)]">“{cfg.music.uploadName}” plays when guests open it. Pick a track below to use that instead.</p>
        )}
        {[{ id: "none", name: "No music", composer: "Quiet" }, ...tracksOf(design)].map((t) => (
          <button key={t.id} onClick={() => pickTrack(t.id)} aria-pressed={track === t.id}
            className={`flex w-full items-center gap-3 rounded-[2px] border px-3.5 py-2.5 text-left transition cursor-pointer ${track === t.id ? "border-[var(--pl-gold)] bg-[rgb(201_168_106/.12)]" : "border-[var(--pl-line)] hover:border-[rgb(28_26_23/.3)]"}`}>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px]">{t.name}</span>
              <span className="block font-accent text-[15px] italic text-[var(--pl-ink-2)]">{t.composer}</span>
            </span>
            {track === t.id && <Check size={14} strokeWidth={2} className="text-[var(--pl-bronze)]" aria-hidden="true" />}
          </button>
        ))}
        </div>
      </Panel>
      )}
    </>
  );
}

/* ------------------------------ a design's own photos, gallery and wording ------------------------------ */

function StudioExtras({ cfg, setCfg, design }: {
  cfg: InvitationConfig; setCfg: (p: Partial<InvitationConfig>) => void; design: StudioDesign;
}) {
  const x = design.extras!;
  const dd: DesignData = cfg.designData ?? {};
  const set = (p: Partial<DesignData>) => setCfg({ designData: { ...dd, ...p } });
  const photos = dd.photos ?? {};
  const texts = dd.texts ?? {};
  const gallery = dd.gallery ?? [];

  return (
    <>
      {x.photos.length > 0 && (
      <Panel title="More photos" label={`${design.name} photos`}>
        <div className="space-y-4">
        <p className="text-[13px] text-[var(--pl-ink-2)]">Any you leave out show {design.name}'s own drawings instead.</p>
        {x.photos.map((slot) => (
          <div key={slot.key} className="space-y-1.5">
            <p className="text-[14.5px]">{slot.label}</p>
            {slot.hint && <p className="text-[12.5px] text-[var(--pl-ink-2)]">{slot.hint}</p>}
            <PhotoUpload photo={photos[slot.key] ?? null} label={slot.label}
              onChange={(url) => {
                const next = { ...photos };
                if (url) next[slot.key] = url; else delete next[slot.key];
                set({ photos: next });
              }} />
          </div>
        ))}
        </div>
      </Panel>
      )}

      {x.gallery > 0 && (
        <Panel title="Gallery" label="Gallery" aside={<span className="text-[13px] text-[var(--pl-ink-2)]">up to <span className="tabular-nums">{x.gallery}</span></span>}>
        <div className="space-y-3">
          {gallery.map((g, i) => (
            <div key={g.photo ?? i} className={item}>
              <PhotoUpload photo={g.photo ?? null} label={`Gallery photo ${i + 1}`}
                onChange={(url) => set({ gallery: url ? gallery.map((x2, j) => (j === i ? { ...x2, photo: url } : x2)) : gallery.filter((_, j) => j !== i) })} />
              <input className={small} maxLength={60} placeholder="A caption (optional)" aria-label={`Gallery photo ${i + 1}: caption`} value={g.caption ?? ""}
                onChange={(e) => set({ gallery: gallery.map((x2, j) => (j === i ? { ...x2, caption: e.target.value } : x2)) })} />
            </div>
          ))}
          {gallery.length < x.gallery && (
            <PhotoUpload photo={null} label="New gallery photo" onChange={(url) => { if (url) set({ gallery: [...gallery, { photo: url, caption: "" }] }); }} />
          )}
        </div>
      </Panel>
      )}

      {(x.choices ?? []).map((c) => {
        const current = dd.choices?.[c.key] ?? c.options[0].value;
        return (
          <Panel key={c.key} title={c.label}>
            <div className="pl-seg flex w-full" role="group" aria-label={c.label}>
              {c.options.map((o) => (
                <button key={o.value} onClick={() => set({ choices: { ...(dd.choices ?? {}), [c.key]: o.value } })} aria-pressed={current === o.value}
                  className="min-w-0 flex-1 !px-2">
                  {o.label}
                </button>
              ))}
            </div>
          </Panel>
        );
      })}

      <Panel title="Wording" label={`${design.name} wording`}>
        <div className="space-y-3">
        <p className="text-[13px] text-[var(--pl-ink-2)]">Left empty, a line is either left out or shows {design.name}'s own wording.</p>
        {x.texts.map((t) => (
          <Field key={t.key} label={t.label}>
            {t.multiline ? (
              <textarea className={inputCls} rows={2} maxLength={t.max} placeholder={t.placeholder} value={texts[t.key] ?? ""}
                onChange={(e) => set({ texts: { ...texts, [t.key]: e.target.value } })} />
            ) : (
              <input className={inputCls} maxLength={t.max} placeholder={t.placeholder} value={texts[t.key] ?? ""}
                onChange={(e) => set({ texts: { ...texts, [t.key]: e.target.value } })} />
            )}
          </Field>
        ))}
        </div>
      </Panel>
    </>
  );
}
