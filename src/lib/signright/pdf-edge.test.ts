// Exercises the Deno edge function (extract-document) with a mocked network and environment: no live credentials.
// The function reads PDFs (scanned or digital) natively through Amazon Bedrock and returns the structured extraction.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(`${process.cwd()}/supabase/functions/extract-document/index.ts`, "utf8");
const EXTRACTION = { company: { name: "Firma SRL" }, representationMode: "individual", administrators: [], unknownFields: [] };
const bedrockReply = (input: unknown = EXTRACTION) => ({ ok: true, json: async () => ({ output: { message: { content: [{ toolUse: { input } }] } } }) });
const pdf = (body = "example") => btoa(`%PDF-1.7\n${body}`);

function setup(reply: unknown = bedrockReply(), env: Record<string, string> = { BEDROCK_MODEL_ID: "model-x", AWS_BEARER_TOKEN_BEDROCK: "token", BEDROCK_REGION: "us-east-1" }) {
  let handler!: (req: Request) => Promise<Response>;
  const fetch = vi.fn().mockResolvedValue(reply);
  runInNewContext(
    ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText,
    {
      Deno: { serve: (fn: typeof handler) => { handler = fn; }, env: { get: (k: string) => env[k] } },
      Response, AbortSignal, atob, fetch, console,
    },
  );
  const call = (body: unknown) => handler(new Request("https://test", { method: "POST", body: JSON.stringify(body) }));
  const sent = () => JSON.parse(fetch.mock.calls[0]![1].body);
  return { fetch, call, sent };
}

describe("PDF reading in the edge function", () => {
  it("rejects files that are not PDFs or are malformed, without calling the model", async () => {
    const { call, fetch } = setup();
    expect((await call({ pdf: btoa("wrong") })).status).toBe(400);
    expect((await call({ pdf: "@@@" })).status).toBe(400);
    expect((await call({ pdfs: [pdf(), btoa("nope")] })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the PDF to the model as a native document and returns the structured extraction", async () => {
    const { call, sent } = setup();
    const res = await call({ pdf: pdf() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(EXTRACTION);
    const doc = sent().messages[0].content[0].document;
    expect(doc.format).toBe("pdf");
    expect(doc.source.bytes).toBe(pdf());
    expect(sent().toolConfig.tools[0].toolSpec.name).toBe("record_extraction");
  });

  it("reads several PDFs, optionally with pasted text, in one request", async () => {
    const { call, sent } = setup();
    expect((await call({ pdfs: [pdf("a"), pdf("b")], text: "Pasted certificate text with enough characters" })).status).toBe(200);
    const kinds = sent().messages[0].content.map((c: { document?: { name: string }; text?: string }) => c.document?.name ?? "text");
    expect(kinds).toEqual(["registry-document-1", "registry-document-2", "text", "text"]);
  });

  it("limits the number and size of files", async () => {
    const { call, fetch } = setup();
    expect((await call({ pdfs: Array(6).fill(pdf()) })).status).toBe(400);
    const big = btoa("%PDF-1.7\n" + "A".repeat(5 * 1024 * 1024));
    expect((await call({ pdf: big })).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the plain text contract", async () => {
    const { call, sent } = setup();
    expect(await (await call({ text: "Synthetic registry document with enough text" })).json()).toEqual(EXTRACTION);
    expect(sent().messages[0].content[0].text).toContain("<document>");
    expect((await setup().call({ text: "short" })).status).toBe(400);
  });

  it("reports provider errors without leaking secrets", async () => {
    const { call } = setup({ ok: false, status: 400, text: async () => '{"message":"bad request"}' });
    const res = await call({ pdf: pdf() });
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("token");
  });
});
