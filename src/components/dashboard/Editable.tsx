import type React from "react";
import { useEffect, useRef } from "react";

/**
 * Words on the invitation the couple can click and type over (A + C, step 2).
 * Plain text only: pasting strips formatting and Enter finishes the line.
 * Uncontrolled while focused, so the caret never jumps: the value is written
 * into the element only when it changes from outside (the Wording sheet, the
 * partner's screen) and nobody is typing in it.
 */
export function Editable({ value, onChange, label, placeholder, className = "", style }: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  placeholder: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={label}
      tabIndex={0}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-ph={placeholder}
      className={`pl-editable ${className}`}
      style={style}
      onInput={(e) => onChange((e.currentTarget.textContent ?? "").replace(/\s+/g, " "))}
      onBlur={(e) => {
        const tidy = (e.currentTarget.textContent ?? "").replace(/\s+/g, " ").trim();
        if (tidy !== (e.currentTarget.textContent ?? "")) e.currentTarget.textContent = tidy;
        if (tidy !== value) onChange(tidy);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); e.currentTarget.blur(); }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain").replace(/\s+/g, " ");
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        onChange((e.currentTarget.textContent ?? "").replace(/\s+/g, " "));
      }}
    />
  );
}

/** "Maya & Theo" as two names, and back */
export const splitNames = (names: string): [string, string] => {
  const [a = "", ...rest] = names.split("&");
  return [a.trim(), rest.join("&").trim()];
};
export const joinNames = (a: string, b: string) => `${a.trim()} & ${b.trim()}`;
