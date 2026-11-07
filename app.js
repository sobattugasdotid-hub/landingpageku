/* Portofolio Produk Digital — frontend publik (vanilla JS, tanpa library)
 * Prinsip kecepatan (gas-scale-turbo):
 *  - Render dari localStorage SEKETIKA, lalu cek versi ke server (respons ringkas bila tidak berubah)
 *  - Semua pindah menu/detail/cari/filter terjadi di memori, tanpa permintaan jaringan
 *  - Request GET kembar digabung (in-flight dedupe), statistik dikirim berkelompok
 */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG || {};
  var GAS = CFG.GAS_URL || '';
  var KONFIG_OK = !!GAS && !/GANTI|XXXX/.test(GAS);

  // ---------- util ----------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var LS = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  var P = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    arrow: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-3.2 4.3M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    ext: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    package: '<path d="M16.5 9.4 7.5 4.2"/><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>'
  };
  function ic(n, s) { s = s || 20; return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>'; }
  var fotoUrl = function (id, w) { return id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w' + (w || 800) : ''; };
  function imgTag(id, alt, w, o) {
    o = o || {};
    if (!id) return '<div class="ph">' + esc(String(alt || '?').trim().charAt(0).toUpperCase()) + '</div>';
    return '<img class="lz" src="' + fotoUrl(id, w) + '" alt="' + esc(alt) + '" loading="' + (o.eager ? 'eager' : 'lazy') + '" decoding="async"' + (o.hi ? ' fetchpriority="high"' : '') + ' draggable="false">';
  }
  var isFree = function (h) { return /^\s*gratis\s*$/i.test(h || ''); };
  var okLink = function (u) { return /^https:\/\/[^\s]+$/i.test(u || ''); };
  function rich(t) {
    var out = '', ul = false, para = [];
    var flush = function () { if (para.length) { out += '<p>' + para.join('<br>') + '</p>'; para = []; } };
    String(t || '').replace(/\r/g, '').split('\n').forEach(function (l) {
      var m = l.match(/^\s*[-•*]\s+(.*)$/);
      if (m) { flush(); if (!ul) { out += '<ul>'; ul = true; } out += '<li><span>' + esc(m[1]) + '</span></li>'; }
      else { if (ul) { out += '</ul>'; ul = false; } if (!l.trim()) flush(); else para.push(esc(l)); }
    });
    flush(); if (ul) out += '</ul>';
    return out;
  }

  // gambar: fade-in saat dimuat, placeholder bila gagal
  document.addEventListener('load', function (e) { if (e.target.tagName === 'IMG') e.target.classList.add('ok'); }, true);
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t.tagName === 'IMG' && t.classList.contains('lz')) { var d = document.createElement('div'); d.className = 'ph'; d.textContent = String(t.alt || '?').trim().charAt(0).toUpperCase(); t.replaceWith(d); }
  }, true);

  // ---------- toast & modal (dipakai juga oleh dashboard) ----------
  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.innerHTML = (type === 'err' ? ic('alert', 18) : type === 'ok' ? ic('check', 18) : '') + '<span>' + esc(msg) + '</span>';
    $('#toastRoot').appendChild(el);
    setTimeout(function () { el.remove(); }, type === 'err' ? 5200 : 2800);
  }
  function modal(html, cls) {
    var r = $('#modalRoot');
    r.innerHTML = '<div class="scrim" data-act="scrim"><div class="dlg ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
    var f = r.querySelector('[data-autofocus]'); if (f) setTimeout(function () { f.focus(); }, 30);
    return r.firstChild.firstChild;
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; document.body.style.overflow = ''; }
  function confirmDlg(o) {
    return new Promise(function (res) {
      var d = modal('<h3>' + esc(o.judul) + '</h3><p>' + esc(o.teks) + '</p><div class="row"><button class="btn line" data-c="0">Batal</button><button class="btn ' + (o.bahaya ? 'danger' : '') + '" data-c="1" data-autofocus>' + esc(o.ok || 'Ya') + '</button></div>');
      d.addEventListener('click', function (e) { var b = e.target.closest('[data-c]'); if (b) { closeModal(); res(b.dataset.c === '1'); } });
      d.parentNode.addEventListener('click', function (e) { if (e.target === d.parentNode) res(false); });
    });
  }

  // ---------- API ----------
  var inflight = {};
  var delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  async function fetchJson(url, opt, tries) {
    try { var r = await fetch(url, opt); return await r.json(); }
    catch (e) { if (tries > 1) { await delay(700); return fetchJson(url, opt, tries - 1); } throw new Error('Koneksi bermasalah. Periksa internet Anda lalu coba lagi.'); }
  }
  function apiGet(action, params) {
    var url = GAS + '?' + new URLSearchParams(Object.assign({ action: action }, params || {})).toString();
    if (inflight[url]) return inflight[url];
    var p = fetchJson(url, undefined, 2).then(function (j) { delete inflight[url]; return j; }, function (e) { delete inflight[url]; throw e; });
    inflight[url] = p; return p;
  }
  var Auth = {
    get: function () { var t = LS.get('da_tok'); return t && t.x > Date.now() ? t : null; },
    set: function (t, x) { LS.set('da_tok', { t: t, x: x }); },
    clear: function () { LS.del('da_tok'); }
  };
  async function apiPost(action, data, o) {
    o = o || {};
    var tok = o.token === undefined ? (Auth.get() || {}).t : o.token;
    var j = await fetchJson(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: action, token: tok, data: data || {} }) }, 1);
    if (!j.success) { var e = new Error(j.message || 'Terjadi kesalahan.'); e.code = j.code; throw e; }
    return j;
  }

  // ---------- statistik: dikumpulkan lalu dikirim berkelompok ----------
  var Q = LS.get('da_q') || [], qTimer = 0, seen = {};
  function track(jenis, id) {
    if (!KONFIG_OK) return;
    if (jenis === 'Lihat Detail') { if (seen[id]) return; seen[id] = 1; }
    Q.push({ id: id, jenis: jenis, at: Date.now() }); LS.set('da_q', Q);
    if (!qTimer) qTimer = setTimeout(function () { qTimer = 0; flush(false); }, 10000);
  }
  async function flush(keep) {
    if (!Q.length || !KONFIG_OK) return;
    var batch = Q.splice(0, 40), now = Date.now();
    LS.set('da_q', Q);
    var body = JSON.stringify({ action: 'statistik.batch', data: { events: batch.map(function (e) { return { id: e.id, jenis: e.jenis, ago: now - e.at }; }) } });
    try {
      if (keep) fetch(GAS, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body });
      else { var r = await fetch(GAS, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }); await r.json(); }
    } catch (e) { Q = batch.concat(Q); LS.set('da_q', Q); }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(true); });
  window.addEventListener('pagehide', function () { flush(true); });

  // ---------- state ----------
  var cache = LS.get('da_boot');
  var S = { boot: cache && cache.data ? cache.data : null, pv: cache && cache.pv || '', err: '', kat: 'Semua', q: '', lim: 60, t: Date.now(), dirty: false };

  // ---------- slider ----------
  var sliders = [];
  function sliderHTML(slides, o) {
    var n = slides.length;
    return '<div class="slider" data-auto="' + (o.auto ? 1 : 0) + '" style="--ar:' + (o.ar || '4/3') + '"><div class="track">' + slides.join('') + '</div>' +
      (n > 1 ? '<button class="sl-btn prev" data-sl="-1" aria-label="Sebelumnya">' + ic('chevL', 20) + '</button><button class="sl-btn next" data-sl="1" aria-label="Berikutnya">' + ic('chevR', 20) + '</button><div class="dots">' +
        slides.map(function (_, i) { return '<button data-dot="' + i + '" aria-label="Slide ' + (i + 1) + '"' + (i === 0 ? ' class="on"' : '') + '></button>'; }).join('') + '</div>' : '') + '</div>';
  }
  function mkSlider(el) {
    var track = $('.track', el), imgs = el.querySelectorAll('.slide img'), n = el.querySelectorAll('.slide').length;
    var dots = [].slice.call(el.querySelectorAll('.dots button'));
    var auto = el.dataset.auto === '1' && n > 1;
    var i = 0, timer = 0, hold = false, vis = true, x0 = 0, dx = 0, drag = false, moved = false, w = 1;
    function warm(k) { var im = imgs[((k % n) + n) % n]; if (im && im.loading === 'lazy') im.loading = 'eager'; }
    function show(k) {
      i = ((k % n) + n) % n; track.classList.remove('drag');
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach(function (d, j) { d.classList.toggle('on', j === i); });
      warm(i + 1); warm(i - 1);
    }
    function stop() { clearInterval(timer); timer = 0; }
    function play() { stop(); if (auto && !hold && vis && document.visibilityState === 'visible') timer = setInterval(function () { show(i + 1); }, 5000); }
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag = true; moved = false; x0 = e.clientX; dx = 0; w = el.clientWidth || 1; hold = true; stop();
    });
    el.addEventListener('pointermove', function (e) {
      if (!drag) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 8) {
        if (!moved) { moved = true; track.classList.add('drag'); try { el.setPointerCapture(e.pointerId); } catch (_) { } }
        track.style.transform = 'translateX(calc(' + (-i * 100) + '% + ' + dx + 'px))';
      }
    });
    function up() {
      if (!drag) return; drag = false; hold = false;
      if (moved) show(Math.abs(dx) > Math.min(60, w * .15) ? i + (dx < 0 ? 1 : -1) : i);
      play();
    }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('mouseenter', function () { hold = true; stop(); });
    el.addEventListener('mouseleave', function () { if (!drag) { hold = false; play(); } });
    el.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    var io = null;
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (en) { vis = en[0].isIntersecting; if (vis) play(); else stop(); }); io.observe(el); }
    var onVis = function () { if (document.visibilityState === 'visible') play(); else stop(); };
    document.addEventListener('visibilitychange', onVis);
    warm(1); play();
    var api = { go: function (k) { show(k); play(); }, prev: function () { api.go(i - 1); }, next: function () { api.go(i + 1); }, cur: function () { return i; }, destroy: function () { stop(); if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis); } };
    el._sl = api; return api;
  }
  function initSliders() { sliders = [].slice.call(document.querySelectorAll('.slider')).map(mkSlider); }
  function killSliders() { sliders.forEach(function (s) { s.destroy(); }); sliders = []; }

  // ---------- komponen tampilan ----------
  function kartu(p) {
    return '<article class="card" data-id="' + esc(p.id) + '"><a class="card-img" href="#/produk/' + esc(p.id) + '" aria-label="' + esc(p.nama) + '">' + imgTag(p.foto[0], p.nama, 600) +
      '<span class="badge">' + esc(p.kat) + '</span></a><div class="card-body"><h3>' + esc(p.nama) + '</h3><p>' + esc(p.ring) + '</p></div>' +
      '<div class="card-foot"><div><small>Harga</small><strong class="' + (isFree(p.harga) ? 'free' : '') + '">' + esc(p.harga || '—') + '</strong></div>' +
      '<a class="btn sm ghost" href="#/produk/' + esc(p.id) + '">Lihat Detail ' + ic('eye', 16) + '</a></div></article>';
  }
  function skelCards(n) { var s = ''; for (var i = 0; i < n; i++) s += '<div class="card"><div class="sk" style="aspect-ratio:4/3"></div><div class="sk" style="height:24px;margin:1rem 0 .5rem;width:70%"></div><div class="sk" style="height:40px"></div></div>'; return '<div class="cards">' + s + '</div>'; }
  function stateBox(icon, judul, teks, aksi) {
    return '<div class="state"><div class="feat-ic">' + ic(icon, 30) + '</div><h3>' + esc(judul) + '</h3><p>' + esc(teks) + '</p>' + (aksi || '') + '</div>';
  }
  function errorView() {
    if (S.err === 'config') return '<div class="wrap">' + stateBox('alert', 'Konfigurasi belum lengkap', 'Isi GAS_URL di file config.js dengan alamat Web App (/exec) hasil Deploy, lalu muat ulang halaman.') + '</div>';
    return '<div class="wrap">' + stateBox('alert', 'Produk belum bisa dimuat', S.err || 'Terjadi gangguan koneksi.', '<button class="btn" data-act="retry">' + ic('refresh', 18) + ' Coba Lagi</button>') + '</div>';
  }
  function heroSlider() {
    var B = S.boot, L = B.hero.map(function (h) { return { foto: h.foto, judul: h.judul, sub: h.sub, href: okLink(h.link) ? h.link : '', ext: true }; });
    if (!L.length) L = B.produk.filter(function (p) { return p.foto[0]; }).slice(0, 4).map(function (p) { return { foto: p.foto[0], judul: p.nama, sub: p.ring, href: '#/produk/' + p.id }; });
    if (!L.length) return '<div class="slider" style="--ar:16/11"><div class="slide"><div class="ph">' + esc((B.set.brand || 'D').charAt(0)) + '</div></div></div>';
    return sliderHTML(L.map(function (s, i) {
      var inner = imgTag(s.foto, s.judul || B.set.brand, 1200, { eager: true, hi: i === 0 }) + (s.judul || s.sub ? '<div class="cap">' + (s.judul ? '<h3>' + esc(s.judul) + '</h3>' : '') + (s.sub ? '<p>' + esc(s.sub) + '</p>' : '') + '</div>' : '');
      return s.href ? '<a class="slide" href="' + esc(s.href) + '"' + (s.ext ? ' target="_blank" rel="noopener noreferrer"' : '') + ' draggable="false">' + inner + '</a>' : '<div class="slide">' + inner + '</div>';
    }), { auto: true, ar: '4/3' });
  }
  function katList() { var m = {}, a = []; S.boot.produk.forEach(function (p) { if (!m[p.kat]) { m[p.kat] = 1; a.push(p.kat); } }); return a; }

  function vBeranda() {
    var B = S.boot, s = B.set, pop = B.produk.slice(0, 3);
    var kp = katList().map(function (k) { return '<button class="pill" data-kat="' + esc(k) + '" data-goto="1">' + esc(k) + '</button>'; }).join('');
    return '<div class="wrap"><section class="hero"><div class="hero-txt"><span class="badge ok"><i class="dot"></i> Koleksi Terverifikasi</span>' +
      '<h1>' + esc(s.judul) + '</h1><p class="hero-sub">' + esc(s.sub) + '</p>' +
      '<div class="hero-cta"><a class="btn lg" href="#/portofolio">Jelajahi Produk ' + ic('arrow', 18) + '</a><button class="btn lg ghost" data-scroll="keunggulan">Lihat Keunggulan</button></div></div>' +
      '<div class="hero-vis"><div class="orbit">' + heroSlider() + '</div></div></section>' +
      '<section class="sec" style="padding-top:0"><div class="searchbox"><form class="search" data-form="cari">' + ic('search', 20) +
      '<input id="hq" type="search" placeholder="Cari produk..." autocomplete="off" aria-label="Cari produk"><button class="btn sm" type="submit">Cari ' + ic('arrow', 16) + '</button></form>' +
      (kp ? '<div class="pills">' + kp + '</div>' : '') + '</div></section>' +
      '<section class="sec" id="keunggulan"><div class="sec-h"><div><div class="eyebrow">Keunggulan</div><h2>Mengapa Memilih ' + esc(s.brand) + '?</h2></div></div><div class="feat">' +
      feat('bolt', 'Langsung Pakai', 'Setelah pembelian, file dan akses dikirim instan. Tanpa setup berbelit.') +
      feat('refresh', 'Update Gratis', 'Dapatkan versi terbaru produk tanpa biaya tambahan.') +
      feat('chat', 'Dukungan Pembeli', 'Ada kendala? Hubungi kami, siap membantu sampai tuntas.') + '</div></section>' +
      '<section class="sec"><div class="sec-h"><div><div class="eyebrow">Pilihan Unggulan</div><h2>Produk Populer</h2></div><a class="btn ghost" href="#/portofolio">Lihat Semua ' + ic('arrow', 16) + '</a></div>' +
      (pop.length ? '<div class="cards">' + pop.map(kartu).join('') + '</div>' : stateBox('package', 'Produk segera hadir', 'Etalase sedang disiapkan. Silakan kembali lagi sebentar lagi.')) + '</section></div>';
  }
  function feat(i, h, p) { return '<div class="feat-i"><div class="feat-ic">' + ic(i, 24) + '</div><div><h3>' + h + '</h3><p>' + p + '</p></div></div>'; }

  function vPortofolio() {
    var B = S.boot;
    return '<div class="wrap"><div class="page-h"><div><h1>Katalog Portofolio Produk</h1><p>Telusuri koleksi produk digital pilihan. Cari berdasarkan nama atau kategori, lalu buka detailnya.</p></div>' +
      '<div class="facts"><div class="fact"><div class="feat-ic">' + ic('package', 20) + '</div><div><b>' + B.produk.length + '</b><small>Produk Aktif</small></div></div>' +
      '<div class="fact"><div class="feat-ic">' + ic('layers', 20) + '</div><div><b>' + katList().length + '</b><small>Kategori</small></div></div></div></div>' +
      '<div class="searchbox"><div class="search">' + ic('search', 20) + '<input id="cari" type="search" placeholder="Cari produk..." autocomplete="off" aria-label="Cari produk" value="' + esc(S.q) + '"></div><div class="pills" id="pills"></div></div>' +
      '<div style="margin-top:1.5rem" id="grid"></div><div style="text-align:center;margin-top:1.5rem" id="more"></div></div>';
  }
  function renderKatalog() {
    var B = S.boot; if (!B || !$('#grid')) return;
    var q = S.q.trim().toLowerCase();
    var base = B.produk.filter(function (p) { return !q || (p.nama + ' ' + p.kat + ' ' + p.ring).toLowerCase().indexOf(q) > -1; });
    var cnt = {}; base.forEach(function (p) { cnt[p.kat] = (cnt[p.kat] || 0) + 1; });
    var kats = katList(); if (S.kat !== 'Semua' && kats.indexOf(S.kat) < 0) S.kat = 'Semua';
    $('#pills').innerHTML = ['Semua'].concat(kats).map(function (k) {
      return '<button class="pill' + (S.kat === k ? ' on' : '') + '" data-kat="' + esc(k) + '">' + esc(k) + ' <small>(' + (k === 'Semua' ? base.length : (cnt[k] || 0)) + ')</small></button>';
    }).join('');
    var list = base.filter(function (p) { return S.kat === 'Semua' || p.kat === S.kat; });
    $('#grid').innerHTML = list.length ? '<div class="cards">' + list.slice(0, S.lim).map(kartu).join('') + '</div>' :
      (B.produk.length ? stateBox('search', 'Produk tidak ditemukan', 'Coba kata kunci lain atau pilih kategori Semua.') : stateBox('package', 'Belum ada produk', 'Produk akan tampil di sini setelah ditambahkan.'));
    $('#more').innerHTML = list.length > S.lim ? '<button class="btn line" data-act="more">Tampilkan lebih banyak</button>' : '';
  }

  function vDetail(id) {
    var B = S.boot, p = B.produk.filter(function (x) { return x.id === id; })[0];
    if (!p) return '<div class="wrap"><a class="back" href="#/portofolio">' + ic('back', 18) + ' Kembali ke Portofolio</a>' + stateBox('package', 'Produk tidak ditemukan', 'Produk ini mungkin sudah tidak tersedia atau tautannya berubah.', '<a class="btn" href="#/portofolio">Lihat Semua Produk</a>') + '</div>';
    document.title = p.nama + ' — ' + B.set.brand;
    track('Lihat Detail', p.id);
    var fotos = p.foto.length ? p.foto : [''];
    var gal = sliderHTML(fotos.map(function (f, i) { return '<div class="slide">' + imgTag(f, p.nama, 1200, { eager: i < 2, hi: i === 0 }) + '</div>'; }), { auto: false, ar: '4/3' });
    var lain = B.produk.filter(function (x) { return x.id !== p.id; }).sort(function (a, b) { return (b.kat === p.kat) - (a.kat === p.kat); }).slice(0, 3);
    var beli = okLink(p.link) ? '<a class="btn lg" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer" data-buy="' + esc(p.id) + '">Beli Sekarang ' + ic('ext', 18) + '</a>' : '<button class="btn lg" disabled>Link beli belum tersedia</button>';
    return '<div class="wrap"><a class="back" href="#/portofolio">' + ic('back', 18) + ' Kembali ke Portofolio</a><div class="d-grid"><div class="d-gal"><div class="orbit">' + gal + '</div></div>' +
      '<div class="d-info"><div class="d-meta"><span class="badge">' + esc(p.kat) + '</span><span>ID: ' + esc(p.id) + '</span></div><h1>' + esc(p.nama) + '</h1>' +
      '<div class="price' + (isFree(p.harga) ? ' free' : '') + '">' + esc(p.harga || '—') + '</div>' +
      '<div class="hide-m" style="display:grid;gap:.6rem;justify-items:start">' + beli + '<div class="secure">' + ic('shield', 16) + ' Pembayaran aman melalui Lynk.id</div></div>' +
      (p.isi || p.ring ? '<h3 style="margin-top:.5rem">Tentang Produk</h3><div class="desc">' + rich(p.isi || p.ring) + '</div>' : '') +
      '<div class="assure"><div>' + ic('bolt', 20) + ' Akses instan setelah pembayaran</div><div>' + ic('refresh', 20) + ' Update gratis selamanya</div><div>' + ic('chat', 20) + ' Bantuan langsung dari penjual</div></div></div></div>' +
      (lain.length ? '<section class="sec"><div class="sec-h"><h2>Produk Lainnya</h2><a class="btn ghost" href="#/portofolio">Lihat Semua ' + ic('arrow', 16) + '</a></div><div class="cards">' + lain.map(kartu).join('') + '</div></section>' : '') +
      '</div><div class="buybar"><div><small>Harga</small><b>' + esc(p.harga || '—') + '</b></div>' + beli + '</div>';
  }

  // ---------- shell: navigasi & footer ----------
  function logoHTML(s) { return '<span class="logo">' + (s.foto ? imgTag(s.foto, s.brand, 120, { eager: true }) : esc((s.brand || 'D').trim().charAt(0).toUpperCase())) + '</span>'; }
  function renderShell(view) {
    var s = S.boot ? S.boot.set : { brand: 'Digital Atelier', sub: '', kontak: '', sosial: '', foto: '', toko: '' };
    var toko = okLink(s.toko), on = function (v) { return view === v ? ' on' : ''; };
    var links = '<a href="#/" class="' + on('beranda').trim() + '">Beranda</a><a href="#/portofolio" class="' + on('portofolio').trim() + '">Portofolio</a><button data-scroll="keunggulan">Keunggulan</button><button data-scroll="kontak">Kontak</button>';
    $('#pubnav').innerHTML = '<div class="wrap"><div class="brand" data-act="logo">' + logoHTML(s) + '<span>' + esc(s.brand) + '</span></div><nav class="links" aria-label="Menu utama">' + links + '</nav>' +
      '<div class="nav-cta"><a class="btn" href="' + (toko ? esc(s.toko) : '#/portofolio') + '"' + (toko ? ' target="_blank" rel="noopener noreferrer"' : '') + '>Beli Sekarang</a><button class="burger" data-act="menu" aria-label="Menu">' + ic('menu', 24) + '</button></div></div>' +
      '<div class="mmenu" id="mmenu"><nav>' + links + '</nav></div>';
    var soc = String(s.sosial || '').split(/[\s,]+/).filter(okLink).map(function (u) {
      var h = u.replace(/^https:\/\/(www\.)?/, '').split('/')[0];
      var fav = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(h) + '&sz=64';
      return '<a class="t" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + ic('globe', 16) +
        '<img class="fav" hidden alt="" width="18" height="18" loading="lazy" src="' + esc(fav) + '" onload="this.hidden=false;this.previousElementSibling.hidden=true">' + esc(h) + '</a>';
    }).join('');
    $('#pubfoot').innerHTML = '<div class="wrap"><div class="foot"><div><div class="brand" style="cursor:default">' + logoHTML(s) + '<span>' + esc(s.brand) + '</span></div><p>' + esc(s.sub || 'Etalase produk digital pilihan.') + '</p></div>' +
      '<div><h4>Navigasi Cepat</h4><nav><a href="#/">Beranda</a><a href="#/portofolio">Katalog Produk</a><button data-scroll="keunggulan">Keunggulan</button></nav></div>' +
      '<div id="kontak"><h4>Terhubung</h4>' + (soc ? '<div class="soc">' + soc + '</div>' : '') + '<p style="white-space:pre-line;margin-top:0">' + esc(s.kontak || 'Hubungi kami lewat halaman produk di Lynk.id.') + '</p></div></div>' +
      '<div class="copy"><span>© ' + new Date().getFullYear() + ' ' + esc(s.brand) + '. Seluruh hak cipta dilindungi.</span></div></div>';
  }
  function closeMenu() { var m = $('#mmenu'); if (m) m.classList.remove('open'); }

  // ---------- router ----------
  var pendingScroll = '', lastKey = '';
  function route(keep) {
    killSliders();
    var seg = (location.hash || '#/').slice(1).split('/').filter(Boolean), v = seg[0] || 'beranda';
    document.body.classList.remove('has-buybar');
    if (v === 'masuk' || v === 'admin') {
      document.body.classList.add('is-admin');
      loadAdmin().then(function () { window.AdminApp.render(v, seg); }).catch(function (e) { $('#view').innerHTML = '<div class="wrap">' + stateBox('alert', 'Dashboard gagal dimuat', e.message, '<button class="btn" data-act="retry">Coba Lagi</button>') + '</div>'; });
      return;
    }
    if (window.AdminApp && window.AdminApp.leave) window.AdminApp.leave();
    document.body.classList.remove('is-admin');
    if (['beranda', 'portofolio', 'produk'].indexOf(v) < 0) { location.replace('#/'); return; }
    var key = v + '/' + (seg[1] || '');
    document.title = (S.boot ? S.boot.set.brand : 'Portofolio Produk Digital');
    renderShell(v);
    var html;
    if (!S.boot) html = S.err ? errorView() : '<div class="wrap" style="padding-top:2rem"><div class="sk" style="height:300px;margin-bottom:1.5rem"></div>' + skelCards(3) + '</div>';
    else if (v === 'beranda') html = vBeranda();
    else if (v === 'portofolio') { document.title = 'Portofolio — ' + S.boot.set.brand; html = vPortofolio(); }
    else { html = vDetail(seg[1]); if (/class="buybar"/.test(html)) document.body.classList.add('has-buybar'); }
    var act = document.activeElement, refocus = act && act.id === 'cari';
    $('#view').innerHTML = html;
    if (S.boot) {
      initSliders();
      if (v === 'portofolio') { renderKatalog(); if (refocus) { var i = $('#cari'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
    }
    if (!(keep === true && key === lastKey)) window.scrollTo(0, 0);
    lastKey = key;
    if (pendingScroll) { var t = pendingScroll; pendingScroll = ''; setTimeout(function () { var el = document.getElementById(t); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40); }
  }

  var adminP = null;
  function loadAdmin() {
    if (window.AdminApp) return Promise.resolve();
    if (adminP) return adminP;
    adminP = new Promise(function (res, rej) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'admin.css'; document.head.appendChild(l);
      var s = document.createElement('script'); s.src = 'admin.js';
      s.onload = res; s.onerror = function () { adminP = null; rej(new Error('Periksa koneksi internet Anda lalu coba lagi.')); };
      document.head.appendChild(s);
    });
    return adminP;
  }

  // ---------- pemuatan data (stale-while-revalidate) ----------
  async function muatData(force) {
    if (!KONFIG_OK) { S.err = 'config'; route(true); return; }
    try {
      var r = null;
      if (!force && window.__boot) { r = await window.__boot; window.__boot = null; }
      if (!r || (r.nm && !S.boot)) r = await apiGet('boot', S.boot && S.pv ? { pv: S.pv } : {});
      S.t = Date.now();
      if (r.nm && S.boot) { S.err = ''; return; }
      if (!r.success) throw new Error(r.message || 'Data belum tersedia.');
      S.boot = r.data; S.pv = r.pv; S.err = '';
      LS.set('da_boot', { pv: r.pv, data: r.data });
      if (!/^#\/(admin|masuk)/.test(location.hash)) route(true);
    } catch (e) {
      if (!S.boot) { S.err = e.message; route(true); }
    }
  }

  // ---------- event ----------
  var taps = [];
  function logoTap() {
    var n = Date.now(); taps = taps.filter(function (t) { return n - t < 4000; }); taps.push(n);
    if (taps.length >= 5) { taps = []; location.hash = '#/masuk'; return; }
    if (location.hash && location.hash !== '#/') location.hash = '#/'; else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goScroll(id) {
    var h = location.hash || '#/';
    if (id === 'kontak' || /^#\/?$/.test(h)) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); closeMenu(); }
    else { pendingScroll = id; location.hash = '#/'; }
  }
  document.addEventListener('click', function (e) {
    var t = e.target, el;
    if ((el = t.closest('[data-sl]'))) { var sl = el.closest('.slider')._sl; if (sl) (el.dataset.sl === '1' ? sl.next() : sl.prev()); e.preventDefault(); return; }
    if ((el = t.closest('[data-dot]'))) { var s2 = el.closest('.slider')._sl; if (s2) s2.go(+el.dataset.dot); return; }
    if ((el = t.closest('[data-buy]'))) { track('Klik Beli', el.dataset.buy); flush(true); return; }
    if ((el = t.closest('[data-kat]'))) { S.kat = el.dataset.kat; if (el.dataset.goto) { S.q = ''; location.hash = '#/portofolio'; } else { S.lim = 60; renderKatalog(); } return; }
    if ((el = t.closest('[data-scroll]'))) { goScroll(el.dataset.scroll); return; }
    if ((el = t.closest('[data-act]'))) {
      var a = el.dataset.act;
      if (a === 'logo') logoTap();
      else if (a === 'menu') { var m = $('#mmenu'); if (m) m.classList.toggle('open'); }
      else if (a === 'retry') { S.err = ''; if (/^#\/(admin|masuk)/.test(location.hash)) route(); else { route(true); muatData(true); } }
      else if (a === 'more') { S.lim += 60; renderKatalog(); }
      else if (a === 'scrim' && t === el) closeModal();
      return;
    }
    if (t.closest('#mmenu a')) closeMenu();
    if (t.closest('#mmenu') && t === $('#mmenu')) closeMenu();
  });
  document.addEventListener('input', function (e) { if (e.target.id === 'cari') { S.q = e.target.value; S.lim = 60; renderKatalog(); } });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-form="cari"]');
    if (f) { e.preventDefault(); S.q = ($('#hq').value || '').trim(); S.kat = 'Semua'; S.lim = 60; location.hash = '#/portofolio'; }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); closeMenu(); } });
  // pemanasan gambar saat kursor/jari mendekati kartu → detail terasa instan
  var warmed = {};
  function warmProduk(e) {
    var c = e.target.closest && e.target.closest('.card'); if (!c || !S.boot) return;
    var id = c.dataset.id; if (warmed[id]) return; warmed[id] = 1;
    var p = S.boot.produk.filter(function (x) { return x.id === id; })[0];
    if (p) p.foto.slice(0, 2).forEach(function (f) { new Image().src = fotoUrl(f, 1200); });
  }
  document.addEventListener('pointerover', warmProduk, { passive: true });
  document.addEventListener('touchstart', warmProduk, { passive: true });
  window.addEventListener('hashchange', function () { route(false); });
  setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - S.t > 90000 && KONFIG_OK) muatData(true); }, 30000);

  // ---------- ekspor untuk dashboard ----------
  window.DA = {
    S: S, LS: LS, ic: ic, esc: esc, toast: toast, modal: modal, closeModal: closeModal, confirmDlg: confirmDlg, imgTag: imgTag, fotoUrl: fotoUrl,
    api: { get: apiGet, post: apiPost }, Auth: Auth, KONFIG_OK: KONFIG_OK,
    refreshPublic: function () { return muatData(true); }
  };

  // ---------- mulai ----------
  route();
  muatData();
  var idle = window.requestIdleCallback || function (f) { setTimeout(f, 2500); };
  idle(function () {
    ['admin.css', 'admin.js'].forEach(function (u) { var l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; document.head.appendChild(l); });
  });
})();
