/**
 * /api/auth/google/callback — Riceve il "code" da Google, ottiene il profilo
 * e crea la sessione MondoVerso (stesso cookie di /api/login).
 * Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_URI, SESSION_SECRET
 */
import { creaToken, cookieSessione } from '../../login.js';

export default async function handler(req, res) {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Codice mancante.');

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.OAUTH_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    }).then(r => r.json());

    if (!tokenRes.access_token) return res.status(401).send('Autenticazione Google fallita.');

    const profilo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenRes.access_token }
    }).then(r => r.json());

    // TODO: crea/recupera l'utente nel tuo DB usando profilo.email
    const utente = { id: 'g_' + profilo.id, email: profilo.email, nome: profilo.name || profilo.email };
    const token = creaToken(utente, process.env.SESSION_SECRET || 'CAMBIA_QUESTO_SECRET');
    res.setHeader('Set-Cookie', cookieSessione(token, 60 * 60 * 24 * 7));
    res.writeHead(302, { Location: '/' }); // torna alla home, ora loggato
    res.end();
  } catch (err) {
    res.status(500).send('Errore OAuth: ' + (err && err.message || err));
  }
}
