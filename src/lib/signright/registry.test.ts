import { describe, expect, it } from "vitest";
import { normId, runInvestigation } from "./engine";
import { demoCase } from "./fixtures";
import type { RegistryCheck } from "./types";

const check = (over: Partial<RegistryCheck> = {}): RegistryCheck => ({
  source: "ANAF",
  checkedAt: "2026-10-28T12:00:00.000Z",
  cui: "40000001",
  found: true,
  name: "ALFA TECH S.R.L.",
  registrationNumber: "J40/1001/2019",
  registrationStatus: "INREGISTRAT din data 12.03.2019",
  inactive: false,
  ...over,
});
const r7 = (c: RegistryCheck | undefined) => {
  const input = demoCase("A");
  input.registryCheck = c;
  return runInvestigation(input).rules.find((x) => x.id === "R7");
};

describe("R7 public registry check", () => {
  it("normalizes names and numbers", () => {
    expect(normId("Alfa Tech S.R.L.")).toBe(normId("ALFA TECH SRL"));
    expect(normId("ȘTEFAN & Fiii SRL")).toBe("STEFANFIIISRL");
  });
  it("does not run without a lookup, so existing cases are unchanged", () => {
    expect(r7(undefined)).toBeUndefined();
    expect(runInvestigation(demoCase("A")).rules).toHaveLength(6);
  });
  it("passes when the entered data matches the registry and the company is active", () => {
    expect(r7(check())!.status).toBe("PASS");
  });
  it("flags a CUI that is not found", () => {
    expect(r7(check({ found: false }))!.status).toBe("REVIEW");
  });
  it("flags a name mismatch", () => {
    const r = r7(check({ name: "OTHER COMPANY SRL" }))!;
    expect(r.status).toBe("REVIEW");
    expect(r.explanation).toContain("OTHER COMPANY SRL");
  });
  it("flags a registration number mismatch", () => {
    expect(r7(check({ registrationNumber: "J12/9999/2020" }))!.status).toBe("REVIEW");
  });
  it("raises CONFLICT for a company declared inactive", () => {
    expect(r7(check({ inactive: true }))!.status).toBe("CONFLICT");
  });
  it("raises CONFLICT for a struck-off company", () => {
    expect(r7(check({ registrationStatus: "RADIERE din data 01.02.2024" }))!.status).toBe("CONFLICT");
  });
  it("flags a lookup made for a different CUI", () => {
    expect(r7(check({ cui: "11111111" }))!.status).toBe("REVIEW");
  });
  it("affects the overall result", () => {
    const input = demoCase("A");
    input.registryCheck = check({ inactive: true });
    expect(runInvestigation(input).overall).toBe("CONFLICT");
  });
});
