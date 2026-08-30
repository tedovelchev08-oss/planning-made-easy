/* Luma — tiny WebAudio chimes for satisfying completions.
   Soft, warm, short — never intrusive. Fails silently everywhere. */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function note(c: AudioContext, freq: number, at: number, peak: number, dur: number, type: OscillatorType = "sine") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

export type ChimeKind = "done" | "undo" | "place" | "sparkle";

export function playChime(kind: ChimeKind = "done") {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + 0.01;
  try {
    if (kind === "done") {
      // warm rising fifth — the "yes, it's handled" feeling
      note(c, 659.25, t, 0.075, 0.42); // E5
      note(c, 987.77, t + 0.075, 0.06, 0.5); // B5
      note(c, 1318.5, t + 0.15, 0.02, 0.35, "triangle"); // faint E6 shimmer
    } else if (kind === "undo") {
      note(c, 493.88, t, 0.05, 0.3); // B4
      note(c, 369.99, t + 0.06, 0.04, 0.3); // F#4
    } else if (kind === "place") {
      note(c, 587.33, t, 0.05, 0.22); // D5 tap
    } else {
      // high shimmer that completes an E-major chord with the "done" chime
      note(c, 1661.2, t, 0.028, 0.32, "triangle"); // G#6
      note(c, 1975.5, t + 0.06, 0.02, 0.3, "triangle"); // B6
    }
  } catch {
    /* silent */
  }
}
