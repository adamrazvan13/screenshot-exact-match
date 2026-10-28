import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, FileDown, CheckCircle2, BadgeCheck, RotateCcw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/signright/AppShell";
import { BankUpdatePanel } from "@/components/signright/BankUpdatePanel";
import { CasePicker } from "@/components/signright/CasePicker";
import { Btn, Card, StatusBadge, fmtDate } from "@/components/signright/ui";
import { allMissingItems, personName } from "@/lib/signright/engine";
import { buildCustomerMessage } from "@/lib/signright/message";
import { updateCase, useCases } from "@/lib/signright/store";
import { EVIDENCE_LABELS, OPERATION_LABELS } from "@/lib/signright/types";

export const Route = createFileRoute("/resolution")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Resolution Center — SignRight AI" },
      { name: "description", content: "Resolution report, customer message drafting, notes and case activity log." },
      { property: "og:title", content: "Resolution Center — SignRight AI" },
      { property: "og:description", content: "Resolution report, customer message drafting, notes and case activity log." },
    ],
  }),
  component: Resolution,
});

function Resolution() {
  const { id } = Route.useSearch();
  const cases = useCases();
  const c = cases.find((x) => x.id === id);
  const [msg, setMsg] = useState("");
  const [notes, setNotes] = useState("");
  useEffect(() => { if (c) { setMsg(c.messageDraft); setNotes(c.notes); } }, [c?.id, c?.messageDraft, c?.notes]);

  if (!c)
    return (
      <div>
        <PageHeader title="Resolution Center" subtitle="Choose a case to prepare its resolution." />
        <CasePicker to="/resolution" />
      </div>
    );
  const { input, result } = c;
  const issues = result.rules.filter((r) => r.status !== "PASS");
  const missing = allMissingItems(result);
  const steps = Array.from(new Set(issues.map((r) => r.nextStep)));

  const saveMsg = () => {
    if (msg !== c.messageDraft) updateCase(c.id, { messageDraft: msg, messageEdited: true, messageApproved: false }, "Customer message edited.");
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Resolution Center"
        subtitle={`${input.company.name} · case ${c.id}`}
        actions={
          <>
            <Link to="/investigation" search={{ id: c.id }}><Btn variant="ghost"><ArrowLeft className="h-4 w-4" /> Investigation</Btn></Link>
            <Btn onClick={() => { updateCase(c.id, {}, "Report exported as PDF."); setTimeout(() => window.print(), 50); }}><FileDown className="h-4 w-4" /> Export report as PDF</Btn>
            <Btn
              variant={c.reviewed ? "outline" : "accent"}
              onClick={() => { updateCase(c.id, { reviewed: !c.reviewed }, c.reviewed ? "Review status reopened." : "Case marked as reviewed."); toast.success(c.reviewed ? "Case reopened" : "Case marked as reviewed"); }}
            >
              <BadgeCheck className="h-4 w-4" /> {c.reviewed ? "Reopen case" : "Mark case as reviewed"}
            </Btn>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <BankUpdatePanel c={c} />
          <Card title="Resolution report" actions={<StatusBadge status={result.overall} />}>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row k="Company" v={input.company.name} />
              <Row k="CUI / Reg. no." v={`${input.company.cui} · ${input.company.registrationNumber}`} />
              <Row k="Representation" v={input.representationMode === "joint" ? "Jointly" : "Individually"} />
              <Row k="Requested operation" v={OPERATION_LABELS[input.request.operation]} />
              <Row k="Submitted by" v={input.request.submittedBy.map((p) => personName(input, p)).join(", ") || "—"} />
              <Row k="Investigation run" v={fmtDate(result.ranAt)} />
            </dl>

            <h3 className="mt-5 mb-2 text-sm font-semibold">Verification results</h3>
            <div className="divide-y rounded-md border">
              {result.rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span><span className="mr-2 font-mono text-xs text-muted-foreground">{r.id}</span>{r.title}</span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>

            <h3 className="mt-5 mb-2 text-sm font-semibold">Identified discrepancies</h3>
            {issues.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">{issues.map((r) => <li key={r.id}><b>{r.title}:</b> {r.explanation}</li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">No discrepancies detected in the available data.</p>}

            <h3 className="mt-5 mb-2 text-sm font-semibold">Evidence used</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {c.sourceDocuments && c.sourceDocuments.length > 0 && <li>Documents read by AI: {c.sourceDocuments.map((d) => d.name).join(", ")}</li>}
              <li>Company registration document dated {input.company.documentDate || "—"}</li>
              {input.mandate.reference && <li>Mandate {input.mandate.reference} ({input.mandate.date || "undated"})</li>}
              {input.request.evidence.map((e) => <li key={e}>{EVIDENCE_LABELS[e]}</li>)}
              {input.registryCheck && <li>Public registry ({input.registryCheck.source}) lookup for CUI {input.registryCheck.cui}, {input.registryCheck.found ? "company found" : "not found"}</li>}
              <li>{input.administrators.length} official administrator record(s), {input.bankRepresentatives.length} bank representative(s), {input.accountOperators.length} account operator(s)</li>
            </ul>

            <h3 className="mt-5 mb-2 text-sm font-semibold">Missing information</h3>
            {missing.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{missing.map((m) => <li key={m}>{m}</li>)}</ul> : <p className="text-sm text-muted-foreground">None.</p>}

            <h3 className="mt-5 mb-2 text-sm font-semibold">Recommended resolution steps</h3>
            {steps.length ? <ol className="list-decimal space-y-1 pl-5 text-sm">{steps.map((s) => <li key={s}>{s}</li>)}</ol> : <p className="text-sm">Proceed with standard processing.</p>}
          </Card>

          <Card
            title="Customer message"
            actions={<span className="text-xs text-muted-foreground">{c.messageApproved ? "Approved" : c.messageEdited ? "Edited draft" : "Generated from findings"}</span>}
          >
            <textarea className="field min-h-72 font-mono text-xs leading-relaxed" value={msg} onChange={(e) => setMsg(e.target.value)} onBlur={saveMsg} />
            <div className="no-print mt-3 flex flex-wrap gap-2">
              <Btn onClick={async () => { await navigator.clipboard.writeText(msg); updateCase(c.id, {}, "Customer message copied."); toast.success("Message copied"); }}><Copy className="h-4 w-4" /> Copy message</Btn>
              <Btn variant="primary" disabled={c.messageApproved && msg === c.messageDraft} onClick={() => { updateCase(c.id, { messageDraft: msg, messageApproved: true, messageEdited: msg !== buildCustomerMessage(input, result) }, "Customer message draft approved."); toast.success("Draft approved (not sent)"); }}>
                <CheckCircle2 className="h-4 w-4" /> {c.messageApproved && msg === c.messageDraft ? "Draft approved" : "Approve draft"}
              </Btn>
              <Btn variant="ghost" onClick={() => { const m = buildCustomerMessage(input, result); setMsg(m); updateCase(c.id, { messageDraft: m, messageEdited: false, messageApproved: false }, "Customer message regenerated from findings."); }}><RotateCcw className="h-4 w-4" /> Regenerate</Btn>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Messages are never sent from this prototype.</p>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Employee notes">
            <textarea className="field min-h-32" placeholder="Internal notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Btn className="no-print mt-2" disabled={notes === c.notes} onClick={() => { updateCase(c.id, { notes }, "Employee notes updated."); toast.success("Notes saved"); }}>Save notes</Btn>
          </Card>
          <Card title="Activity log">
            <ol className="space-y-3 border-l pl-4">
              {[...c.log].reverse().map((l, i) => (
                <li key={i} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                  <div>{l.text}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(l.at)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
