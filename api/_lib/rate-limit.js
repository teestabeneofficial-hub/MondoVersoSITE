/**
 * Rate limiting semplice.
 * In produzione su serverless usa Upstash Redis (gli env UPSTASH_*).
 * Il fallback in memoria funziona solo a livello di singola istanza.
 */
const memoria = new Map();

export async function rateLimit(chiave, maxRichieste, finestraSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    // INCR + EXPIRE su Upstash REST
    const incr = await fetch(`${url}/incr/${encodeURIComponent(chiave)}`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    const n = incr.result;
    if (n === 1) await fetch(`${url}/expire/${encodeURIComponent(chiave)}/${finestraSec}`, { headers: { Authorization: `Bearer ${token}` } });
    return n <= maxRichieste;
  }

  // Fallback in memoria
  const ora = Date.now();
  const rec = memoria.get(chiave) || { n: 0, reset: ora + finestraSec * 1000 };
  if (ora > rec.reset) { rec.n = 0; rec.reset = ora + finestraSec * 1000; }
  rec.n++; memoria.set(chiave, rec);
  return rec.n <= maxRichieste;
}
