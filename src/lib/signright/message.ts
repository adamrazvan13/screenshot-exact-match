import { allMissingItems } from "./engine";
import { OPERATION_LABELS, type InvestigationInput, type InvestigationResult } from "./types";

export function buildCustomerMessage(input: InvestigationInput, result: InvestigationResult): string {
  const op = OPERATION_LABELS[input.request.operation].toLowerCase();
  if (result.overall === "PASS") {
    return `Dear Customer,

We have completed the verification of the authorization records for ${input.company.name} related to your request to ${op}.

No discrepancies were detected in the information available to us, and your request will continue to be processed.

Kind regards,
Corporate Banking Operations`;
  }
  const findings = result.rules
    .filter((r) => r.status !== "PASS")
    .map((r) => `- ${r.title}: ${r.explanation}`)
    .join("\n");
  const missing = allMissingItems(result);
  return `Dear Customer,

During the verification of the authorization records for ${input.company.name} (CUI ${input.company.cui}) related to your request to ${op}, we identified the following points that require clarification:

${findings}
${missing.length ? `\nTo continue processing your request, please provide:\n${missing.map((m) => `- ${m}`).join("\n")}\n` : "\nPlease contact us so we can clarify these points.\n"}
Kind regards,
Corporate Banking Operations`;
}
