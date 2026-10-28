-- SignRight AI — simulated BANK SYSTEM (synthetic data only).
-- In a real bank these records live in the bank's own systems and are fetched through an internal API.
-- Here they live in one table so the app can look a company up by CUI.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run again.

create table if not exists public.bank_clients (
  cui             text        primary key,            -- digits only, no "RO" prefix (e.g. 40000001)
  company_name    text        not null,
  representatives jsonb       not null default '[]',  -- [{ "personId": "P-1001", "name": "..." }]
  operators       jsonb       not null default '[]',  -- [{ "personId": "P-1001", "name": "...", "scope": "..." }]
  mandate         jsonb,                              -- { "reference": "...", "description": "...", "date": "yyyy-mm-dd" }
  updated_at      timestamptz not null default now()
);

alter table public.bank_clients enable row level security;

-- Read-only for the app: the public key can look clients up, but never change the bank's records.
grant usage on schema public to anon;
revoke all on public.bank_clients from anon;
grant select on public.bank_clients to anon;

drop policy if exists "demo bank read" on public.bank_clients;
create policy "demo bank read" on public.bank_clients for select to anon using (true);

insert into public.bank_clients (cui, company_name, representatives, operators, mandate) values
('40000001', 'ALFA TECH SRL',
 '[{"personId":"P-1001","name":"Andrei Popescu"}]',
 '[{"personId":"P-1001","name":"Andrei Popescu","scope":"Full operating rights"}]',
 '{"reference":"MND-A-2019-01","description":"Sole administrator mandate","date":"2026-09-28"}'),
('40000002', 'BETA CONSULTING SRL',
 '[{"personId":"P-1001","name":"Andrei Popescu"}]',
 '[{"personId":"P-1001","name":"Andrei Popescu","scope":"Full operating rights"}]',
 '{"reference":"MND-B-2020-03","description":"Representation mandate for Andrei Popescu","date":"2026-09-18"}'),
('40000003', 'GAMMA INDUSTRIES SRL',
 '[{"personId":"P-1001","name":"Andrei Popescu"},{"personId":"P-1002","name":"Maria Ionescu"}]',
 '[{"personId":"P-2001","name":"Elena Dumitru","scope":"Payments up to 50,000 RON"}]',
 '{"reference":"MND-C-2018-07","description":"Joint signature mandate","date":"2026-08-29"}'),
('40000004', 'DELTA LOGISTICS SRL',
 '[{"personId":"P-1003","name":"Ioan Georgescu"}]',
 '[{"personId":"P-1003","name":"Ioan Georgescu","scope":"Full operating rights"}]',
 '{"reference":"MND-D-2017-02","description":"Mandate for Ioan Georgescu","date":"2017-02-01"}'),
('40000005', 'EPSILON FOODS SRL',
 '[{"personId":"P-1005","name":"Cristina Marin"}]',
 '[{"personId":"P-1005","name":"Cristina Marin","scope":"Full operating rights"}]',
 '{"reference":"MND-E-2021-01","description":"Sole administrator mandate","date":"2026-10-16"}')
on conflict (cui) do update set
  company_name = excluded.company_name,
  representatives = excluded.representatives,
  operators = excluded.operators,
  mandate = excluded.mandate,
  updated_at = now();
