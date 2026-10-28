import { useState } from "react";
import { FileText, Sparkles, AlertTriangle } from "lucide-react";
import { Btn, Card } from "@/components/signright/ui";
import { aiConfig, applyExtraction, extractFromText } from "@/lib/signright/extract";
import type { DemoKey } from "@/lib/signright/fixtures";
import { SAMPLE_DOCS } from "@/lib/signright/sampleDocs";
import type { InvestigationInput } from "@/lib/signright/types";

interface Props {
  current: InvestigationInput;
  onApply: (input: InvestigationInput, label: string) => void;
}

/** Reads a registry document with AI and fills the OFFICIAL side of the form. The employee must review it. */
export function DocumentExtractor({ current, onApply }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string[]; warnings: string[] } | null>(null);
  const configured = aiConfig() !== null;

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const extraction = await extractFromText(text);
      const applied = applyExtraction(current, extraction);
      onApply(applied.input, "Data extracted from document by AI — review before running");
      setResult({ summary: applied.summary, warnings: applied.warnings });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed. Enter the data manually.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Read a registry document with AI"
      actions={<span className="text-xs text-muted-foreground">AI reads the document · fixed rules decide</span>}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Paste the text of a company registry certificate (synthetic). The AI proposes the company data, representation mode and
        administrators; you review and correct them below. The AI never decides the outcome.
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        {(Object.keys(SAMPLE_DOCS) as DemoKey[]).map((k) => (
          <Btn key={k} variant="ghost" className="text-xs" onClick={() => setText(SAMPLE_DOCS[k].text)}>
            <FileText className="h-3.5 w-3.5" /> Sample {k}: {SAMPLE_DOCS[k].title}
          </Btn>
        ))}
      </div>
      <textarea
        className="field min-h-40 font-mono text-xs leading-relaxed"
        placeholder="Paste the certificate text here…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn variant="primary" disabled={busy || text.trim().length < 20 || !configured} onClick={run}>
          <Sparkles className="h-4 w-4" /> {busy ? "Reading document…" : "Extract with AI"}
        </Btn>
        {!configured && (
          <span className="text-xs text-muted-foreground">AI extraction is not configured yet — enter the data manually below.</span>
        )}
      </div>
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-conflict/30 bg-conflict-soft p-3 text-sm text-conflict">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="mt-3 space-y-2 rounded-md bg-muted p-3 text-sm">
          <div className="font-medium">Extracted — please verify against the document:</div>
          <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
            {result.summary.map((s) => <li key={s}>{s}</li>)}
          </ul>
          {result.warnings.length > 0 && (
            <>
              <div className="pt-1 font-medium text-review">Needs your attention:</div>
              <ul className="list-disc space-y-0.5 pl-5 text-review">
                {result.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
