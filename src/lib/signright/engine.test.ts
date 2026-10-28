import { describe, expect, it } from "vitest";
import { runInvestigation } from "./engine";
import { demoCase } from "./fixtures";

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
});
