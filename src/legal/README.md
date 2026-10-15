# Legal pages

`privacy.md`, `terms.md` and `refunds.md` render at `#/privacy`, `#/terms` and `#/refunds`.

**The text must come from a lawyer or a reviewed template, not from code changes.**
`docs/DATA-INVENTORY.md` lists what Luma stores and who receives it, for whoever writes it.

To publish a page: replace the whole file with the reviewed text, written in Markdown
(`#`/`##`/`###` headings, paragraphs, `-` or `1.` lists, `**bold**`, `*italic*`, `[links](https://…)`).
Remove the `LEGAL-PLACEHOLDER` line. CI (`npm run check:legal`) fails while any of the three
still contains it, so placeholder text can't ship.
