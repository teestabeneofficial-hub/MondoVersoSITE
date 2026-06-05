/**
 * Invio email transazionali (stub).
 * Esempio con Resend (npm i resend) — sostituisci con il tuo provider.
 */
export async function inviaEmail({ a, oggetto, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'MondoVerso <no-reply@example.com>';
  if (!key) { console.log('[email][DEV] a:', a, 'oggetto:', oggetto); return { ok: true, dev: true }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: a, subject: oggetto, html })
  });
  return { ok: r.ok };
}
