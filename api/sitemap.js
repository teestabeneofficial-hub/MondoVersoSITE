/**
 * MondoVERSO: mappa del sito sempre aggiornata.
 * Le pagine città arrivano da Supabase (tabella "citta"), pubblicate dal radar.
 */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xssiiwontwrddcexfyvs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_x4yu2ZdVMscmzgsN7k1f8Q_zfEyDRNg';
const SITE = 'https://www.mondoverso.com';

export default async function handler(req, res) {
  const pages = ['/', '/guida', '/racconta', '/privacy', '/cookie', '/termini', '/contatti'];
  let cities = [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/citta?select=slug,aggiornata_il`, { headers: { apikey: SUPABASE_KEY } });
    if (r.ok) cities = await r.json();
  } catch (e) { cities = []; }
  const urls = pages.map((p) => `<url><loc>${SITE}${p}</loc><changefreq>${p === '/' ? 'daily' : 'monthly'}</changefreq></url>`)
    .concat(cities.map((c) => `<url><loc>${SITE}/citta/${encodeURIComponent(c.slug)}</loc>${c.aggiornata_il ? `<lastmod>${String(c.aggiornata_il).slice(0, 10)}</lastmod>` : ''}<changefreq>daily</changefreq></url>`));
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
}
