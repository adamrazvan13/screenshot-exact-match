// Exercise the Deno handler with mocked network and environment; no live credentials.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
const source = readFileSync(
  `${process.cwd()}/supabase/functions/extract-document/index.ts`,
  "utf8",
);
function setup(
  result: unknown = {
    content: [
      { type: "tool_use", name: "record_document_text", input: { text: "[Page 1] Firma SRL" } },
    ],
  },
) {
  let handler!: (req: Request) => Promise<Response>;
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText,
    {
      Deno: {
        serve: (fn: typeof handler) => {
          handler = fn;
        },
        env: { get: () => "test" },
      },
      Response,
      AbortSignal,
      atob,
      fetch,
      console,
    },
  );
  return {
    fetch,
    call: (body: unknown) =>
      handler(new Request("https://test", { method: "POST", body: JSON.stringify(body) })),
  };
}
describe("PDF edge function", () => {
  it("validates binary signature and mutually exclusive inputs", async () => {
    const { call, fetch } = setup();
    expect((await call({ pdf: btoa("wrong") })).status).toBe(400);
    expect((await call({ pdf: btoa("%PDF-1.7"), text: "ambiguous" })).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses native PDF vision and returns the transcription", async () => {
    const { call, fetch } = setup();
    const response = await call({ pdf: btoa("%PDF-1.7") });
    expect(await response.json()).toEqual({ text: "[Page 1] Firma SRL" });
    const payload = JSON.parse(fetch.mock.calls[0]![1].body);
    expect(payload.messages[0].content[0].source.media_type).toBe("application/pdf");
    expect(payload.tool_choice.name).toBe("record_document_text");
  });
  it("rejects truncated transcription instead of presenting incomplete text", async () => {
    const { call } = setup({ stop_reason: "max_tokens", content: [] });
    expect((await call({ pdf: btoa("%PDF-1.7") })).status).toBe(413);
  });
  it("keeps the existing text extraction contract", async () => {
    const extraction = { company: { name: "Firma SRL" } };
    const { call, fetch } = setup({
      content: [{ type: "tool_use", name: "record_extraction", input: extraction }],
    });
    expect(
      await (await call({ text: "Synthetic registry document with enough text" })).json(),
    ).toEqual(extraction);
    expect(JSON.parse(fetch.mock.calls[0]![1].body).tool_choice.name).toBe("record_extraction");
  });
});
