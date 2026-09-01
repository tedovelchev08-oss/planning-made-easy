import React, { createContext, useContext, useMemo } from "react";

/* ------------------------------------------------------------------ */
/* i18n — strings live in dictionaries, not inlined in JSX.            */
/*                                                                     */
/* The active locale follows the wedding record (see configureFormat). */
/* A dictionary maps message keys → per-locale strings with {tokens}.  */
/* Components read via useT(); unknown keys fall back to en-US, then   */
/* to the key itself, so a missing translation never renders blank.    */
/* ------------------------------------------------------------------ */

export type Locale = "en-US" | "fr-FR" | "es-ES" | "de-DE" | "it-IT";

export const LOCALES: { id: Locale; label: string; currency: string }[] = [
  { id: "en-US", label: "English (US)", currency: "USD" },
  { id: "fr-FR", label: "Français", currency: "EUR" },
  { id: "es-ES", label: "Español", currency: "EUR" },
  { id: "de-DE", label: "Deutsch", currency: "EUR" },
  { id: "it-IT", label: "Italiano", currency: "EUR" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "nav.dashboard": "Dashboard",
  "nav.guests": "Guest List",
  "nav.budget": "Budget",
  "nav.timeline": "Timeline",
  "nav.vendors": "Vendors",
  "nav.seating": "Seating",
  "nav.registry": "Registry",
  "nav.page": "Wedding Page",
  "greeting.morning": "Good morning",
  "greeting.afternoon": "Good afternoon",
  "greeting.evening": "Good evening",
  "onboard.title": "Let's set the date.",
  "onboard.subtitle": "Three fields. The rest of the plan grows around them.",
  "onboard.names": "Your two names",
  "onboard.date": "Wedding date",
  "onboard.venue": "Venue or city",
  "onboard.locale": "Language & region",
  "onboard.currency": "Currency",
  "onboard.submit": "Create our plan",
  "onboard.welcome": "Welcome to Luma",
};

const fr: Dict = {
  "nav.dashboard": "Tableau de bord",
  "nav.guests": "Invités",
  "nav.budget": "Budget",
  "nav.timeline": "Planning",
  "nav.vendors": "Prestataires",
  "nav.seating": "Plan de table",
  "nav.registry": "Liste de mariage",
  "nav.page": "Page du mariage",
  "greeting.morning": "Bonjour",
  "greeting.afternoon": "Bon après-midi",
  "greeting.evening": "Bonsoir",
  "onboard.title": "Fixons la date.",
  "onboard.subtitle": "Trois champs. Le reste du plan grandit autour.",
  "onboard.names": "Vos deux prénoms",
  "onboard.date": "Date du mariage",
  "onboard.venue": "Lieu ou ville",
  "onboard.locale": "Langue & région",
  "onboard.currency": "Devise",
  "onboard.submit": "Créer notre plan",
  "onboard.welcome": "Bienvenue sur Luma",
};

const es: Dict = {
  "nav.dashboard": "Panel",
  "nav.guests": "Invitados",
  "nav.budget": "Presupuesto",
  "nav.timeline": "Cronograma",
  "nav.vendors": "Proveedores",
  "nav.seating": "Seating",
  "nav.registry": "Mesa de regalos",
  "nav.page": "Página de la boda",
  "greeting.morning": "Buenos días",
  "greeting.afternoon": "Buenas tardes",
  "greeting.evening": "Buenas noches",
  "onboard.title": "Fijemos la fecha.",
  "onboard.subtitle": "Tres campos. El resto del plan crece alrededor.",
  "onboard.names": "Vuestros dos nombres",
  "onboard.date": "Fecha de la boda",
  "onboard.venue": "Lugar o ciudad",
  "onboard.locale": "Idioma y región",
  "onboard.currency": "Moneda",
  "onboard.submit": "Crear nuestro plan",
  "onboard.welcome": "Bienvenidos a Luma",
};

const de: Dict = {
  "nav.dashboard": "Übersicht",
  "nav.guests": "Gästelist",
  "nav.budget": "Budget",
  "nav.timeline": "Zeitplan",
  "nav.vendors": "Dienstleister",
  "nav.seating": "Sitzplan",
  "nav.registry": "Wunschliste",
  "nav.page": "Hochzeitsseite",
  "greeting.morning": "Guten Morgen",
  "greeting.afternoon": "Guten Tag",
  "greeting.evening": "Guten Abend",
  "onboard.title": "Legen wir das Datum fest.",
  "onboard.subtitle": "Drei Felder. Der Rest des Plans wächst darum.",
  "onboard.names": "Eure beiden Namen",
  "onboard.date": "Hochzeitsdatum",
  "onboard.venue": "Location oder Stadt",
  "onboard.locale": "Sprache & Region",
  "onboard.currency": "Währung",
  "onboard.submit": "Unseren Plan erstellen",
  "onboard.welcome": "Willkommen bei Luma",
};

const it: Dict = {
  "nav.dashboard": "Panoramica",
  "nav.guests": "Invitati",
  "nav.budget": "Budget",
  "nav.timeline": "Cronoprogramma",
  "nav.vendors": "Fornitori",
  "nav.seating": " seating",
  "nav.registry": "Lista nozze",
  "nav.page": "Pagina del matrimonio",
  "greeting.morning": "Buongiorno",
  "greeting.afternoon": "Buon pomeriggio",
  "greeting.evening": "Buonasera",
  "onboard.title": "Fissiamo la data.",
  "onboard.subtitle": "Tre campi. Il resto del piano cresce intorno.",
  "onboard.names": "I vostri due nomi",
  "onboard.date": "Data del matrimonio",
  "onboard.venue": "Location o città",
  "onboard.locale": "Lingua e regione",
  "onboard.currency": "Valuta",
  "onboard.submit": "Crea il nostro piano",
  "onboard.welcome": "Benvenuti su Luma",
};

const dictionaries: Record<Locale, Dict> = { "en-US": en, "fr-FR": fr, "es-ES": es, "de-DE": de, "it-IT": it };

/** Interpolate {tokens} into a message. */
const fill = (msg: string, vars?: Record<string, string | number>) =>
  vars ? msg.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : msg;

/** Translate a key for a locale, falling back en-US → key. */
export const translate = (locale: string, key: string, vars?: Record<string, string | number>): string => {
  const dict = dictionaries[locale as Locale] ?? en;
  return fill(dict[key] ?? en[key] ?? key, vars);
};

interface I18nCtx {
  locale: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({ locale: "en-US", t: (k, v) => translate("en-US", k, v) });

/** Provides t() bound to the wedding's locale. */
export function I18nProvider({ locale, children }: { locale: string; children: React.ReactNode }) {
  const value = useMemo<I18nCtx>(
    () => ({ locale, t: (key, vars) => translate(locale, key, vars) }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** Time-of-day greeting key for the dashboard. */
export const greetingKey = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "greeting.morning";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
};
