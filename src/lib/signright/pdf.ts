import { aiConfig, ExtractionUnavailableError } from "./extract";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

/** The PDF is sent transiently to the existing AI service, never saved in localStorage. */
export async function readPdf(file: File, signal?: AbortSignal): Promise<string> {
  if (!/\.pdf$/i.test(file.name)) throw new Error("Choose a PDF file.");
  if (!file.size || file.size > MAX_PDF_BYTES)
    throw new Error("PDF must be between 1 byte and 10 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-")
    throw new Error("This file is not a valid PDF.");
  const cfg = aiConfig();
  if (!cfg) throw new ExtractionUnavailableError("Configure the AI service before reading PDFs.");
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  const response = await fetch(`${cfg.url}/functions/v1/extract-document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
    },
    body: JSON.stringify({ pdf: btoa(binary) }),
    ...(signal ? { signal } : {}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `PDF reading failed (HTTP ${response.status}).`);
  if (typeof body?.text !== "string" || !body.text.trim() || body.text.length > 60_000) {
    throw new Error("No usable text was returned. Try a clearer or shorter PDF.");
  }
  return body.text;
}
