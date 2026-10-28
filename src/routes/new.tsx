import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/signright/AppShell";
import { DocumentExtractor } from "@/components/signright/DocumentExtractor";
import { Btn, Card, Field } from "@/components/signright/ui";
import { demoCase, type DemoKey } from "@/lib/signright/fixtures";
import { getCase, newCase, rerunCase, saveCase } from "@/lib/signright/store";
import {
  EVIDENCE_LABELS,
  OPERATION_LABELS,
  type EvidenceType,
  type InvestigationInput,
  type OperationType,
} from "@/lib/signright/types";

export const Route = createFileRoute("/new")({
  validateSearch: (s: Record<string, unknown>): { id?: string } => (typeof s["id"] === "string" ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "New Investigation — SignRight AI" },
      { name: "description", content: "Enter company, registry and bank authorization data to run a rule-based investigation." },
      { property: "og:title", content: "New Investigation — SignRight AI" },
      { property: "og:description", content: "Enter company, registry and bank authorization data to run a rule-based investigation." },
    ],
  }),
  component: NewInvestigation,
});

const blank = (): InvestigationInput => ({
  company: { name: "", cui: "", registrationNumber: "", documentDate: "" },
  representationMode: "individual",
  administrators: [{ personId: "P-", name: "" }],
  bankRepresentatives: [],
  accountOperators: [],
  mandate: { reference: "", description: "", date: "" },
  request: { operation: "update_representatives", submittedBy: [], details: "", evidence: [] },
});

function NewInvestigation() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [f, setF] = useState<InvestigationInput>(blank);
  const [loaded, setLoaded] = useState<string>("");

  useEffect(() => {
    if (id) {
      const c = getCase(id);
      if (c) { setF(structuredClone(c.input)); setLoaded(`Editing ${c.input.company.name}`); }
    }
  }, [id]);

  const set = (patch: Partial<InvestigationInput>) => setF((p) => ({ ...p, ...patch }));
  const load = (k: DemoKey, label: string) => { setF(demoCase(k)); setLoaded(label); toast.info(`${label} loaded — edit before running`); };

  const people = Array.from(
    new Map([...f.administrators, ...f.bankRepresentatives, ...f.accountOperators].filter((p) => p.personId && p.name).map((p) => [p.personId, p.name])),
  );

  const run = () => {
    if (!f.company.name.trim()) { toast.error("Company name is required"); return; }
    const clean: InvestigationInput = {
      ...f,
      administrators: f.administrators.filter((a) => a.name.trim()).map((a) => ({ ...a, appointedOn: a.appointedOn || undefined, terminatedOn: a.terminatedOn || undefined })),
      bankRepresentatives: f.bankRepresentatives.filter((a) => a.name.trim()),
      accountOperators: f.accountOperators.filter((a) => a.name.trim()),
      request: { ...f.request, submittedBy: f.request.submittedBy.filter((s) => people.some(([pid]) => pid === s)) },
    };
    let caseId: string = id ?? "";
    if (id && getCase(id)) rerunCase(id, clean);
    else { const c = newCase(clean); saveCase(c); caseId = c.id; }
    navigate({ to: "/investigation", search: { id: caseId } });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="New Investigation"
        subtitle={loaded || "Enter case data manually or load a synthetic demo case."}
        actions={
          <>
            <Btn onClick={() => load("A", "Case A — All Records Match")}>Load Case A — All Records Match</Btn>
            <Btn onClick={() => load("B", "Case B — New Administrator Missing")}>Load Case B — New Administrator Missing from Bank Records</Btn>
            <Btn onClick={() => load("C", "Case C — Joint Representation Conflict")}>Load Case C — Joint Representation Conflict</Btn>
          </>
        }
      />

      <DocumentExtractor current={f} onApply={(input, label) => { setF(input); setLoaded(label); toast.info(label); }} />

      <Card title="Company">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Company name"><input className="field" value={f.company.name} onChange={(e) => set({ company: { ...f.company, name: e.target.value } })} /></Field>
          <Field label="CUI"><input className="field font-mono" value={f.company.cui} onChange={(e) => set({ company: { ...f.company, cui: e.target.value } })} /></Field>
          <Field label="Registration number"><input className="field font-mono" value={f.company.registrationNumber} onChange={(e) => set({ company: { ...f.company, registrationNumber: e.target.value } })} /></Field>
          <Field label="Company document date"><input type="date" className="field" value={f.company.documentDate} onChange={(e) => set({ company: { ...f.company, documentDate: e.target.value } })} /></Field>
        </div>
      </Card>

      <Card
        title="Official company records"
        actions={<Btn variant="ghost" onClick={() => set({ administrators: [...f.administrators, { personId: "P-", name: "" }] })}><Plus className="h-4 w-4" /> Add administrator</Btn>}
      >
        <div className="mb-4 flex gap-4 text-sm">
          <span className="text-muted-foreground">Representation mode:</span>
          {(["individual", "joint"] as const).map((m) => (
            <label key={m} className="flex items-center gap-1.5 capitalize">
              <input type="radio" checked={f.representationMode === m} onChange={() => set({ representationMode: m })} className="accent-primary" /> {m === "individual" ? "Individually" : "Jointly"}
            </label>
          ))}
        </div>
        <div className="space-y-2">
          {f.administrators.map((a, i) => {
            const upd = (p: Partial<typeof a>) => set({ administrators: f.administrators.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={i} className="grid items-end gap-2 md:grid-cols-[110px_1fr_150px_150px_auto_auto]">
                <Field label="Person ID"><input className="field font-mono" value={a.personId} onChange={(e) => upd({ personId: e.target.value })} /></Field>
                <Field label="Administrator name"><input className="field" value={a.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
                <Field label="Appointed on"><input type="date" className="field" value={a.appointedOn ?? ""} onChange={(e) => upd({ appointedOn: e.target.value })} /></Field>
                <Field label="Terminated on"><input type="date" className="field" value={a.terminatedOn ?? ""} onChange={(e) => upd({ terminatedOn: e.target.value })} /></Field>
                <label className={`flex items-center gap-1.5 pb-2 text-xs ${f.representationMode === "joint" ? "" : "opacity-40"}`}>
                  <input type="checkbox" disabled={f.representationMode !== "joint"} checked={!!a.requiredForJoint} onChange={(e) => upd({ requiredForJoint: e.target.checked })} /> Must act jointly
                </label>
                <Btn variant="ghost" aria-label="Remove administrator" onClick={() => set({ administrators: f.administrators.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Btn>
              </div>
            );
          })}
        </div>
        {f.representationMode === "joint" && (
          <p className="mt-3 text-xs text-muted-foreground">Demo rule: administrators marked "Must act jointly" must all participate (or provide joint authorization). If none are marked, all active administrators are required.</p>
        )}
      </Card>

      <Card title="Bank records">
        <div className="grid gap-6 lg:grid-cols-2">
          <PersonList
            title="Registered legal representatives"
            rows={f.bankRepresentatives}
            onChange={(rows) => set({ bankRepresentatives: rows })}
            make={() => ({ personId: "P-", name: "" })}
          />
          <PersonList
            title="Authorized account operators"
            rows={f.accountOperators}
            onChange={(rows) => set({ accountOperators: rows })}
            make={() => ({ personId: "P-", name: "", scope: "" })}
            withScope
          />
        </div>
        <div className="mt-5 grid gap-4 border-t pt-4 md:grid-cols-3">
          <Field label="Existing mandate reference"><input className="field font-mono" value={f.mandate.reference} onChange={(e) => set({ mandate: { ...f.mandate, reference: e.target.value } })} /></Field>
          <Field label="Mandate description"><input className="field" value={f.mandate.description} onChange={(e) => set({ mandate: { ...f.mandate, description: e.target.value } })} /></Field>
          <Field label="Mandate date"><input type="date" className="field" value={f.mandate.date ?? ""} onChange={(e) => set({ mandate: { ...f.mandate, date: e.target.value } })} /></Field>
        </div>
      </Card>

      <Card title="Requested operation">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Operation">
            <select className="field" value={f.request.operation} onChange={(e) => set({ request: { ...f.request, operation: e.target.value as OperationType } })}>
              {Object.entries(OPERATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Request details"><input className="field" value={f.request.details} onChange={(e) => set({ request: { ...f.request, details: e.target.value } })} /></Field>
          {f.request.operation === "add_operator" && (
            <>
              <Field label="Proposed operator ID"><input className="field font-mono" value={f.request.targetPersonId ?? ""} onChange={(e) => set({ request: { ...f.request, targetPersonId: e.target.value } })} /></Field>
              <Field label="Proposed operator name"><input className="field" value={f.request.targetPersonName ?? ""} onChange={(e) => set({ request: { ...f.request, targetPersonName: e.target.value } })} /></Field>
            </>
          )}
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Request submitted by</div>
            {people.length === 0 && <p className="text-sm text-muted-foreground">Add people above first.</p>}
            {people.map(([pid, name]) => (
              <label key={pid} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={f.request.submittedBy.includes(pid)} onChange={(e) => set({ request: { ...f.request, submittedBy: e.target.checked ? [...f.request.submittedBy, pid] : f.request.submittedBy.filter((x) => x !== pid) } })} />
                {name} <span className="font-mono text-xs text-muted-foreground">{pid}</span>
              </label>
            ))}
          </div>
          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Evidence provided</div>
            {(Object.keys(EVIDENCE_LABELS) as EvidenceType[]).map((ev) => (
              <label key={ev} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" checked={f.request.evidence.includes(ev)} onChange={(e) => set({ request: { ...f.request, evidence: e.target.checked ? [...f.request.evidence, ev] : f.request.evidence.filter((x) => x !== ev) } })} />
                {EVIDENCE_LABELS[ev]}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Btn variant="accent" className="px-6 py-2.5" onClick={run}><Play className="h-4 w-4" /> Run Investigation</Btn>
      </div>
    </div>
  );
}

type Row = { personId: string; name: string; scope?: string };
function PersonList<T extends Row>({ title, rows, onChange, make, withScope }: { title: string; rows: T[]; onChange: (r: T[]) => void; make: () => T; withScope?: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <Btn variant="ghost" onClick={() => onChange([...rows, make()])}><Plus className="h-4 w-4" /> Add</Btn>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">None registered.</p>}
      <div className="space-y-2">
        {rows.map((r, i) => {
          const upd = (p: Partial<Row>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
          return (
            <div key={i} className="flex gap-2">
              <input className="field w-28 font-mono" placeholder="ID" value={r.personId} onChange={(e) => upd({ personId: e.target.value })} />
              <input className="field" placeholder="Name" value={r.name} onChange={(e) => upd({ name: e.target.value })} />
              {withScope && <input className="field" placeholder="Scope" value={r.scope ?? ""} onChange={(e) => upd({ scope: e.target.value })} />}
              <Btn variant="ghost" aria-label="Remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}
