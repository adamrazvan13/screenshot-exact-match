// AI document extraction (client side). The AI only READS a document and proposes data;
// it never decides anything. The employee reviews/corrects the result, then the fixed rules run.
import { z } from "zod";
import { supabaseConfig } from "./config";
import type { Administrator, InvestigationInput, RepresentationMode } from "./types";

const text = z.string().trim().min(1).nullable().optional().catch(null);
/** Invalid or non-ISO dates become null instead of failing the whole extraction. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .catch(null);

export const extractionSchema = z.object({
  company: z
    .object({
      name: text,
      cui: text,
      registrationNumber: text,
      documentDate: isoDate,
    })
    .default({}),
  representationMode: z.enum(["individual", "joint", "unknown"]).catch("unknown"),
  administrators: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        personId: text,
        appointedOn: isoDate,
        terminatedOn: isoDate,
        quote: text,
      }),
    )
    .default([]),
  unknownFields: z.array(z.string()).default([]),
});

export type Extraction = z.infer<typeof extractionSchema>;

export interface ApplyResult {
  input: InvestigationInput;
  /** Human-readable notes the employee must look at (missing / unknown values). */
  warnings: string[];
  summary: string[];
}

/**
 * Merge an extraction into the form. Only the OFFICIAL company side (registry document) is
 * touched: company data, representation mode and administrators. Bank records and the
 * request itself are never taken from the document. Unknown values are left as they were.
 */
export function applyExtraction(current: InvestigationInput, ex: Extraction): ApplyResult {
  const warnings: string[] = [];
  const summary: string[] = [];
  const company = { ...current.company };

  const set = <K extends keyof typeof company>(key: K, value: string | null | undefined, label: string) => {
    if (value) {
      company[key] = value as (typeof company)[K];
      summary.push(`${label}: ${value}`);
    } else {
      warnings.push(`${label} was not found in the document — fill it in manually.`);
    }
  };
  set("name", ex.company.name, "Company name");
  set("cui", ex.company.cui, "CUI");
  set("registrationNumber", ex.company.registrationNumber, "Registration number");
  set("documentDate", ex.company.documentDate, "Document date");

  let representationMode: RepresentationMode = current.representationMode;
  if (ex.representationMode === "unknown") {
    warnings.push("The representation mode (individual / joint) could not be determined — choose it manually.");
  } else {
    representationMode = ex.representationMode;
    summary.push(`Representation: ${ex.representationMode === "joint" ? "jointly" : "individually"}`);
  }

  let administrators: Administrator[] = current.administrators;
  if (ex.administrators.length === 0) {
    warnings.push("No administrators were found in the document — add them manually.");
  } else {
    administrators = ex.administrators.map((a) => {
      if (!a.personId) warnings.push(`No person ID found for ${a.name} — enter the ID so it can be matched with bank records.`);
      return {
        personId: a.personId ?? "P-",
        name: a.name,
        appointedOn: a.appointedOn ?? undefined,
        terminatedOn: a.terminatedOn ?? undefined,
        ...(representationMode === "joint" ? { requiredForJoint: true } : {}),
      };
    });
    summary.push(`Administrators: ${ex.administrators.map((a) => a.name).join(", ")}`);
  }
  for (const f of ex.unknownFields) warnings.push(`Not found in document: ${f}`);

  // A new document may change the CUI, so any earlier public-registry lookup is discarded.
  return { input: { ...current, company, representationMode, administrators, registryCheck: undefined }, warnings, summary };
}

export class ExtractionUnavailableError extends Error {}

/** Same public Supabase config as the database; AI secrets stay in the Edge Function. */
export const aiConfig = supabaseConfig;

export async function extractFromText(documentText: string, signal?: AbortSignal): Promise<Extraction> {
  const cfg = aiConfig();
  if (!cfg)
    throw new ExtractionUnavailableError(
      "AI extraction is not configured (missing Supabase URL / key). Enter the data manually.",
    );
  let res: Response;
  try {
    res = await fetch(`${cfg.url}/functions/v1/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ text: documentText }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ExtractionUnavailableError("The extraction service could not be reached. Enter the data manually.");
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new ExtractionUnavailableError(`Extraction failed: ${msg}`);
  }
  const parsed = extractionSchema.safeParse(body);
  if (!parsed.success) throw new Error("The AI response did not match the expected format. Enter the data manually.");
  return parsed.data;
}
