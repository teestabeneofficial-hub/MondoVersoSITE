/**
 * MondoVerso — Prezzi hotel REALI via LiteAPI
 * ---------------------------------------------------------------------------
 * Riceve POST { destinazioni:[{iata,citta,paese,lat,lng}], date:{andata,ritorno}, adulti }
 * Per ogni destinazione chiede a LiteAPI la tariffa più economica per quelle date
 * e restituisce { ok, prezzi: { IATA|citta: { price, currency, hotelName } } }.
 *
 * La chiave resta SEGRETA lato server: Vercel > Settings > Environment Variables
 *   LITEAPI_KEY = la tua chiave LiteAPI (sandbox 'sand_...' o produzione 'prod_...')
 *
 * Se manca la chiave o le date, ritorna prezzi:{} (il frontend mostra il fallback).
 */

const BASE = 'https://api.liteapi.travel/v3.0';

// Estrae il prezzo più basso da una struttura "hotel" di LiteAPI, provando
// i vari formati possibili della risposta (retailRate / roomPrice / net...).
function prezzoMinimoDaHotel(h){
  let best = null;
  const considera = (v) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n === 'number' && !isNaN(n) && n > 0 && (best === null || n < best)) best = n;
  };
  const rates = [];
  // formato: roomTypes[].rates[]
  if (Array.isArray(h.roomTypes)) h.roomTypes.forEach(rt => Array.isArray(rt.rates) && rates.push(...rt.rates));
  // formato: rooms[] / rates[]
  if (Array.isArray(h.rooms))     h.rooms.forEach(rt => Array.isArray(rt.rates) && rates.push(...rt.rates));
  if (Array.isArray(h.rates))     rates.push(...h.rates);

  rates.forEach(rt => {
    // possibili percorsi del totale
    if (rt.retailRate){
      const t = rt.retailRate.total;
      if (Array.isArray(t) && t[0]) considera(t[0].amount);
      else if (t && t.amount != null) considera(t.amount);
      if (rt.retailRate.suggestedSellingPrice && Array.isArray(rt.retailRate.suggestedSellingPrice))
        considera(rt.retailRate.suggestedSellingPrice[0] && rt.retailRate.suggestedSellingPrice[0].amount);
    }
    if (rt.roomPrice && rt.roomPrice.price) { considera(rt.roomPrice.price.gross); considera(rt.roomPrice.price.net); }
    if (rt.price != null) considera(rt.price);
    if (rt.net != null)   considera(rt.net);
    if (rt.total != null) considera(rt.total);
  });
  return best;
}

async function tariffaPerDestinazione(dest, body, key){
  // Sceglie il metodo di localizzazione migliore disponibile
  const corpo = Object.assign({}, body);
  if (dest.iata)               corpo.iataCode = dest.iata;
  else if (dest.lat && dest.lng){ corpo.latitude = dest.lat; corpo.longitude = dest.lng; corpo.radius = 15000; }
  else if (dest.citta)         corpo.cityName = dest.citta;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(BASE + '/hotels/rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-API-Key': key },
      body: JSON.stringify(corpo),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const lista = (j && (j.data || j.hotels || j.options)) || [];
    let best = null, nome = '';
    (Array.isArray(lista) ? lista : []).forEach(h => {
      const p = prezzoMinimoDaHotel(h);
      if (p != null && (best === null || p < best)) { best = p; nome = h.hotelName || h.name || ''; }
    });
    if (best == null) return null;
    return { price: Math.round(best), currency: 'EUR', hotelName: nome };
  } catch(e){ clearTimeout(timer); return null; }
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito' });

  const key = process.env.LITEAPI_KEY;
  const { destinazioni = [], date = {}, adulti = 2 } = (req.body || {});
  const checkin = date.andata, checkout = date.ritorno;

  if (!key)              return res.status(200).json({ ok: false, prezzi: {}, motivo: 'chiave mancante' });
  if (!checkin || !checkout) return res.status(200).json({ ok: false, prezzi: {}, motivo: 'date mancanti' });

  const body = {
    checkin, checkout,
    currency: 'EUR',
    guestNationality: 'IT',
    occupancies: [{ adults: adulti }],
    maxRatesPerHotel: 1,
    limit: 25
  };

  const prezzi = {};
  await Promise.all(destinazioni.slice(0, 12).map(async (d) => {
    const t = await tariffaPerDestinazione(d, body, key);
    if (t) prezzi[d.iata || d.citta] = t;
  }));

  return res.status(200).json({ ok: true, prezzi });
}
