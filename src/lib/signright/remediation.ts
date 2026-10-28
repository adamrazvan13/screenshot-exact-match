// Proposes the bank-record change that fixes a finding. The proposal is computed by fixed rules from the
// rule results; a human employee must approve it. Nothing here is decided by AI.
import { unregisteredAdministrators } from "./engine";
import type { BankRepresentative, InvestigationInput, InvestigationResult } from "./types";

export interface BankUpdateProposal {
  /** Official administrators to register as legal representatives at the bank. */
  toRegister: BankRepresentative[];
  /** True when every other rule passes, i.e. the missing representative is the only open point. */
  ready: boolean;
  /** Why the update cannot be approved yet (other rules that are not PASS). */
  blockers: string[];
}

/**
 * For a "register representatives" request: the only thing that may stay open is the administrator who is
 * in the official registry but not yet at the bank. Returns null when there is nothing to register.
 */
export function proposeBankUpdate(input: InvestigationInput, result: InvestigationResult, now: Date = new Date()): BankUpdateProposal | null {
  if (input.request.operation !== "update_representatives") return null;
  const r1 = result.rules.find((r) => r.id === "R1");
  if (!r1 || r1.status !== "REVIEW") return null;
  const missing = unregisteredAdministrators(input, now);
  if (missing.length === 0) return null;
  const blockers = result.rules.filter((r) => r.id !== "R1" && r.status !== "PASS").map((r) => `${r.id} ${r.title} (${r.status})`);
  return {
    toRegister: missing.map((a) => ({ personId: a.personId, name: a.name })),
    ready: blockers.length === 0,
    blockers,
  };
}
