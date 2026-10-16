import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * syncEntity("vendors"): a vendor and its payment schedule are saved with
 * one save_vendor call (one database transaction, 0015), never as separate
 * upsert / delete / insert requests that can fail half-way.
 */
const rpc = vi.fn(async () => ({ error: null }));
const from = vi.fn(() => {
  const q = { delete: () => q, in: async () => ({ error: null }) };
  return q;
});
vi.mock("./supabase", () => ({ requireSb: () => ({ rpc, from }) }));

const { syncEntity } = await import("./api");

const vendor = (id: string, payments = [{ label: "Deposit", amount: 500, due: "2027-01-10", paid: true }]) => ({
  id, category: "Venue", company: "The Glasshouse", contact: "Ana", email: "ana@example.com", phone: "",
  price: 12000, status: "Booked", contract: true, notes: "", budgetId: null, payments,
});

beforeEach(() => { rpc.mockClear(); from.mockClear(); });

describe("syncEntity — vendors", () => {
  it("saves each vendor with exactly one save_vendor call", async () => {
    await syncEntity("vendors", "w1", [vendor("v1"), vendor("v2", [])], []);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith("save_vendor", {
      p_wedding: "w1",
      p_vendor: {
        id: "v1", category: "Venue", company: "The Glasshouse", contact: "Ana", email: "ana@example.com",
        phone: "", price: 12000, status: "Booked", contract: true, notes: "", budget_id: null, updated_at: null,
      },
      p_payments: [{ label: "Deposit", amount: 500, due: "2027-01-10", paid: true }],
    });
    expect((rpc.mock.calls[1] as unknown as [string, { p_payments: unknown[] }])[1].p_payments).toEqual([]);
  });

  it("never touches vendor_payments directly", async () => {
    await syncEntity("vendors", "w1", [vendor("v1")], []);
    expect(from).not.toHaveBeenCalledWith("vendor_payments");
    expect(from).not.toHaveBeenCalledWith("vendors");
  });

  it("still deletes removed vendors (their payments cascade)", async () => {
    await syncEntity("vendors", "w1", [], ["v9"]);
    expect(from).toHaveBeenCalledWith("vendors");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a failed save surfaces as an error, so the sync queue retries it", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "connection lost" } } as never);
    await expect(syncEntity("vendors", "w1", [vendor("v1")], [])).rejects.toThrow("connection lost");
  });

  it("sends the version the edit was made from, and returns the new one (0018)", async () => {
    rpc.mockResolvedValueOnce({ data: "2026-10-16T12:00:01.000001+00:00", error: null } as never);
    const out = await syncEntity("vendors", "w1", [{ ...vendor("v1"), updated_at: "2026-10-16T12:00:00+00:00" }], []);
    expect((rpc.mock.calls[0] as unknown as [string, { p_vendor: { updated_at: string } }])[1].p_vendor.updated_at)
      .toBe("2026-10-16T12:00:00+00:00");
    expect(out).toEqual({ v1: "2026-10-16T12:00:01.000001+00:00" });
  });
});
