-- ============================================================================
--  MondoVerso — Schema database (Supabase / Postgres)
--  Esegui questo SQL in: Supabase > SQL Editor > New query > Run
-- ============================================================================

-- Tabella utenti (per il login email/password gestito da /api/login.js)
create table if not exists public.utenti (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  nome          text,
  password_hash text not null,
  creato_il     timestamptz not null default now()
);

-- Token per il reset password (/api/forgot-password.js)
create table if not exists public.reset_token (
  id        bigint generated always as identity primary key,
  email     text not null,
  token     text not null,
  scadenza  timestamptz not null,
  usato     boolean not null default false,
  creato_il timestamptz not null default now()
);
create index if not exists idx_reset_token_token on public.reset_token(token);

-- Città già visitate dall'utente (per il filtro "Escludi le città visitate")
create table if not exists public.citta_visitate (
  id        bigint generated always as identity primary key,
  utente_id uuid not null references public.utenti(id) on delete cascade,
  iata      text not null,
  citta     text,
  creato_il timestamptz not null default now(),
  unique (utente_id, iata)
);

-- ----------------------------------------------------------------------------
-- SICUREZZA (Row Level Security)
-- Le funzioni serverless usano la SERVICE ROLE key, che BYPASSA la RLS.
-- Abilitiamo comunque la RLS così, se un domani usi le chiavi pubbliche/anon
-- o Supabase Auth dal frontend, i dati restano protetti per default.
-- ----------------------------------------------------------------------------
alter table public.utenti          enable row level security;
alter table public.reset_token     enable row level security;
alter table public.citta_visitate  enable row level security;

-- Nessuna policy pubblica: di default tutto è negato ai client anon.
-- (Aggiungi policy mirate solo se passerai a Supabase Auth lato frontend.)
