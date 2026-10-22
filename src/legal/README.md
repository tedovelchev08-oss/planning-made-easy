# Legal pages

`privacy.md`, `terms.md`, `refunds.md` and `cookies.md` render at `#/privacy`, `#/terms`, `#/refunds` and `#/cookies`.
The cookie policy can draw on section 2a of `docs/DATA-INVENTORY.md` (Twofold sets no cookies;
it lists every browser-storage key).

**The text must come from a lawyer or a reviewed template, not from code changes.**
`docs/DATA-INVENTORY.md` lists what Twofold stores and who receives it, for whoever writes it.

To publish a page: replace the whole file with the reviewed text, written in Markdown
(`#`/`##`/`###` headings, paragraphs, `-` or `1.` lists, `**bold**`, `*italic*`, `[links](https://…)`).
Remove the `LEGAL-PLACEHOLDER` line. CI (`npm run check:legal`) fails while any of the four
still contains it, so placeholder text can't ship.
