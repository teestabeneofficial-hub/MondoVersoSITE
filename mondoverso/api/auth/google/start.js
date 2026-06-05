/**
 * /api/auth/google/start — Reindirizza l'utente al consenso Google.
 * Env: GOOGLE_CLIENT_ID, OAUTH_REDIRECT_URI
 */
export default async function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.OAUTH_REDIRECT_URI;
  if (!clientId || !redirect) return res.status(500).json({ ok: false, errore: 'Google OAuth non configurato.' });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account'
  });
  res.writeHead(302, { Location: 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString() });
  res.end();
}
