import { describe, it, expect } from "vitest";
import sql from "../../supabase/migrations/0010_free_guest_limit.sql?raw";
import { FREE_GUEST_LIMIT } from "./plans";

describe("the database guest limit", () => {
  it("matches FREE_GUEST_LIMIT in plans.ts", () => {
    // change the limit in one place and this fails until the next migration
    // moves the database to the same number
    const m = sql.match(/v_count >= (\d+)/);
    expect(m && Number(m[1])).toBe(FREE_GUEST_LIMIT);
  });
});
