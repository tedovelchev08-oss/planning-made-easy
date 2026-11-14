import { DESIGN_LIMITS, type StudioDesign } from "../../../api/_lib/studioDesigns";
import type { Db } from "../../lib/store";
import { joinNames } from "./Editable";

/**
 * A word typed on a studio design in the planner (luma-bridge.js, edit mode)
 * becomes a change to the couple's details: where each key is kept, and how
 * long it may be. Anything unknown is ignored, so a design can't write
 * outside the fields it was given.
 */
export function studioEditPatch(db: Db, design: StudioDesign, key: string, raw: unknown): Partial<Db> | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/\r/g, "");
  const line = value.replace(/\s+/g, " ");
  const w = db.wedding;
  const cfg = db.invitation;
  const dd = cfg.designData ?? {};
  const design_ = (p: Partial<NonNullable<typeof cfg.designData>>) => ({ invitation: { ...cfg, designData: { ...dd, ...p } } });

  switch (key) {
    case "partner1": {
      const a = line.slice(0, 40);
      return { wedding: { ...w, partnerA: a, names: joinNames(a, w.partnerB ?? "") }, invitation: { ...cfg, names: joinNames(a, w.partnerB ?? "") } };
    }
    case "partner2": {
      const b = line.slice(0, 40);
      return { wedding: { ...w, partnerB: b, names: joinNames(w.partnerA ?? "", b) }, invitation: { ...cfg, names: joinNames(w.partnerA ?? "", b) } };
    }
    case "venueName": return { wedding: { ...w, venue: line.slice(0, DESIGN_LIMITS.venue) } };
    case "venueAddress": return { wedding: { ...w, location: line.slice(0, 160) } };
    case "hashtag": return design_({ hashtag: line.slice(0, DESIGN_LIMITS.hashtag) });
    case "dressCode": return design_({ dressCode: line.slice(0, DESIGN_LIMITS.dressCode) });
    case "dressCodeNote": return design_({ dressCodeNote: line.slice(0, DESIGN_LIMITS.dressCodeNote) });
    case "story1": return design_({ story1: value.slice(0, DESIGN_LIMITS.story) });
    case "story2": return design_({ story2: value.slice(0, DESIGN_LIMITS.story) });
    // a design that shows the story as one block: it is all the first paragraph
    case "story": return design_({ story1: value.slice(0, DESIGN_LIMITS.story), story2: "" });
  }

  const own = design.extras?.texts.find((t) => t.key === key);
  if (own) return design_({ texts: { ...(dd.texts ?? {}), [key]: (own.multiline ? value : line).slice(0, own.max) } });
  return null;
}
