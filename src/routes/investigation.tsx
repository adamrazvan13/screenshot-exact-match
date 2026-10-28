import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, Pencil, RefreshCw, Cpu } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/signright/AppShell";
import { CasePicker } from "@/components/signright/CasePicker";
import { Btn, Card, StatusBadge, fmtDate } from "@/components/signright/ui";
import { rerunCase, useCases } from "@/lib/signright/store";
import { OPERATION_LABELS } from "@/lib/signright/types";

export const Route = createFileRoute("/investigation")({
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
  head: () => ({
    meta: [
      { title: "Investigation — SignRight AI" },
      { name: "description", content: "Rule-by-rule verification results with explanations, evidence and next steps." },
      { property: "og:title", content: "Investigation — SignRight AI" },
      { property: "og:description", content: "Rule-by-rule verification results with explanations, evidence and next steps." },
    ],
  }),
  component: Investigation,
});

function Investigation() {
  const { id } = Route.useSearch();
  const cases = useCases();
  const c = cases.find((x) => x.id === id);
  if (!c)
    return (
      <div>
        <PageHeader title="Investigation" subtitle={cases.length && id ? "Case not found." : "Choose a case to view its investigation."} />
        <CasePicker to="/investigation" />
      </div>
    );
  const { input, result } = c;
  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title={input.company.name}
        subtitle={`${input.company.cui} · ${input.company.registrationNumber} · ${OPERATION_LABELS[input.request.operation]}`}
        actions={
          <>
            <Link to="/new" search={{ id: c.id }}><Btn><Pencil className="h-4 w-4" /> Edit data</Btn></Link>
            <Btn onClick={() => { rerunCase(c.id, input); toast.success("Investigation re-run"); }}><RefreshCw className="h-4 w-4" /> Re-run</Btn>
            <Link to="/resolution" search={{ id: c.id }}><Btn variant="accent"><ClipboardCheck className="h-4 w-4" /> Resolution Center</Btn></Link>
          </>
        }
      />
      <div className="card-surface flex flex-wrap items-center gap-6 p-5">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Overall result</div>
          <div className="mt-1 scale-125 origin-left"><StatusBadge status={result.overall} /></div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Discrepancies</div>
          <div className="font-display text-2xl font-semibold">{result.discrepancyCount}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Run at</div>
          <div className="text-sm">{fmtDate(result.ranAt)}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Cpu className="h-4 w-4" /> Automated rule-based investigation — no AI model is used in this version.
        </div>
      </div>
      {result.overall === "PASS" && (
        <div className="rounded-lg border border-pass/30 bg-pass-soft p-4 text-sm text-pass">No discrepancies detected in the available data.</div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {result.rules.map((r, i) => (
          <Card key={r.id} className="animate-fade-up" >
            <div style={{ animationDelay: `${i * 50}ms` }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold"><span className="mr-2 font-mono text-xs text-muted-foreground">{r.id}</span>{r.title}</h3>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm">{r.explanation}</p>
              <ul className="mt-3 space-y-1 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                {r.supportingData.map((d, j) => <li key={j}>• {d}</li>)}
              </ul>
              <p className="mt-3 text-sm"><span className="font-medium">Next step: </span>{r.nextStep}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
