// Local persistence (localStorage) for the first prototype version.
import { useSyncExternalStore } from "react";
import { runInvestigation } from "./engine";
import { demoCase, extraCases } from "./fixtures";
import { buildCustomerMessage } from "./message";
import type { CaseRecord, InvestigationInput } from "./types";

const KEY = "signright.cases.v1";
const listeners = new Set<() => void>();
let cache: CaseRecord[] | null = null;
const EMPTY: CaseRecord[] = [];

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

function read(): CaseRecord[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CaseRecord[]) : seed();
    if (!raw) localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    cache = seed();
  }
  return cache;
}

function write(next: CaseRecord[]) {
  cache = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useCases(): CaseRecord[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => EMPTY,
  );
}

export function getCase(id: string) {
  return read().find((c) => c.id === id);
}

export function saveCase(c: CaseRecord) {
  const list = read();
  write(list.some((x) => x.id === c.id) ? list.map((x) => (x.id === c.id ? c : x)) : [c, ...list]);
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
  write(seed());
}
