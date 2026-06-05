/**
 * ============================================================================
 *  /api/search-flights.js  —  Funzione Serverless (Vercel)
 * ----------------------------------------------------------------------------
 *  Riceve i dati di ricerca dal frontend (POST) e interroga Travelpayouts
 *  lato server, così il TOKEN segreto NON viene mai esposto al browser.
 *
 *  Deploy su Vercel:
 *    1) Metti questo file in:  /api/search-flights.js
 *    2) Dashboard Vercel > Project > Settings > Environment Variables:
 *         - TRAVELPAYOUTS_TOKEN   = il tuo token API Travelpayouts
 *         - TRAVELPAYOUTS_MARKER  = il tuo ID affiliato (marker)
 *    3) Il frontend chiama:  fetch('/api/search-flights', { method:'POST', ... })
 *
 *  Endpoint Travelpayouts usato: "Prices for dates" (Aviasales Data API v3)
 *    https://api.travelpayouts.com/aviasales/v3/prices_for_dates
 *  Doc: https://support.travelpayouts.com/hc/en-us/articles/203956163
 * ============================================================================
 */

export default async function handler(req, res) {
  // --- CORS di base (utile se chiami l'API da un dominio diverso) ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // --- Accetta solo POST ---
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, errore: 'Metodo non consentito. Usa POST.' });
  }

  try {
    // Il body può arrivare come oggetto (Vercel lo parsa) o come stringa.
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      partenza,            // { nome, iata }
      date,                // { andata: 'YYYY-MM-DD', ritorno: 'YYYY-MM-DD' }
      orari,               // { partenza: '17', ritorno: '18' }
      bagaglio,            // 'zaino' | 'trolley'
      escludiVisitate,     // bool
      destinazione         // (opzionale) IATA destinazione; se assente: "ovunque"
    } = body;

    // --- Validazione minima dell'input ---
    if (!partenza || !partenza.iata) {
      return res.status(400).json({ ok: false, errore: 'Codice IATA di partenza mancante.' });
    }

    const TOKEN  = process.env.TRAVELPAYOUTS_TOKEN;
    const MARKER = process.env.TRAVELPAYOUTS_MARKER || '';

    // Se il token non è configurato, restituiamo dati MOCK (utile in sviluppo).
    if (!TOKEN) {
      return res.status(200).json({
        ok: true,
        fonte: 'mock',
        avviso: 'TRAVELPAYOUTS_TOKEN non configurato: dati dimostrativi.',
        risultati: risultatiMock(partenza)
      });
    }

    // --- Costruzione della query verso Travelpayouts ---
    const params = new URLSearchParams({
      origin: partenza.iata,
      currency: 'eur',
      one_way: 'false',
      sorting: 'price',
      limit: '30',
      market: 'it',
      token: TOKEN
    });
    // Se l'utente ha scelto una destinazione specifica, la passiamo.
    if (destinazione) params.set('destination', destinazione);
    // Data di partenza (mese) se disponibile.
    if (date && date.andata) params.set('departure_at', date.andata);
    if (date && date.ritorno) params.set('return_at', date.ritorno);

    const url = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates?' + params.toString();

    const risposta = await fetch(url, {
      headers: { 'X-Access-Token': TOKEN, 'Accept-Encoding': 'gzip' }
    });

    if (!risposta.ok) {
      const testo = await risposta.text();
      return res.status(502).json({ ok: false, errore: 'Travelpayouts ha risposto con errore.', dettaglio: testo.slice(0, 300) });
    }

    const dati = await risposta.json();
    const voli = Array.isArray(dati.data) ? dati.data : [];

    // --- Normalizzazione + applicazione filtri lato server ---
    let risultati = voli.map((v) => normalizzaVolo(v, partenza, MARKER));

    // Filtro nicchia: partenza venerdì dopo l'orario scelto, ritorno domenica.
    if (orari && orari.partenza) {
      const minOra = parseInt(orari.partenza, 10);
      risultati = risultati.filter(r => oraDi(r.andata.partenza) >= minOra);
    }

    // (Esempio) qui potresti incrociare le città già visitate dell'utente
    // recuperandole dal DB se escludiVisitate === true.
    // if (escludiVisitate) risultati = risultati.filter(r => !cittaVisitate.includes(r.iata));

    return res.status(200).json({ ok: true, fonte: 'travelpayouts', conteggio: risultati.length, risultati });

  } catch (err) {
    return res.status(500).json({ ok: false, errore: 'Errore interno.', dettaglio: String(err && err.message || err) });
  }
}

/* -------------------------- Funzioni di supporto -------------------------- */

// Estrae l'ora (intero) da una stringa ISO o "HH:MM".
function oraDi(valore) {
  if (!valore) return 0;
  if (valore.includes('T')) return new Date(valore).getHours();
  return parseInt(String(valore).split(':')[0], 10) || 0;
}

// Trasforma un risultato Travelpayouts nel formato usato dal frontend.
function normalizzaVolo(v, partenza, marker) {
  // Link di prenotazione con il TUO marker affiliato integrato.
  const linkAffiliato =
    'https://www.aviasales.com/search/' +
    (v.origin || partenza.iata) + (v.destination || '') +
    '?marker=' + encodeURIComponent(marker);

  return {
    id: (v.origin || '') + (v.destination || '') + (v.departure_at || ''),
    iata: v.destination,
    citta: v.destination,                 // in produzione: mappa IATA -> nome città
    compagnia: v.airline || '—',
    diretto: (v.transfers || 0) === 0,
    andata:  { da: v.origin, a: v.destination, partenza: v.departure_at, durata: v.duration_to ? v.duration_to + ' min' : '' },
    ritorno: { da: v.destination, a: v.origin, partenza: v.return_at,   durata: v.duration_back ? v.duration_back + ' min' : '' },
    prezzoVolo: v.price,
    prezzoHotel: null,                    // l'hotel andrà abbinato con l'API Hotellook
    linkAffiliato
  };
}

// Dati dimostrativi (quando manca il token, es. in locale).
function risultatiMock(partenza) {
  return [
    { id: 'demo-bcn', iata: 'BCN', citta: 'Barcellona', compagnia: 'Vueling', diretto: true,
      andata: { da: partenza.iata, a: 'BCN', partenza: '21:10', durata: '1h 45m' },
      ritorno: { da: 'BCN', a: partenza.iata, partenza: '20:30', durata: '1h 45m' },
      prezzoVolo: 78, prezzoHotel: 111 },
    { id: 'demo-lis', iata: 'LIS', citta: 'Lisbona', compagnia: 'TAP Air', diretto: true,
      andata: { da: partenza.iata, a: 'LIS', partenza: '19:40', durata: '2h 45m' },
      ritorno: { da: 'LIS', a: partenza.iata, partenza: '19:10', durata: '2h 40m' },
      prezzoVolo: 96, prezzoHotel: 129 }
  ];
}
