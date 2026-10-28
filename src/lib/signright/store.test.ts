import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseRecord } from "./types";

/** Minimal in-memory stand-in for the Supabase REST API (PostgREST). */
function fakeDatabase(initial: CaseRecord[] = [], opts: { fail?: boolean } = {}) {
  const rows = new Map<string, { data: CaseRecord; updated_at: string }>(
    initial.map((c) => [c.id, { data: c, updated_at: c.updatedAt ?? new Date(0).toISOString() }]),
  );
  const audit: { case_id: string; text: string }[] = [];
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.split("/rest/v1/")[1]}`);
    if (opts.fail) throw new TypeError("network down");
    const ok = (body: unknown = []) => new Response(JSON.stringify(body), { status: 200 });
    if (url.includes("/rest/v1/cases") && method === "GET") return ok([...rows.values()]);
    if (url.includes("/rest/v1/cases") && method === "POST") {
      for (const r of JSON.parse(String(init?.body)) as { id: string; data: CaseRecord; updated_at: string }[])
        rows.set(r.id, { data: r.data, updated_at: r.updated_at });
      return ok();
    }
    if (url.includes("/rest/v1/cases") && method === "DELETE") {
      rows.clear();
      return ok();
    }
    if (url.includes("/rest/v1/audit_events") && method === "POST") {
      audit.push(...(JSON.parse(String(init?.body)) as { case_id: string; text: string }[]));
      return ok();
    }
    return new Response("not found", { status: 404 });
  });
  return { rows, audit, calls, fetchMock };
}

async function loadStore() {
  vi.resetModules();
  return import("./store");
}

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("case store with database", () => {
  it("uploads the demo cases to an empty database on first load", async () => {
    const db = fakeDatabase();
    vi.stubGlobal("fetch", db.fetchMock);
    const store = await loadStore();
    await store.pullRemote();
    expect(db.rows.size).toBe(5);
    expect(db.audit.length).toBeGreaterThanOrEqual(5);
  });

  it("a newer database copy replaces the local one (work survives on another device)", async () => {
    const seedStore = await loadStore();
    const local = seedStore.getCase("CASE-DEMO-B")!;
    const newer: CaseRecord = { ...local, notes: "written on another device", updatedAt: new Date(Date.now() + 60_000).toISOString() };
    const db = fakeDatabase([newer]);
    vi.stubGlobal("fetch", db.fetchMock);
    const store = await loadStore();
    await store.pullRemote();
    expect(store.getCase("CASE-DEMO-B")!.notes).toBe("written on another device");
  });

  it("saves edits to the database and appends audit events", async () => {
    const db = fakeDatabase();
    vi.stubGlobal("fetch", db.fetchMock);
    const store = await loadStore();
    await store.pullRemote();
    const before = db.audit.length;
    store.updateCase("CASE-DEMO-A", { reviewed: true }, "Case marked as reviewed.");
    await vi.waitFor(() => expect(db.rows.get("CASE-DEMO-A")!.data.reviewed).toBe(true));
    await vi.waitFor(() => expect(db.audit.length).toBe(before + 1));
    expect(db.audit.at(-1)!.text).toBe("Case marked as reviewed.");
  });

  it("keeps working locally when the database is unreachable", async () => {
    const db = fakeDatabase([], { fail: true });
    vi.stubGlobal("fetch", db.fetchMock);
    const store = await loadStore();
    await store.pullRemote();
    expect(store.getCase("CASE-DEMO-A")).toBeDefined();
    store.updateCase("CASE-DEMO-A", { notes: "offline note" });
    expect(store.getCase("CASE-DEMO-A")!.notes).toBe("offline note");
    expect(JSON.parse(localStorage.getItem("signright.cases.v1")!).find((c: CaseRecord) => c.id === "CASE-DEMO-A").notes).toBe("offline note");
  });

  it("does nothing remote when no database is configured", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const db = fakeDatabase();
    vi.stubGlobal("fetch", db.fetchMock);
    const store = await loadStore();
    await store.pullRemote();
    store.updateCase("CASE-DEMO-A", { notes: "x" });
    expect(db.fetchMock).not.toHaveBeenCalled();
  });
});
