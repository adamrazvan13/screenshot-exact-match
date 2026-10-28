import { useRef, useState } from "react";
import { FileUp, Sparkles, AlertTriangle, X, UploadCloud, CheckCircle2 } from "lucide-react";
import { Btn, Card } from "@/components/signright/ui";
import {
  aiConfig,
  applyExtraction,
  extractFromDocuments,
  fileToBase64,
  MAX_FILES,
  MAX_PDF_BYTES,
  MAX_TOTAL_PDF_BYTES,
} from "@/lib/signright/extract";
import type { InvestigationInput, SourceDocument } from "@/lib/signright/types";

interface Props {
  current: InvestigationInput;
  /** Documents already read for this case (kept when the case is edited later). */
  processed?: SourceDocument[];
  onApply: (input: InvestigationInput, label: string, docs: SourceDocument[]) => void;
}

const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Reads registry documents with AI and fills the OFFICIAL side of the form. The employee must review it. */
export function DocumentExtractor({ current, processed = [], onApply }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ summary: string[]; warnings: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const configured = aiConfig() !== null;

  const hasText = text.trim().length >= 20;
  const canRun = !busy && configured && (files.length > 0 || hasText);

  /** Adds files to the list (nothing is sent until "Extract with AI"). */
  const addFiles = (incoming: FileList | File[] | null | undefined) => {
    if (!incoming) return;
    const problems: string[] = [];
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (!isPdf(f)) problems.push(`"${f.name}" is not a PDF.`);
      else if (f.size > MAX_PDF_BYTES) problems.push(`"${f.name}" is too large (max 4 MB per file).`);
      else if (next.some((x) => x.name === f.name && x.size === f.size)) problems.push(`"${f.name}" is already in the list.`);
      else if (next.length >= MAX_FILES) problems.push(`Maximum ${MAX_FILES} files — "${f.name}" was not added.`);
      else if (next.reduce((n, x) => n + x.size, 0) + f.size > MAX_TOTAL_PDF_BYTES) problems.push(`"${f.name}" would exceed the 12 MB total.`);
      else next.push(f);
    }
    setFiles(next);
    setError(problems.join(" "));
    setResult(null);
  };

  const removeFile = (i: number) => {
    setFiles(files.filter((_, idx) => idx !== i));
    setError("");
  };

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const pdfs = await Promise.all(files.map(fileToBase64));
      const extraction = await extractFromDocuments({ ...(hasText ? { text } : {}), ...(pdfs.length ? { pdfs } : {}) });
      const applied = applyExtraction(current, extraction);
      const what = [...files.map((f) => `"${f.name}"`), ...(hasText ? ["pasted text"] : [])].join(", ");
      const docs: SourceDocument[] = [...files.map((f) => ({ name: f.name, size: f.size })), ...(hasText ? [{ name: "Pasted text", size: text.length }] : [])];
      onApply(applied.input, `Data extracted by AI from ${what} — review before running`, docs);
      setResult({ summary: applied.summary, warnings: applied.warnings });
      setFiles([]); // they now count as "already read" for this case
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed. Enter the data manually.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Read registry documents with AI"
      actions={<span className="text-xs text-muted-foreground">AI reads the documents · fixed rules decide</span>}
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Drop one or more PDF files (scanned or digital) or paste the text of a registry certificate (synthetic). The AI proposes
        the company data, representation mode and administrators; you review and correct them below. The AI never decides the outcome.
      </p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop PDF files here or click to choose"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`mb-3 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-accent bg-accent/10" : "border-border bg-muted/40 hover:bg-muted"
        }`}
      >
        <UploadCloud className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium">Drag &amp; drop PDF files here, or click to browse</div>
        <div className="text-xs text-muted-foreground">Up to {MAX_FILES} files · 4 MB each · nothing is sent until you press “Extract with AI”</div>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {processed.length > 0 && (
        <div className="mb-3 rounded-md border border-pass/30 bg-pass-soft p-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-pass">
            <CheckCircle2 className="h-4 w-4" /> Documents already read for this case
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            {processed.map((d) => (
              <li key={d.name} className="flex items-center gap-2">
                <FileUp className="h-3.5 w-3.5 shrink-0" /> <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {d.name !== "Pasted text" && <span className="text-xs">{fmtSize(d.size)}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Their data is already in the form below — there is no need to upload them again. Add a document only to read more or to replace data.
          </p>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mb-3 divide-y rounded-md border text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 px-3 py-2">
              <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                disabled={busy}
                onClick={() => removeFile(i)}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        className="field min-h-40 font-mono text-xs leading-relaxed"
        placeholder="…or paste the certificate text here"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn variant="primary" disabled={!canRun} onClick={run}>
          <Sparkles className="h-4 w-4" />{" "}
          {busy ? "Reading documents…" : files.length > 1 ? `Extract with AI (${files.length} files)` : "Extract with AI"}
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
          <div className="font-medium">Extracted — please verify against the document(s):</div>
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
