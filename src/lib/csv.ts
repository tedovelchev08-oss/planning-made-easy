/**
 * CSV field handling for the guest list import/export.
 *
 * Kept here rather than in the Guests component because it is pure string
 * work, and because export and import have to agree exactly: anything
 * toCsvRow writes, parseCsvLine has to read back unchanged.
 */

/**
 * Split one CSV line into trimmed fields.
 *
 * Handles quoted fields containing commas, and the doubled-quote escape
 * ("" inside a quoted field means one literal ").
 */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Serialise one row, quoting every field so commas and quotes survive. */
export const toCsvRow = (values: (string | number | null | undefined)[]): string =>
  values.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
