import React from "react";

/**
 * A deliberately small Markdown renderer for the legal pages.
 *
 * It builds React elements and never sets innerHTML, so text pasted from a
 * policy generator can't run scripts. Supported: # / ## / ### headings,
 * paragraphs, "-" / "*" and "1." lists, **bold**, *italic*, and
 * [links](https://… or mailto:…). HTML comments are dropped. Anything else
 * renders as plain text.
 */

const SAFE_LINK = /^(https:\/\/|mailto:|#\/)/i;

export function renderInline(text: string, keyBase = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[1] !== undefined) {
      const href = m[2];
      out.push(SAFE_LINK.test(href)
        ? <a key={key} href={href} className="font-bold text-blush-deep underline underline-offset-2" {...(href.startsWith("https://") ? { target: "_blank", rel: "noreferrer" } : {})}>{m[1]}</a>
        : m[1]);
    } else if (m[3] !== undefined) {
      out.push(<strong key={key} className="text-ink">{m[3]}</strong>);
    } else {
      out.push(<em key={key}>{m[4]}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function renderMarkdown(source: string): React.ReactNode[] {
  const lines = source.replace(/<!--[\s\S]*?-->/g, "").split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let k = 0;

  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${k++}`} className="mt-4 text-body leading-relaxed text-ink-2">{renderInline(para.join(" "), `p${k}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{renderInline(it, `l${k}-${i}`)}</li>);
    blocks.push(list.ordered
      ? <ol key={`l${k++}`} className="mt-4 list-decimal space-y-1.5 pl-6 text-body leading-relaxed text-ink-2">{items}</ol>
      : <ul key={`l${k++}`} className="mt-4 list-disc space-y-1.5 pl-6 text-body leading-relaxed text-ink-2">{items}</ul>);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (h) {
      flushPara(); flushList();
      const level = h[1].length;
      const cls = level === 1 ? "font-display text-4xl tracking-tight text-ink" : level === 2 ? "mt-10 font-display text-2xl text-ink" : "mt-6 text-lead font-extrabold text-ink";
      blocks.push(React.createElement(`h${level}`, { key: `h${k++}`, className: cls }, renderInline(h[2], `h${k}`)));
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return blocks;
}

/** True while a legal file still holds its placeholder; CI refuses to ship it. */
export const isLegalPlaceholder = (source: string) => source.includes("LEGAL-PLACEHOLDER");
