// Fails while any legal page still holds placeholder text, so it can never ship.
// The text itself comes from a lawyer or a reviewed template (src/legal/README.md).
import { readFileSync } from "node:fs";
import process from "node:process";

const dir = process.argv[2] ?? "src/legal"; // a folder argument is only for testing the check itself
const files = ["privacy", "terms", "refunds"].map((n) => `${dir}/${n}.md`);
let failed = false;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const words = text.replace(/<!--[\s\S]*?-->/g, "").trim().split(/\s+/).filter(Boolean).length;
  if (text.includes("LEGAL-PLACEHOLDER")) {
    console.error(`::error file=${f}::${f} still holds placeholder text. Replace it with the reviewed text (see src/legal/README.md).`);
    failed = true;
  } else if (words < 150) {
    console.error(`::error file=${f}::${f} has only ${words} words; that is not a complete policy.`);
    failed = true;
  } else {
    console.log(`ok  ${f} (${words} words)`);
  }
}
process.exit(failed ? 1 : 0);
