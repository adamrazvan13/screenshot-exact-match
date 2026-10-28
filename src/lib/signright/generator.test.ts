import { describe, expect, it } from "vitest";
import { runInvestigation } from "./engine";
import { SCENARIO_KINDS, generateCase, generateScenarios, makeRng } from "./generator";

describe("synthetic case generator", () => {
  it("is reproducible for the same seed", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    expect(generateScenarios(5, 42, now)).toEqual(generateScenarios(5, 42, now));
  });

  it("covers every scenario kind and produces all three statuses via the real engine", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const rng = makeRng(7);
    const results = SCENARIO_KINDS.map((k, i) => ({ k, r: runInvestigation(generateCase(k, rng, now, i), now) }));
    const statuses = new Set(results.map((x) => x.r.overall));
    expect(statuses).toEqual(new Set(["PASS", "REVIEW", "CONFLICT"]));
  });

  it("expected outcomes follow from the data, not from labels", () => {
    const now = new Date("2026-10-28T12:00:00Z");
    const get = (k: Parameters<typeof generateCase>[0]) => runInvestigation(generateCase(k, makeRng(1), now), now);
    expect(get("clean").overall).toBe("PASS");
    expect(get("joint_both_sign").overall).toBe("PASS");
    expect(get("joint_covered").overall).toBe("PASS");
    expect(get("joint_single").rules.find((r) => r.id === "R2")!.status).toBe("REVIEW");
    expect(get("missing_rep").rules.find((r) => r.id === "R1")!.status).toBe("REVIEW");
    expect(get("terminated_at_bank").rules.find((r) => r.id === "R1")!.status).toBe("CONFLICT");
    expect(get("operator_requests").rules.find((r) => r.id === "R3")!.status).toBe("CONFLICT");
    expect(get("stale_docs").rules.find((r) => r.id === "R4")!.status).toBe("REVIEW");
    expect(get("missing_evidence").rules.find((r) => r.id === "R6")!.status).toBe("REVIEW");
    expect(get("admin_not_rep").rules.find((r) => r.id === "R3")!.status).toBe("REVIEW");
    expect(get("name_typo").rules.find((r) => r.id === "R1")!.status).toBe("REVIEW");
  });

  it("generates unique CUIs and no duplicate people inside a case", () => {
    const list = generateScenarios(30, 99);
    expect(new Set(list.map((c) => c.company.cui)).size).toBe(30);
    for (const c of list) {
      const ids = c.administrators.map((a) => a.personId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("generator variety", () => {
  it("does not repeat company names within a batch", () => {
    const names = generateScenarios(10, 5).map((c) => c.company.name);
    expect(new Set(names).size).toBe(10);
  });
});
