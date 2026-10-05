/**
 * Plans, prices and what each one unlocks — the single place to change them.
 *
 * Luma sells two one-time upgrades on top of a free plan that is a real
 * planner, not a demo: the conversion path is free experience → value →
 * natural limit → upgrade, never landing page → paywall.
 *
 * The internal ids stay `essential | celebration | luxe`: they are stored in
 * weddings.plan, entitlements and purchases, and Stripe metadata. Only the
 * names people see changed ("Essential" is now the free "Engaged" plan).
 *
 * api/create-checkout.ts keeps its own copy of the prices (serverless
 * functions build separately); plans.test.ts fails if the two drift apart.
 */

export type Plan = "essential" | "celebration" | "luxe";

/** Ascending. planRank() is an index into this, so the order is load-bearing. */
export const PLAN_ORDER: Plan[] = ["essential", "celebration", "luxe"];

export const planRank = (p: Plan | null): number => (p ? PLAN_ORDER.indexOf(p) : -1);

/* ------------------------------ currency ------------------------------ */

export type Currency = "eur" | "usd" | "gbp";

/**
 * The same nominal price in every currency — €49, $49, £49. This is local
 * presentation, not country pricing and not exchange-rate conversion.
 */
export const CURRENCIES: Record<Currency, { code: string; symbol: string; label: string }> = {
  eur: { code: "EUR", symbol: "€", label: "EUR €" },
  usd: { code: "USD", symbol: "$", label: "USD $" },
  gbp: { code: "GBP", symbol: "£", label: "GBP £" },
};
export const CURRENCY_ORDER: Currency[] = ["eur", "usd", "gbp"];
export const DEFAULT_CURRENCY: Currency = "eur";

const EUROZONE = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  "BG", // joined the euro on 1 January 2026
]);

/** Default currency for an ISO country code. Never the browser language. */
export function currencyForCountry(country: string | null | undefined): Currency {
  const c = (country ?? "").toUpperCase();
  if (c === "US") return "usd";
  if (c === "GB") return "gbp";
  if (EUROZONE.has(c)) return "eur";
  return DEFAULT_CURRENCY;
}

/** "€49", "$99", "£0" — whole amounts, symbol first, in every currency. */
export const formatPrice = (amount: number, currency: Currency) => `${CURRENCIES[currency].symbol}${amount}`;

/* ------------------------------ plans ------------------------------ */

export interface PlanInfo {
  id: Plan;
  /** what people see */
  name: string;
  /** one line of positioning */
  tagline: string;
  /** why someone would choose it — the value, not a checklist */
  value: string;
  /** nominal price, the same in every currency; 0 = free */
  price: number;
  /** the price line under the amount */
  priceNote: string;
  features: string[];
  featured?: boolean;
}

export const PLANS: Record<Plan, PlanInfo> = {
  essential: {
    id: "essential",
    name: "Engaged",
    tagline: "Start planning today. Free, for as long as you like.",
    value: "The whole planner — budget, timeline, vendors, seating and your guest list — so you can feel how calm planning with Luma is before you spend a thing.",
    price: 0,
    priceNote: "Free forever",
    features: [
      "Budget, timeline & vendors",
      "Seating chart",
      "Gift registry",
      "Up to 50 guests",
      "An invitation with RSVP link",
      "Plan together with your partner",
    ],
  },
  celebration: {
    id: "celebration",
    name: "Celebration",
    tagline: "Everything you need to plan your celebration from start to finish.",
    value: "For couples planning in earnest: every guest, every invitation design, personal RSVP links, your wedding website, and the seating sheet your venue will ask for.",
    price: 49,
    priceNote: "One-time — no subscription",
    featured: true,
    features: [
      "Everything in Engaged",
      "Unlimited guests",
      "All 18 invitation designs",
      "Colours, fonts & photos",
      "A personal RSVP link for every guest",
      "Meal choices & notes on RSVPs",
      "Your wedding website",
      "Printable seating chart & guest export",
      "Share by WhatsApp, Messenger, text & email",
      "Use your own invitation design",
    ],
  },
  luxe: {
    id: "luxe",
    name: "Luxe",
    tagline: "The complete Luma experience.",
    value: "For an invitation guests remember: animated designs, falling petals and gold shimmer, music when they open it, and a website that moves.",
    price: 99,
    priceNote: "One-time — no subscription",
    features: [
      "Everything in Celebration",
      "6 animated premium designs",
      "Petals, shimmer & animated type",
      "Music on your invitation",
      "Website scroll animations",
      "Marble, oak & noir table finishes",
    ],
  },
};

export const planLabel = (p: Plan) => PLANS[p].name;

/**
 * What moving to `target` costs a wedding already on `current`: the full price
 * from the free plan, the difference between paid plans (nobody pays twice for
 * what they own), or null when there is nothing to buy. Mirrors checkoutPrice()
 * in api/create-checkout.ts — checkout-price.test.ts holds the two together.
 */
export function upgradePrice(target: Plan, current: Plan): number | null {
  if (planRank(target) <= planRank(current)) return null;
  return PLANS[target].price - PLANS[current].price;
}

/* ------------------------------ limits & features ------------------------------ */

/** Guests on the free plan. Existing guests above it are never hidden or removed. */
export const FREE_GUEST_LIMIT = 50;
/** From here the guest list starts mentioning the limit, kindly. */
export const FREE_GUEST_WARN_AT = 40;

export const guestLimit = (plan: Plan): number => (plan === "essential" ? FREE_GUEST_LIMIT : Infinity);

export type Feature =
  | "unlimitedGuests"
  | "allDesigns"
  | "customize"
  | "personalLinks"
  | "rsvpDetails"
  | "website"
  | "exports"
  | "shareKit"
  | "premiumDesigns"
  | "motion"
  | "music"
  | "premiumSkins"
  | "customDesigns"
  | "websiteMotion";

/** Which plan unlocks each feature, and how the upgrade prompt describes it. */
export const FEATURES: Record<Feature, { plan: Plan; title: string; body: string }> = {
  unlimitedGuests: { plan: "celebration", title: "Unlimited guests", body: "Invite everyone you love — Engaged includes up to 50 guests. Every guest you've added stays exactly as it is." },
  allDesigns: { plan: "celebration", title: "Every invitation design", body: "Choose from all 18 designs, from editorial to garden to classic." },
  customize: { plan: "celebration", title: "Colours, fonts & photos", body: "Make the invitation yours — your palette, your type, your photo." },
  personalLinks: { plan: "celebration", title: "Personal RSVP links", body: "Send each guest their own link. Their name arrives pre-filled, and you see exactly who has replied." },
  rsvpDetails: { plan: "celebration", title: "Meal choices & notes", body: "Collect meal choices and a personal note with every RSVP — straight into your guest list." },
  website: { plan: "celebration", title: "Your wedding website", body: "Story, schedule, travel and registry on one calm page, at the same address as your invitation." },
  exports: { plan: "celebration", title: "Printable seating chart & guest export", body: "The seating sheet your venue and caterer will ask for, and your guest list as a spreadsheet." },
  shareKit: { plan: "celebration", title: "Share kit", body: "Send your invitation by WhatsApp, Messenger, text or email, and see where every RSVP came from." },
  premiumDesigns: { plan: "luxe", title: "Animated premium designs", body: "Six premium originals that come alive when your guests open them." },
  motion: { plan: "luxe", title: "Petals, shimmer & animated type", body: "Falling petals, gold shimmer and type that writes itself across the invitation." },
  music: { plan: "luxe", title: "Music on your invitation", body: "A song plays softly when guests open your invitation." },
  premiumSkins: { plan: "luxe", title: "Premium table finishes", body: "Marble, oak and noir finishes for your seating chart." },
  customDesigns: { plan: "celebration", title: "Your own invitation design", body: "Bring a design you made yourself and use it as your invitation, RSVP and all." },
  websiteMotion: { plan: "luxe", title: "Website scroll animations", body: "Sections that drift in as your guests scroll." },
};

export const can = (plan: Plan, feature: Feature) => planRank(plan) >= planRank(FEATURES[feature].plan);

/** The one invitation design included with the free plan. */
export const FREE_DESIGN_ID = "tp13";
