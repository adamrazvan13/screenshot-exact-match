// Case storage. The browser (localStorage) is the instant, always-available copy; when Supabase is
// configured, every change is also saved to the database and cases are reconciled on load.
// If the database is unreachable the app keeps working locally and retries on the next load.
import { useEffect, useSyncExternalStore } from "react";
import { runInvestigation } from "./engine";
import { demoCase, extraCases } from "./fixtures";
import { buildCustomerMessage } from "./message";
import { deleteAllRemoteCases, fetchRemoteCases, insertAuditEvents, remoteEnabled, upsertRemoteCases } from "./remote";
import type { CaseRecord, InvestigationInput } from "./types";

const KEY = "signright.cases.v1";
const listeners = new Set<() => void>();
let cache: CaseRecord[] | null = null;
const EMPTY: CaseRecord[] = [];

/** local = no database configured · syncing · synced = saved in database · offline = database unreachable */
export type SyncStatus = "local" | "syncing" | "synced" | "offline";
let status: SyncStatus = "local";
let pulled = false;

const notify = () => listeners.forEach((l) => l());
function setStatus(next: SyncStatus) {
  if (status !== next) {
    status = next;
    notify();
  }
}
const ts = (c: CaseRecord) => Date.parse(c.updatedAt ?? "") || 0;

export function newCase(input: InvestigationInput, id?: string): CaseRecord {
  const result = runInvestigation(input);
  const now = new Date().toISOString();
  return {
    id: id ?? `CASE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    createdAt: now,
    input,
    result,
    reviewed: false,
    messageDraft: buildCustomerMessage(input, result),
    messageEdited: false,
    messageApproved: false,
    notes: "",
    log: [{ at: now, text: `Automated rule-based investigation run — overall ${result.overall}, ${result.discrepancyCount} discrepancy(ies).` }],
  };
}

function seed(): CaseRecord[] {
  return [
    ...(["A", "B", "C"] as const).map((k) => newCase(demoCase(k), `CASE-DEMO-${k}`)),
    ...extraCases().map((c, i) => newCase(c, `CASE-DEMO-${i + 4}`)),
  ];
}

function persistLocal(list: CaseRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

function read(): CaseRecord[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CaseRecord[]) : seed();
    if (!raw) persistLocal(cache);
  } catch {
    cache = seed();
  }
  return cache;
}

/** Save changed cases (and their new audit entries) to the database in the background. */
async function pushChanges(prev: CaseRecord[], next: CaseRecord[]) {
  if (!remoteEnabled()) return;
  const before = new Map(prev.map((c) => [c.id, c]));
  const changed = next.filter((c) => before.get(c.id) !== c);
  if (changed.length === 0) return;
  setStatus("syncing");
  try {
    await upsertRemoteCases(changed);
    for (const c of changed) {
      const oldLen = before.get(c.id)?.log.length ?? 0;
      await insertAuditEvents(c.id, c.log.slice(oldLen));
    }
    setStatus("synced");
  } catch {
    setStatus("offline");
  }
}

function write(next: CaseRecord[]) {
  const prev = cache ?? EMPTY;
  cache = next;
  persistLocal(next);
  notify();
  void pushChanges(prev, next);
}

/** On first load: merge database and local copies (newest wins); push anything only we have. */
export async function pullRemote(): Promise<void> {
  if (pulled || !remoteEnabled() || typeof window === "undefined") return;
  pulled = true;
  setStatus("syncing");
  try {
    const remote = await fetchRemoteCases();
    const local = read();
    const merged = new Map(local.map((c) => [c.id, c]));
    const toPush: CaseRecord[] = [];
    const remoteIds = new Set<string>();
    for (const r of remote) {
      remoteIds.add(r.id);
      const l = merged.get(r.id);
      if (!l || ts(r) > ts(l)) merged.set(r.id, r);
      else if (ts(l) > ts(r)) toPush.push(l);
    }
    for (const l of local) if (!remoteIds.has(l.id)) toPush.push(l);
    cache = Array.from(merged.values());
    persistLocal(cache);
    notify();
    if (toPush.length) {
      const stamped = toPush.map((c) => (c.updatedAt ? c : { ...c, updatedAt: new Date().toISOString() }));
      await upsertRemoteCases(stamped);
      for (const c of stamped) if (!remoteIds.has(c.id)) await insertAuditEvents(c.id, c.log);
    }
    setStatus("synced");
  } catch {
    setStatus("offline");
  }
}

export function useCases(): CaseRecord[] {
  useEffect(() => {
    void pullRemote();
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => (remoteEnabled() ? status : "local"),
    () => "local" as SyncStatus,
  );
}

export function getCase(id: string) {
  return read().find((c) => c.id === id);
}

export function saveCase(c: CaseRecord) {
  const list = read();
  const stamped = { ...c, updatedAt: new Date().toISOString() };
  write(list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? stamped : x)) : [stamped, ...list]);
}

export function updateCase(id: string, patch: Partial<CaseRecord>, logText?: string) {
  const c = getCase(id);
  if (!c) return;
  saveCase({
    ...c,
    ...patch,
    log: logText ? [...c.log, { at: new Date().toISOString(), text: logText }] : c.log,
  });
}

/** Re-run engine on edited input, keeping notes/log history. */
export function rerunCase(id: string, input: InvestigationInput) {
  const c = getCase(id);
  const fresh = newCase(input, id);
  if (!c) return saveCase(fresh);
  saveCase({
    ...fresh,
    createdAt: c.createdAt,
    notes: c.notes,
    log: [...c.log, ...fresh.log],
  });
}

export function resetDemoData() {
  const fresh = seed().map((c) => ({ ...c, updatedAt: new Date().toISOString() }));
  const prev = cache ?? EMPTY;
  cache = fresh;
  persistLocal(fresh);
  notify();
  if (!remoteEnabled()) return;
  setStatus("syncing");
  void (async () => {
    try {
      await deleteAllRemoteCases();
      await upsertRemoteCases(fresh);
      await insertAuditEvents("DEMO", [{ at: new Date().toISOString(), text: `Demo data reset (${prev.length} case(s) replaced).` }]);
      setStatus("synced");
    } catch {
      setStatus("offline");
    }
  })();
}
