/**
 * ============================================================================
 *  /api/search-hotels.js — Hotel via TRIP.COM (Travelpayouts)
 * ----------------------------------------------------------------------------
 *  Scelta: TRIP.COM.
 *  Perché: prezzi spesso competitivi/più bassi della media, ottima copertura
 *  globale, ed è disponibile su Travelpayouts con deep link e cookie di
 *  attribuzione più lungo rispetto ad Agoda (meglio per guadagnare commissioni
 *  anche se l'utente non prenota subito).
 *
 *  Questo endpoint NON espone prezzi (niente API prezzi aperta): costruisce il
 *  LINK AFFILIATO alla ricerca hotel di Trip.com per città e date, col tuo
 *  marker. Il prezzo reale lo vede l'utente su Trip.com (massima trasparenza).
 *
 *  Da fare per l'attribuzione corretta delle commissioni:
 *    1) In Travelpayouts iscriviti al programma "Trip.com".
 *    2) Genera dal pannello un deep link Trip.com di esempio e incolla qui il
 *       TEMPLATE reale (di solito passa dal redirector tp.media col tuo marker).
 *    3) TRAVELPAYOUTS_MARKER è già impostato (729991).
 *
 *  Env: TRAVELPAYOUTS_MARKER
 * ============================================================================
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { citta, checkIn, checkOut, ospiti } = body; // citta = nome città (es. "Lisbona")
    const MARKER = process.env.TRAVELPAYOUTS_MARKER || '729991';
    if (!citta) return res.status(400).json({ ok: false, errore: 'Parametro "citta" mancante.' });

    const adulti = (ospiti && ospiti.adulti) ? ospiti.adulti : 2;

    // URL di ricerca hotel su Trip.com (destinazione testuale + date + ospiti).
    const ricerca = new URLSearchParams({
      city: citta,
      checkin: checkIn || '',
      checkout: checkOut || '',
      adult: String(adulti),
      crn: '1',
      locale: 'it-IT',
      curr: 'EUR'
    });
    const urlTrip = 'https://www.trip.com/hotels/list?' + ricerca.toString();

    // Wrapping affiliato Travelpayouts tramite redirector tp.media.
    // SOSTITUISCI trs/p/campaign_id con quelli del TUO deep link Trip.com
    // copiato dal pannello Travelpayouts (programma Trip.com).
    const urlAffiliato =
      'https://tp.media/r' +
      '?marker=' + encodeURIComponent(MARKER) +
      '&trs=INSERISCI_TRS' +
      '&p=INSERISCI_P' +
      '&u=' + encodeURIComponent(urlTrip) +
      '&campaign_id=INSERISCI_CAMPAIGN';

    return res.status(200).json({
      ok: true,
      partner: 'trip.com',
      marker: MARKER,
      citta,
      linkRicerca: urlTrip,        // funziona subito, senza attribuzione
      linkAffiliato: urlAffiliato, // da completare col deep link Travelpayouts
      nota: 'Completa trs/p/campaign_id col deep link Trip.com dal pannello Travelpayouts per le commissioni.'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, errore: 'Errore interno.', dettaglio: String(err) });
  }
}
