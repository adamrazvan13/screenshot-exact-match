import { afterEach, describe, expect, it, vi } from "vitest";
import { readPdf, MAX_PDF_BYTES } from "./pdf";
vi.mock("./config", () => ({
  supabaseConfig: () => ({ url: "https://demo.supabase.co", key: "test" }),
}));
const pdf = (content = "%PDF-1.7\nexample") =>
  ({
    name: "registry.pdf",
    size: content.length,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer,
  }) as File;
afterEach(() => vi.unstubAllGlobals());
describe("PDF upload", () => {
  it("rejects oversized and disguised files before contacting the service", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(readPdf({ ...pdf(), size: MAX_PDF_BYTES + 1 } as File)).rejects.toThrow("10 MB");
    await expect(readPdf(pdf("not a pdf"))).rejects.toThrow("valid PDF");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("sends base64 to the configured edge function and returns recognized text", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ text: "[Page 1] Societate română" }) });
    vi.stubGlobal("fetch", fetch);
    expect(await readPdf(pdf())).toContain("română");
    const [url, request] = fetch.mock.calls[0]!;
    expect(url).toBe("https://demo.supabase.co/functions/v1/extract-document");
    expect(atob(JSON.parse(request.body).pdf)).toBe("%PDF-1.7\nexample");
  });
  it("reports backend errors and refuses empty OCR results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Encrypted PDF" }) }),
    );
    await expect(readPdf(pdf())).rejects.toThrow("Encrypted PDF");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: " " }) }),
    );
    await expect(readPdf(pdf())).rejects.toThrow("No usable text");
  });
});
