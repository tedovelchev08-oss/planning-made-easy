import { useEffect, useRef, useState } from "react";
import { MUSIC_TRACKS, MusicTrack } from "./data";

/* Tiny WebAudio feedback for the planner. Everything is short, soft and
   created lazily on user gesture; it fails silently where unsupported. */

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  opts: { at?: number; dur?: number; vol?: number; type?: OscillatorType } = {},
) {
  const c = ensureCtx();
  if (!c) return;
  const { at = 0, dur = 0.16, vol = 0.055, type = "sine" } = opts;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export type ChimeKind = "done" | "undo" | "place" | "sparkle";

export function playChime(kind: ChimeKind) {
  switch (kind) {
    case "done":
      tone(659.25, { dur: 0.14 });
      tone(987.77, { at: 0.09, dur: 0.22 });
      break;
    case "undo":
      tone(493.88, { dur: 0.12, vol: 0.04 });
      tone(329.63, { at: 0.07, dur: 0.16, vol: 0.04 });
      break;
    case "place":
      tone(880, { dur: 0.09, vol: 0.035, type: "triangle" });
      break;
    case "sparkle":
      [659.25, 830.61, 987.77, 1318.5].forEach((f, i) =>
        tone(f, { at: i * 0.07, dur: 0.3, vol: 0.04 }),
      );
      break;
  }
}

/* ------------------------------ music loop ------------------------------ */

/** Gentle generative pluck melody for invitation previews. */
export function useChimeLoop(trackId: MusicTrack["id"] = "serene") {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const track = MUSIC_TRACKS.find((t) => t.id === trackId) ?? MUSIC_TRACKS[0];

  const stop = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    setPlaying(false);
  };

  const start = () => {
    if (playing) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const c = new AC();
    ctxRef.current = c;
    let step = 0;
    const pluck = () => {
      if (c.state === "closed") return;
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.value = track.notes[step % track.notes.length];
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.085, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 1.7);
      step++;
    };
    pluck();
    timerRef.current = window.setInterval(pluck, track.tempo);
    setPlaying(true);
  };

  // if the track changes mid-playback, restart with the new melody
  useEffect(() => {
    if (playing) {
      stop();
      start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  useEffect(() => () => stop(), []);
  return { playing, start, stop };
}
