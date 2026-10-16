import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/ui";
import { SUPPORT_EMAIL } from "../lib/links";
import { renderMarkdown } from "../lib/markdown";
import privacy from "../legal/privacy.md?raw";
import terms from "../legal/terms.md?raw";
import refunds from "../legal/refunds.md?raw";
import cookies from "../legal/cookies.md?raw";

/**
 * Privacy policy, terms, refund policy and cookie policy. The text lives in src/legal/*.md
 * and comes from the owner (a lawyer or a reviewed template), never from code
 * changes. CI fails while any file still holds its placeholder.
 */
export const LEGAL = {
  privacy: { title: "Privacy policy", source: privacy },
  terms: { title: "Terms of service", source: terms },
  refunds: { title: "Refund policy", source: refunds },
  cookies: { title: "Cookie policy", source: cookies },
} as const;
export type LegalDoc = keyof typeof LEGAL;

export default function LegalPage({ doc }: { doc: LegalDoc }) {
  const { title, source } = LEGAL[doc];

  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · Luma`;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="min-h-[100svh] bg-cream px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link to="/" aria-label="Back to Luma home"><Logo /></Link>
        <main className="mt-12">{renderMarkdown(source)}</main>
        <nav aria-label="Legal" className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink/10 pt-6 text-small font-bold text-ink-2">
          {(Object.keys(LEGAL) as LegalDoc[]).filter((d) => d !== doc).map((d) => (
            <Link key={d} to={`/${d}`} className="hover:text-ink">{LEGAL[d].title}</Link>
          ))}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-ink">{SUPPORT_EMAIL}</a>
        </nav>
      </div>
    </div>
  );
}
