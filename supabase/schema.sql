-- SignRight AI — database schema (synthetic demo data only).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

create table if not exists public.cases (
  id            text primary key,
  company_name  text        not null default '',
  overall       text        not null default 'PASS',
  data          jsonb       not null,           -- full case: input data, rule results, message, notes, log
  updated_at    timestamptz not null default now()
);

-- Append-only audit trail: who/what/when for every action on a case.
create table if not exists public.audit_events (
  id       bigint generated always as identity primary key,
  case_id  text        not null,
  at       timestamptz not null default now(),
  text     text        not null
);
create index if not exists audit_events_case_idx on public.audit_events (case_id, at);

alter table public.cases        enable row level security;
alter table public.audit_events enable row level security;

-- DEMO ACCESS MODEL: the app has no login yet, so the public (anon) key may read/write
-- cases. This is acceptable ONLY because all data is synthetic. A production version would
-- authenticate employees and restrict these policies per user/role.
grant usage on schema public to anon;
grant select, insert, update, delete on public.cases to anon;
grant select, insert on public.audit_events to anon;   -- no update/delete: the audit log is append-only

drop policy if exists "demo cases all"  on public.cases;
create policy "demo cases all" on public.cases
  for all to anon using (true) with check (true);

drop policy if exists "demo audit read"   on public.audit_events;
drop policy if exists "demo audit insert" on public.audit_events;
create policy "demo audit read"   on public.audit_events for select to anon using (true);
create policy "demo audit insert" on public.audit_events for insert to anon with check (true);
