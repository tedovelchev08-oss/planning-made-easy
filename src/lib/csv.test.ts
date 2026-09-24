import { describe, it, expect } from "vitest";
import { parseCsvLine, toCsvRow } from "./csv";

describe("parseCsvLine", () => {
  it("splits plain fields", () => {
    expect(parseCsvLine("Maya Hartley,A,confirmed")).toEqual(["Maya Hartley", "A", "confirmed"]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseCsvLine(" Maya , A ,  confirmed ")).toEqual(["Maya", "A", "confirmed"]);
  });

  it("keeps a comma inside a quoted field", () => {
    // The case that breaks naive split(",") — a guest list is full of these.
    expect(parseCsvLine('"Hartley, Maya",A,confirmed')).toEqual(["Hartley, Maya", "A", "confirmed"]);
  });

  it("unescapes a doubled quote into one literal quote", () => {
    expect(parseCsvLine('"She said ""yes""",A')).toEqual(['She said "yes"', "A"]);
  });

  it("preserves empty fields including trailing ones", () => {
    expect(parseCsvLine("Maya,,confirmed,")).toEqual(["Maya", "", "confirmed", ""]);
  });

  it("returns a single empty field for an empty line", () => {
    expect(parseCsvLine("")).toEqual([""]);
  });

  it("handles a field that is only a quoted comma", () => {
    expect(parseCsvLine('","')).toEqual([","]);
  });
});

describe("toCsvRow", () => {
  it("quotes every field", () => {
    expect(toCsvRow(["Maya", "A"])).toBe('"Maya","A"');
  });

  it("escapes embedded quotes by doubling", () => {
    expect(toCsvRow(['She said "yes"'])).toBe('"She said ""yes"""');
  });

  it("writes null and undefined as empty fields rather than the words", () => {
    // A guest with no meal or table must not export the string "null".
    expect(toCsvRow(["Maya", null, undefined, ""])).toBe('"Maya","","",""');
  });

  it("stringifies numbers", () => {
    expect(toCsvRow(["Maya", 4])).toBe('"Maya","4"');
  });
});

describe("export -> import round trip", () => {
  // The contract that matters: anything the export writes, the import reads
  // back identically. These are the values that actually break CSV.
  const awkward = [
    ["Hartley, Maya", "A", "confirmed", "Sea Bass", "", "4", "nut allergy", "seat near the band"],
    ['She said "yes"', "B", "pending", "", "", "", "", ""],
    ["Zoë O'Brien", "S", "declined", "Garden Risotto", "Maya Hartley", "2", "", "plus one of Maya"],
    ["Plain Name", "A", "pending", "", "", "", "", ""],
    ["Trailing empties", "A", "confirmed", "", "", "", "", ""],
  ];

  it("survives every awkward field intact", () => {
    for (const row of awkward) {
      expect(parseCsvLine(toCsvRow(row))).toEqual(row);
    }
  });

  it("survives a field containing both a comma and a quote", () => {
    const row = ['Hartley, "Maya"', "A"];
    expect(parseCsvLine(toCsvRow(row))).toEqual(row);
  });

  it("survives a field that is entirely quotes", () => {
    const row = ['"""', "A"];
    expect(parseCsvLine(toCsvRow(row))).toEqual(row);
  });

  it("maps a full exported row back onto the header order", () => {
    const header = "name,party,rsvp,meal,plus_one_of,table,dietary,notes".split(",");
    const row = ["Maya Hartley", "A", "confirmed", "Sea Bass", "", "4", "nut allergy", "by the window"];
    const parsed = parseCsvLine(toCsvRow(row));
    expect(parsed).toHaveLength(header.length);
    expect(Object.fromEntries(header.map((h, i) => [h, parsed[i]]))).toMatchObject({
      name: "Maya Hartley",
      rsvp: "confirmed",
      table: "4",
      dietary: "nut allergy",
    });
  });
});
