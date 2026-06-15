/**
 * MondoVerso — Prezzi reali per le card "in evidenza" della home
 * ---------------------------------------------------------------------------
 * 1) Rileva l'aeroporto più vicino all'utente dal suo IP (Travelpayouts whereami)
 *    — a meno che il frontend non passi un'origine esplicita (es. la città scelta).
 * 2) Per ogni meta in evidenza chiede il volo più economico (Aviasales Data API).
 *
 * POST { destinazioni:[{iata}], date:{andata,ritorno}, origine? }
 *  -> { ok, origine:{iata,nome}|null, prezzi:{ IATA:{price,link} } }
 *
 * Usa process.env.TRAVELPAYOUTS_TOKEN (lo stesso dei voli).
 * Se manca il token o l'origine, ritorna prezzi:{} e il frontend tiene il fallback.
 */

async function rilevaOrigine(token, ipUtente){
  try {
    const u = 'https://www.travelpayouts.com/whereami?locale=it' + (ipUtente ? ('&ip=' + encodeURIComponent(ipUtente)) : '');
    const r = await fetch(u, { headers: { 'x-access-token': token, 'Accept': 'application/json' } });
    const testo = await r.text();
    // La risposta può essere JSON puro o "useriata({...})" (JSONP): estraiamo l'oggetto.
    const m = testo.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (!j || !j.iata) return null;
    return { iata: String(j.iata).toUpperCase(), nome: j.name || '' };
  } catch(e){ return null; }
}

async function prezzoVolo(token, origine, iataDest, andata, ritorno){
  try {
    const url = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates'
      + '?origin=' + origine
      + '&destination=' + iataDest
      + '&departure_at=' + andata
      + '&return_at=' + ritorno
      + '&currency=eur&sorting=price&direct=false&unique=false&limit=1&token=' + token;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    const it = j && j.data && j.data[0];
    if (!it || !it.price) return null;
    return { price: Math.round(it.price), link: it.link ? ('https://www.aviasales.com' + it.link) : null };
  } catch(e){ return null; }
}

export default async function handler(req, res){
  if (req.method !== 'POST') return res.status(405).json({ errore: 'Metodo non consentito' });

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  const { destinazioni = [], date = {}, origine } = (req.body || {});
  const andata = date.andata, ritorno = date.ritorno;

  if (!token) return res.status(200).json({ ok: false, origine: null, prezzi: {} });

  // Origine: esplicita (città scelta dall'utente) oppure rilevata dall'IP
  let org = null;
  if (origine) org = { iata: String(origine).toUpperCase(), nome: '' };
  else {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    org = await rilevaOrigine(token, ip);
  }
  if (!org || !org.iata || !andata || !ritorno) {
    return res.status(200).json({ ok: true, origine: org, prezzi: {} });
  }

  const prezzi = {};
  await Promise.all(destinazioni.slice(0, 12).map(async (d) => {
    if (!d.iata || d.iata === org.iata) return;
    const p = await prezzoVolo(token, org.iata, d.iata, andata, ritorno);
    if (p) prezzi[d.iata] = p;
  }));

  return res.status(200).json({ ok: true, origine: org, prezzi });
}
