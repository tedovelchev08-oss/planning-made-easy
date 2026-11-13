import type React from "react";

/** a titled card of settings beside the preview */
export function Panel({ title, aside, children, label }: { title: string; aside?: React.ReactNode; children: React.ReactNode; label?: string }) {
  return (
    <section className="pl-card" aria-label={label ?? title}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--pl-line)] px-5 pb-3 pt-4">
        <h3 className="font-display text-[22px] leading-none">{title}</h3>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Italiana's old-style "1" reads as "ı": inside a display line, digits switch to Jost light (the Lining Figure rule) */
export function Lining({ text }: { text: string }) {
  return <>{text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <span key={i} className="pl-fig">{part}</span> : part))}</>;
}
