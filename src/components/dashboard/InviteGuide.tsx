import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * The first-time walk-through on the Invitation page (A + C, step 4).
 * One plain question at a time, answered here; the answer is saved at once
 * and shows on the invitation beside it, which points at the part being
 * written. Every step can be skipped, and the whole thing closed: everything
 * it asks can also be typed on the invitation itself.
 */
export type GuideStep = {
  id: string;
  question: string;
  help: string;
  /** what the invitation points at while this step is open */
  point: string[];
  /** the fields; none on the last step */
  body?: React.ReactNode;
};

export function InviteGuide({ steps, onPoint, onClose, onShare }: {
  steps: GuideStep[];
  onPoint: (keys: string[]) => void;
  /** closed, or finished: either way it isn't offered again on its own */
  onClose: () => void;
  onShare: () => void;
}) {
  const [at, setAt] = useState(0);
  const step = steps[Math.min(at, steps.length - 1)];
  const last = at >= steps.length - 1;
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // the steps are rebuilt on every keystroke: point again only when the step changes
  const pointAt = step.point.join("|");
  useEffect(() => { onPoint(pointAt ? pointAt.split("|") : []); }, [pointAt, onPoint]);
  // moving on reads the new question out, without stealing focus on arrival
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
  }, [at]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="pl-guide" aria-label="Your invitation, step by step">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {steps.map((s, i) => <i key={s.id} className={`pl-guide-tick ${i <= at ? "is-done" : ""}`} />)}
        </div>
        <button type="button" onClick={onClose} aria-label="Close the walk-through" className="pl-guide-x"><X size={15} strokeWidth={1.6} /></button>
      </div>
      <p className="pl-guide-count">Step {at + 1} of {steps.length}</p>
      <h2 ref={heading} tabIndex={-1} className="font-display text-[30px] leading-[1.1] outline-none">{step.question}</h2>
      <p className="text-[14.5px] leading-relaxed text-[rgb(237_227_207/.8)]">{step.help}</p>
      {step.body && <div className="space-y-3">{step.body}</div>}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
        {at > 0 && <button type="button" onClick={() => setAt(at - 1)} className="pl-guide-btn pl-guide-ghost">Back</button>}
        {last ? (
          <>
            <button type="button" onClick={onShare} className="pl-guide-btn pl-guide-gold">Share it</button>
            <button type="button" onClick={onClose} className="pl-guide-btn pl-guide-ghost">Keep editing</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setAt(at + 1)} className="pl-guide-btn pl-guide-gold">Next</button>
            <button type="button" onClick={() => setAt(at + 1)} className="pl-guide-skip">Skip this</button>
          </>
        )}
      </div>
    </aside>
  );
}

/**
 * A field in the walk-through. Kept as typed while it has focus, so a space
 * at the end of a name isn't tidied away mid-word; it follows changes made
 * elsewhere (the invitation itself, the partner's screen) otherwise.
 */
export function GuideField({ label, value, onChange, placeholder, multiline = false, type = "text", maxLength }: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: "text" | "date";
  maxLength?: number;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value); }, [value]);
  const props = {
    id,
    value: text,
    placeholder,
    maxLength,
    className: "pl-guide-input",
    onFocus: () => { focused.current = true; },
    onBlur: () => { focused.current = false; setText(value); },
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText(e.target.value);
      if (type !== "date" || e.target.value) onChange(e.target.value);
    },
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="pl-guide-label">{label}</label>
      {multiline ? <textarea rows={5} {...props} /> : <input type={type} {...props} />}
    </div>
  );
}

/** a yes/no in the walk-through, in the planner's switch */
export function GuideSwitch({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="pl-guide-switch">
      <span>{label}</span>
      <span className="pl-switch" aria-hidden="true" />
    </button>
  );
}

const SEEN = "twofold.inviteGuide.seen";

/** whether the walk-through has been offered on this device for this wedding */
export function guideSeen(weddingId: string | null): boolean {
  try { return localStorage.getItem(`${SEEN}.${weddingId ?? "local"}`) === "1"; } catch { return true; }
}
export function markGuideSeen(weddingId: string | null): void {
  try { localStorage.setItem(`${SEEN}.${weddingId ?? "local"}`, "1"); } catch { /* storage blocked: it may be offered again */ }
}
