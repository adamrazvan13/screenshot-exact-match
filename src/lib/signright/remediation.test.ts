import { beforeEach, describe, expect, it, vi } from "vitest";
import { runInvestigation } from "./engine";
import { demoCase } from "./fixtures";
import { proposeBankUpdate } from "./remediation";

const propose = (input = demoCase("B")) => proposeBankUpdate(input, runInvestigation(input));

describe("proposed bank update", () => {
  it("Case B: proposes registering Maria Ionescu and is ready (everything else passes)", () => {
    const p = propose()!;
    expect(p.toRegister).toEqual([{ personId: "P-1002", name: "Maria Ionescu" }]);
    expect(p.ready).toBe(true);
    expect(p.blockers).toEqual([]);
  });

  it("is not ready when the required evidence is missing", () => {
    const b = demoCase("B");
    b.request.evidence = ["registry_extract"];
    const p = propose(b)!;
    expect(p.ready).toBe(false);
    expect(p.blockers.some((x) => x.startsWith("R6"))).toBe(true);
  });

  it("is not ready when the request was submitted by someone with no authority", () => {
    const b = demoCase("B");
    b.request.submittedBy = ["P-9999"]; // unknown to both the registry and the bank
    const p = propose(b)!;
    expect(p.ready).toBe(false);
    expect(p.blockers.length).toBeGreaterThan(0);
  });

  it("proposes nothing for other operations or when nothing is missing", () => {
    expect(propose(demoCase("A"))).toBeNull();
    expect(propose(demoCase("C"))).toBeNull();
    const b = demoCase("B");
    b.request.operation = "add_operator";
    expect(propose(b)).toBeNull();
  });

  it("R1 tells the employee this is the change the customer asked for", () => {
    const r1 = runInvestigation(demoCase("B")).rules.find((r) => r.id === "R1")!;
    expect(r1.status).toBe("REVIEW");
    expect(r1.nextStep).toMatch(/approve the bank update/);
  });
});

describe("approving the bank update", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("registers the representative, re-runs the rules (PASS) and logs it", async () => {
    const store = await import("./store");
    store.saveCase(store.newCase(demoCase("B"), "CASE-T"));
    expect(store.getCase("CASE-T")!.result.overall).toBe("REVIEW");

    const p = proposeBankUpdate(store.getCase("CASE-T")!.input, store.getCase("CASE-T")!.result)!;
    store.registerRepresentatives("CASE-T", p.toRegister);

    const after = store.getCase("CASE-T")!;
    expect(after.result.overall).toBe("PASS");
    expect(after.input.bankRepresentatives.map((b) => b.personId)).toEqual(["P-1001", "P-1002"]);
    expect(after.log.some((l) => /registered Maria Ionescu \(P-1002\)/.test(l.text))).toBe(true);
    expect(proposeBankUpdate(after.input, after.result)).toBeNull();
  });

  it("does nothing when the person is already registered", async () => {
    const store = await import("./store");
    store.saveCase(store.newCase(demoCase("A"), "CASE-A"));
    const before = store.getCase("CASE-A")!.log.length;
    store.registerRepresentatives("CASE-A", [{ personId: "P-1001", name: "Andrei Popescu" }]);
    expect(store.getCase("CASE-A")!.log.length).toBe(before);
  });
});

describe("documents read for a case", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("stay with the case when it is edited, re-run or updated", async () => {
    const store = await import("./store");
    const docs = [{ name: "01_Certificat_Constatator_Beta_Consulting.pdf", size: 60_000 }];
    store.saveCase({ ...store.newCase(demoCase("B"), "CASE-D"), sourceDocuments: docs });

    store.rerunCase("CASE-D", demoCase("B")); // "Edit data" without uploading again
    expect(store.getCase("CASE-D")!.sourceDocuments).toEqual(docs);

    store.registerRepresentatives("CASE-D", [{ personId: "P-1002", name: "Maria Ionescu" }]);
    expect(store.getCase("CASE-D")!.sourceDocuments).toEqual(docs);

    const more = [...docs, { name: "05_Decizie.pdf", size: 1000 }];
    store.rerunCase("CASE-D", demoCase("B"), more);
    expect(store.getCase("CASE-D")!.sourceDocuments).toEqual(more);
  });
});
