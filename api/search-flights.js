/**
 * ============================================================================
 *  /api/search-flights.js — Prezzi VOLI REALI (Aviasales / Travelpayouts)
 * ----------------------------------------------------------------------------
 *  Riceve origine + date weekend + lista destinazioni e restituisce, per ogni
 *  destinazione, il prezzo A/R più basso reale (dati di mercato in cache).
 *
 *  Endpoint: Aviasales Data API v3 "prices_for_dates".
 *  Doc: https://support.travelpayouts.com/hc/en-us/articles/...
 *  Env: TRAVELPAYOUTS_TOKEN (obbligatorio), TRAVELPAYOUTS_MARKER
 *
 *  NB: sono prezzi reali ma "in cache" (raccolti dalle ricerche degli utenti):
 *  possono mancare per alcune rotte/date. Il frontend, se manca il prezzo,
 *  tiene il valore dimostrativo, così la pagina resta sempre popolata.
 * ============================================================================
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const origine = (body.partenza && body.partenza.iata) || body.origine;
    const date = body.date || {};
    const destinazioni = Array.isArray(body.destinazioni) ? body.destinazioni.slice(0, 12) : [];

    const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
    if (!origine) return res.status(400).json({ ok: false, errore: 'Origine (IATA) mancante.' });
    if (!TOKEN)   return res.status(200).json({ ok: true, fonte: 'mock', prezzi: {} });
    if (!destinazioni.length) return res.status(200).json({ ok: true, fonte: 'vuoto', prezzi: {} });

    // Una chiamata per destinazione, in parallelo (con piccolo timeout di sicurezza).
    const richieste = destinazioni.map((dest) => prezzoRotta(origine, dest, date, TOKEN));
    const risultati = await Promise.all(richieste);

    // Costruisce la mappa { IATA: { price, airline, transfers, departure_at, return_at } }
    const prezzi = {};
    risultati.forEach((r) => { if (r) prezzi[r.iata] = r; });

    return res.status(200).json({ ok: true, fonte: 'travelpayouts', origine, prezzi });
  } catch (err) {
    return res.status(200).json({ ok: false, errore: String(err && err.message || err), prezzi: {} });
  }
}

// Prezzo A/R più basso per una singola rotta nel weekend richiesto
async function prezzoRotta(origine, dest, date, token) {
  try {
    const params = new URLSearchParams({
      origin: origine,
      destination: dest,
      currency: 'eur',
      one_way: 'false',
      sorting: 'price',
      limit: '1',
      token
    });
    if (date.andata)  params.set('departure_at', date.andata);   // YYYY-MM-DD
    if (date.ritorno) params.set('return_at', date.ritorno);

    const url = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates?' + params.toString();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { headers: { 'X-Access-Token': token }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const dati = await r.json();
    const v = dati && Array.isArray(dati.data) ? dati.data[0] : null;
    if (!v) return null;
    return {
      iata: dest,
      price: Math.round(v.price),
      airline: v.airline || null,
      transfers: v.transfers || 0,
      departure_at: v.departure_at || null,
      return_at: v.return_at || null,
      link: v.link || null   // percorso /search/... del volo più economico
    };
  } catch { return null; }
}
