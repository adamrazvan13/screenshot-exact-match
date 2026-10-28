import { describe, expect, it } from "vitest";
import { runInvestigation } from "./engine";
import { demoCase, extraCases } from "./fixtures";

const status = (r: ReturnType<typeof runInvestigation>, id: string) => r.rules.find((x) => x.id === id)!.status;

describe("investigation engine", () => {
  it("Case A has no discrepancies", () => {
    const r = runInvestigation(demoCase("A"));
    expect(r.discrepancyCount).toBe(0);
    expect(r.overall).toBe("PASS");
  });

  it("Case B flags Maria Ionescu missing from bank records", () => {
    const r = runInvestigation(demoCase("B"));
    expect(status(r, "R1")).toBe("REVIEW");
    expect(r.rules[0]!.explanation).toContain("Maria Ionescu");
  });

  it("Case C flags missing joint authorization", () => {
    const r = runInvestigation(demoCase("C"));
    expect(status(r, "R2")).toBe("REVIEW");
    expect(status(r, "R6")).toBe("REVIEW");
  });

  it("Case C passes representation once joint evidence is added", () => {
    const input = demoCase("C");
    input.request.evidence.push("joint_authorization");
    expect(status(runInvestigation(input), "R2")).toBe("PASS");
  });

  it("Case B passes matching once Maria is registered at the bank", () => {
    const input = demoCase("B");
    input.bankRepresentatives.push({ personId: "P-1002", name: "Maria Ionescu" });
    expect(status(runInvestigation(input), "R1")).toBe("PASS");
  });

  it("Case B becomes fully PASS after remediation", () => {
    const input = demoCase("B");
    input.bankRepresentatives.push({ personId: "P-1002", name: "Maria Ionescu" });
    const r = runInvestigation(input);
    expect(r.overall).toBe("PASS");
    expect(r.discrepancyCount).toBe(0);
  });

  it("Delta case produces a CONFLICT (terminated administrator still registered)", () => {
    const r = runInvestigation(extraCases()[0]!);
    expect(r.overall).toBe("CONFLICT");
    expect(status(r, "R1")).toBe("CONFLICT");
  });

  it("fixing one alert does not hide other unresolved alerts", () => {
    const input = demoCase("C");
    input.request.evidence.push("joint_authorization");
    input.request.details = "";
    const r = runInvestigation(input);
    expect(status(r, "R2")).toBe("PASS");
    expect(status(r, "R6")).toBe("PASS");
    expect(status(r, "R5")).toBe("REVIEW");
    expect(r.overall).toBe("REVIEW");
  });
});
