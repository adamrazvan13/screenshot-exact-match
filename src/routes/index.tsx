import { createFileRoute, Link } from "@tanstack/react-router";
import { FilePlus2, FolderOpen, AlertTriangle, ListChecks, CheckCheck, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/signright/AppShell";
import { Btn, Card, StatusBadge, fmtDate } from "@/components/signright/ui";
import type { CaseRecord } from "@/lib/signright/types";
import { resetDemoData, useCases } from "@/lib/signright/store";
import { OPERATION_LABELS } from "@/lib/signright/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SignRight AI" },
      { name: "description", content: "Overview of corporate authorization cases, reviews and detected discrepancies." },
      { property: "og:title", content: "Dashboard — SignRight AI" },
      { property: "og:description", content: "Overview of corporate authorization cases, reviews and detected discrepancies." },
    ],
  }),
  component: Dashboard,
});

/** Time of the most recent "marked as reviewed" entry in the case's activity log. */
function reviewedAt(c: CaseRecord): string | undefined {
  return [...c.log].reverse().find((l) => l.text === "Case marked as reviewed.")?.at;
}

function Dashboard() {
  const cases = useCases();
  const stats = [
    { label: "Total company cases", value: cases.length, icon: FolderOpen },
    { label: "Cases requiring review", value: cases.filter((c) => c.result.overall !== "PASS" && !c.reviewed).length, icon: AlertTriangle },
    { label: "Detected discrepancies", value: cases.reduce((n, c) => n + c.result.discrepancyCount, 0), icon: ListChecks },
    { label: "Reviewed cases", value: cases.filter((c) => c.reviewed).length, icon: CheckCheck },
  ];
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Operations Dashboard"
        subtitle="Automated rule-based investigation · synthetic Romanian SRL data"
        actions={
          <>
            <Btn variant="ghost" onClick={() => { resetDemoData(); toast.success("Demo data reset"); }}>
              <RotateCcw className="h-4 w-4" /> Reset demo data
            </Btn>
            <Link to="/new">
              <Btn variant="accent"><FilePlus2 className="h-4 w-4" /> New Investigation</Btn>
            </Link>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-accent" />
            <s.icon className="h-5 w-5 text-muted-foreground" />
            <div className="mt-3 font-display text-3xl font-semibold">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <Card title="Company cases" className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Company</th>
              <th className="px-3 py-3 font-medium">Reg. number</th>
              <th className="px-3 py-3 font-medium">Requested operation</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Discrepancies</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b last:border-0 transition-colors hover:bg-muted/50">
                <td className="px-5 py-3">
                  <div className="font-medium">{c.input.company.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{c.input.company.cui}</div>
                </td>
                <td className="px-3 py-3 font-mono text-xs">{c.input.company.registrationNumber}</td>
                <td className="px-3 py-3">{OPERATION_LABELS[c.input.request.operation]}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.result.overall} />
                    {c.reviewed && (
                      <span className="text-xs leading-tight text-muted-foreground">
                        Reviewed
                        {reviewedAt(c) && <><br />{fmtDate(reviewedAt(c)!)}</>}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 font-mono">{c.result.discrepancyCount}</td>
                <td className="px-5 py-3 text-right">
                  <Link to="/investigation" search={{ id: c.id }}>
                    <Btn variant="primary" className="py-1.5">Investigate</Btn>
                  </Link>
                </td>
              </tr>
            ))}
            {cases.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Loading cases…</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
