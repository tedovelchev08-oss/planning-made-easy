import type { Db, User } from "./store";

/**
 * "Export my data": the couple's whole workspace as one JSON file.
 *
 * The footer used to promise "Export or erase anytime" when neither existed.
 * Everything here is already loaded in the browser, so the export is exactly
 * what the couple sees: no extra request, nothing withheld.
 */
export function buildExport(db: Db, user: User | null, weddingId: string | null, now = new Date()) {
  // songs uploaded in the demo are local blob: URLs that mean nothing outside this tab
  const music = db.invitation.music.uploadUrl?.startsWith("blob:")
    ? { ...db.invitation.music, uploadUrl: null }
    : db.invitation.music;
  return {
    format: "luma-export",
    version: 1,
    exportedAt: now.toISOString(),
    account: user ? { email: user.email } : null,
    weddingId,
    plan: db.plan,
    wedding: db.wedding,
    guests: db.guests,
    rsvps: db.rsvpLog,
    seating: { tables: db.tables, venueObjects: db.venueObjects ?? [] },
    budget: db.budget,
    vendors: db.vendors,
    tasks: db.tasks,
    registry: db.registry,
    invitation: { ...db.invitation, music },
    website: db.website,
    customDesigns: db.customTemplates,
  };
}

/** "twofold-maya-and-theo-2026-10-15.json" */
export function exportFileName(db: Db, now = new Date()) {
  const who = (db.wedding.slug || db.wedding.names || "wedding").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `twofold-${who || "wedding"}-${now.toISOString().slice(0, 10)}.json`;
}

export function downloadExport(db: Db, user: User | null, weddingId: string | null) {
  const blob = new Blob([JSON.stringify(buildExport(db, user, weddingId), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(db);
  a.click();
  URL.revokeObjectURL(url);
}
