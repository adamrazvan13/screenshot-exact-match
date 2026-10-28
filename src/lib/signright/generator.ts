// Generates varied SYNTHETIC cases (fictional companies and people). Scenarios only describe
// the INPUT data (who is registered where, who signed, which documents exist); the outcome of
// every case is computed by the real rule engine, never hard-coded here.
import type { Administrator, InvestigationInput, EvidenceType } from "./types";

export type ScenarioKind =
  | "clean"
  | "missing_rep"
  | "joint_single"
  | "joint_covered"
  | "joint_both_sign"
  | "terminated_at_bank"
  | "operator_requests"
  | "stale_docs"
  | "missing_evidence"
  | "admin_not_rep"
  | "name_typo";

export const SCENARIO_KINDS: ScenarioKind[] = [
  "clean",
  "missing_rep",
  "joint_single",
  "joint_covered",
  "joint_both_sign",
  "terminated_at_bank",
  "operator_requests",
  "stale_docs",
  "missing_evidence",
  "admin_not_rep",
  "name_typo",
];

const COMPANIES = ["Nordic Trans", "Carpatica Foods", "Danubius Solutions", "Mioritic Energy", "Transilvania Packaging", "Apuseni Robotics", "Delta Verde", "Olt Logistic", "Bucegi Digital", "Siret Components", "Prahova Agro", "Dobrogea Marine", "Retezat Tools", "Banat Textile", "Moldova Print", "Oltenia Cargo", "Maramures Wood", "Cluj Biotech", "Iasi Software", "Brasov Mechanics", "Timis Energy", "Arges Motors", "Sibiu Labs", "Galati Steel"];
const FIRST = ["Andrei", "Maria", "Ioana", "Mihai", "Elena", "Radu", "Ana", "Vlad", "Cristina", "Bogdan", "Daniela", "Stefan", "Laura", "Paul"];
const LAST = ["Popescu", "Ionescu", "Dumitru", "Stan", "Georgescu", "Marin", "Matei", "Pop", "Constantin", "Lazar", "Moldovan", "Neagu"];

/** Small seedable PRNG (mulberry32) so tests are reproducible. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  return { next, int, pick: <T,>(a: readonly T[]): T => a[int(a.length)]! };
}
type Rng = ReturnType<typeof makeRng>;

const daysAgo = (n: number, now: Date) => new Date(now.getTime() - n * 86_400_000).toISOString().slice(0, 10);

export function generateCase(kind: ScenarioKind, rng: Rng, now: Date = new Date(), serial = 0, usedCompanies: Set<string> = new Set()): InvestigationInput {
  let companyName = "";
  do companyName = `${rng.pick(COMPANIES).toUpperCase()} SRL`;
  while (usedCompanies.has(companyName) && usedCompanies.size < COMPANIES.length);
  usedCompanies.add(companyName);
  const used = new Set<string>();
  let n = 3000 + serial * 10;
  const person = (): { personId: string; name: string } => {
    let name = "";
    do name = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    return { personId: `P-${n++}`, name };
  };

  const a1 = person();
  const a2 = person();
  const op = person();
  const admin = (p: { personId: string; name: string }, extra: Partial<Administrator> = {}): Administrator => ({
    ...p,
    appointedOn: daysAgo(400 + rng.int(2500), now),
    ...extra,
  });

  const input: InvestigationInput = {
    company: {
      name: companyName,
      cui: `RO49${String(rng.int(1_000_000)).padStart(6, "0")}`,
      registrationNumber: `J${1 + rng.int(40)}/${1000 + rng.int(8999)}/${2012 + rng.int(12)}`,
      documentDate: daysAgo(3 + rng.int(60), now),
    },
    representationMode: "individual",
    administrators: [admin(a1)],
    bankRepresentatives: [{ ...a1 }],
    accountOperators: [{ ...a1, scope: "Full operating rights" }],
    mandate: { reference: `MND-${100 + rng.int(899)}`, description: "Representation mandate", date: daysAgo(15 + rng.int(60), now) },
    request: { operation: "update_company_info", submittedBy: [a1.personId], details: "Update registered office address.", evidence: ["registry_extract"] },
  };
  const ev = (...e: EvidenceType[]) => e;

  switch (kind) {
    case "clean":
      input.request = { operation: "add_operator", submittedBy: [a1.personId], details: `Add ${op.name} as account operator.`, targetPersonId: op.personId, targetPersonName: op.name, evidence: ev("signed_mandate", "id_documents") };
      break;
    case "missing_rep":
      input.administrators = [admin(a1), admin(a2, { appointedOn: daysAgo(5 + rng.int(40), now) })];
      input.request = { operation: "update_representatives", submittedBy: [a1.personId], details: `Register newly appointed administrator ${a2.name}.`, evidence: ev("registry_extract", "appointment_decision", "id_documents") };
      break;
    case "joint_single":
    case "joint_covered":
    case "joint_both_sign":
      input.representationMode = "joint";
      input.administrators = [admin(a1, { requiredForJoint: true }), admin(a2, { requiredForJoint: true })];
      input.bankRepresentatives = [{ ...a1 }, { ...a2 }];
      input.accountOperators = [{ ...op, scope: `Payments up to ${(1 + rng.int(9)) * 10_000} RON` }];
      input.request = {
        operation: "change_authorization",
        submittedBy: kind === "joint_both_sign" ? [a1.personId, a2.personId] : [a1.personId],
        details: `Raise ${op.name}'s payment limit to ${(2 + rng.int(8)) * 50_000} RON.`,
        evidence: kind === "joint_covered" ? ev("signed_mandate", "joint_authorization") : ev("signed_mandate"),
      };
      break;
    case "terminated_at_bank": {
      const fresh = person();
      input.administrators = [admin(a1, { terminatedOn: daysAgo(10 + rng.int(80), now) }), admin(fresh, { appointedOn: daysAgo(10 + rng.int(80), now) })];
      input.request = { operation: "update_representatives", submittedBy: [fresh.personId], details: `Replace ${a1.name} with ${fresh.name}.`, evidence: ev("registry_extract", "appointment_decision", "id_documents") };
      break;
    }
    case "operator_requests":
      input.accountOperators = [{ ...a1, scope: "Full operating rights" }, { ...op, scope: "Payments up to 20000 RON" }];
      input.request = { operation: "change_authorization", submittedBy: [op.personId], details: `Raise own payment limit to ${(2 + rng.int(8)) * 50_000} RON.`, evidence: ev("signed_mandate") };
      break;
    case "stale_docs":
      input.company.documentDate = daysAgo(100 + rng.int(300), now);
      input.mandate.date = daysAgo(120 + rng.int(600), now);
      break;
    case "missing_evidence":
      input.request = { operation: "add_operator", submittedBy: [a1.personId], details: `Add ${op.name} as account operator.`, targetPersonId: op.personId, targetPersonName: op.name, evidence: ev("id_documents") };
      break;
    case "admin_not_rep":
      input.administrators = [admin(a1), admin(a2)];
      input.bankRepresentatives = [{ ...a1 }];
      input.request = { operation: "change_authorization", submittedBy: [a2.personId], details: `Change payment limits for ${op.name}.`, evidence: ev("signed_mandate") };
      break;
    case "name_typo":
      input.bankRepresentatives = [{ personId: a1.personId, name: a1.name.replace(/[aeiou]/, (v) => (v === "a" ? "e" : "a")) }];
      break;
  }
  return input;
}

/** Produces `count` cases, cycling through every scenario kind in a shuffled order for variety. */
export function generateScenarios(count: number, seed = Date.now(), now: Date = new Date()): InvestigationInput[] {
  const rng = makeRng(seed);
  const order = [...SCENARIO_KINDS].sort(() => rng.next() - 0.5);
  const usedCompanies = new Set<string>();
  return Array.from({ length: count }, (_, i) => generateCase(order[i % order.length]!, rng, now, i, usedCompanies));
}
