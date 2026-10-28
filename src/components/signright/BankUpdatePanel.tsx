import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card } from "@/components/signright/ui";
import { proposeBankUpdate } from "@/lib/signright/remediation";
import { registerRepresentatives } from "@/lib/signright/store";
import type { CaseRecord } from "@/lib/signright/types";

/** Shown when the customer asked to register new administrators and the only open point is the missing bank record. */
export function BankUpdatePanel({ c }: { c: CaseRecord }) {
  const proposal = proposeBankUpdate(c.input, c.result);
  if (!proposal) return null;
  const names = proposal.toRegister.map((p) => `${p.name} (${p.personId})`).join(", ");
  return (
    <Card title="Proposed bank update" actions={<span className="text-xs text-muted-foreground">Needs employee approval</span>}>
      <p className="text-sm">
        The customer asked to register the new administrator(s). The official registry lists <b>{names}</b>, but the bank has no
        record yet. After you have reviewed the appointment documents, approve the update to register them as legal
        representative(s) at the bank.
      </p>
      {proposal.ready ? (
        <p className="mt-2 text-sm text-pass">All other checks passed, so this is the only open point.</p>
      ) : (
        <div className="mt-2 rounded-md bg-review-soft p-3 text-sm text-review">
          Cannot be approved yet. Resolve first: {proposal.blockers.join("; ")}.
        </div>
      )}
      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        <Btn
          variant="accent"
          disabled={!proposal.ready}
          onClick={() => {
            registerRepresentatives(c.id, proposal.toRegister);
            toast.success(`Bank records updated: ${names}`);
          }}
        >
          <UserPlus className="h-4 w-4" /> Approve &amp; register in bank records
        </Btn>
        <span className="text-xs text-muted-foreground">
          Demo: updates this case's bank records and re-runs the checks; the simulated bank system itself is not modified.
        </span>
      </div>
    </Card>
  );
}
