import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyBankRecords, cuiKey, fetchBankClient } from "./bank";
import { runInvestigation } from "./engine";
import { demoCase } from "./fixtures";

const ROW = {
  cui: "40000002",
  company_name: "BETA CONSULTING SRL",
  representatives: [{ personId: "P-1001", name: "Andrei Popescu" }],
  operators: [{ personId: "P-1001", name: "Andrei Popescu", scope: "Full operating rights" }],
  mandate: { reference: "MND-B-2020-03", description: "Representation mandate", date: "2026-09-18" },
};

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const stubDb = (rows: unknown[]) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("bank records lookup", () => {
  it("normalizes CUI formats to digits", () => {
    expect(cuiKey("RO40000002")).toBe("40000002");
    expect(cuiKey("ro 40000002")).toBe("40000002");
    expect(cuiKey("40000002")).toBe("40000002");
  });

  it("looks the client up by CUI digits using the public key", async () => {
    const fetchMock = stubDb([ROW]);
    const client = await fetchBankClient("RO40000002");
    expect(client?.companyName).toBe("BETA CONSULTING SRL");
    expect(client?.representatives).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/rest/v1/bank_clients?cui=eq.40000002");
    expect((init.headers as Record<string, string>)["apikey"]).toBe("anon-key");
  });

  it("returns null when the company is not a bank client", async () => {
    stubDb([]);
    expect(await fetchBankClient("RO99999999")).toBeNull();
  });

  it("rejects an empty CUI without calling the database", async () => {
    const fetchMock = stubDb([ROW]);
    await expect(fetchBankClient("")).rejects.toThrow(/valid CUI/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fills only the bank side and leaves registry data and the request untouched", async () => {
    stubDb([ROW]);
    const client = await fetchBankClient("40000002");
    const base = demoCase("C");
    const out = applyBankRecords(base, client);
    expect(out.bankRepresentatives).toEqual(ROW.representatives);
    expect(out.accountOperators).toEqual(ROW.operators);
    expect(out.mandate.reference).toBe("MND-B-2020-03");
    expect(out.company).toEqual(base.company);
    expect(out.administrators).toEqual(base.administrators);
    expect(out.request).toEqual(base.request);
  });

  it("clears stale bank records when the company is unknown to the bank", () => {
    const out = applyBankRecords(demoCase("C"), null);
    expect(out.bankRepresentatives).toEqual([]);
    expect(out.accountOperators).toEqual([]);
    expect(out.mandate.reference).toBe("");
  });

  it("registry certificate + bank-system records reproduce the Case B outcome (administrator missing at bank)", async () => {
    stubDb([ROW]);
    const b = demoCase("B");
    const registrySideOnly = { ...b, bankRepresentatives: [], accountOperators: [], mandate: { reference: "", description: "", date: "" } };
    const filled = applyBankRecords(registrySideOnly, await fetchBankClient("RO40000002"));
    const result = runInvestigation(filled);
    expect(result.overall).toBe("REVIEW");
    expect(result.rules.find((r) => r.id === "R1")?.status).toBe("REVIEW");
  });
});
