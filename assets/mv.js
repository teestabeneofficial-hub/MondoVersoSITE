/* MondoVERSO, sito pubblico. I dati arrivano da Supabase: li pubblica il radar dal tuo computer. */
(function () {
  'use strict';
  const MV = window.MV_CONFIG = Object.assign({
    SUPABASE_URL: 'https://xssiiwontwrddcexfyvs.supabase.co',
    SUPABASE_KEY: 'sb_publishable_x4yu2ZdVMscmzgsN7k1f8Q_zfEyDRNg',
    WHATSAPP: 'https://whatsapp.com/channel/0029Vb9e1TUEawdtD6A6ht2u',
    INSTAGRAM: '',
    EMAIL: 'andrea.lampitto@borsaviaggi.net',
    AVIASALES_MARKER: '729991',
  }, window.MV_CONFIG || {});

  /* ---------- Strumenti ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => (n == null ? '' : `${Math.round(Number(n)).toLocaleString('it-IT')} €`);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toDate = (s) => new Date(`${s}T12:00:00`);
  const fmtDay = (s) => toDate(s).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayLong = (s) => toDate(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayShort = (s) => toDate(s).toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', '').toUpperCase();
  const nightsWord = (n) => `${n} ${Number(n) === 1 ? 'notte' : 'notti'}`;
  const price = (o) => (o.completo && o.totale != null ? Number(o.totale) : Number(o.prezzo_volo));
  const priceNote = (o) => (o.completo ? 'a persona, tutto compreso' : 'a persona, solo volo');
  // prima le offerte complete (volo, hotel e tasse), poi quelle con il solo volo
  const rank = (o) => (o.completo ? 0 : 1e5) + price(o);
  const cityUrl = (slug, origin) => `/citta/${encodeURIComponent(slug)}${origin ? `?da=${encodeURIComponent(origin)}` : ''}`;
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* niente */ } } };

  /* ---------- Dati da Supabase ---------- */
  let sbClient = null;
  function sb() {
    if (!sbClient && window.supabase) sbClient = window.supabase.createClient(MV.SUPABASE_URL, MV.SUPABASE_KEY);
    return sbClient;
  }
  async function rest(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ apikey: MV.SUPABASE_KEY, 'Content-Type': 'application/json' }, opts.headers || {});
    if (sb()) { try { const { data } = await sb().auth.getSession(); if (data && data.session) headers.Authorization = 'Bearer ' + data.session.access_token; } catch (e) { /* ospite */ } }
    const r = await fetch(`${MV.SUPABASE_URL}/rest/v1/${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`${r.status} ${t.slice(0, 160)}`); }
    if (r.status === 204 || opts.method === 'POST') return null;
    return r.json();
  }
  async function loadOffers() {
    const rows = await rest(`offerte?select=*&ritorno=gte.${today()}&order=posizione.asc`).catch(() => []);
    return (rows || []).filter((o) => o.andata >= today() || o.stasera).sort((a, b) => rank(a) - rank(b));
  }
  const loadCities = () => rest('citta?select=slug,nome,paese,foto').catch(() => []);
  const loadStories = (slug, limit) => rest(`racconti?select=*&stato=eq.pubblicato${slug ? `&citta_slug=eq.${encodeURIComponent(slug)}` : ''}&order=creato_il.desc&limit=${limit || 9}`).catch(() => []);
  function cheapestPerCity(list) {
    const best = new Map();
    list.forEach((o) => { const cur = best.get(o.citta_slug); if (!cur || rank(o) < rank(cur)) best.set(o.citta_slug, o); });
    return [...best.values()].sort((a, b) => rank(a) - rank(b));
  }
  function origins(list) {
    const m = new Map();
    list.forEach((o) => { if (!m.has(o.origine)) m.set(o.origine, o.origine_nome || o.origine); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'it'));
  }

  /* ---------- Testata e piede ---------- */
  function chrome() {
    const page = document.body.dataset.page;
    const top = $('[data-mv-top]');
    if (top) top.outerHTML = `<header class="top"><div class="wrap">
      <a class="brand" href="/" aria-label="MondoVERSO, pagina iniziale"><img src="/assets/logo-mv-96.png" alt="" width="44" height="44"><span class="brand-word"><span>Mondo</span><b>VERSO</b></span></a>
      <nav class="nav" aria-label="Sezioni">
        <a href="/#offerte" ${page === 'home' ? '' : ''}>Offerte</a>
        <a href="/#sorprendimi">Sorprendimi</a>
        <a href="/#citta">Città</a>
        <a href="/#racconti">Racconti</a>
        <a href="/guida" ${page === 'guida' ? 'aria-current="page"' : ''}>Guida gratis</a>
      </nav>
      <a class="btn btn-ink btn-small top-cta" href="/account" ${page === 'account' ? 'aria-current="page"' : ''}>Profilo</a>
    </div></header>`;
    const foot = $('[data-mv-foot]');
    if (foot) foot.outerHTML = `<footer class="foot"><div class="wrap">
      <div class="foot-grid">
        <div><a class="brand" href="/" style="color:#fff"><img src="/assets/logo-mv-96.png" alt="" width="40" height="40"><span class="brand-word"><span>Mondo</span><b style="color:#D9D9D9">VERSO</b></span></a>
          <p style="margin-top:12px">Weekend che parti dopo il lavoro: volo diretto, hotel in centro e tasse in un solo prezzo, controllato ogni giorno.</p></div>
        <div><h3>Seguici</h3><ul>
          <li><a href="${esc(MV.WHATSAPP)}" target="_blank" rel="noopener">Canale WhatsApp</a></li>
          ${MV.INSTAGRAM ? `<li><a href="${esc(MV.INSTAGRAM)}" target="_blank" rel="noopener">Instagram</a></li>` : ''}
          <li><a href="/racconta">Racconta il tuo weekend</a></li>
          <li><a href="/guida">Chiedi la guida</a></li></ul></div>
        <div><h3>Informazioni</h3><ul>
          <li><a href="/privacy">Privacy</a></li><li><a href="/cookie">Cookie</a></li><li><a href="/termini">Termini e regole dei racconti</a></li><li><a href="/contatti">Contatti</a></li></ul></div>
      </div>
      <p class="foot-note">Alcuni link sono affiliati: se prenoti da lì MondoVERSO riceve una piccola commissione, senza costi in più per te. I prezzi sono controllati al momento della pubblicazione e possono cambiare sul sito del partner.</p>
    </div></footer>`;
  }

  /* ---------- Tabellone delle partenze ---------- */
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function flapIn(el, text, delay) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { el.textContent = text; return; }
    const target = String(text);
    let frame = 0;
    const total = 14;
    setTimeout(function tick() {
      frame++;
      el.textContent = target.split('').map((c, i) => (c === ' ' || frame > total - (target.length - i) * 0.4 || frame >= total) ? c : FLAP[Math.floor(Math.random() * FLAP.length)]).join('');
      if (frame < total) setTimeout(tick, 45); else el.textContent = target;
    }, delay || 0);
  }
  function renderBoard(list, origin) {
    const box = $('#board'); if (!box) return;
    const all = cheapestPerCity(list.filter((o) => !origin || o.origine === origin));
    const complete = all.filter((o) => o.completo);
    const rows = (complete.length >= 3 ? complete : all).slice(0, 6);
    if (!rows.length) {
      box.innerHTML = `<p class="board-empty">Le offerte di oggi arrivano a momenti. Intanto segui il canale WhatsApp: le pubblichiamo lì ogni mattina.</p>`;
      return;
    }
    const stamp = list.reduce((m, o) => (o.pubblicata_il > m ? o.pubblicata_il : m), '');
    box.innerHTML = `<div class="board-head" aria-hidden="true"><span>Partenza</span><span>Destinazione</span><span class="h-nights">Notti</span><span>Prezzo</span></div>
      ${rows.map((o) => `<a class="board-row" href="${cityUrl(o.citta_slug, o.origine)}" aria-label="${esc(o.citta)}, ${esc(fmtDayLong(o.andata))} alle ${esc(o.ora_andata)}, ${esc(euro(price(o)))} ${esc(priceNote(o))}">
        <span class="flap flap-time" data-flap="${esc(dayShort(o.andata))} ${esc(o.ora_andata || '')}"></span>
        <span class="flap" data-flap="${esc(o.citta)}"></span>
        <span class="flap flap-nights" data-flap="${esc(nightsWord(o.notti))}"></span>
        <span class="flap flap-price" data-flap="${esc(euro(price(o)))}"></span></a>`).join('')}
      <div class="board-foot"><span>${origin ? `Da ${esc((list.find((o) => o.origine === origin) || {}).origine_nome || origin)}` : 'Dalle principali città italiane'}, ${rows.some((o) => !o.completo) ? 'prezzi a persona' : 'volo, hotel e tasse a persona'}</span><span>${stamp ? `Controllati ${new Date(stamp).toLocaleString('it-IT', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}</span></div>`;
    $$('[data-flap]', box).forEach((el, i) => flapIn(el, el.dataset.flap, i * 70));
  }

  /* ---------- Offerte ---------- */
  function dealHtml(o) {
    const facts = [`${fmtDay(o.andata)} ${o.ora_andata || ''} → ${fmtDay(o.ritorno)} ${o.ora_ritorno || ''}`, nightsWord(o.notti), o.hotel ? o.hotel : ''].filter(Boolean).join(', ');
    return `<article class="deal">
      ${o.foto ? `<img class="deal-photo" src="${esc(o.foto)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="deal-photo" aria-hidden="true"></span>'}
      <div><h3><a href="${cityUrl(o.citta_slug, o.origine)}">${esc(o.citta)} da ${esc(o.origine_nome || o.origine)}</a>${o.affare ? `<span class="badge">${esc(o.affare)}</span>` : ''}${o.stasera ? '<span class="badge badge-leaf">Stasera</span>' : ''}</h3>
        <p class="deal-facts">${esc(facts)}</p>
        <p style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 0">
          ${o.link_volo ? `<a class="btn btn-orange btn-small" href="${esc(o.link_volo)}" target="_blank" rel="sponsored noopener">Prenota il volo</a>` : ''}
          ${o.link_hotel ? `<a class="btn btn-line btn-small" href="${esc(o.link_hotel)}" target="_blank" rel="sponsored noopener">${o.hotel ? 'Prenota l\u2019hotel' : 'Trova l\u2019hotel'}</a>` : ''}
          <a class="btn btn-line btn-small" href="${cityUrl(o.citta_slug, o.origine)}">Cosa fare</a></p></div>
      <div class="deal-price"><strong>${esc(euro(price(o)))}</strong><span>${esc(priceNote(o))}</span></div>
    </article>`;
  }
  function renderDeals(list) {
    const box = $('#deals'); if (!box) return;
    const fo = $('#fOrigin').value, fw = $('#fWeekend').value, fb = Number($('#fBudget').value) || 0;
    const shown = list.filter((o) => (!fo || o.origine === fo) && (!fw || o.ritorno === fw) && (!fb || price(o) <= fb)).slice(0, 40);
    box.innerHTML = shown.length ? shown.map(dealHtml).join('') : `<p class="empty">Nessuna offerta con questi filtri. Togli un filtro, oppure iscriviti agli avvisi qui sotto: ti scriviamo quando il prezzo scende.</p>`;
  }
  function fillDealFilters(list) {
    const os = origins(list);
    const weekends = [...new Set(list.map((o) => o.ritorno))].sort();
    const optO = '<option value="">Tutte le partenze</option>' + os.map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join('');
    ['#fOrigin', '#sOrigin', '#heroOrigin'].forEach((s) => { if ($(s)) $(s).innerHTML = optO; });
    if ($('#fWeekend')) $('#fWeekend').innerHTML = '<option value="">Tutti i weekend</option>' + weekends.map((r) => `<option value="${r}">Weekend fino a ${esc(fmtDay(r))}</option>`).join('');
    if ($('#sWeekend')) $('#sWeekend').innerHTML = '<option value="">Qualsiasi weekend</option>' + weekends.map((r) => `<option value="${r}">Fino a ${esc(fmtDay(r))}</option>`).join('');
  }

  /* ---------- Stasera si parte ---------- */
  function renderTonight(list) {
    const band = $('#tonight'); if (!band) return;
    const t = today();
    const items = cheapestPerCity(list.filter((o) => o.stasera && o.andata === t)).slice(0, 6);
    if (!items.length) { band.hidden = true; return; }
    const first = items.map((o) => o.ora_andata).filter(Boolean).sort()[0];
    band.hidden = false;
    band.innerHTML = `<div class="wrap"><div><h2>Stasera si parte</h2>
      <p style="margin:6px 0 0">${first ? `Il primo volo è alle ${esc(first)}: hai tempo per decidere fino a un paio d'ore prima.` : 'Voli di stasera ancora a buon prezzo.'}</p></div>
      <div class="tonight-list">${items.map((o) => `<a class="tonight-item" href="${cityUrl(o.citta_slug, o.origine)}">${esc(o.citta)}<small>${esc(o.ora_andata || '')} da ${esc(o.origine_nome || o.origine)}, ${esc(euro(price(o)))}</small></a>`).join('')}</div></div>`;
  }

  /* ---------- Sorprendimi ---------- */
  let lastPick = null;
  function surprise(list) {
    const budget = Number($('#sBudget').value), org = $('#sOrigin').value, wk = $('#sWeekend').value;
    const pool = list.filter((o) => (!org || o.origine === org) && (!wk || o.ritorno === wk) && price(o) <= budget && (!lastPick || o.id !== lastPick.id));
    const ticket = $('#ticket');
    ticket.classList.remove('spin'); void ticket.offsetWidth; ticket.classList.add('spin');
    const inner = $('.ticket-inner', ticket);
    if (!pool.length) {
      inner.innerHTML = `<p class="ticket-hint">Con ${esc(euro(budget))}${org ? ` da ${esc((list.find((o) => o.origine === org) || {}).origine_nome || org)}` : ''} oggi non c'è niente. Alza un po' il budget o scegli un altro weekend.</p>`;
      return;
    }
    const o = pool[Math.floor(Math.random() * pool.length)];
    lastPick = o;
    setTimeout(() => {
      inner.innerHTML = `<p class="ticket-hint">Si parte per</p><p class="ticket-city">${esc(o.citta)}</p>
        <p class="ticket-line">${esc(fmtDayLong(o.andata))} alle ${esc(o.ora_andata || '')} da ${esc(o.origine_nome || o.origine)}, ritorno ${esc(fmtDayLong(o.ritorno))}. ${esc(euro(price(o)))} ${esc(priceNote(o))}.</p>
        <div class="ticket-actions">${o.link_volo ? `<a class="btn btn-orange" href="${esc(o.link_volo)}" target="_blank" rel="sponsored noopener">Prenota il volo</a>` : ''}
          <a class="btn btn-line" style="color:#fff;box-shadow:inset 0 0 0 2px #fff" href="${cityUrl(o.citta_slug, o.origine)}">Scopri ${esc(o.citta)}</a>
          <button class="btn btn-line" style="color:#fff;box-shadow:inset 0 0 0 2px #fff" type="button" id="sAgain">Un'altra meta</button></div>`;
      $('#sAgain').addEventListener('click', () => surprise(list));
    }, 350);
  }

  /* ---------- Città e racconti ---------- */
  function renderPostcards(list, cities) {
    const box = $('#postcards'); if (!box) return;
    const photos = new Map((cities || []).map((c) => [c.slug, c.foto]));
    const items = cheapestPerCity(list).slice(0, 12);
    box.innerHTML = items.length ? items.map((o) => {
      const img = o.foto || photos.get(o.citta_slug);
      return `<a class="postcard${img ? '' : ' postcard-noimg'}" href="${cityUrl(o.citta_slug)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        <span class="postcard-body"><h3>${esc(o.citta)}</h3><span class="postcard-meta"><span>${esc(o.paese || '')}</span><span class="postcard-price">da ${esc(euro(price(o)))}${o.completo ? '' : ' solo volo'}</span></span></span></a>`;
    }).join('') : '<p class="empty">Le città arrivano insieme alle offerte di oggi.</p>';
  }
  function storyHtml(s) {
    const photos = s.foto || [];
    return `<article class="story">
      ${photos.length === 1 ? `<img src="${esc(photos[0])}" alt="" loading="lazy">` : photos.length > 1 ? `<div class="story-photos">${photos.slice(0, 6).map((p) => `<img src="${esc(p)}" alt="" loading="lazy">`).join('')}</div>` : ''}
      <div class="story-body"><p class="story-who"><span>${esc(s.autore)}</span><a href="${cityUrl(s.citta_slug)}">${esc(s.citta || s.citta_slug)}</a></p>
        <h3>${esc(s.titolo)}</h3><p>${esc(String(s.testo).slice(0, 320))}${String(s.testo).length > 320 ? '…' : ''}</p>
        ${s.consigli ? `<p class="small"><b>Il consiglio:</b> ${esc(s.consigli)}</p>` : ''}
        ${s.speso ? `<span class="story-spent">Ha speso ${esc(euro(s.speso))}${s.quando ? `, ${esc(s.quando)}` : ''}</span>` : ''}</div></article>`;
  }
  function renderStories(stories, box) {
    if (!box) return;
    box.innerHTML = stories.length ? stories.map(storyHtml).join('') : `<p class="empty" style="column-span:all">Ancora nessun racconto qui. <a href="/racconta">Sii il primo a raccontare il tuo weekend</a>.</p>`;
  }

  /* ---------- Avvisi di prezzo ---------- */
  function bindAlerts(list) {
    const f = $('#alertForm'); if (!f) return;
    if ($('#aOrigin')) $('#aOrigin').innerHTML = origins(list).map(([c, n]) => `<option value="${esc(n)}">${esc(n)}</option>`).join('') + '<option value="">Un\u2019altra città</option>';
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(f), msg = $('#alertMsg');
      if (!d.get('consenso')) { msg.textContent = 'Spunta il consenso per ricevere gli avvisi.'; msg.dataset.tone = 'warn'; return; }
      msg.textContent = 'Invio…'; msg.dataset.tone = '';
      try {
        await rest('avvisi', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { nome: d.get('nome'), email: d.get('email'), whatsapp: d.get('whatsapp') || null, partenza: d.get('partenza'), citta: d.get('citta'), budget: Number(d.get('budget')) || null, consenso: true } });
        f.reset(); msg.textContent = 'Fatto: ti scriviamo quando il prezzo scende sotto il tuo budget.'; msg.dataset.tone = 'ok';
      } catch (err) { msg.textContent = 'Non riesco a salvare l\u2019iscrizione adesso: riprova tra poco.'; msg.dataset.tone = 'warn'; }
    });
  }

  /* ---------- Pagina iniziale ---------- */
  async function home() {
    const [list, cities, stories] = await Promise.all([loadOffers(), loadCities(), loadStories(null, 9)]);
    fillDealFilters(list);
    const saved = store.get('mv-origine', '');
    if (saved && origins(list).some(([c]) => c === saved)) { $('#heroOrigin').value = saved; $('#fOrigin').value = saved; $('#sOrigin').value = saved; }
    renderBoard(list, $('#heroOrigin').value);
    $('#heroOrigin').addEventListener('change', (e) => { store.set('mv-origine', e.target.value); renderBoard(list, e.target.value); $('#fOrigin').value = e.target.value; $('#sOrigin').value = e.target.value; renderDeals(list); });
    renderTonight(list);
    renderPostcards(list, cities);
    renderDeals(list);
    ['#fOrigin', '#fWeekend', '#fBudget'].forEach((s) => $(s).addEventListener('input', () => renderDeals(list)));
    const bOut = () => { $('#sBudgetOut').textContent = euro($('#sBudget').value); };
    $('#sBudget').addEventListener('input', bOut); bOut();
    $('#sGo').addEventListener('click', () => { lastPick = null; surprise(list); });
    renderStories(stories, $('#stories'));
    bindAlerts(list);
  }

  /* ---------- Pagina città ---------- */
  async function city() {
    const slug = decodeURIComponent((location.pathname.match(/\/citta\/([^/?#]+)/) || [])[1] || new URLSearchParams(location.search).get('c') || '');
    const from = new URLSearchParams(location.search).get('da') || store.get('mv-origine', '');
    const [rows, all, stories] = await Promise.all([rest(`citta?slug=eq.${encodeURIComponent(slug)}&select=*`).catch(() => []), loadOffers(), loadStories(slug, 12)]);
    const c = (rows || [])[0];
    const offers = all.filter((o) => o.citta_slug === slug);
    const name = (c && c.nome) || (offers[0] && offers[0].citta) || slug;
    if (!c && !offers.length) {
      $('#cityMain').innerHTML = `<section class="section"><div class="wrap"><h1>Questa città non c'è ancora</h1><p class="lead">Torna alla <a href="/">pagina iniziale</a> per vedere le offerte di oggi, oppure iscriviti agli avvisi.</p></div></section>`;
      return;
    }
    document.title = `Weekend a ${name}: volo, hotel e cosa fare | MondoVERSO`;
    const md = $('meta[name="description"]'); if (md) md.setAttribute('content', `Weekend a ${name} da venerdì sera a domenica: volo diretto, hotel in centro e tasse in un solo prezzo, cosa vedere e i racconti di chi c'è stato.`);
    const best = offers.filter((o) => !from || o.origine === from)[0] || offers[0];
    const photo = (c && c.foto) || (best && best.foto);
    $('#cityHero').innerHTML = `${photo ? `<img src="${esc(photo)}" alt="" onerror="this.remove()">` : ''}<div class="wrap">
      <p>${esc((c && c.paese) || (best && best.paese) || '')}</p><h1>${esc(name)}</h1>
      ${c && c.intro ? `<p>${esc(c.intro)}</p>` : ''}
      ${best ? `<div class="city-price"><span>Weekend da ${esc(best.origine_nome || best.origine)}</span><strong>${esc(euro(price(best)))}</strong><span>${esc(priceNote(best))}, ${esc(fmtDay(best.andata))} – ${esc(fmtDay(best.ritorno))}</span><a class="btn btn-orange btn-small" href="#offerte-citta">Vedi le date</a></div>` : ''}</div>`;
    $('#cityDeals').innerHTML = offers.length ? offers.map(dealHtml).join('') : `<p class="empty">Oggi nessuna offerta per ${esc(name)}. <a href="/#avvisi">Iscriviti agli avvisi</a> e ti scriviamo quando il prezzo scende.</p>`;
    const places = (c && c.luoghi) || [];
    $('#cityPlaces').innerHTML = places.length ? places.map((p) => `<article class="place">${p.foto ? `<img src="${esc(p.foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div class="place-body"><h3>${esc(p.nome)}</h3>${p.descrizione ? `<p>${esc(p.descrizione)}</p>` : ''}
      <p>${p.wiki ? `<a href="${esc(p.wiki)}" target="_blank" rel="noopener">Scopri di più</a>` : ''}${p.lat != null ? ` <a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" rel="noopener">Mappa</a>` : ''}${p.biglietti ? ` <a href="${esc(p.biglietti)}" target="_blank" rel="sponsored noopener">Biglietti</a>` : ''}</p></div></article>`).join('') : '<p class="empty">I luoghi da vedere arrivano a breve.</p>';
    const tips = (c && c.consigli) || [];
    $('#cityTipsWrap').hidden = !tips.length;
    $('#cityTips').innerHTML = tips.map((t) => `<li>${esc(t)}</li>`).join('');
    $('#cityStoriesTitle').textContent = `I racconti di chi è stato a ${name}`;
    renderStories(stories, $('#cityStories'));
    $('#cityTell').href = `/racconta?citta=${encodeURIComponent(slug)}`;
    $('#cityTell').textContent = `Racconta il tuo weekend a ${name}`;
  }

  /* ---------- Richiesta della guida ---------- */
  function guide() {
    const f = $('#guideForm');
    const q = new URLSearchParams(location.search);
    if (q.get('citta')) f.elements.citta.value = q.get('citta');
    if (q.get('codice')) f.elements.codice.value = q.get('codice');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = new FormData(f), msg = $('#guideMsg');
      if (!d.get('consenso')) { msg.textContent = 'Spunta il consenso: ci serve per contattarti e mandarti la guida.'; msg.dataset.tone = 'warn'; return; }
      if (!d.get('whatsapp') && !d.get('email')) { msg.textContent = 'Lascia almeno WhatsApp o email, così sappiamo dove mandarti la guida.'; msg.dataset.tone = 'warn'; return; }
      const row = {};
      ['nome', 'whatsapp', 'email', 'codice', 'citta', 'date', 'partenza', 'formula', 'con_chi', 'persone', 'hotel', 'ritmo', 'sveglia', 'da_vedere', 'da_evitare', 'serata', 'budget', 'alimentazione', 'mobilita', 'occasione'].forEach((k) => { row[k] = d.get(k) || null; });
      row.interessi = d.getAll('interessi'); row.esperienze = d.getAll('esperienze'); row.consenso = true;
      $('#guideSend').disabled = true; msg.textContent = 'Invio…'; msg.dataset.tone = '';
      try {
        await rest('richieste_guida', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: row });
        f.hidden = true; $('#guideDone').hidden = false; window.scrollTo({ top: 0 });
      } catch (err) { msg.textContent = 'Non riesco a inviare adesso: riprova tra poco o scrivici sul canale WhatsApp.'; msg.dataset.tone = 'warn'; }
      $('#guideSend').disabled = false;
    });
  }

  /* ---------- Accesso (racconta e profilo) ---------- */
  async function currentUser() {
    if (!sb()) return null;
    const { data } = await sb().auth.getSession();
    return data && data.session ? data.session.user : null;
  }
  function bindLogin(onIn) {
    const f = $('#loginForm'); if (!f) return;
    const msg = $('#loginMsg');
    const say = (t, tone) => { msg.textContent = t; msg.dataset.tone = tone || ''; };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!sb()) { say('Il servizio di accesso non si è caricato: ricarica la pagina.', 'warn'); return; }
      const email = f.elements.email.value.trim(), pass = f.elements.password.value;
      const mode = e.submitter && e.submitter.dataset.mode;
      try {
        if (mode === 'link' || !pass) {
          const { error } = await sb().auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
          if (error) throw error;
          say('Ti abbiamo mandato un link per entrare: aprilo da questo dispositivo.', 'ok');
          return;
        }
        if (mode === 'signup') {
          const { error } = await sb().auth.signUp({ email, password: pass, options: { emailRedirectTo: location.href } });
          if (error) throw error;
          say('Account creato: conferma l\u2019email che ti abbiamo mandato, poi torna qui.', 'ok');
          return;
        }
        const { error } = await sb().auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        onIn(await currentUser());
      } catch (err) {
        const t = String(err.message || err);
        say(/Invalid login/i.test(t) ? 'Email o password sbagliate.' : /rate/i.test(t) ? 'Troppi tentativi: riprova tra qualche minuto.' : t, 'warn');
      }
    });
  }

  /* ---------- Racconta il tuo weekend ---------- */
  function resizeImage(file, max) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? res(b) : rej(new Error('foto non leggibile'))), 'image/jpeg', 0.82);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => rej(new Error('foto non leggibile'));
      img.src = URL.createObjectURL(file);
    });
  }
  async function tell() {
    const cities = await loadCities();
    const sel = $('#tCity');
    sel.innerHTML = '<option value="">Scegli la città</option>' + (cities || []).sort((a, b) => a.nome.localeCompare(b.nome, 'it')).map((c) => `<option value="${esc(c.slug)}">${esc(c.nome)}</option>`).join('') + '<option value="altra">Un\u2019altra città</option>';
    const pre = new URLSearchParams(location.search).get('citta'); if (pre) sel.value = pre;
    const show = (u) => { $('#loginBox').hidden = !!u; $('#tellForm').hidden = !u; if (u) $('#tWho').textContent = u.email; };
    show(await currentUser());
    bindLogin(show);
    if (sb()) sb().auth.onAuthStateChange((_e, s) => show(s ? s.user : null));
    const f = $('#tellForm');
    sel.addEventListener('change', () => { $('#tOtherWrap').hidden = sel.value !== 'altra'; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#tellMsg'), say = (t, tone) => { msg.textContent = t; msg.dataset.tone = tone || ''; };
      const user = await currentUser(); if (!user) { show(null); return; }
      const d = new FormData(f);
      if (!d.get('regole')) { say('Spunta la conferma sulle foto e sulle regole.', 'warn'); return; }
      const other = String(d.get('altra') || '').trim();
      const slug = sel.value === 'altra' ? other.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : sel.value;
      if (!slug) { say('Scegli la città del tuo weekend.', 'warn'); return; }
      const files = [...$('#tPhotos').files].slice(0, 6);
      $('#tellSend').disabled = true;
      try {
        const urls = [];
        for (let i = 0; i < files.length; i++) {
          say(`Carico la foto ${i + 1} di ${files.length}…`);
          const blob = await resizeImage(files[i], 1600);
          const path = `${user.id}/${Date.now()}-${i}.jpg`;
          const { error } = await sb().storage.from('racconti').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
          if (error) throw error;
          urls.push(sb().storage.from('racconti').getPublicUrl(path).data.publicUrl);
        }
        say('Salvo il racconto…');
        const cityName = sel.value === 'altra' ? other : sel.options[sel.selectedIndex].text;
        const { error } = await sb().from('racconti').insert({ autore: d.get('autore'), citta_slug: slug, citta: cityName, titolo: d.get('titolo'), testo: d.get('testo'), speso: Number(d.get('speso')) || null, quando: d.get('quando') || null, consigli: d.get('consigli') || null, foto: urls, stato: 'in_attesa', user_id: user.id });
        if (error) throw error;
        f.reset(); say('Grazie! Il tuo racconto è arrivato: lo pubblichiamo dopo un controllo, di solito entro un giorno.', 'ok');
      } catch (err) { say('Non sono riuscito a salvare: ' + (err.message || err), 'warn'); }
      $('#tellSend').disabled = false;
    });
  }

  /* ---------- Il mio profilo ---------- */
  let map = null, markers = [];
  async function account() {
    const show = async (u) => {
      $('#loginBox').hidden = !!u; $('#profile').hidden = !u;
      if (!u) return;
      $('#pEmail').textContent = u.email;
      const { data: mine } = await sb().from('racconti').select('id,titolo,citta,stato,creato_il').eq('user_id', u.id).order('creato_il', { ascending: false });
      const label = { in_attesa: 'In attesa di controllo', pubblicato: 'Pubblicato', rifiutato: 'Non pubblicato' };
      $('#myStories').innerHTML = (mine || []).length ? mine.map((s) => `<li>${esc(s.titolo)}, ${esc(s.citta || '')} <span class="status status-${esc(s.stato)}">${esc(label[s.stato] || s.stato)}</span></li>`).join('') : '<li class="small">Non hai ancora raccontato un weekend. <a href="/racconta">Racconta il primo</a>.</li>';
      await drawVisited();
    };
    bindLogin(show);
    $('#logout').addEventListener('click', async () => { await sb().auth.signOut(); show(null); });
    $('#visitForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = $('#visitCity').value.trim(); if (!q) return;
      const msg = $('#visitMsg'); msg.textContent = 'Cerco la città…';
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=it&q=${encodeURIComponent(q)}`).then((x) => x.json());
        if (!r.length) { msg.textContent = 'Città non trovata: prova ad aggiungere il paese.'; return; }
        const a = r[0].address || {};
        const name = a.city || a.town || a.village || r[0].name || q;
        const { error } = await sb().from('citta_visitate').upsert({ citta: name, paese: a.country || '', cc: (a.country_code || '').toUpperCase(), lat: Number(r[0].lat), lng: Number(r[0].lon) });
        if (error) throw error;
        $('#visitCity').value = ''; msg.textContent = `${name} aggiunta alla tua mappa.`;
        drawVisited();
      } catch (err) { msg.textContent = 'Non riesco ad aggiungerla adesso.'; }
    });
    show(await currentUser());
    if (sb()) sb().auth.onAuthStateChange((_e, s) => show(s ? s.user : null));
  }
  async function drawVisited() {
    const { data } = await sb().from('citta_visitate').select('citta,paese,cc,lat,lng');
    const list = data || [];
    const countries = new Set(list.map((c) => c.paese).filter(Boolean));
    $('#visitCount').textContent = list.length ? `${list.length} ${list.length === 1 ? 'città' : 'città'} in ${countries.size} ${countries.size === 1 ? 'paese' : 'paesi'}` : 'Aggiungi le città dove sei stato.';
    $('#visitList').innerHTML = list.map((c) => `<span class="chip">${esc(c.citta)}<button type="button" aria-label="Togli ${esc(c.citta)}" data-del="${esc(c.citta)}">×</button></span>`).join('');
    $$('#visitList [data-del]').forEach((b) => b.addEventListener('click', async () => { await sb().from('citta_visitate').delete().eq('citta', b.dataset.del); drawVisited(); }));
    if (!window.L) { $('#map').innerHTML = '<p class="small" style="padding:16px">La mappa non si è caricata.</p>'; return; }
    if (!map) { map = window.L.map('map', { worldCopyJump: true }).setView([45, 10], 3); window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap' }).addTo(map); }
    markers.forEach((m) => m.remove()); markers = [];
    list.forEach((c) => { if (c.lat != null) markers.push(window.L.circleMarker([c.lat, c.lng], { radius: 8, color: '#FF6600', fillColor: '#FF6600', fillOpacity: 0.85 }).addTo(map).bindPopup(esc(c.citta))); });
    if (markers.length) map.fitBounds(window.L.featureGroup(markers).getBounds().pad(0.4), { maxZoom: 5 });
  }

  /* ---------- Avvio ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    chrome();
    const page = document.body.dataset.page;
    const run = { home, city, guida: guide, racconta: tell, account }[page];
    if (run) Promise.resolve().then(run).catch((e) => console.error(e));
  });
  window.MV = { rest, price, euro };
})();
