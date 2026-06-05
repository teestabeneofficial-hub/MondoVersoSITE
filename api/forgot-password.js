/**
 * /api/forgot-password — Avvia il reset password.
 * Rispondiamo sempre OK per non rivelare se l'email è registrata.
 */
import crypto from 'crypto';
import { rateLimit } from './_lib/rate-limit.js';
import { trovaUtentePerEmail, salvaTokenReset } from './_lib/db.js';
import { inviaEmail } from './_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (!await rateLimit('reset:' + ip, 5, 600)) return res.status(429).json({ ok: false, errore: 'Troppe richieste.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = (body.email || '').trim().toLowerCase();
  if (!email.includes('@')) return res.status(400).json({ ok: false, errore: 'Email non valida.' });

  const utente = await trovaUtentePerEmail(email);
  if (utente) {
    const token = crypto.randomBytes(32).toString('hex');
    const scadenza = Date.now() + 1000 * 60 * 30; // 30 minuti
    await salvaTokenReset(email, token, scadenza);
    const base = process.env.OAUTH_REDIRECT_URI ? new URL(process.env.OAUTH_REDIRECT_URI).origin : '';
    const link = `${base}/reset?token=${token}`;
    await inviaEmail({ a: email, oggetto: 'Reimposta la tua password MondoVerso',
      html: `<p>Per reimpostare la password clicca qui (valido 30 min):</p><p><a href="${link}">${link}</a></p>` });
  }
  return res.status(200).json({ ok: true, messaggio: 'Se l\'email è registrata, riceverai un link.' });
}
