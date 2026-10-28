import { useEffect, useRef, useState } from "react";
import { FileText, Sparkles, AlertTriangle, Upload } from "lucide-react";
import { Btn, Card } from "@/components/signright/ui";
import { aiConfig, applyExtraction, extractFromText } from "@/lib/signright/extract";
import { readPdf } from "@/lib/signright/pdf";
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
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfName, setPdfName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const upload = async (file: File) => {
    const request = new AbortController();
    controller.current = request;
    setPdfBusy(true);
    setError("");
    setResult(null);
    setPdfName("");
    try {
      const recognized = await readPdf(file, request.signal);
      if (request.signal.aborted) return;
      setText(recognized);
      setPdfName(file.name);
    } catch (e) {
      if (!request.signal.aborted)
        setError(e instanceof Error ? e.message : "PDF reading failed. Try again.");
    } finally {
      if (controller.current === request) {
        controller.current = null;
        setPdfBusy(false);
      }
    }
  };
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
      actions={
        <span className="text-xs text-muted-foreground">
          AI reads the document · fixed rules decide
        </span>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Upload a company registry PDF (digital or scanned), or paste its text (synthetic). The AI
        proposes the company data, representation mode and administrators; you review and correct
        them below. The AI never decides the outcome.
      </p>
      <div className="mb-4 space-y-2 rounded-md border border-input p-3">
        <span className="block text-sm font-medium">Upload PDF · OCR for scanned pages</span>
        <label
          htmlFor="registry-pdf"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type === "application/pdf") void upload(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          } ${busy || pdfBusy || !configured ? "pointer-events-none opacity-50" : ""}`}
        >
          <Upload className={`h-6 w-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-sm font-medium">
            {pdfBusy ? "Reading PDF…" : "Choose a PDF file or drag it here"}
          </span>
          <span className="text-xs text-muted-foreground">PDF up to 10 MB · scanned pages are read with OCR</span>
        </label>
        <input
          id="registry-pdf"
          type="file"
          accept=".pdf,application/pdf"
          disabled={busy || pdfBusy || !configured}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Maximum 10 MB. PDF is sent to the AI provider for recognition; the original file is not
          saved. Review the text below, then select Extract with AI.
        </p>
        {pdfBusy && (
          <div role="status" className="text-sm">
            Reading PDF and recognizing scanned text…
            <Btn
              type="button"
              className="ml-2"
              onClick={() => {
                controller.current?.abort();
              }}
            >
              Cancel
            </Btn>
          </div>
        )}
        {pdfName && (
          <p role="status" className="text-sm">
            Read: {pdfName}. Verify names, identifiers and dates against the original.
          </p>
        )}
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {(Object.keys(SAMPLE_DOCS) as DemoKey[]).map((k) => (
          <Btn
            key={k}
            disabled={busy || pdfBusy}
            variant="ghost"
            className="text-xs"
            onClick={() => setText(SAMPLE_DOCS[k].text)}
          >
            <FileText className="h-3.5 w-3.5" /> Sample {k}: {SAMPLE_DOCS[k].title}
          </Btn>
        ))}
      </div>
      <textarea
        className="field min-h-40 font-mono text-xs leading-relaxed"
        placeholder="Paste the certificate text here…"
        aria-label="Document text to review"
        disabled={busy || pdfBusy}
        maxLength={60_000}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn
          variant="primary"
          disabled={busy || pdfBusy || text.trim().length < 20 || !configured}
          onClick={run}
        >
          <Sparkles className="h-4 w-4" /> {busy ? "Reading document…" : "Extract with AI"}
        </Btn>
        {!configured && (
          <span className="text-xs text-muted-foreground">
            AI extraction is not configured yet — enter the data manually below.
          </span>
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
            {result.summary.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <>
              <div className="pt-1 font-medium text-review">Needs your attention:</div>
              <ul className="list-disc space-y-0.5 pl-5 text-review">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
