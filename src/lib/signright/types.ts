// Typed data models for SignRight AI. All data is synthetic.

export type RepresentationMode = "individual" | "joint";

export type OperationType =
  | "update_representatives"
  | "add_operator"
  | "change_authorization"
  | "update_company_info";

export type EvidenceType =
  | "registry_extract"
  | "appointment_decision"
  | "id_documents"
  | "signed_mandate"
  | "joint_authorization";

export type RuleStatus = "PASS" | "REVIEW" | "CONFLICT";

export interface Company {
  name: string;
  cui: string;
  registrationNumber: string;
  documentDate: string; // ISO yyyy-mm-dd
}

/** Legal administrator as listed in the official company registry. */
export interface Administrator {
  personId: string;
  name: string;
  appointedOn?: string;
  terminatedOn?: string;
  /** Part of the group that must act together under joint representation. */
  requiredForJoint?: boolean;
}

/** Legal representative as registered in the bank's internal records. */
export interface BankRepresentative {
  personId: string;
  name: string;
}

/** Person authorized to operate the company's bank accounts. */
export interface AccountOperator {
  personId: string;
  name: string;
  scope: string;
}

export interface Mandate {
  reference: string;
  description: string;
  date?: string;
}

export interface OperationRequest {
  operation: OperationType;
  submittedBy: string[]; // person IDs
  details: string;
  targetPersonId?: string;
  targetPersonName?: string;
  evidence: EvidenceType[];
}

export interface InvestigationInput {
  company: Company;
  representationMode: RepresentationMode;
  administrators: Administrator[];
  bankRepresentatives: BankRepresentative[];
  accountOperators: AccountOperator[];
  mandate: Mandate;
  request: OperationRequest;
}

export interface RuleResult {
  id: string;
  title: string;
  status: RuleStatus;
  explanation: string;
  supportingData: string[];
  nextStep: string;
  missingItems: string[];
}

export interface InvestigationResult {
  ranAt: string;
  overall: RuleStatus;
  rules: RuleResult[];
  discrepancyCount: number;
  policy: DemoPolicy;
}

export interface DemoPolicy {
  maxDocumentAgeDays: number;
}

export interface ActivityEntry {
  at: string;
  text: string;
}

export interface CaseRecord {
  id: string;
  createdAt: string;
  input: InvestigationInput;
  result: InvestigationResult;
  reviewed: boolean;
  messageDraft: string;
  messageEdited: boolean;
  messageApproved: boolean;
  notes: string;
  log: ActivityEntry[];
}

export const OPERATION_LABELS: Record<OperationType, string> = {
  update_representatives: "Update company representatives",
  add_operator: "Add account operator",
  change_authorization: "Change account authorization",
  update_company_info: "Update company information",
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  registry_extract: "Recent trade registry extract",
  appointment_decision: "Administrator appointment decision",
  id_documents: "Identity documents of involved persons",
  signed_mandate: "Signed mandate / authorization form",
  joint_authorization: "Joint authorization signed by all required administrators",
};
