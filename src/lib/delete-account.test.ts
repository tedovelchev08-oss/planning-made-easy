import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Block 14: api/delete-account.ts deletes the signed-in user's own account.
 * Owners' uploaded files go first (storage isn't foreign-keyed), then the
 * auth user; a failure before the account is deleted leaves nothing half-done.
 */
const calls: string[] = [];
let user: { id: string; email: string } | null = { id: "u1", email: "Couple@Example.com" };
let owned: { id: string }[] = [{ id: "w1" }];
let removeError: { message: string } | null = null;

// w1/ holds a music folder with two songs; w1/music/ holds the files
const tree: Record<string, { name: string; id: string | null }[]> = {
  w1: [{ name: "music", id: null }],
  "w1/music": [{ name: "a.mp3", id: "f1" }, { name: "b.mp3", id: "f2" }],
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getUser: async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "bad jwt" } }),
      admin: { deleteUser: async (id: string) => { calls.push(`deleteUser:${id}`); return { error: null }; } },
    },
    from: () => {
      const q = { select: () => q, eq: async () => ({ data: owned, error: null }) };
      return q;
    },
    storage: {
      from: () => ({
        list: async (folder: string) => { calls.push(`list:${folder}`); return { data: tree[folder] ?? [], error: null }; },
        remove: async (paths: string[]) => { calls.push(`remove:${paths.join(",")}`); return { error: removeError }; },
      }),
    },
  }),
}));

const { default: handler } = await import("../../api/delete-account");

async function del(body: unknown, auth = "Bearer jwt") {
  const res: { statusCode?: number; body?: unknown; status: (n: number) => typeof res; json: (b: unknown) => typeof res; setHeader: () => void } = {
    status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, setHeader() {},
  };
  await handler({ method: "POST", headers: auth ? { authorization: auth } : {}, body } as never, res as never);
  return res;
}

beforeEach(() => {
  calls.length = 0;
  user = { id: "u1", email: "Couple@Example.com" };
  owned = [{ id: "w1" }];
  removeError = null;
  vi.stubEnv("SUPABASE_URL", "https://staging.example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("api/delete-account", () => {
  it("refuses without a session", async () => {
    expect((await del({ confirmEmail: "couple@example.com" }, "")).statusCode).toBe(401);
    user = null;
    expect((await del({ confirmEmail: "couple@example.com" })).statusCode).toBe(401);
    expect(calls).toEqual([]);
  });

  it("refuses unless the typed email matches the account", async () => {
    for (const confirmEmail of [undefined, "", "someone@example.com"]) {
      expect((await del({ confirmEmail })).statusCode).toBe(400);
    }
    expect(calls).toEqual([]);
  });

  it("owner: removes the wedding's files, THEN deletes the account", async () => {
    const res = await del({ confirmEmail: "  couple@example.com " });
    expect(res.statusCode).toBe(200);
    expect(calls).toEqual(["list:w1", "list:w1/music", "remove:w1/music/a.mp3,w1/music/b.mp3", "deleteUser:u1"]);
  });

  it("partner (owns no wedding): no storage calls, just the account", async () => {
    owned = [];
    expect((await del({ confirmEmail: "couple@example.com" })).statusCode).toBe(200);
    expect(calls).toEqual(["deleteUser:u1"]);
  });

  it("if removing files fails, the account is NOT deleted (safe to retry)", async () => {
    removeError = { message: "storage unavailable" };
    const res = await del({ confirmEmail: "couple@example.com" });
    expect(res.statusCode).toBe(500);
    expect(calls).not.toContain("deleteUser:u1");
  });

  it("only POST", async () => {
    const res: { statusCode?: number; status: (n: number) => typeof res; json: () => typeof res; setHeader: () => void } = {
      status(n) { this.statusCode = n; return this; }, json() { return this; }, setHeader() {},
    };
    await handler({ method: "GET", headers: {} } as never, res as never);
    expect(res.statusCode).toBe(405);
  });
});
