// Deterministic, rule-based investigation engine. No AI / LLM involved.
import {
  EVIDENCE_LABELS,
  OPERATION_LABELS,
  type DemoPolicy,
  type EvidenceType,
  type InvestigationInput,
  type InvestigationResult,
  type OperationType,
  type RuleResult,
  type RuleStatus,
} from "./types";

export const DEFAULT_POLICY: DemoPolicy = { maxDocumentAgeDays: 90 };

/** Synthetic workflow: evidence required per operation (demo only). */
export const REQUIRED_EVIDENCE: Record<OperationType, EvidenceType[]> = {
  update_representatives: ["registry_extract", "appointment_decision", "id_documents"],
  add_operator: ["signed_mandate", "id_documents"],
  change_authorization: ["signed_mandate"],
  update_company_info: ["registry_extract"],
};

const DAY = 86_400_000;

function daysBetween(fromIso: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(fromIso + "T00:00:00Z").getTime()) / DAY);
}

function isActive(terminatedOn: string | undefined, now: Date) {
  return !terminatedOn || new Date(terminatedOn + "T00:00:00Z").getTime() > now.getTime();
}

function worst(statuses: RuleStatus[]): RuleStatus {
  if (statuses.includes("CONFLICT")) return "CONFLICT";
  if (statuses.includes("REVIEW")) return "REVIEW";
  return "PASS";
}

export function personName(input: InvestigationInput, id: string): string {
  const all = [
    ...input.administrators,
    ...input.bankRepresentatives,
    ...input.accountOperators,
  ];
  const p = all.find((x) => x.personId === id);
  if (p) return p.name;
  if (input.request.targetPersonId === id && input.request.targetPersonName)
    return input.request.targetPersonName;
  return id;
}

const label = (n: string, id: string) => `${n} (${id})`;

/** Rules needing joint participation: is the joint requirement satisfied? */
export function jointRequirement(input: InvestigationInput, now: Date) {
  const active = input.administrators.filter((a) => isActive(a.terminatedOn, now));
  const flagged = active.filter((a) => a.requiredForJoint);
  const group = flagged.length > 0 ? flagged : active;
  const missing = group.filter((a) => !input.request.submittedBy.includes(a.personId));
  const hasEvidence = input.request.evidence.includes("joint_authorization");
  return { group, missing, hasEvidence, satisfied: missing.length === 0 || hasEvidence };
}

function rule1(input: InvestigationInput, now: Date): RuleResult {
  const active = input.administrators.filter((a) => isActive(a.terminatedOn, now));
  const terminated = input.administrators.filter((a) => !isActive(a.terminatedOn, now));
  const bankIds = new Set(input.bankRepresentatives.map((b) => b.personId));
  const activeIds = new Set(active.map((a) => a.personId));
  const missing = active.filter((a) => !bankIds.has(a.personId));
  const outdated = input.bankRepresentatives.filter((b) =>
    terminated.some((t) => t.personId === b.personId),
  );
  const additional = input.bankRepresentatives.filter(
    (b) => !activeIds.has(b.personId) && !outdated.includes(b),
  );
  const nameMismatch = input.bankRepresentatives.filter((b) => {
    const a = active.find((x) => x.personId === b.personId);
    return a && a.name.trim().toLowerCase() !== b.name.trim().toLowerCase();
  });

  const supporting = [
    `Official active administrators: ${active.map((a) => label(a.name, a.personId)).join(", ") || "none"}`,
    `Bank-registered legal representatives: ${input.bankRepresentatives.map((b) => label(b.name, b.personId)).join(", ") || "none"}`,
  ];
  const parts: string[] = [];
  const missingItems: string[] = [];
  let status: RuleStatus = "PASS";

  if (missing.length) {
    status = worst([status, "REVIEW"]);
    parts.push(
      `${missing.map((m) => label(m.name, m.personId)).join(", ")} ${missing.length > 1 ? "are" : "is"} listed as administrator in the official records but missing from the bank's representative records.`,
    );
    missing.forEach((m) => missingItems.push(`Appointment documentation for ${m.name}`));
  }
  if (outdated.length) {
    status = "CONFLICT";
    parts.push(
      `${outdated.map((o) => label(o.name, o.personId)).join(", ")} is still registered at the bank although the official mandate was terminated (${outdated.map((o) => terminated.find((t) => t.personId === o.personId)?.terminatedOn).join(", ")}).`,
    );
  }
  if (additional.length) {
    status = "CONFLICT";
    parts.push(
      `${additional.map((o) => label(o.name, o.personId)).join(", ")} is registered at the bank but does not appear among the official administrators.`,
    );
  }
  if (nameMismatch.length) {
    status = worst([status, "REVIEW"]);
    parts.push(
      `Name differs between records for ID ${nameMismatch.map((n) => n.personId).join(", ")}.`,
    );
  }

  return {
    id: "R1",
    title: "Representative matching",
    status,
    explanation: parts.length
      ? parts.join(" ")
      : `All ${active.length} active administrator(s) match the bank's registered legal representatives by person ID.`,
    supportingData: supporting,
    nextStep:
      status === "PASS"
        ? "No action required."
        : outdated.length || additional.length
          ? "Suspend reliance on outdated representatives and request current registry documentation."
          : "Verify the administrator update and register the missing representative(s) after document review.",
    missingItems,
  };
}

function rule2(input: InvestigationInput, now: Date): RuleResult {
  const submitters = input.request.submittedBy.map((id) => label(personName(input, id), id));
  const active = input.administrators.filter((a) => isActive(a.terminatedOn, now));
  const supporting = [
    `Official representation mode: ${input.representationMode}`,
    `Request submitted by: ${submitters.join(", ") || "nobody specified"}`,
  ];

  if (input.request.submittedBy.length === 0) {
    return {
      id: "R2",
      title: "Representation mode",
      status: "REVIEW",
      explanation: "The request does not identify who submitted it.",
      supportingData: supporting,
      nextStep: "Identify the submitting person(s) before processing.",
      missingItems: ["Identification of the request submitter"],
    };
  }

  if (input.representationMode === "individual") {
    const anyAdmin = input.request.submittedBy.some((id) => active.some((a) => a.personId === id));
    const anyOperator = input.request.submittedBy.some((id) =>
      input.accountOperators.some((o) => o.personId === id),
    );
    if (anyAdmin || anyOperator) {
      return {
        id: "R2",
        title: "Representation mode",
        status: "PASS",
        explanation: `Individual representation applies; ${submitters.join(", ")} may act alone in their recorded capacity.`,
        supportingData: supporting,
        nextStep: "No action required.",
        missingItems: [],
      };
    }
    return {
      id: "R2",
      title: "Representation mode",
      status: "CONFLICT",
      explanation: `None of the submitters (${submitters.join(", ")}) is an active administrator or authorized operator.`,
      supportingData: supporting,
      nextStep: "Reject or hold the request until a valid representative submits it.",
      missingItems: ["Request from a valid company representative"],
    };
  }

  const j = jointRequirement(input, now);
  supporting.push(
    `Configured joint group (must act together): ${j.group.map((g) => label(g.name, g.personId)).join(", ")}`,
    `Joint authorization evidence provided: ${j.hasEvidence ? "yes" : "no"}`,
  );
  if (j.missing.length === 0) {
    return {
      id: "R2",
      title: "Representation mode",
      status: "PASS",
      explanation: "Joint representation applies and all required administrators participate in the request.",
      supportingData: supporting,
      nextStep: "No action required.",
      missingItems: [],
    };
  }
  if (j.hasEvidence) {
    return {
      id: "R2",
      title: "Representation mode",
      status: "PASS",
      explanation: `Joint representation applies. ${j.missing.map((m) => m.name).join(", ")} did not submit the request, but joint authorization evidence was provided.`,
      supportingData: supporting,
      nextStep: "Verify signatures on the joint authorization document.",
      missingItems: [],
    };
  }
  return {
    id: "R2",
    title: "Representation mode",
    status: "REVIEW",
    explanation: `Joint representation requires ${j.group.map((g) => g.name).join(" and ")} to act together. The request was submitted by ${submitters.join(", ")} only, and no joint authorization evidence was provided.`,
    supportingData: supporting,
    nextStep: "Hold for manual review and request a joint authorization signed by all required administrators.",
    missingItems: [], // reported once by R6 (missing evidence)
  };
}

function rule3(input: InvestigationInput, now: Date): RuleResult {
  const op = input.request.operation;
  const active = input.administrators.filter((a) => isActive(a.terminatedOn, now));
  const rows = input.request.submittedBy.map((id) => {
    const admin = active.some((a) => a.personId === id);
    const rep = input.bankRepresentatives.some((b) => b.personId === id);
    const operator = input.accountOperators.some((o) => o.personId === id);
    return { id, name: personName(input, id), admin, rep, operator };
  });
  const supporting = rows.map(
    (r) =>
      `${label(r.name, r.id)} — legal administrator: ${r.admin ? "yes" : "no"}; bank-registered representative: ${r.rep ? "yes" : "no"}; account operator: ${r.operator ? "yes" : "no"}`,
  );
  const adminsNotOperators = active.filter(
    (a) => !input.accountOperators.some((o) => o.personId === a.personId),
  );
  if (adminsNotOperators.length)
    supporting.push(
      `Administrators without account operating rights: ${adminsNotOperators.map((a) => a.name).join(", ")}`,
    );

  if (rows.length === 0)
    return {
      id: "R3",
      title: "Bank authorization",
      status: "REVIEW",
      explanation: "No submitter identified, so bank authorization cannot be assessed.",
      supportingData: supporting,
      nextStep: "Identify the submitter.",
      missingItems: [],
    };

  // Changing representatives or company data relies on official registry capacity.
  if (op === "update_representatives" || op === "update_company_info") {
    const ok = rows.some((r) => r.admin);
    return {
      id: "R3",
      title: "Bank authorization",
      status: ok ? "PASS" : "CONFLICT",
      explanation: ok
        ? `${rows.filter((r) => r.admin).map((r) => r.name).join(", ")} holds legal administrator capacity in the official records, which is the relevant capacity for this request type. Account operating rights are not implied.`
        : `No submitter is an active legal administrator; ${OPERATION_LABELS[op].toLowerCase()} cannot rely on operator or bank-registration status alone.`,
      supportingData: supporting,
      nextStep: ok ? "No action required." : "Request submission by an active legal administrator.",
      missingItems: ok ? [] : ["Submission by an active legal administrator"],
    };
  }

  // Account-level changes require the bank-registered legal representative capacity.
  const reps = rows.filter((r) => r.rep && r.admin);
  if (reps.length) {
    return {
      id: "R3",
      title: "Bank authorization",
      status: "PASS",
      explanation: `${reps.map((r) => r.name).join(", ")} is both an active administrator and a bank-registered legal representative, so may request account authorization changes.`,
      supportingData: supporting,
      nextStep: "No action required.",
      missingItems: [],
    };
  }
  const adminOnly = rows.filter((r) => r.admin && !r.rep);
  if (adminOnly.length) {
    return {
      id: "R3",
      title: "Bank authorization",
      status: "REVIEW",
      explanation: `${adminOnly.map((r) => r.name).join(", ")} is a legal administrator but not registered as legal representative in bank records. A legal administrator is not automatically authorized for bank account changes.`,
      supportingData: supporting,
      nextStep: "Register the administrator as legal representative before accepting account-level changes.",
      missingItems: [`Bank representative registration for ${adminOnly.map((r) => r.name).join(", ")}`],
    };
  }
  return {
    id: "R3",
    title: "Bank authorization",
    status: "CONFLICT",
    explanation: `${rows.map((r) => r.name).join(", ")} ${rows.some((r) => r.operator) ? "is an account operator only; operators cannot change account authorizations or appoint other operators." : "has no recognized capacity in official or bank records."}`,
    supportingData: supporting,
    nextStep: "Reject the request in its current form; it must come from a legal representative.",
    missingItems: ["Request from a bank-registered legal representative"],
  };
}

function rule4(input: InvestigationInput, now: Date, policy: DemoPolicy): RuleResult {
  const docs: { name: string; date?: string | undefined }[] = [
    { name: "Company registration document", date: input.company.documentDate },
  ];
  if (input.mandate.reference || input.mandate.date)
    docs.push({ name: `Mandate ${input.mandate.reference || ""}`.trim(), date: input.mandate.date });

  const supporting = [`Demo policy: documents older than ${policy.maxDocumentAgeDays} days require review (not a legal or bank requirement).`];
  const statuses: RuleStatus[] = [];
  const issues: string[] = [];
  const missingItems: string[] = [];
  for (const d of docs) {
    if (!d.date) {
      statuses.push("REVIEW");
      issues.push(`${d.name} has no date.`);
      missingItems.push(`Dated version of ${d.name.toLowerCase()}`);
      supporting.push(`${d.name}: no date`);
      continue;
    }
    const age = daysBetween(d.date, now);
    supporting.push(`${d.name}: ${d.date} (${age} days old)`);
    if (age < 0) {
      statuses.push("CONFLICT");
      issues.push(`${d.name} is dated in the future (${d.date}).`);
    } else if (age > policy.maxDocumentAgeDays) {
      statuses.push("REVIEW");
      issues.push(`${d.name} is ${age} days old, exceeding the ${policy.maxDocumentAgeDays}-day demo policy.`);
      missingItems.push(`Updated ${d.name.toLowerCase()}`);
    }
  }
  const status = worst(statuses);
  return {
    id: "R4",
    title: "Document recency",
    status,
    explanation: issues.length ? issues.join(" ") : "All dated documents are within the demo recency policy.",
    supportingData: supporting,
    nextStep: status === "PASS" ? "No action required." : "Request current documents from the customer.",
    missingItems,
  };
}

function rule5(input: InvestigationInput, now: Date, r1: RuleResult): RuleResult {
  const { request } = input;
  const op = request.operation;
  const supporting = [
    `Requested operation: ${OPERATION_LABELS[op]}`,
    `Request details: ${request.details.trim() || "none"}`,
  ];
  const issues: string[] = [];
  const statuses: RuleStatus[] = [];
  const missingItems: string[] = [];

  if (!request.details.trim()) {
    statuses.push("REVIEW");
    issues.push("The request contains no description of the requested change.");
    missingItems.push("Description of the requested change");
  }

  if (op === "update_representatives") {
    // Records already match: the requested update is satisfied, which is not a discrepancy.
    if (r1.status === "PASS")
      supporting.push("Official and bank representative records already match; no further update is needed.");
  } else if (r1.status !== "PASS") {
    statuses.push("REVIEW");
    issues.push(`Representative records are out of sync, yet the request is "${OPERATION_LABELS[op]}" rather than a representative update.`);
  }

  if (op === "add_operator") {
    if (!request.targetPersonName?.trim()) {
      statuses.push("REVIEW");
      issues.push("No person to be added as account operator is specified.");
      missingItems.push("Identification of the proposed account operator");
    } else {
      supporting.push(`Proposed operator: ${label(request.targetPersonName, request.targetPersonId || "no ID")}`);
      if (input.accountOperators.some((o) => o.personId === request.targetPersonId)) {
        statuses.push("CONFLICT");
        issues.push(`${request.targetPersonName} is already an authorized account operator.`);
      }
    }
  }

  if ((op === "change_authorization" || op === "add_operator") && !input.mandate.reference.trim()) {
    statuses.push("REVIEW");
    issues.push("No existing mandate reference is on file to compare the requested change against.");
    missingItems.push("Reference of the existing mandate");
  }
  if (input.mandate.reference) supporting.push(`Existing mandate: ${input.mandate.reference} — ${input.mandate.description || "no description"}`);

  if (input.representationMode === "joint" && op !== "update_company_info") {
    const j = jointRequirement(input, now);
    if (!j.satisfied) {
      statuses.push("REVIEW");
      issues.push("The request relies on a single signatory while the company is represented jointly.");
    }
  }

  const status = worst(statuses);
  return {
    id: "R5",
    title: "Request consistency",
    status,
    explanation: issues.length ? issues.join(" ") : "The requested operation is consistent with the supplied representation and mandate information.",
    supportingData: supporting,
    nextStep: status === "PASS" ? "No action required." : "Clarify the request with the customer before processing.",
    missingItems,
  };
}

function rule6(input: InvestigationInput, now: Date): RuleResult {
  const op = input.request.operation;
  const required = [...REQUIRED_EVIDENCE[op]];
  if (input.representationMode === "joint" && op !== "update_company_info") {
    const j = jointRequirement(input, now);
    if (j.missing.length > 0) required.push("joint_authorization");
  }
  const missing = required.filter((e) => !input.request.evidence.includes(e));
  return {
    id: "R6",
    title: "Missing evidence",
    status: missing.length ? "REVIEW" : "PASS",
    explanation: missing.length
      ? `The synthetic workflow for "${OPERATION_LABELS[op]}" requires evidence that was not provided: ${missing.map((m) => EVIDENCE_LABELS[m]).join("; ")}.`
      : `All evidence required by the synthetic workflow for "${OPERATION_LABELS[op]}" was provided.`,
    supportingData: [
      `Required: ${required.map((r) => EVIDENCE_LABELS[r]).join("; ")}`,
      `Provided: ${input.request.evidence.map((r) => EVIDENCE_LABELS[r]).join("; ") || "none"}`,
    ],
    nextStep: missing.length ? "Request the missing documents from the customer." : "No action required.",
    missingItems: missing.map((m) => EVIDENCE_LABELS[m]),
  };
}

export function runInvestigation(
  input: InvestigationInput,
  now: Date = new Date(),
  policy: DemoPolicy = DEFAULT_POLICY,
): InvestigationResult {
  const r1 = rule1(input, now);
  const rules = [r1, rule2(input, now), rule3(input, now), rule4(input, now, policy), rule5(input, now, r1), rule6(input, now)];
  return {
    ranAt: now.toISOString(),
    overall: worst(rules.map((r) => r.status)),
    rules,
    discrepancyCount: rules.filter((r) => r.status !== "PASS").length,
    policy,
  };
}

export function allMissingItems(result: InvestigationResult): string[] {
  return Array.from(new Set(result.rules.flatMap((r) => r.missingItems)));
}
