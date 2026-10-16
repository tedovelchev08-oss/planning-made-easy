/**
 * POST /api/delete-account — the signed-in user deletes their own account.
 *
 * Body: { confirmEmail } — must equal the account's email, typed by hand in
 * the app, so a stray click or a stolen session in an open tab can't do it.
 *
 * Order matters, and every step can be retried:
 *   1. If the user owns weddings, remove every file stored under each
 *      wedding's folder in the media bucket (uploaded songs). Storage
 *      objects aren't foreign-keyed to the database, so deleting the wedding
 *      alone left them behind forever. Failing here stops before step 2,
 *      so nothing is half-deleted.
 *   2. Delete the auth user. The database does the rest: an owner's
 *      weddings and everything in them cascade; a partner only loses their
 *      membership; payment records stay, anonymised (0017).
 *
 * Service role for both steps (Storage API and auth admin); the caller is
 * identified only by their verified JWT, never by anything in the body.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/** The one part of the Storage API this needs, so tests can stand in for it. */
interface MediaBucket {
  list: (folder: string, opts: { limit: number }) => Promise<{ data: { name: string; id: string | null }[] | null; error: { message: string } | null }>;
}

/** Every file path under a folder, a few levels deep (weddings use <id>/music/<file>). */
export async function filesUnder(bucket: MediaBucket, folder: string, depth = 3): Promise<string[]> {
  const { data, error } = await bucket.list(folder, { limit: 1000 });
  if (error) throw new Error(`storage list failed for ${folder}: ${error.message}`);
  const out: string[] = [];
  for (const entry of data ?? []) {
    const path = `${folder}/${entry.name}`;
    // folders come back without an id
    if (entry.id == null) {
      if (depth > 1) out.push(...(await filesUnder(bucket, path, depth - 1)));
    } else {
      out.push(path);
    }
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: "Supabase server env is not set" });

  const authHeader = req.headers.authorization ?? "";
  const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!jwt) return res.status(401).json({ error: "Missing authorization" });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId: string;
  let email: string;
  try {
    const { data: authed, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !authed?.user) return res.status(401).json({ error: "Invalid session" });
    userId = authed.user.id;
    email = authed.user.email ?? "";
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  const confirm = (req.body as { confirmEmail?: unknown } | undefined)?.confirmEmail;
  if (typeof confirm !== "string" || !email || confirm.trim().toLowerCase() !== email.toLowerCase()) {
    return res.status(400).json({ error: "Type the email address you sign in with to confirm." });
  }

  try {
    // 1. files in the weddings this user owns
    const { data: owned, error: ownedErr } = await admin.from("weddings").select("id").eq("owner_id", userId);
    if (ownedErr) throw new Error(`wedding lookup failed: ${ownedErr.message}`);
    let removed = 0;
    for (const { id } of (owned ?? []) as { id: string }[]) {
      const paths = await filesUnder(admin.storage.from("media") as unknown as MediaBucket, id);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from("media").remove(paths.slice(i, i + 100));
        if (error) throw new Error(`storage remove failed: ${error.message}`);
      }
      removed += paths.length;
    }

    // 2. the account; the database cascades the rest
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`deleteUser failed: ${delErr.message}`);

    console.log(`[delete-account] deleted ${userId} (owned ${owned?.length ?? 0} wedding(s), ${removed} file(s) removed)`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[delete-account] failed:", userId, (err as Error).message);
    return res.status(500).json({ error: "Your account couldn't be deleted just now. Please try again, or email us." });
  }
}
