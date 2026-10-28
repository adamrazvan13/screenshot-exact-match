// Lookup of a company's BANK RECORDS (registered representatives, account operators, mandate).
// In production this would be an internal bank API; in the demo it is the `bank_clients` table.
import { fetchBankClientRow, remoteEnabled } from "./remote";
import type { AccountOperator, BankRepresentative, InvestigationInput, Mandate } from "./types";

export interface BankClient {
  cui: string;
  companyName: string;
  representatives: BankRepresentative[];
  operators: AccountOperator[];
  mandate: Mandate | null;
}

/** "RO 40000001" / "ro40000001" / "40000001" -> "40000001" */
export function cuiKey(cui: string): string {
  return cui.toUpperCase().replace(/^\s*RO/, "").replace(/\D/g, "");
}

export const bankLookupAvailable = remoteEnabled;

/** Returns the bank's records for this CUI, or null when the company is not a client of the bank. */
export async function fetchBankClient(cui: string): Promise<BankClient | null> {
  const key = cuiKey(cui);
  if (key.length < 2 || key.length > 10) throw new Error("Enter a valid CUI first (2-10 digits).");
  const row = await fetchBankClientRow(key);
  if (!row) return null;
  return {
    cui: row.cui,
    companyName: row.company_name,
    representatives: row.representatives ?? [],
    operators: row.operators ?? [],
    mandate: row.mandate ?? null,
  };
}

/** Fills ONLY the bank side of the form. Registry data and the request itself are left untouched. */
export function applyBankRecords(current: InvestigationInput, client: BankClient | null): InvestigationInput {
  return {
    ...current,
    bankRepresentatives: client ? client.representatives : [],
    accountOperators: client ? client.operators : [],
    mandate: client?.mandate ?? { reference: "", description: "", date: "" },
  };
}
