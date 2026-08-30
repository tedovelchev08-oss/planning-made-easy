import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Globe, Heart, Lock, MapPin, Monitor, Music2, Smartphone, Sparkles, Tablet } from "lucide-react";
import { SITE_SECTIONS, fmtDate, fmtDateShort } from "../../lib/data";
import { IMAGES } from "../../lib/images";
import { useApp, usePrefersReducedMotion } from "../../lib/store";
import { Field, Modal, Pill, SafeImg, btn, inputCls } from "../ui";

const SITE_TEMPLATES = {
  serene: { label: "Serene", bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true },
  editorial: { label: "Editorial", bg: "#FFFFFF", ink: "#1E1A1D", accent: "#E98BA0", serif: false },
  garden: { label: "Garden", bg: "#E7F0E3", ink: "#3E4A38", accent: "#74996B", serif: true },
} as const;

const SITE_PALETTES = [
  { bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37" },
  { bg: "#FFE7EC", ink: "#5C4F55", accent: "#E98BA0" },
  { bg: "#EEE8F9", ink: "#4A4152", accent: "#A78BD4" },
  { bg: "#E7F0E3", ink: "#3E4A38", accent: "#74996B" },
  { bg: "#FFFFFF", ink: "#1E1A1D", accent: "#D4AF37" },
];

const PHOTOS = [
  { label: "Golden hour", src: IMAGES.couple },
  { label: "The venue", src: IMAGES.venue },
  { label: "The rings", src: IMAGES.hands },
];

export default function Website() {
  const { db, patch, toast, openCheckout } = useApp();
  const w = db.website;
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const reduced = usePrefersReducedMotion();

  const isLuxe = db.plan === "luxe";
  const setW = (p: Partial<typeof w>) => patch({ website: { ...w, ...p } });
  const fontFamily = w.serif ? "'Playfair Display', Georgia, serif" : "'Nunito Sans', sans-serif";

  const applyTemplate = (id: keyof typeof SITE_TEMPLATES) => {
    const t = SITE_TEMPLATES[id];
    setW({ template: id, bg: t.bg, ink: t.ink, accent: t.accent, serif: t.serif });
    toast(`${t.label} template applied`, "Colors and type follow the mood.");
  };

  const toggleSection = (id: string) => {
    if (id === "hero") { toast("The hero stays", "Every great site needs a front door.", "info"); return; }
    setW({ sections: { ...w.sections, [id]: !w.sections[id] } });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${w.domain}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Copy manually", w.domain, "info");
    }
  };

  const on = (id: string) => !!w.sections[id];
  const anim = isLuxe && w.animations && !reduced;

  const SectionFade = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) =>
    anim ? (
      <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </motion.div>
    ) : (
      <>{children}</>
    );

  if (db.plan === "essential") {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/70 bg-white/60 p-10 text-center backdrop-blur-md">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lav-soft text-lav-deep"><Globe size={24} /></span>
        <h2 className="mt-5 font-display text-3xl text-ink">Your website lives in the <em className="text-blush-deep">Celebration Suite.</em></h2>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-2">A beautiful one-page wedding site with RSVPs, schedule, travel and registry — yours for the one-time Suite price.</p>
        <button onClick={() => openCheckout("celebration")} className={`${btn.blush} mt-7`}>Unlock the website — $99 one-time</button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      {/* controls */}
      <div className="space-y-5">
        <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Template</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {(Object.keys(SITE_TEMPLATES) as (keyof typeof SITE_TEMPLATES)[]).map((id) => {
              const t = SITE_TEMPLATES[id];
              return (
                <button key={id} onClick={() => applyTemplate(id)} aria-pressed={w.template === id}
                  className={`rounded-xl border-2 p-2 transition cursor-pointer ${w.template === id ? "border-gold shadow-card" : "border-transparent hover:shadow-sm"}`} style={{ background: t.bg }}>
                  <span className="block h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${t.accent}40, transparent)` }} />
                  <span className="mt-1.5 block text-center text-[0.66rem] font-extrabold" style={{ color: t.ink }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Sections</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {SITE_SECTIONS.map((s) => (
              <button key={s.id} onClick={() => toggleSection(s.id)} aria-pressed={on(s.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.72rem] font-bold transition cursor-pointer ${on(s.id) ? "border-sage/60 bg-sage-soft/70 text-ink" : "border-ink/12 text-ink-mute hover:border-ink/30"}`}>
                {on(s.id) && <Check size={10} strokeWidth={3.5} className="text-sage-deep" />} {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Palette & type</h3>
          <div className="mt-4 flex flex-wrap gap-2.5">
            {SITE_PALETTES.map((p) => (
              <button key={p.bg + p.accent} onClick={() => setW({ bg: p.bg, ink: p.ink, accent: p.accent })} aria-label="Apply palette"
                className={`h-9 w-9 rounded-full border-2 transition cursor-pointer ${w.bg === p.bg && w.accent === p.accent ? "border-ink scale-110" : "border-white shadow-sm hover:scale-105"}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 45%, ${p.accent} 45%)` }} />
            ))}
          </div>
          <div className="mt-4 flex rounded-full bg-ink/5 p-1 text-[0.78rem] font-bold">
            <button onClick={() => setW({ serif: true })} className={`flex-1 rounded-full py-2 transition cursor-pointer ${w.serif ? "bg-white shadow-sm text-ink" : "text-ink-mute"}`}>Serif</button>
            <button onClick={() => setW({ serif: false })} className={`flex-1 rounded-full py-2 transition cursor-pointer ${!w.serif ? "bg-white shadow-sm text-ink" : "text-ink-mute"}`}>Sans</button>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Hero photo</h3>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {PHOTOS.map((p) => (
              <button key={p.label} onClick={() => { setW({ heroPhoto: p.src }); }} title={p.label} aria-label={`Hero photo: ${p.label}`}
                className={`overflow-hidden rounded-xl border-2 transition cursor-pointer ${w.heroPhoto === p.src ? "border-gold" : "border-transparent opacity-80 hover:opacity-100"}`}>
                <img src={p.src} alt={p.label} className="h-14 w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/70 bg-white/60 p-6 backdrop-blur-md">
          <h3 className="text-[0.66rem] font-extrabold uppercase tracking-[0.2em] text-ink-mute">Domain & motion</h3>
          <div className="mt-4 space-y-3">
            {isLuxe ? (
              <Field label="Custom domain">
                <input className={inputCls} value={w.domain} onChange={(e) => setW({ domain: e.target.value.replace(/\s/g, "") })} />
              </Field>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
                <div>
                  <p className="text-[0.78rem] font-bold text-ink">maya-theo.luma.love</p>
                  <p className="text-[0.64rem] font-semibold text-ink-mute">Free subdomain · custom domains are Luxe</p>
                </div>
                <Lock size={14} className="text-ink-mute" />
              </div>
            )}
            <button onClick={() => {
              if (!isLuxe) { toast("Animations are Luxe", "Scroll reveals and motion unlock with Premium Luxe.", "info"); return; }
              setW({ animations: !w.animations });
            }} aria-pressed={w.animations}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-[0.85rem] font-bold transition cursor-pointer ${w.animations && isLuxe ? "border-sage/60 bg-sage-soft/60 text-ink" : "border-ink/12 text-ink-mute"}`}>
              <span className="flex items-center gap-2"><Sparkles size={14} className="text-gold-deep" /> Scroll animations {!isLuxe && <Lock size={11} />}</span>
              <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${w.animations && isLuxe ? "bg-sage-deep" : "bg-ink/15"}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${w.animations && isLuxe ? "translate-x-4" : ""}`} />
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* preview */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-ink">Your site</h2>
            {w.published ? <Pill tone="confirmed">Live</Pill> : <Pill tone="pending">Draft</Pill>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-ink/12 bg-white/70 p-1">
              {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
                <button key={d} onClick={() => setDevice(d)} aria-label={`${d} preview`} className={`rounded-full p-2 transition cursor-pointer ${device === d ? "bg-ink text-cream" : "text-ink-mute hover:text-ink"}`}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
            {w.published && (
              <button onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-[0.78rem] font-bold text-ink transition hover:border-gold/60 cursor-pointer">
                {copied ? <Check size={13} className="text-sage-deep" /> : <Copy size={13} />} {w.domain}
              </button>
            )}
            <button onClick={() => setPublishing(true)} className={`${btn.ink} !py-2.5`}>{w.published ? "Republish" : "Publish"}</button>
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/70 bg-white/50 p-4 backdrop-blur-md sm:p-6">
          <div className={`mx-auto overflow-hidden rounded-[1.2rem] border border-ink/10 shadow-lift transition-all duration-500 ${device === "mobile" ? "max-w-[340px]" : device === "tablet" ? "max-w-[560px]" : "max-w-full"}`}>
            <div className="flex items-center gap-1.5 border-b border-ink/8 bg-white px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blush" /><span className="h-2.5 w-2.5 rounded-full bg-gold" /><span className="h-2.5 w-2.5 rounded-full bg-sage" />
              <span className="ml-3 flex-1 truncate rounded-full bg-ink/5 px-2.5 py-0.5 text-[0.62rem] font-bold text-ink-mute">https://{isLuxe ? w.domain : "maya-theo.luma.love"}</span>
            </div>

            <div className="max-h-[600px] overflow-y-auto" style={{ background: w.bg, color: w.ink, fontFamily }}>
              {on("hero") && (
                <div className="relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
                  <SafeImg src={w.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgb(30 26 29 / 0.62), rgb(30 26 29 / 0.18))" }} />
                  <SectionFade>
                    <p className="relative text-[0.6rem] font-extrabold uppercase tracking-[0.4em]" style={{ color: w.accent === "#D4AF37" ? "#F3E7C3" : w.accent }}>We're getting married</p>
                    <h2 className="relative mt-3 text-4xl text-[#FFF8F0] sm:text-5xl" style={{ fontWeight: w.serif ? 600 : 800 }}>{db.wedding.names}</h2>
                    <p className="relative mt-3 text-[0.9rem] font-semibold text-[#FFF8F0]/85">{fmtDate(db.wedding.date, { month: "long", day: "numeric", year: "numeric" })} · {db.wedding.location}</p>
                  </SectionFade>
                </div>
              )}

              {on("story") && (
                <SectionFade>
                  <div className="grid items-center gap-6 px-8 py-12 sm:grid-cols-2 sm:px-12">
                    <div>
                      <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: w.accent }}>Our story</p>
                      <h3 className="mt-2 text-2xl" style={{ fontWeight: w.serif ? 600 : 800 }}>A slow yes</h3>
                      <p className="mt-3 text-[0.85rem] leading-relaxed opacity-75">It started with a borrowed umbrella and became a shared calendar, a small apartment with tall windows, and one very certain question asked at exactly the wrong, perfect moment.</p>
                    </div>
                      <SafeImg src={IMAGES.hands} alt="Our hands, our rings" className="h-52 w-full rounded-[1.4rem] object-cover shadow-card" />                  </div>
                </SectionFade>
              )}

              {on("details") && (
                <SectionFade>
                  <div className="px-8 pb-12 sm:px-12">
                    <div className="grid gap-4 rounded-[1.4rem] border p-7 sm:grid-cols-3" style={{ borderColor: `${w.accent}44`, background: `${w.accent}0D` }}>
                      {[["When", fmtDateShort(db.wedding.date)], ["Ceremony", "4:00 in the afternoon"], ["Where", `${db.wedding.venue}`]].map(([k, v]) => (
                        <div key={k}>
                          <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.3em]" style={{ color: w.accent }}>{k}</p>
                          <p className="mt-1.5 text-[0.92rem] font-bold">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionFade>
              )}

              {on("schedule") && (
                <SectionFade>
                  <div className="px-8 pb-12 sm:px-12">
                    <p className="text-center text-[0.6rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: w.accent }}>The order of joy</p>
                    <div className="mx-auto mt-5 max-w-md space-y-0">
                      {[["4:00", "Ceremony"], ["5:00", "Cocktails on the terrace"], ["7:00", "Dinner under glass"], ["9:00", "First dance"], ["11:30", "Midnight snacks"]].map(([t, label], i, arr) => (
                        <div key={t} className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.accent }} />
                            {i < arr.length - 1 && <span className="w-px flex-1" style={{ background: `${w.accent}55` }} />}
                          </div>
                          <p className="pb-5 text-[0.88rem] font-bold"><span className="mr-2 tabular-nums opacity-60">{t}</span>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SectionFade>
              )}

              {on("venue") && (
                <SectionFade>
                  <div className="px-8 pb-12 sm:px-12">
                    <div className="overflow-hidden rounded-[1.4rem] shadow-card">
                      <SafeImg src={IMAGES.venue} alt={db.wedding.venue} className="h-56 w-full object-cover" />
                      <div className="flex items-center justify-between gap-3 border-t px-6 py-4" style={{ borderColor: `${w.accent}33` }}>
                        <div>
                          <p className="text-[0.95rem] font-extrabold">{db.wedding.venue}</p>
                          <p className="flex items-center gap-1 text-[0.74rem] font-semibold opacity-65"><MapPin size={11} /> {db.wedding.location}</p>
                        </div>
                        <Heart size={16} style={{ color: w.accent }} fill={`${w.accent}33`} />
                      </div>
                    </div>
                  </div>
                </SectionFade>
              )}

              {on("travel") && (
                <SectionFade>
                  <div className="grid gap-4 px-8 pb-12 sm:grid-cols-2 sm:px-12">
                    {[["Stay", "The Hudson Collective — room block “M&T”, two blocks from the venue."], ["Get there", "Subway to 34th–Hudson Yards; coaches leave both hotels at 3:15."]].map(([k, v]) => (
                      <div key={k} className="rounded-[1.2rem] border p-5" style={{ borderColor: `${w.accent}44` }}>
                        <p className="text-[0.6rem] font-extrabold uppercase tracking-[0.3em]" style={{ color: w.accent }}>{k}</p>
                        <p className="mt-2 text-[0.84rem] leading-relaxed opacity-80">{v}</p>
                      </div>
                    ))}
                  </div>
                </SectionFade>
              )}

              {on("registry") && (
                <SectionFade>
                  <div className="px-8 pb-12 sm:px-12">
                    <p className="text-center text-[0.6rem] font-extrabold uppercase tracking-[0.35em]" style={{ color: w.accent }}>With gratitude</p>
                    <div className="mx-auto mt-4 flex max-w-lg flex-wrap justify-center gap-2">
                      {db.registry.slice(0, 4).map((r) => (
                        <span key={r.id} className="rounded-full border px-3.5 py-1.5 text-[0.74rem] font-bold" style={{ borderColor: `${w.accent}55` }}>{r.name}</span>
                      ))}
                      <span className="rounded-full px-3.5 py-1.5 text-[0.74rem] font-extrabold text-[#FFF8F0]" style={{ background: w.ink }}>Honeymoon fund ♥</span>
                    </div>
                  </div>
                </SectionFade>
              )}

              {on("gallery") && (
                <SectionFade>
                  <div className="grid grid-cols-3 gap-1.5 px-8 pb-12 sm:px-12">
                    {[IMAGES.couple, IMAGES.hands, IMAGES.venue].map((src, i) => (
                      <SafeImg key={src} src={src} alt={`Gallery ${i + 1}`} className={`w-full object-cover ${i === 0 ? "col-span-2 h-40" : "h-40"}`} />
                    ))}
                  </div>
                </SectionFade>
              )}

              {on("rsvp") && (
                <SectionFade>
                  <div className="px-8 pb-14 text-center sm:px-12">
                    <h3 className="text-2xl" style={{ fontWeight: w.serif ? 600 : 800 }}>Will you join us?</h3>
                    <p className="mx-auto mt-2 max-w-sm text-[0.85rem] opacity-70">Your RSVP lands straight in our Luma planner — meals, plus-ones and all.</p>
                    <button onClick={() => toast("RSVP wired", "Guest answers flow into the guest list automatically.")} className="mt-5 rounded-full px-7 py-3 text-[0.85rem] font-bold text-[#FFF8F0] transition hover:opacity-90 cursor-pointer" style={{ background: w.ink }}>
                      RSVP now
                    </button>
                  </div>
                </SectionFade>
              )}

              {on("music") && (
                <SectionFade>
                  <div className="mx-8 mb-12 flex items-center gap-3 rounded-[1.2rem] border px-5 py-4 sm:mx-12" style={{ borderColor: `${w.accent}44`, background: `${w.accent}0D` }}>
                    <Music2 size={18} style={{ color: w.accent }} />
                    <div>
                      <p className="text-[0.82rem] font-extrabold">The first dance</p>
                      <p className="text-[0.7rem] font-semibold opacity-65">“La Vie en Rose” — until the quartet takes over.</p>
                    </div>
                  </div>
                </SectionFade>
              )}

              <p className="border-t px-6 py-5 text-center text-[0.6rem] tracking-[0.3em] opacity-45" style={{ borderColor: `${w.accent}33` }}>
                MADE WITH LUMA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* publish modal */}
      <Modal open={publishing} onClose={() => setPublishing(false)} label="Publish website">
        <div className="p-7 sm:p-8">
          <h2 className="flex items-center gap-2.5 font-display text-2xl text-ink"><Globe size={20} className="text-sage-deep" /> Publish your site</h2>
          <p className="mt-2 text-[0.88rem] font-semibold text-ink-2">Guests will visit <strong className="text-ink">{isLuxe ? w.domain : "maya-theo.luma.love"}</strong> and find everything in one calm page.</p>
          <div className="mt-5 space-y-2 rounded-2xl border border-ink/10 bg-white/70 p-4 text-[0.84rem] font-semibold text-ink-2">
            <p className="flex items-center gap-2"><Check size={13} className="text-sage-deep" /> {Object.values(w.sections).filter(Boolean).length} sections live</p>
            <p className="flex items-center gap-2"><Check size={13} className="text-sage-deep" /> RSVPs flow into Guest List</p>
            <p className="flex items-center gap-2"><Check size={13} className="text-sage-deep" /> SSL, fast hosting, mobile-first</p>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setPublishing(false)} className={btn.ghost}>Not yet</button>
            <button
              onClick={() => { setW({ published: true }); setPublishing(false); toast("Your site is live", `https://${isLuxe ? w.domain : "maya-theo.luma.love"} — share it proudly.`); }}
              className={btn.ink}
            >
              <Globe size={14} /> Publish now
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
