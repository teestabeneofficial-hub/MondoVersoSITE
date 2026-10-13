-- =====================================================================
--  MondoVERSO: tabelle e regole del sito
--  Come si usa: Supabase > SQL Editor > New query > incolla tutto > Run.
--  Si può rieseguire senza problemi: non cancella i dati.
-- =====================================================================

-- Chi è amministratore (tu): l'ultimo blocco di questo file ti aggiunge
create table if not exists public.amministratori (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text
);
alter table public.amministratori enable row level security;
drop policy if exists "admin vede gli admin" on public.amministratori;
create policy "admin vede gli admin" on public.amministratori for select using (user_id = auth.uid());

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.amministratori where user_id = auth.uid())
$$;

-- Offerte verificate dal radar
create table if not exists public.offerte (
  id text primary key,
  origine text not null, origine_nome text,
  destinazione text not null, citta text not null, citta_slug text not null, paese text,
  formula text default 'ven', andata date not null, ritorno date not null, notti int,
  ora_andata text, arrivo_andata text, ora_ritorno text, arrivo_ritorno text,
  compagnia text, volo text,
  prezzo_volo numeric, hotel text, prezzo_hotel numeric, tassa numeric, totale numeric, completo boolean default false,
  affare text, prezzo_abituale numeric,
  link_volo text, link_hotel text, link_esperienze text, foto text,
  stasera boolean default false, posizione int default 0,
  pubblicata_il timestamptz default now()
);
alter table public.offerte enable row level security;
drop policy if exists "offerte visibili a tutti" on public.offerte;
create policy "offerte visibili a tutti" on public.offerte for select using (true);
drop policy if exists "offerte gestite dall'admin" on public.offerte;
create policy "offerte gestite dall'admin" on public.offerte for all using (public.is_admin()) with check (public.is_admin());

-- Pagine città
create table if not exists public.citta (
  slug text primary key, nome text not null, paese text, intro text, foto text,
  luoghi jsonb default '[]'::jsonb, consigli jsonb default '[]'::jsonb,
  aggiornata_il timestamptz default now()
);
alter table public.citta enable row level security;
drop policy if exists "citta visibili a tutti" on public.citta;
create policy "citta visibili a tutti" on public.citta for select using (true);
drop policy if exists "citta gestite dall'admin" on public.citta;
create policy "citta gestite dall'admin" on public.citta for all using (public.is_admin()) with check (public.is_admin());

-- Racconti dei viaggiatori: si vedono solo dopo la tua approvazione
create table if not exists public.racconti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users(id) on delete set null,
  autore text not null, citta_slug text not null, citta text,
  titolo text not null, testo text not null, speso numeric, quando text, consigli text,
  foto text[] default '{}',
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'pubblicato', 'rifiutato')),
  creato_il timestamptz default now()
);
alter table public.racconti enable row level security;
drop policy if exists "racconti pubblicati visibili" on public.racconti;
create policy "racconti pubblicati visibili" on public.racconti for select
  using (stato = 'pubblicato' or user_id = auth.uid() or public.is_admin());
drop policy if exists "chi è registrato racconta" on public.racconti;
create policy "chi è registrato racconta" on public.racconti for insert to authenticated
  with check ((user_id = auth.uid() and stato = 'in_attesa') or public.is_admin());
drop policy if exists "admin modera i racconti" on public.racconti;
create policy "admin modera i racconti" on public.racconti for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin cancella i racconti" on public.racconti;
create policy "admin cancella i racconti" on public.racconti for delete using (public.is_admin() or user_id = auth.uid());

-- Richieste di guida (il modulo del sito)
create table if not exists public.richieste_guida (
  id uuid primary key default gen_random_uuid(),
  nome text, whatsapp text, email text, codice text,
  citta text, date text, partenza text, formula text, con_chi text, persone text, hotel text,
  ritmo text, sveglia text, interessi text[], da_vedere text, da_evitare text, serata text,
  budget text, alimentazione text, mobilita text, esperienze text[], occasione text,
  consenso boolean not null default false, gestita boolean default false,
  creata_il timestamptz default now()
);
alter table public.richieste_guida enable row level security;
drop policy if exists "chiunque chiede la guida" on public.richieste_guida;
create policy "chiunque chiede la guida" on public.richieste_guida for insert to anon, authenticated with check (consenso = true and gestita = false);
drop policy if exists "admin gestisce le richieste" on public.richieste_guida;
create policy "admin gestisce le richieste" on public.richieste_guida for all using (public.is_admin()) with check (public.is_admin());

-- Iscrizioni agli avvisi di prezzo
create table if not exists public.avvisi (
  id uuid primary key default gen_random_uuid(),
  nome text, email text, whatsapp text, partenza text, citta text, budget numeric,
  consenso boolean not null default false, importato boolean default false,
  creato_il timestamptz default now()
);
alter table public.avvisi enable row level security;
drop policy if exists "chiunque si iscrive agli avvisi" on public.avvisi;
create policy "chiunque si iscrive agli avvisi" on public.avvisi for insert to anon, authenticated with check (consenso = true and importato = false);
drop policy if exists "admin gestisce gli avvisi" on public.avvisi;
create policy "admin gestisce gli avvisi" on public.avvisi for all using (public.is_admin()) with check (public.is_admin());

-- Città visitate (la mappa del mondo, già usata dal sito)
create table if not exists public.citta_visitate (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  citta text not null, paese text, cc text, lat double precision, lng double precision,
  primary key (user_id, citta)
);
alter table public.citta_visitate enable row level security;
drop policy if exists "ognuno vede le sue citta" on public.citta_visitate;
create policy "ognuno vede le sue citta" on public.citta_visitate for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Foto dei racconti
insert into storage.buckets (id, name, public) values ('racconti', 'racconti', true) on conflict (id) do nothing;
drop policy if exists "foto dei racconti pubbliche" on storage.objects;
create policy "foto dei racconti pubbliche" on storage.objects for select using (bucket_id = 'racconti');
drop policy if exists "carichi le tue foto" on storage.objects;
create policy "carichi le tue foto" on storage.objects for insert to authenticated
  with check (bucket_id = 'racconti' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "admin gestisce le foto" on storage.objects;
create policy "admin gestisce le foto" on storage.objects for delete using (bucket_id = 'racconti' and public.is_admin());

-- =====================================================================
--  ULTIMO PASSO: diventa amministratore.
--  1. Registrati sul sito (pagina Accedi) con la tua email.
--  2. Sostituisci qui sotto LA_TUA_EMAIL e premi di nuovo Run.
-- =====================================================================
insert into public.amministratori (user_id, email)
select id, email from auth.users where email = 'LA_TUA_EMAIL'
on conflict (user_id) do nothing;
