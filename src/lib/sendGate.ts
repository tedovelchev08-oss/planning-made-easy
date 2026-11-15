import { seedTemplates } from "./data";
import { FREE_DESIGN_ID, PLANS, can, designOnPlan, type Feature, type Plan } from "./plans";
import type { Db, InvitationConfig } from "./store";
import { planAllows, studioDesignOf } from "../../api/_lib/studioDesigns";

/**
 * A couple may build their invitation with anything (every design, their own
 * colours and photo) and see it exactly as it will look. What their plan
 * doesn't include yet can't be sent: while it's on the invitation, the link
 * isn't copied, shared or opened to guests (owner, 2026-11-15: "block until
 * they pay"). The guest page and api/invitation.ts hold the same line, so a
 * link already out shows the free version until the plan includes it.
 */
export type SendGate = {
  /** the plan that sends it as built */
  plan: Plan;
  /** what the upgrade dialog explains */
  feature: Feature;
  /** what the couple is trying, in a few words: "the Celestial design" */
  what: string;
} | null;

/** whether the couple's own colours, lettering or photo are on the invitation */
function ownLook(cfg: InvitationConfig): boolean {
  const t = seedTemplates.find((x) => x.id === cfg.templateId);
  const ownPhoto = !!t?.photo && !!cfg.photo && cfg.photo !== t.photo;
  return cfg.colors !== null || cfg.fontSerif !== null || ownPhoto;
}

export function sendGate(db: Pick<Db, "plan" | "invitation">): SendGate {
  const cfg = db.invitation;
  const studio = studioDesignOf(cfg.templateId);
  if (studio) {
    if (!planAllows(db.plan, studio)) return { plan: studio.plan, feature: studio.plan === "luxe" ? "premiumDesigns" : "allDesigns", what: `the ${studio.name} design` };
    return null;
  }
  const t = seedTemplates.find((x) => x.id === cfg.templateId);
  if (t && !designOnPlan(db.plan, t)) return { plan: t.luxe ? "luxe" : "celebration", feature: t.luxe ? "premiumDesigns" : "allDesigns", what: `the ${t.name} design` };
  if (!can(db.plan, "customize") && ownLook(cfg)) return { plan: "celebration", feature: "customize", what: "your own colours and photo" };
  return null;
}

/** "Celebration", "Luxe" */
export const gatePlanName = (gate: NonNullable<SendGate>) => PLANS[gate.plan].name;

/**
 * The invitation as the plan sends it today: the free design if the chosen
 * one isn't included, without colours, lettering or a photo the plan doesn't
 * include. The couple's words, replies and music settings stay.
 */
export function sendableNow(db: Pick<Db, "plan" | "invitation">): Partial<InvitationConfig> {
  const cfg = db.invitation;
  const studio = studioDesignOf(cfg.templateId);
  const t = seedTemplates.find((x) => x.id === cfg.templateId);
  const designOk = studio ? planAllows(db.plan, studio) : !t || designOnPlan(db.plan, t);
  const next: Partial<InvitationConfig> = designOk ? {} : { templateId: FREE_DESIGN_ID };
  if (!can(db.plan, "customize")) {
    const shown = seedTemplates.find((x) => x.id === (next.templateId ?? cfg.templateId));
    Object.assign(next, { colors: null, fontSerif: null, photo: shown?.photo ?? null });
  }
  return next;
}
