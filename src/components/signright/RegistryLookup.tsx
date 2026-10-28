import { useState } from "react";
import { Landmark, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Btn } from "@/components/signright/ui";
import { normId } from "@/lib/signright/engine";
import { lookupAvailable, lookupCompany } from "@/lib/signright/lookup";
import type { InvestigationInput } from "@/lib/signright/types";

interface Props {
  input: InvestigationInput;
  onChange: (patch: Partial<InvestigationInput>) => void;
}

/** Looks the CUI up in the public ANAF registry. The result is shown to the employee and checked by rule R7. */
export function RegistryLookup({ input, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const check = input.registryCheck;

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      onChange({ registryCheck: await lookupCompany(input.company.cui) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setBusy(false);
    }
  };

  const differs = !!check?.found && ((!!check.name && normId(check.name) !== normId(input.company.name)) || (!!check.registrationNumber && normId(check.registrationNumber) !== normId(input.company.registrationNumber)));

  const useRegistryValues = () => {
    if (!check?.found) return;
    onChange({
      company: {
        ...input.company,
        name: check.name ?? input.company.name,
        registrationNumber: check.registrationNumber ?? input.company.registrationNumber,
      },
    });
  };

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Btn disabled={busy || !lookupAvailable() || input.company.cui.replace(/\D/g, "").length < 2} onClick={run}>
          <Landmark className="h-4 w-4" /> {busy ? "Checking…" : "Verify CUI in public registry (ANAF)"}
        </Btn>
        <span className="text-xs text-muted-foreground">
          {lookupAvailable()
            ? "Optional. Compares the company data with ANAF's public records (name, number, status). Adds rule R7."
            : "Public registry lookup is not configured."}
        </span>
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-conflict/30 bg-conflict-soft p-3 text-sm text-conflict">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {check && !check.found && (
        <div className="mt-3 rounded-md border border-review/40 bg-review-soft p-3 text-sm text-review">
          CUI {check.cui} was not found in the ANAF public registry. This is expected for the synthetic demo companies.
        </div>
      )}
      {check?.found && (
        <div className="mt-3 space-y-1 rounded-md bg-muted p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 text-pass" /> Found in the ANAF public registry
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
            <div>Name: <span className="text-foreground">{check.name ?? "—"}</span></div>
            <div>Registration no.: <span className="text-foreground">{check.registrationNumber ?? "—"}</span></div>
            <div className="sm:col-span-2">Address: <span className="text-foreground">{check.address ?? "—"}</span></div>
            <div>Status: <span className="text-foreground">{check.registrationStatus ?? "—"}</span></div>
            <div>Declared inactive: <span className="text-foreground">{check.inactive === undefined ? "—" : check.inactive ? "yes" : "no"}</span></div>
          </dl>
          {differs && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-xs text-review">The entered name or number differs from the registry.</span>
              <Btn variant="ghost" className="text-xs" onClick={useRegistryValues}>Use registry values</Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
