// Thin REST client for the Supabase database (PostgREST). No extra dependencies.
import { supabaseConfig, type SupabaseConfig } from "./config";
import type { ActivityEntry, CaseRecord } from "./types";

export const remoteEnabled = () => supabaseConfig() !== null;

function need(): SupabaseConfig {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Database is not configured");
  return cfg;
}

async function call(path: string, init: RequestInit & { prefer?: string } = {}): Promise<Response> {
  const cfg = need();
  const { prefer, ...rest } = init;
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
  });
  if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return res;
}

interface CaseRow {
  data: CaseRecord;
  updated_at: string;
}

export async function fetchRemoteCases(): Promise<CaseRecord[]> {
  const rows = (await (await call("cases?select=data,updated_at&order=updated_at.desc")).json()) as CaseRow[];
  return rows.map((r) => ({ ...r.data, updatedAt: r.updated_at }));
}

export async function upsertRemoteCases(cases: CaseRecord[]): Promise<void> {
  if (cases.length === 0) return;
  const rows = cases.map((c) => ({
    id: c.id,
    company_name: c.input.company.name,
    overall: c.result.overall,
    data: c,
    updated_at: c.updatedAt ?? new Date().toISOString(),
  }));
  await call("cases?on_conflict=id", { method: "POST", body: JSON.stringify(rows), prefer: "resolution=merge-duplicates,return=minimal" });
}

export async function deleteAllRemoteCases(): Promise<void> {
  await call("cases?id=not.is.null", { method: "DELETE", prefer: "return=minimal" });
}

/** The audit log is append-only: rows are inserted, never updated or deleted by the app. */
export async function insertAuditEvents(caseId: string, entries: ActivityEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const rows = entries.map((e) => ({ case_id: caseId, at: e.at, text: e.text }));
  await call("audit_events", { method: "POST", body: JSON.stringify(rows), prefer: "return=minimal" });
}
