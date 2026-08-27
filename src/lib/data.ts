import { IMAGES } from "./images";

/* ------------------------------------------------------------------ */
/* Luma — types & seed data                                            */
/* ------------------------------------------------------------------ */

export type Rsvp = "confirmed" | "pending" | "declined";
export type Plan = "essential" | "celebration" | "luxe";
/** A = partner one · T = partner two · B = both */
export type Assignee = "A" | "T" | "B";

export interface Wedding {
  names: string;
  partnerA: string;
  partnerB: string;
  date: string; // ISO
  venue: string;
  location: string;
  timezone: string;
}

export interface Guest {
  id: string;
  name: string;
  party: "A" | "B" | "S";
  rsvp: Rsvp;
  meal: string | null;
  plusOne: string | null;
  table: string | null;
  dietary: string | null;
  notes: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budget: number;
  committed: number;
  paid: number;
  color: string;
}

export type PhaseId = "p12" | "p9" | "p6" | "p3" | "p1" | "fw" | "wd";

export interface Task {
  id: string;
  title: string;
  phase: PhaseId;
  done: boolean;
  assignee: Assignee;
  due?: string;
  week?: boolean;
}

export type VendorStatus = "Inquiry" | "Proposal" | "Booked" | "Declined";

export interface Vendor {
  id: string;
  category: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  price: number;
  status: VendorStatus;
  contract: boolean;
  notes: string;
  payments: { label: string; amount: number; due: string; paid: boolean }[];
}

export type TableShape = "round" | "rect" | "head" | "sweetheart";

export interface SeatTable {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number; // % of canvas
  y: number;
}

export interface RegistryItem {
  id: string;
  name: string;
  store: string;
  price: number;
  url: string;
  purchased: boolean;
}

export interface Template {
  id: string;
  name: string;
  cat: "editorial" | "garden" | "modern" | "romantic" | "minimalist" | "classic";
  bg: string;
  ink: string;
  accent: string;
  serif: boolean;
  luxe?: boolean;
  photo?: string;
}

export const MEALS = ["Herb Chicken", "Sea Bass", "Garden Risotto", "Vegan Wellington"];

export const VENDOR_CATEGORIES = [
  "Venue", "Photographer", "Videographer", "Catering", "Florist",
  "DJ / Band", "Planner", "Transportation", "Beauty", "Attire",
];

export const PHASES: { id: PhaseId; label: string; hint: string }[] = [
  { id: "p12", label: "12+ months", hint: "Dream it, date it, book the big rocks" },
  { id: "p9", label: "9 months", hint: "Assemble the team that fits your feeling" },
  { id: "p6", label: "6 months", hint: "Shape the guest experience" },
  { id: "p3", label: "3 months", hint: "Decisions become details" },
  { id: "p1", label: "1 month", hint: "Confirm, confirm, breathe" },
  { id: "fw", label: "Final week", hint: "Hand it over gracefully" },
  { id: "wd", label: "Wedding day", hint: "Be present. Luma has the rest." },
];

/* ------------------------------------------------------------------ */

const addDays = (d: number) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  return t.toISOString();
};

export const seedWedding: Wedding = {
  names: "Maya & Theo",
  partnerA: "Maya",
  partnerB: "Theo",
  date: addDays(292),
  venue: "The Glasshouse",
  location: "Hudson Yards, New York",
  timezone: "America/New_York",
};

/* ------------------------------ guests ---------------------------- */

const rich: Omit<Guest, "id">[] = [
  { name: "Amara Okafor", party: "A", rsvp: "confirmed", meal: MEALS[2], plusOne: "Kwame Okafor", table: "t1", dietary: "Vegan", notes: "College roommate — near the dance floor" },
  { name: "Liam Bennett", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t2", dietary: null, notes: "Best man" },
  { name: "Sofia Lindqvist", party: "A", rsvp: "confirmed", meal: MEALS[1], plusOne: "Erik Lindqvist", table: "t1", dietary: "Gluten-free", notes: "Maid of honor" },
  { name: "Marcus Silva", party: "B", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "Theo's cousin — nudged twice" },
  { name: "Priya Kaur", party: "A", rsvp: "confirmed", meal: MEALS[3], plusOne: "Dev Kaur", table: "t3", dietary: "Vegetarian", notes: "" },
  { name: "Jonas Weiss", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t2", dietary: null, notes: "Gave the great toast at the engagement" },
  { name: "Elena Moreau", party: "A", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "Flying in from Lyon" },
  { name: "Noah Tanaka", party: "B", rsvp: "confirmed", meal: MEALS[1], plusOne: "Rin Tanaka", table: "t4", dietary: null, notes: "" },
  { name: "Ines Almeida", party: "A", rsvp: "declined", meal: null, plusOne: null, table: null, dietary: null, notes: "Expecting — sent a sweet note" },
  { name: "Felix Novak", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t4", dietary: "Nut allergy", notes: "Severe nut allergy — flag catering" },
  { name: "Clara Haugen", party: "A", rsvp: "confirmed", meal: MEALS[2], plusOne: null, table: "t3", dietary: null, notes: "" },
  { name: "Mateo Duarte", party: "B", rsvp: "pending", meal: null, plusOne: "Lucia Duarte", table: null, dietary: null, notes: "Waiting on flights from Madrid" },
  { name: "Yuki Kimura", party: "A", rsvp: "confirmed", meal: MEALS[1], plusOne: null, table: "t5", dietary: null, notes: "Photographer friend — golden hour ally" },
  { name: "Omar Farah", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t2", dietary: "Halal", notes: "" },
  { name: "Lena Vogel", party: "A", rsvp: "declined", meal: null, plusOne: null, table: null, dietary: null, notes: "Out of the country that week" },
  { name: "Hugo Ricci", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: "Bianca Ricci", table: "t6", dietary: null, notes: "Uncle Hugo — keep near the bar" },
  { name: "Freya Nyström", party: "A", rsvp: "confirmed", meal: MEALS[2], plusOne: null, table: "t5", dietary: "Vegetarian", notes: "" },
  { name: "Kofi Mensah", party: "B", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "" },
  { name: "Nadia Iversen", party: "A", rsvp: "confirmed", meal: MEALS[1], plusOne: "Emil Iversen", table: "t6", dietary: null, notes: "" },
  { name: "Rafael Costa", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t7", dietary: null, notes: "College crew" },
  { name: "Rosa Marino", party: "A", rsvp: "confirmed", meal: MEALS[2], plusOne: null, table: "t7", dietary: null, notes: "Nonna's famous tiramisu — dessert ally" },
  { name: "Silas Beck", party: "B", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "" },
  { name: "Mira Sorensen", party: "A", rsvp: "confirmed", meal: MEALS[3], plusOne: null, table: "t8", dietary: "Vegan", notes: "" },
  { name: "Victor Vargas", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: "Camila Vargas", table: "t8", dietary: null, notes: "" },
  { name: "Aisha Ahmadi", party: "A", rsvp: "confirmed", meal: MEALS[1], plusOne: null, table: "t3", dietary: "Halal", notes: "" },
  { name: "Ruben Kovac", party: "B", rsvp: "declined", meal: null, plusOne: null, table: null, dietary: null, notes: "New baby at home" },
  { name: "Tessa Lindgren", party: "A", rsvp: "confirmed", meal: MEALS[2], plusOne: null, table: "t9", dietary: null, notes: "" },
  { name: "Milan Petrov", party: "B", rsvp: "pending", meal: null, plusOne: null, table: null, dietary: null, notes: "" },
  { name: "Ida Ferreira", party: "A", rsvp: "confirmed", meal: MEALS[1], plusOne: "Oskar Ferreira", table: "t9", dietary: null, notes: "" },
  { name: "Samuel Berg", party: "B", rsvp: "confirmed", meal: MEALS[0], plusOne: null, table: "t10", dietary: null, notes: "Groomsman" },
];

const first = ["Ava", "Nora", "Elias", "June", "Marco", "Selma", "Theo", "Alma", "Bruno", "Celia", "David", "Ebba", "Filip", "Greta", "Henrik", "Iris", "Jules", "Klara", "Leon", "Maja", "Nils", "Olivia", "Pablo", "Qin", "Ruth", "Sten", "Tove", "Ulf", "Vera", "Wanda", "Xenia", "Yara", "Zane", "Agnes", "Boris", "Cora", "Dante", "Edith", "Flora", "Gideon"];
const last = ["Andersson", "Bergman", "Costa", "Dahl", "Ekström", "Fontaine", "Galli", "Holm", "Ibrahim", "Jensen", "Klein", "Larsen", "Meyer", "Nilsen", "Olsson", "Petersen", "Quist", "Rossi", "Sund", "Thomsen", "Ueda", "Vidal", "Weber", "Xavier", "Young", "Zeller"];

function buildGuests(): Guest[] {
  const guests: Guest[] = rich.map((g, i) => ({ id: `g-${i + 1}`, ...g }));
  // 82 generated → totals: 112 guests, 84 confirmed, 21 pending, 7 declined
  for (let i = 0; i < 82; i++) {
    const name = `${first[i % first.length]} ${last[(i * 7) % last.length]}`;
    const rsvp: Rsvp = i < 66 ? "confirmed" : i < 79 ? "pending" : "declined";
    const table = rsvp === "confirmed" && i % 3 !== 0 ? `t${(i % 10) + 1}` : null;
    guests.push({
      id: `g-${31 + i}`,
      name,
      party: i % 2 === 0 ? "A" : "B",
      rsvp,
      meal: rsvp === "confirmed" ? MEALS[i % MEALS.length] : null,
      plusOne: i % 11 === 4 ? `${first[(i + 3) % first.length]} ${last[(i * 3) % last.length]}` : null,
      table,
      dietary: i % 13 === 5 ? "Vegetarian" : i % 17 === 6 ? "Nut allergy" : null,
      notes: "",
    });
  }
  return guests;
}

export const seedGuests: Guest[] = buildGuests();

/* ------------------------------ budget ---------------------------- */

export const seedBudget: BudgetCategory[] = [
  { id: "b1", name: "Venue", budget: 16000, committed: 16000, paid: 8000, color: "#D4AF37" },
  { id: "b2", name: "Catering", budget: 12500, committed: 11200, paid: 3000, color: "#EE8FA1" },
  { id: "b3", name: "Photography", budget: 6200, committed: 6200, paid: 3100, color: "#A78BD4" },
  { id: "b4", name: "Florals", budget: 4800, committed: 3400, paid: 1000, color: "#74996B" },
  { id: "b5", name: "Music", budget: 3200, committed: 2800, paid: 800, color: "#FFB5C2" },
  { id: "b6", name: "Attire", budget: 4100, committed: 3100, paid: 1500, color: "#C9B8E8" },
  { id: "b7", name: "Stationery", budget: 1600, committed: 900, paid: 400, color: "#A8C5A0" },
  { id: "b8", name: "Transportation", budget: 1400, committed: 0, paid: 0, color: "#5C4F55" },
  { id: "b9", name: "Miscellaneous", budget: 2200, committed: 580, paid: 200, color: "#E98BA0" },
];
// total 52,600 · committed 44,180 · remaining 8,420

/* ------------------------------ tasks ------------------------------ */

const task = (title: string, phase: PhaseId, done: boolean, assignee: Assignee, week = false): Task => ({
  id: `t-${title.replace(/[^a-z0-9]/gi, "").slice(0, 18)}-${phase}`,
  title, phase, done, assignee, week,
});

export const seedTasks: Task[] = [
  // 12+ months — 8/8
  task("Set the wedding date", "p12", true, "B"),
  task("Agree on a budget ceiling", "p12", true, "B"),
  task("Draft the first guest list", "p12", true, "B"),
  task("Choose the ceremony vibe", "p12", true, "A"),
  task("Tour three venues", "p12", true, "B"),
  task("Book The Glasshouse", "p12", true, "B"),
  task("Hire a photographer", "p12", true, "T"),
  task("Start the inspiration board", "p12", true, "A"),
  // 9 months — 8/8
  task("Book caterer tasting", "p9", true, "B"),
  task("Reserve the quartet", "p9", true, "T"),
  task("Interview two florists", "p9", true, "A"),
  task("Order save-the-dates", "p9", true, "A"),
  task("Begin dress appointments", "p9", true, "A"),
  task("Book the honeymoon flights", "p9", true, "T"),
  task("Create the wedding registry", "p9", true, "B"),
  task("Set up the Luma workspace", "p9", true, "B"),
  // 6 months — 9/9
  task("Send save-the-dates", "p6", true, "B"),
  task("Finalize catering menu draft", "p6", true, "B"),
  task("Book hair & makeup trial", "p6", true, "A"),
  task("Choose the wedding party outfits", "p6", true, "B"),
  task("Order bridesmaid bouquets plan", "p6", true, "A"),
  task("Draft the ceremony reading list", "p6", true, "B"),
  task("Book rehearsal dinner spot", "p6", true, "T"),
  task("Arrange guest hotel blocks", "p6", true, "T"),
  task("Start the seating sketch", "p6", true, "B"),
  // 3 months — 9/9
  task("Send invitations", "p3", true, "B"),
  task("Final menu tasting", "p3", true, "B"),
  task("Approve floral moodboard", "p3", true, "A"),
  task("Book the late-night snack cart", "p3", true, "T"),
  task("Choose ceremony music", "p3", true, "B"),
  task("Order wedding bands", "p3", true, "B"),
  task("Plan the morning-after brunch", "p3", true, "A"),
  task("Confirm transportation quotes", "p3", true, "T"),
  task("Publish the wedding website", "p3", true, "B"),
  // 1 month — 4/8
  task("Chase remaining RSVPs", "p1", true, "B"),
  task("Final dress fitting", "p1", true, "A"),
  task("Write the vows", "p1", true, "B"),
  task("Confirm vendor arrival times", "p1", true, "T"),
  task("Confirm final menu", "p1", false, "T", true),
  task("Send RSVP reminder", "p1", false, "A", true),
  task("Approve floral proposal", "p1", false, "B", true),
  task("Choose first dance", "p1", false, "B", true),
  // final week — 1/5
  task("Pack the emergency kit", "fw", true, "A"),
  task("Hand off seating chart to venue", "fw", false, "B"),
  task("Final payment to caterer", "fw", false, "T"),
  task("Steam everything twice", "fw", false, "A"),
  task("Write thank-you notes plan", "fw", false, "B"),
  // wedding day — 0/3
  task("Sunrise coffee, no phones", "wd", false, "B"),
  task("Rings to the best man", "wd", false, "T"),
  task("First look at 4pm", "wd", false, "B"),
];
// 50 tasks · 39 done → 78%

/* ------------------------------ vendors ---------------------------- */

export const seedVendors: Vendor[] = [
  {
    id: "v1", category: "Venue", company: "The Glasshouse", contact: "Renata Cole", email: "events@glasshouse.nyc", phone: "+1 212 555 0184",
    price: 16000, status: "Booked", contract: true, notes: "Golden-hour ceremony on the west terrace. Rain plan: atrium.",
    payments: [
      { label: "Deposit", amount: 8000, due: "Paid", paid: true },
      { label: "Balance", amount: 8000, due: "30 days out", paid: false },
    ],
  },
  {
    id: "v2", category: "Photographer", company: "Aria Studio", contact: "June Park", email: "hello@ariastudio.co", phone: "+1 917 555 0142",
    price: 6200, status: "Booked", contract: true, notes: "Two shooters · film + digital · golden hour portraits.",
    payments: [
      { label: "Retainer", amount: 3100, due: "Paid", paid: true },
      { label: "Final", amount: 3100, due: "14 days out", paid: false },
    ],
  },
  {
    id: "v3", category: "Catering", company: "Maison Verte", contact: "Chef Didier Blanc", email: "events@maisonverte.com", phone: "+1 646 555 0117",
    price: 11200, status: "Booked", contract: true, notes: "Seasonal tasting menu · vegan + halal options confirmed.",
    payments: [
      { label: "Deposit", amount: 3000, due: "Paid", paid: true },
      { label: "Midpoint", amount: 4000, due: "60 days out", paid: false },
      { label: "Balance", amount: 4200, due: "Final week", paid: false },
    ],
  },
  {
    id: "v4", category: "Florist", company: "Peony & Stem", contact: "Wren Halloran", email: "wren@peonyandstem.com", phone: "+1 347 555 0163",
    price: 3400, status: "Proposal", contract: false, notes: "Proposal v2 — garden roses, trailing amaranth, candlelight greens.",
    payments: [{ label: "Retainer", amount: 1000, due: "On booking", paid: false }],
  },
  {
    id: "v5", category: "DJ / Band", company: "The Marlowe Quartet", contact: "Ezra Marlowe", email: "book@marlowequartet.com", phone: "+1 212 555 0129",
    price: 2800, status: "Booked", contract: true, notes: "Ceremony strings → jazz cocktail hour → DJ hybrid at night.",
    payments: [
      { label: "Deposit", amount: 800, due: "Paid", paid: true },
      { label: "Balance", amount: 2000, due: "Day-of", paid: false },
    ],
  },
  {
    id: "v6", category: "Videographer", company: "Frame & Fern", contact: "Sasha Reyes", email: "sasha@frameandfern.film", phone: "+1 929 555 0155",
    price: 4800, status: "Proposal", contract: false, notes: "Cinematic cut + 60s teaser. Awaiting final quote.",
    payments: [{ label: "Retainer", amount: 1500, due: "On booking", paid: false }],
  },
  {
    id: "v7", category: "Attire", company: "Casa Lorena", contact: "Lorena Vitale", email: "atelier@casalorena.com", phone: "+1 212 555 0171",
    price: 3100, status: "Booked", contract: true, notes: "Two fittings done. Final fitting scheduled.",
    payments: [
      { label: "Deposit", amount: 1500, due: "Paid", paid: true },
      { label: "Balance", amount: 1600, due: "On pickup", paid: false },
    ],
  },
  {
    id: "v8", category: "Beauty", company: "Atelier Blond", contact: "Mina Sato", email: "mina@atelierblond.nyc", phone: "+1 646 555 0139",
    price: 950, status: "Inquiry", contract: false, notes: "Trial booked for next month. Ask about mother-of-bride slot.",
    payments: [],
  },
  {
    id: "v9", category: "Transportation", company: "Velvet Coach Co.", contact: "Desmond Wright", email: "rides@velvetcoach.com", phone: "+1 718 555 0126",
    price: 1400, status: "Inquiry", contract: false, notes: "Two vintage coaches for 24 guests + getaway car.",
    payments: [],
  },
];

/* ------------------------------ seating ---------------------------- */

export const seedTables: SeatTable[] = [
  { id: "sweet", name: "Sweetheart", shape: "sweetheart", capacity: 2, x: 50, y: 10 },
  { id: "head", name: "Head Table", shape: "head", capacity: 8, x: 50, y: 30 },
  { id: "t1", name: "Table 1", shape: "round", capacity: 8, x: 16, y: 26 },
  { id: "t2", name: "Table 2", shape: "round", capacity: 8, x: 84, y: 24 },
  { id: "t3", name: "Table 3", shape: "round", capacity: 8, x: 14, y: 56 },
  { id: "t4", name: "Table 4", shape: "round", capacity: 8, x: 36, y: 60 },
  { id: "t5", name: "Table 5", shape: "round", capacity: 8, x: 62, y: 58 },
  { id: "t6", name: "Table 6", shape: "round", capacity: 10, x: 86, y: 54 },
  { id: "t7", name: "Table 7", shape: "round", capacity: 8, x: 24, y: 86 },
  { id: "t8", name: "Table 8", shape: "round", capacity: 8, x: 50, y: 88 },
  { id: "t9", name: "Table 9", shape: "round", capacity: 8, x: 76, y: 86 },
];

/* ------------------------------ registry ---------------------------- */

export const seedRegistry: RegistryItem[] = [
  { id: "r1", name: "Everyday Stoneware Set", store: "Crate & Barrel", price: 240, url: "https://www.crateandbarrel.com", purchased: true },
  { id: "r2", name: "Signature Round French Oven", store: "Le Creuset", price: 420, url: "https://www.lecreuset.com", purchased: true },
  { id: "r3", name: "Espresso Machine — La linea", store: "Williams Sonoma", price: 650, url: "https://www.williams-sonoma.com", purchased: false },
  { id: "r4", name: "Belgian Linen Duvet Set", store: "Sferra", price: 380, url: "https://www.sferra.com", purchased: true },
  { id: "r5", name: "Walnut Record Player", store: "Audio-Technica", price: 350, url: "https://www.audio-technica.com", purchased: false },
  { id: "r6", name: "Chef's Knife, Damascus", store: "Korin", price: 290, url: "https://www.korin.com", purchased: false },
  { id: "r7", name: "Weekender Bags × 2", store: "Away", price: 300, url: "https://www.awaytravel.com", purchased: false },
  { id: "r8", name: "Honeymoon Fund — Amalfi", store: "Luma Fund", price: 0, url: "#fund", purchased: false },
];

/* ------------------------------ templates ---------------------------- */

export const TEMPLATE_CATS = ["editorial", "garden", "modern", "romantic", "minimalist", "classic"] as const;

export const seedTemplates: Template[] = [
  { id: "tp1", name: "Vogue Noce", cat: "editorial", bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true },
  { id: "tp2", name: "Gallery Wall", cat: "editorial", bg: "#FFFFFF", ink: "#1E1A1D", accent: "#EE8FA1", serif: false },
  { id: "tp3", name: "Masthead", cat: "editorial", bg: "#FBF2E4", ink: "#332B31", accent: "#74996B", serif: true, photo: IMAGES.invEditorial },
  { id: "tp4", name: "Issue One", cat: "editorial", bg: "#EEE8F9", ink: "#332B31", accent: "#A78BD4", serif: false, luxe: true },
  { id: "tp5", name: "Peony Hour", cat: "garden", bg: "#E7F0E3", ink: "#332B31", accent: "#74996B", serif: true },
  { id: "tp6", name: "Botanica", cat: "garden", bg: "#FFF8F0", ink: "#3E4A38", accent: "#A8C5A0", serif: true, photo: IMAGES.invGarden },
  { id: "tp7", name: "Meadow Line", cat: "garden", bg: "#FFFFFF", ink: "#332B31", accent: "#A8C5A0", serif: false },
  { id: "tp8", name: "Orangerie", cat: "garden", bg: "#EEE8F9", ink: "#3E4A38", accent: "#74996B", serif: true, luxe: true },
  { id: "tp9", name: "Mono Blush", cat: "modern", bg: "#FFE7EC", ink: "#332B31", accent: "#E98BA0", serif: false, photo: IMAGES.invModern },
  { id: "tp10", name: "Gridline", cat: "modern", bg: "#FFFFFF", ink: "#1E1A1D", accent: "#D4AF37", serif: false },
  { id: "tp11", name: "Arc Study", cat: "modern", bg: "#FFF8F0", ink: "#332B31", accent: "#A78BD4", serif: false },
  { id: "tp12", name: "After Dark", cat: "modern", bg: "#332B31", ink: "#FFF8F0", accent: "#FFB5C2", serif: false, luxe: true },
  { id: "tp13", name: "First Light", cat: "romantic", bg: "#FFE7EC", ink: "#5C4F55", accent: "#D4AF37", serif: true },
  { id: "tp14", name: "Serenade", cat: "romantic", bg: "#EEE8F9", ink: "#5C4F55", accent: "#E98BA0", serif: true },
  { id: "tp15", name: "Amour Animé", cat: "romantic", bg: "#FFF8F0", ink: "#5C4F55", accent: "#EE8FA1", serif: true, luxe: true },
  { id: "tp16", name: "Duet", cat: "romantic", bg: "#FFFFFF", ink: "#5C4F55", accent: "#FFB5C2", serif: true },
  { id: "tp17", name: "Whitespace", cat: "minimalist", bg: "#FFFFFF", ink: "#1E1A1D", accent: "#1E1A1D", serif: false },
  { id: "tp18", name: "Line & Vow", cat: "minimalist", bg: "#FFF8F0", ink: "#332B31", accent: "#74996B", serif: false },
  { id: "tp19", name: "Quiet Type", cat: "minimalist", bg: "#FBF2E4", ink: "#5C4F55", accent: "#D4AF37", serif: true },
  { id: "tp20", name: "Essence", cat: "minimalist", bg: "#FFFFFF", ink: "#332B31", accent: "#EE8FA1", serif: false, luxe: true },
  { id: "tp21", name: "Heritage", cat: "classic", bg: "#FFF8F0", ink: "#332B31", accent: "#D4AF37", serif: true },
  { id: "tp22", name: "Monogram Seal", cat: "classic", bg: "#FFFFFF", ink: "#332B31", accent: "#D4AF37", serif: true },
  { id: "tp23", name: "Estate Garden", cat: "classic", bg: "#E7F0E3", ink: "#332B31", accent: "#D4AF37", serif: true },
  { id: "tp24", name: "Regalia", cat: "classic", bg: "#EEE8F9", ink: "#332B31", accent: "#D4AF37", serif: true, luxe: true },
];

/* ------------------------------ pricing ---------------------------- */

export const TIERS: {
  id: Plan; name: string; price: number; blurb: string;
  features: string[]; featured?: boolean; lockedBy?: Plan;
}[] = [
  {
    id: "essential", name: "Essential Planner", price: 49,
    blurb: "Every core tool to plan calmly from day one.",
    features: ["All core planning tools", "Unlimited guests", "Budget, timeline & vendors", "Basic support", "No invitations", "No wedding website"],
  },
  {
    id: "celebration", name: "Celebration Suite", price: 99, featured: true,
    blurb: "The full planning suite plus invitations that feel like you.",
    features: ["Everything in Essential", "Digital invitations", "RSVP tracking", "20+ templates", "Colors, fonts & photo customization", "Guest messaging", "Basic wedding website"],
  },
  {
    id: "luxe", name: "Premium Luxe", price: 199,
    blurb: "Animated invitations and a website guests will re-watch.",
    features: ["Everything in Celebration", "Animated invitations", "Music integration", "Premium animated designs", "Custom domain", "Full website customization", "Advanced animations", "Priority support", "Multiple events", "Photo gallery", "Website playlist"],
  },
];

/* ------------------------------ testimonials ---------------------------- */

export const TESTIMONIALS = [
  { quote: "It made planning feel like part of our engagement, not a second job.", names: "Maya & Theo", city: "Brooklyn", stars: 5 },
  { quote: "The seating studio alone saved our sanity. We dragged, dropped, and finally exhaled.", names: "Sofia & Erik", city: "Copenhagen", stars: 5 },
  { quote: "Our guests are still talking about the invitation. It felt like the first scene of the wedding.", names: "Priya & Dev", city: "London", stars: 5 },
  { quote: "We watched the budget bar instead of arguing about it. Calm is a feature, apparently.", names: "Camila & Rafael", city: "Lisbon", stars: 5 },
];

/* ------------------------------ features ---------------------------- */

export const FEATURES = [
  { id: "guests", icon: "flow", title: "Guest Flow", body: "Know who's coming, who needs a nudge, and every important guest detail — meals, plus-ones, allergies, all in one gentle stream.", span: "wide" },
  { id: "budget", icon: "budget", title: "Budget Clarity", body: "Understand commitments, actual spend and what's left — before the spreadsheet ever tempts you.", span: "wide" },
  { id: "timeline", icon: "timeline", title: "Timeline", body: "Turn a giant wedding checklist into a calm weekly rhythm that knows what's next.", span: "third" },
  { id: "vendors", icon: "vendors", title: "Vendor Hub", body: "Proposals, contracts, contacts and decisions — together at last.", span: "third" },
  { id: "seating", icon: "seating", title: "Seating Studio", body: "Visually arrange tables and guests on a living canvas.", span: "third" },
  { id: "world", icon: "world", title: "Wedding World", body: "Connect invitations, RSVPs, your website, photos and memories into one world your guests step into — and you get to keep forever.", span: "banner" },
] as const;

/* ------------------------------ website ---------------------------- */

export const SITE_SECTIONS = [
  { id: "hero", label: "Hero" },
  { id: "story", label: "Our Story" },
  { id: "details", label: "Wedding Details" },
  { id: "schedule", label: "Schedule" },
  { id: "venue", label: "Venue" },
  { id: "travel", label: "Travel" },
  { id: "registry", label: "Registry" },
  { id: "gallery", label: "Gallery" },
  { id: "rsvp", label: "RSVP" },
  { id: "music", label: "Music" },
] as const;

/* ------------------------------ helpers ---------------------------- */

export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleDateString("en-US", opts ?? { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const daysUntil = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

export const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
