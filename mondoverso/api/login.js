/**
 * ============================================================================
 *  /api/login.js — Accesso email/password (Vercel Serverless)
 * ----------------------------------------------------------------------------
 *  • POST   /api/login   { email, password }  -> verifica e imposta cookie sessione
 *  • DELETE /api/login                         -> logout (cancella cookie)
 *
 *  Sicurezza inclusa: validazione, hashing password con bcrypt, rate limiting
 *  per IP, cookie httpOnly firmato. Da collegare: il tuo DATABASE utenti.
 *
 *  Dipendenze:  npm i bcryptjs
 *  Env:  SESSION_SECRET, (consigliato) UPSTASH_REDIS_REST_URL/TOKEN per il rate limit
 * ============================================================================
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { rateLimit } from './_lib/rate-limit.js';
import { trovaUtentePerEmail } from './_lib/db.js';

export default async function handler(req, res) {
  const SECRET = process.env.SESSION_SECRET || 'CAMBIA_QUESTO_SECRET';

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieSessione('', 0));
    return res.status(200).json({ ok: true, messaggio: 'Disconnesso.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });
  }

  // --- Rate limiting (max 8 tentativi / 5 min per IP) ---
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'sconosciuto';
  const consentito = await rateLimit('login:' + ip, 8, 300);
  if (!consentito) {
    return res.status(429).json({ ok: false, errore: 'Troppi tentativi. Riprova tra qualche minuto.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    if (!email || !email.includes('@')) return res.status(400).json({ ok: false, errore: 'Email non valida.' });
    if (!password || password.length < 6) return res.status(400).json({ ok: false, errore: 'Password troppo corta.' });

    // --- Recupero utente dal DB ---
    const utente = await trovaUtentePerEmail(email);
    // Per non rivelare se l'email esiste, rispondiamo sempre con lo stesso errore generico.
    if (!utente) return res.status(401).json({ ok: false, errore: 'Credenziali non valide.' });

    const valido = await bcrypt.compare(password, utente.passwordHash);
    if (!valido) return res.status(401).json({ ok: false, errore: 'Credenziali non valide.' });

    const pubblico = { id: utente.id, email: utente.email, nome: utente.nome };
    const token = creaToken(pubblico, SECRET);
    res.setHeader('Set-Cookie', cookieSessione(token, 60 * 60 * 24 * 7));
    return res.status(200).json({ ok: true, utente: pubblico });

  } catch (err) {
    return res.status(500).json({ ok: false, errore: 'Errore interno.', dettaglio: String(err && err.message || err) });
  }
}

/* -------------------------- Utility condivise -------------------------- */
export function cookieSessione(valore, maxAge) {
  return ['mv_session=' + valore, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Secure', 'Max-Age=' + maxAge].join('; ');
}
export function creaToken(payload, secret) {
  const dati = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const firma = crypto.createHmac('sha256', secret).update(dati).digest('base64url');
  return dati + '.' + firma;
}
export function verificaToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [dati, firma] = token.split('.');
  const atteso = crypto.createHmac('sha256', secret).update(dati).digest('base64url');
  if (firma !== atteso) return null;
  try { return JSON.parse(Buffer.from(dati, 'base64url').toString()); } catch { return null; }
}
