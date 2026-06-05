/**
 * /api/me — Restituisce l'utente loggato leggendo il cookie di sessione.
 * Usalo dal frontend all'avvio per sapere se l'utente è già autenticato.
 */
import { verificaToken } from './login.js';

export default async function handler(req, res) {
  const SECRET = process.env.SESSION_SECRET || 'CAMBIA_QUESTO_SECRET';
  const cookie = (req.headers.cookie || '').split(';').map(s => s.trim());
  const sess = cookie.find(c => c.startsWith('mv_session='));
  const token = sess ? sess.split('=')[1] : null;
  const dati = verificaToken(token, SECRET);
  if (!dati) return res.status(200).json({ ok: true, loggato: false });
  return res.status(200).json({ ok: true, loggato: true, utente: { id: dati.id, email: dati.email, nome: dati.nome } });
}
