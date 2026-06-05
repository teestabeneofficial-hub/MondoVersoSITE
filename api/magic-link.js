/**
 * /api/magic-link — Accesso passwordless: invia un link monouso via email.
 */
import { rateLimit } from './_lib/rate-limit.js';
import { inviaEmail } from './_lib/email.js';
import { creaToken } from './login.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });
  const SECRET = process.env.SESSION_SECRET || 'CAMBIA_QUESTO_SECRET';
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  if (!await rateLimit('magic:' + ip, 5, 600)) return res.status(429).json({ ok: false, errore: 'Troppe richieste.' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const email = (body.email || '').trim().toLowerCase();
  if (!email.includes('@')) return res.status(400).json({ ok: false, errore: 'Email non valida.' });

  // Token monouso a breve scadenza (qui riusiamo il formato firmato).
  const token = creaToken({ email, scopo: 'magic' }, SECRET);
  const base = process.env.OAUTH_REDIRECT_URI ? new URL(process.env.OAUTH_REDIRECT_URI).origin : '';
  const link = `${base}/api/magic-link/verify?token=${token}`; // crea poi la rotta di verifica
  await inviaEmail({ a: email, oggetto: 'Il tuo link di accesso a MondoVerso',
    html: `<p>Accedi con un clic (valido pochi minuti):</p><p><a href="${link}">${link}</a></p>` });
  return res.status(200).json({ ok: true, messaggio: 'Link inviato se l\'email è valida.' });
}
