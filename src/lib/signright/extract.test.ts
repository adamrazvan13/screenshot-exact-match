import { describe, expect, it } from "vitest";
import { runInvestigation } from "./engine";
import { applyExtraction, extractionSchema } from "./extract";
import { demoCase } from "./fixtures";
import { SAMPLE_DOCS } from "./sampleDocs";
import type { InvestigationInput } from "./types";

const blank = (): InvestigationInput => ({
  company: { name: "", cui: "", registrationNumber: "", documentDate: "" },
  representationMode: "individual",
  administrators: [{ personId: "P-", name: "" }],
  bankRepresentatives: [],
  accountOperators: [],
  mandate: { reference: "", description: "", date: "" },
  request: { operation: "update_representatives", submittedBy: [], details: "", evidence: [] },
});

// What a correct model would return for the Case C sample document.
const caseC = {
  company: { name: "GAMMA INDUSTRIES SRL", cui: "RO40000003", registrationNumber: "J22/3003/2018", documentDate: "2026-10-18" },
  representationMode: "joint",
  administrators: [
    { name: "Andrei Popescu", personId: "P-1001", appointedOn: "2018-09-01", terminatedOn: null, quote: "Andrei Popescu — Cod persoană: P-1001" },
    { name: "Maria Ionescu", personId: "P-1002", appointedOn: "2018-09-01", terminatedOn: null, quote: "Maria Ionescu — Cod persoană: P-1002" },
  ],
  unknownFields: [],
};

describe("document extraction", () => {
  it("sample documents contain the data the demo cases rely on", () => {
    expect(SAMPLE_DOCS.C.text).toContain("P-1002");
    expect(SAMPLE_DOCS.B.text).toContain("Maria Ionescu");
  });

  it("validates a well-formed extraction", () => {
    expect(extractionSchema.safeParse(caseC).success).toBe(true);
  });

  it("turns invalid dates into null instead of failing", () => {
    const r = extractionSchema.parse({ ...caseC, company: { ...caseC.company, documentDate: "18 octombrie" } });
    expect(r.company.documentDate).toBeNull();
  });

  it("treats an unexpected representation mode as unknown", () => {
    expect(extractionSchema.parse({ ...caseC, representationMode: "whatever" }).representationMode).toBe("unknown");
  });

  it("fills the official side of the form and leaves bank records and the request alone", () => {
    const start = blank();
    start.request.details = "keep me";
    const { input, warnings } = applyExtraction(start, extractionSchema.parse(caseC));
    expect(input.company.cui).toBe("RO40000003");
    expect(input.representationMode).toBe("joint");
    expect(input.administrators.map((a) => a.personId)).toEqual(["P-1001", "P-1002"]);
    expect(input.bankRepresentatives).toEqual([]);
    expect(input.request.details).toBe("keep me");
    expect(warnings).toEqual([]);
  });

  it("never invents missing data and warns about it", () => {
    const sparse = extractionSchema.parse({
      company: { name: "X SRL", cui: null, registrationNumber: null, documentDate: null },
      representationMode: "unknown",
      administrators: [{ name: "Ion Vasile", personId: null, appointedOn: null, terminatedOn: null, quote: null }],
      unknownFields: ["representation clause"],
    });
    const { input, warnings } = applyExtraction(blank(), sparse);
    expect(input.company.cui).toBe("");
    expect(input.administrators[0]!.personId).toBe("P-");
    expect(warnings.some((w) => w.includes("CUI"))).toBe(true);
    expect(warnings.some((w) => w.includes("Ion Vasile"))).toBe(true);
    expect(warnings.some((w) => w.includes("representation clause"))).toBe(true);
  });

  it("does not warn about a missing end date, but keeps real notes such as conflicts between documents", () => {
    const ex = extractionSchema.parse({
      company: { name: "X SRL", cui: "RO1", registrationNumber: "J1/1/2020", documentDate: "2026-10-01" },
      representationMode: "individual",
      administrators: [{ name: "Ion Vasile", personId: "P-1", appointedOn: "2020-01-01", terminatedOn: null, quote: null }],
      unknownFields: ["administrators[0].terminatedOn", "conflict: documents disagree on the administrators"],
    });
    const { warnings } = applyExtraction(blank(), ex);
    expect(warnings.some((w) => w.includes("terminatedOn"))).toBe(false);
    expect(warnings.some((w) => w.includes("documents disagree"))).toBe(true);
  });

  it("extracted data feeds the same rules: Case C extraction + bank data reproduces the joint-representation alert", () => {
    const base = demoCase("C");
    const { input } = applyExtraction(base, extractionSchema.parse(caseC));
    const r = runInvestigation(input);
    expect(r.rules.find((x) => x.id === "R2")!.status).toBe("REVIEW");
    expect(r.rules.find((x) => x.id === "R6")!.status).toBe("REVIEW");
  });
});
