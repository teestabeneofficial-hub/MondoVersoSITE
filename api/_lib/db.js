/**
 * ============================================================================
 *  _lib/db.js — Accesso dati con SUPABASE (Postgres gestito)
 * ----------------------------------------------------------------------------
 *  Usa la SERVICE ROLE key (segreta, solo lato server) per leggere/scrivere
 *  nella tabella "utenti". Se le env non sono configurate (es. in locale),
 *  ricade su un utente demo così il codice non si rompe.
 *
 *  Dipendenza:  npm i @supabase/supabase-js
 *  Env:  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ============================================================================
 */
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = (URL && KEY) ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;

export async function trovaUtentePerEmail(email) {
  if (!sb) return UTENTI_DEMO.find(u => u.email === email) || null;
  const { data, error } = await sb
    .from('utenti')
    .select('id, email, nome, password_hash')
    .eq('email', email)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, email: data.email, nome: data.nome, passwordHash: data.password_hash };
}

export async function creaUtente({ email, nome, passwordHash }) {
  if (!sb) { const u = { id: 'u_' + Date.now(), email, nome, passwordHash }; UTENTI_DEMO.push(u); return u; }
  const { data, error } = await sb
    .from('utenti')
    .insert({ email, nome, password_hash: passwordHash })
    .select('id, email, nome')
    .single();
  if (error) throw error;
  return data;
}

export async function salvaTokenReset(email, token, scadenza) {
  if (!sb) return;
  await sb.from('reset_token').insert({ email, token, scadenza: new Date(scadenza).toISOString() });
}

// Fallback demo (solo se Supabase non configurato).
const UTENTI_DEMO = [
  { id: 'demo-1', email: 'demo@mondoverso.com', nome: 'Demo',
    passwordHash: '$2a$10$8K1p/a0dL2LkqvQOuQe1iuy9b1u8m2k0z6S6m1c2d3e4f5g6h7i8K' }
];
