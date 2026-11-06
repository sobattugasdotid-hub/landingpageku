/* Dashboard superadmin — dimuat lazy (setelah halaman publik selesai).
 * Semua perubahan bersifat OPTIMISTIS: tampilan berubah seketika, server menyusul di latar belakang.
 * Bila server menolak → tampilkan pesan, lalu sinkron ulang dari server. */
(function () {
  'use strict';
  var DA = window.DA, esc = DA.esc, ic = DA.ic, toast = DA.toast, LS = DA.LS, post = DA.api.post;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var TABS = [['ringkasan', 'Ringkasan', 'grid'], ['produk', 'Kelola Produk', 'box'], ['hero', 'Hero Slider', 'image'], ['pengaturan', 'Pengaturan', 'sliders']];
  var A = { loaded: false, produk: [], hero: [], set: {}, tab: 'ringkasan', range: '7', stat: {}, q: '', fk: '', fs: '', sk: 'urutan', sd: 1, page: 1, pend: false, dirty: false };
  var PAGE = 10, uid = 0;

  // ---------- util ----------
  function modalOpen() { return $('#modalRoot').children.length > 0; }
  function persist() { LS.set('da_adm', { produk: A.produk, hero: A.hero, set: A.set }); }
  function apply(d) { A.produk = d.produk || []; A.hero = d.hero || []; A.set = d.set || {}; }
  function clearCache() { ['da_adm', 'da_stat_7', 'da_stat_30', 'da_stat_all'].forEach(LS.del); }
  var refreshTimer = 0;
  function refreshSoon() { A.dirty = true; clearTimeout(refreshTimer); refreshTimer = setTimeout(function () { DA.refreshPublic(); }, 600); }
  function onErr(e) {
    if (e && e.code === 'AUTH') { DA.Auth.clear(); clearCache(); toast('Sesi berakhir. Silakan masuk lagi.', 'err'); location.hash = '#/masuk'; return; }
    toast(e && e.message ? e.message : 'Terjadi kesalahan.', 'err');
  }
  var cmp = function (a, b) { return ((a.urutan || 9999) - (b.urutan || 9999)) || String(a.dibuat || a.id).localeCompare(String(b.dibuat || b.id)); };
  function newId(pre) { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 3; i++) s += c[Math.floor(Math.random() * c.length)]; return pre + '-' + Date.now().toString(36).toUpperCase() + s; }
  function val(id) { var e = $(id); return e ? e.value : ''; }
  function host(u) { return String(u || '').replace(/^https?:\/\/(www\.)?/, ''); }
  async function sinkron() {
    try { var r = await post('admin.boot'); apply(r.data); A.loaded = true; persist(); if (!modalOpen()) paintTab(); else A.pend = true; }
    catch (e) { onErr(e); if (!A.loaded) $('#admMain').innerHTML = '<div class="box"><div class="empty-s">Data belum bisa dimuat. <button class="btn sm" data-a="muat" style="margin-left:.5rem">Coba Lagi</button></div></div>'; }
  }

  // ---------- foto: validasi + kompres di browser (lebih cepat diunggah) ----------
  async function kompres(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Format foto harus JPG, PNG, atau WEBP.');
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5 MB: ' + file.name);
    var blob = file;
    try {
      var bmp = await createImageBitmap(file), mx = 1600, sc = Math.min(1, mx / Math.max(bmp.width, bmp.height));
      var cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      var b = await new Promise(function (r) { cv.toBlob(r, 'image/webp', .86); });
      if (b && b.type === 'image/webp' && b.size < file.size) blob = b;
    } catch (e) { /* pakai berkas asli */ }
    var b64 = await new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(String(fr.result).split(',')[1]); }; fr.onerror = rej; fr.readAsDataURL(blob); });
    return { mime: blob.type, b64: b64, url: URL.createObjectURL(blob) };
  }

  // ---------- login ----------
  function vLogin() {
    $('#view').innerHTML = '<div class="login"><div class="login-frame"><form class="login-card" data-f="login" autocomplete="off"><h1>Masuk Superadmin</h1><p>Akses khusus pengelola konten &amp; analitik portofolio</p>' +
      '<div><label for="lp">Kunci Akses Superadmin</label><div class="pw" style="margin-top:.4rem">' + ic('lock', 20) + '<input type="password" id="lp" placeholder="Masukkan kata sandi…" autocomplete="current-password" data-autofocus><button type="button" data-a="eye" aria-label="Tampilkan kata sandi">' + ic('eye', 20) + '</button></div></div>' +
      '<div class="note">' + ic('shield', 18) + '<span>Kata sandi verifikasi superadmin diperlukan untuk memuat sesi kerja.</span></div><div class="ferr" id="lerr" hidden></div>' +
      '<button class="btn lg block" type="submit" id="lbtn">Masuk ke Dashboard ' + ic('arrow', 18) + '</button><hr><a class="back-link" href="#/">← Kembali ke Beranda Publik</a></form></div></div>';
    setTimeout(function () { var i = $('#lp'); if (i) i.focus(); }, 50);
  }
  document.addEventListener('submit', async function (e) {
    var f = e.target.closest('[data-f]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.f === 'login') {
      var b = $('#lbtn'), er = $('#lerr'), pw = val('#lp');
      if (!pw) { er.textContent = 'Masukkan kata sandi terlebih dahulu.'; er.hidden = false; return; }
      b.disabled = true; b.textContent = 'Memeriksa…'; er.hidden = true;
      try { var r = await post('login', { password: pw }, { token: '' }); DA.Auth.set(r.data.token, r.data.exp); location.hash = '#/admin'; }
      catch (x) { er.textContent = x.message; er.hidden = false; f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); b.disabled = false; b.innerHTML = 'Masuk ke Dashboard ' + ic('arrow', 18); }
    }
  });

  // ---------- kerangka ----------
  function shell() {
    var nav = TABS.map(function (t) { return '<a href="#/admin/' + t[0] + '" data-t="' + t[0] + '">' + ic(t[2], 20) + ' ' + t[1] + '</a>'; }).join('');
    var btm = TABS.map(function (t) { return '<a href="#/admin/' + t[0] + '" data-t="' + t[0] + '">' + ic(t[2], 22) + '<span>' + t[1].replace('Kelola ', '') + '</span></a>'; }).join('');
    var br = A.set.brand || 'Digital Atelier';
    $('#view').innerHTML = '<div class="adm" id="admShell"><aside class="side"><div class="side-top"><span class="logo">' + esc(br.charAt(0).toUpperCase()) + '</span><div><b>' + esc(br) + '</b><small>SUPERADMIN</small></div></div><nav>' + nav + '</nav>' +
      '<div class="side-foot"><a href="#/">' + ic('home', 20) + ' Ke Etalase Publik</a><button data-a="keluar">' + ic('logout', 20) + ' Keluar</button></div></aside>' +
      '<div class="adm-body"><header class="adm-top"><span class="logo">' + esc(br.charAt(0).toUpperCase()) + '</span><span>Console Administrasi</span><button class="out" data-a="keluar" aria-label="Keluar">' + ic('logout', 20) + '</button></header><main id="admMain"></main></div><nav class="btm">' + btm + '</nav></div>';
  }
  function markNav() { document.querySelectorAll('#admShell [data-t]').forEach(function (a) { a.classList.toggle('on', a.dataset.t === A.tab); }); }
  function render(view, seg) {
    var tok = DA.Auth.get();
    if (view === 'masuk') { if (tok) { location.replace('#/admin'); return; } document.title = 'Masuk Superadmin'; vLogin(); return; }
    if (!tok) { location.replace('#/masuk'); return; }
    var prev = A.tab;
    A.tab = TABS.some(function (t) { return t[0] === seg[1]; }) ? seg[1] : 'ringkasan';
    document.title = 'Console Administrasi';
    var fresh = !$('#admShell');
    if (fresh) { shell(); }
    markNav();
    if (!A.loaded) {
      var c = LS.get('da_adm');
      if (c) { apply(c); A.loaded = true; }
      sinkron();
    }
    if (fresh || prev !== A.tab || true) { paintTab(); window.scrollTo(0, 0); }
  }
  function leave() { if (modalOpen()) DA.closeModal(); if (A.dirty) { A.dirty = false; DA.refreshPublic(); } }

  function paintTab() {
    var m = $('#admMain'); if (!m) return;
    if (!A.loaded) { m.innerHTML = '<div class="sk" style="height:140px"></div><div class="sk" style="height:220px"></div><div class="sk" style="height:300px"></div>'; return; }
    m.innerHTML = A.tab === 'produk' ? vProduk() : A.tab === 'hero' ? vHero() : A.tab === 'pengaturan' ? vSet() : vRingkasan();
    if (A.tab === 'ringkasan') loadStat(A.range);
    if (A.tab === 'produk') paintTable();
  }

  // ---------- RINGKASAN ----------
  function vRingkasan() {
    var aktif = A.produk.filter(function (p) { return p.status === 'Aktif'; }).length;
    var hl = A.hero.slice().sort(cmp).map(function (h) {
      return '<div><span class="im">' + DA.imgTag(h.foto, h.judul || 'S', 160) + '</span><span class="t">' + esc(h.judul || '(tanpa judul)') + '</span><span class="badge ' + (h.status === 'Aktif' ? 'ok' : 'off') + '">' + h.status + '</span></div>';
    }).join('') || '<div class="empty-s">Belum ada slide. Etalase memakai foto produk sebagai gantinya.</div>';
    return '<div class="adm-head"><div><span class="badge ok"><i class="dot"></i> Superadmin Aktif</span><h1>Kelola Katalog Produk &amp; Statistik</h1><p>Pantau interaksi etalase, atur hero slider, dan kontrol katalog dengan cepat.</p></div>' +
      '<button class="btn" data-a="produk-baru">' + ic('plus', 18) + ' Tambah Produk Baru</button></div>' +
      '<div class="seg" role="tablist">' + [['7', '7 Hari'], ['30', '30 Hari'], ['all', 'Semua']].map(function (r) { return '<button data-a="range" data-r="' + r[0] + '" class="' + (A.range === r[0] ? 'on' : '') + '">' + r[1] + '</button>'; }).join('') + '</div>' +
      '<div class="statgrid" id="stCards"></div>' +
      '<div class="two"><div class="box"><h3>Tren Harian</h3><p>Lihat detail vs klik beli Lynk.id</p><div class="legend"><span><i style="background:#D8C4FF"></i>Lihat Detail</span><span><i style="background:#6D28D9"></i>Klik Beli</span></div><div id="chH"></div></div>' +
      '<div class="box"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Hero Slider</h3><a class="btn sm ghost" href="#/admin/hero">Kelola</a></div><p>' + A.hero.filter(function (h) { return h.status === 'Aktif'; }).length + ' slide aktif</p><div class="hl">' + hl + '</div></div></div>' +
      '<div class="two"><div class="box"><h3>Per Produk</h3><p>Produk dengan interaksi terbanyak</p><div class="legend"><span><i style="background:#D8C4FF"></i>Lihat Detail</span><span><i style="background:#6D28D9"></i>Klik Beli</span></div><div id="chP"></div></div>' +
      '<div class="box"><h3>Paling Sering Dilihat</h3><p>Diurutkan dari kunjungan detail</p><div class="top" id="topL"></div></div></div>' +
      '<span hidden id="aktifN" data-a="' + aktif + '" data-t="' + A.produk.length + '"></span>';
  }
  function niceTop(m) { var s = Math.max(m, 1) / 4, p = Math.pow(10, Math.floor(Math.log10(s))), n = s / p, k = [1, 2, 3, 4, 5, 6, 8, 10].filter(function (x) { return x >= n; })[0]; return Math.max(1, k * p) * 4; }
  function chart(items) {
    if (!items.length) return '<div class="empty-s">Belum ada data pada rentang ini.</div>';
    var W = 640, H = 230, pl = 32, pb = 30, pt = 10, n = items.length, mx = 0;
    items.forEach(function (i) { mx = Math.max(mx, i.a, i.b); });
    var top = niceTop(mx), ch = H - pt - pb, gw = (W - pl) / n, bw = Math.min(18, gw * .34), s = '';
    for (var k = 0; k <= 4; k++) { var y = pt + ch * (1 - k / 4); s += '<line class="gl" x1="' + pl + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text x="' + (pl - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + Math.round(top * k / 4) + '</text>'; }
    items.forEach(function (it, i) {
      var cx = pl + gw * i + gw / 2, ha = ch * it.a / top, hb = ch * it.b / top;
      s += '<rect class="b1" rx="3" x="' + (cx - bw - 1.5) + '" y="' + (pt + ch - ha) + '" width="' + bw + '" height="' + Math.max(ha, it.a ? 2 : 0) + '"><title>' + esc(it.l) + ': ' + it.a + ' lihat</title></rect>' +
        '<rect class="b2" rx="3" x="' + (cx + 1.5) + '" y="' + (pt + ch - hb) + '" width="' + bw + '" height="' + Math.max(hb, it.b ? 2 : 0) + '"><title>' + esc(it.l) + ': ' + it.b + ' klik beli</title></rect>';
      if (n <= 10 || i % Math.ceil(n / 10) === 0) s += '<text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(it.l.length > 10 ? it.l.slice(0, 9) + '…' : it.l) + '</text>';
    });
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafik batang">' + s + '</svg>';
  }
  function paintStat() {
    var st = A.stat[A.range], el = $('#stCards'); if (!el) return;
    var n = $('#aktifN'), aktif = n ? n.dataset.a : 0, tot = n ? n.dataset.t : 0;
    var c = function (l, v, i, extra) { return '<div class="sc"><div><small>' + l + '</small><b>' + v + (extra || '') + '</b></div><div class="feat-ic">' + ic(i, 22) + '</div></div>'; };
    el.innerHTML = c('Total Lihat Detail', st ? st.lihat : '…', 'eye') + c('Total Klik Beli Lynk.id', st ? st.beli : '…', 'cart') + c('Konversi', st ? st.konversi + '%' : '…', 'bolt') + c('Produk Aktif', aktif, 'package', ' <em>/ ' + tot + '</em>');
    $('#chH').innerHTML = st ? chart(st.harian.map(function (h) { return { l: h.d, a: h.lihat, b: h.beli }; })) : '<div class="sk" style="height:200px"></div>';
    $('#chP').innerHTML = st ? chart(st.produk.slice(0, 8).map(function (p) { return { l: p.nama, a: p.lihat, b: p.beli }; })) : '<div class="sk" style="height:200px"></div>';
    $('#topL').innerHTML = !st ? '<div class="sk" style="height:120px"></div>' : st.produk.length ? st.produk.slice(0, 5).map(function (p, i) { return '<div><span class="n">' + (i + 1) + '</span><span class="t">' + esc(p.nama) + '</span><span class="v">' + p.lihat + ' lihat · ' + p.beli + ' beli</span></div>'; }).join('') : '<div class="empty-s">Belum ada kunjungan tercatat.</div>';
  }
  async function loadStat(r) {
    var c = LS.get('da_stat_' + r); if (c && !A.stat[r]) A.stat[r] = c;
    paintStat();
    try { var j = await post('admin.statistik', { range: r }); A.stat[r] = j.data; LS.set('da_stat_' + r, j.data); if (A.tab === 'ringkasan' && A.range === r) paintStat(); }
    catch (e) { onErr(e); }
  }

  // ---------- PRODUK ----------
  function vProduk() {
    var kats = []; A.produk.forEach(function (p) { if (p.kat && kats.indexOf(p.kat) < 0) kats.push(p.kat); });
    return '<div class="adm-head"><div><h1 style="font-size:24px;margin:0">Katalog Produk Digital</h1><p>Kelola link pembelian Lynk.id, urutan tampil, dan status etalase publik.</p></div><button class="btn" data-a="produk-baru">' + ic('plus', 18) + ' Produk Baru</button></div>' +
      '<div class="box"><div class="tools"><div class="search">' + ic('search', 18) + '<input id="aq" type="search" placeholder="Cari nama produk…" value="' + esc(A.q) + '" autocomplete="off"></div>' +
      '<select class="sel" id="afk"><option value="">Semua Kategori</option>' + kats.map(function (k) { return '<option' + (A.fk === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
      '<select class="sel" id="afs"><option value="">Semua Status</option><option' + (A.fs === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (A.fs === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select></div><div id="ptbl"></div></div>';
  }
  function paintTable() {
    var el = $('#ptbl'); if (!el) return;
    var q = A.q.trim().toLowerCase();
    var L = A.produk.filter(function (p) { return (!q || (p.nama + ' ' + p.kat + ' ' + p.id).toLowerCase().indexOf(q) > -1) && (!A.fk || p.kat === A.fk) && (!A.fs || p.status === A.fs); });
    L.sort(function (a, b) { var k = A.sk, x = k === 'urutan' ? cmp(a, b) : String(a[k]).toLowerCase().localeCompare(String(b[k]).toLowerCase()); return x * A.sd; });
    var pages = Math.max(1, Math.ceil(L.length / PAGE)); if (A.page > pages) A.page = pages;
    var rows = L.slice((A.page - 1) * PAGE, A.page * PAGE);
    var th = function (k, t) { return '<button data-a="sort" data-k="' + k + '">' + t + (A.sk === k ? ic(A.sd > 0 ? 'up' : 'down', 12) : '') + '</button>'; };
    var h = '<div class="tbl"><div class="tr th"><div>' + th('nama', 'Produk') + '</div><div>' + th('kat', 'Kategori') + '</div><div>Harga</div><div>Tautan Lynk.id</div><div>' + th('urutan', 'Urutan') + '</div><div>' + th('status', 'Status') + '</div><div></div></div>';
    h += rows.map(function (p) {
      return '<div class="tr" data-id="' + esc(p.id) + '"><div class="c-prod"><span class="th-img">' + DA.imgTag(p.foto[0], p.nama, 160) + '</span><div style="min-width:0"><b>' + esc(p.nama) + '</b><small>ID: ' + esc(p.id) + ' · ' + p.foto.length + ' foto</small></div></div>' +
        '<div class="k"><span class="badge">' + esc(p.kat || '-') + '</span></div><div class="c-price">' + esc(p.harga || '—') + '</div>' +
        '<div class="c-link"><a href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(host(p.link)) + '</span>' + ic('ext', 14) + '</a></div>' +
        '<div class="c-ord"><button class="ib sm" data-a="naik" aria-label="Naikkan">' + ic('up', 14) + '</button><span>#' + (p.urutan || '-') + '</span><button class="ib sm" data-a="turun" aria-label="Turunkan">' + ic('down', 14) + '</button></div>' +
        '<div class="c-st"><button class="sw ' + (p.status === 'Aktif' ? 'on' : '') + '" role="switch" aria-checked="' + (p.status === 'Aktif') + '" data-a="toggle" aria-label="Status tampil"></button><span class="badge ' + (p.status === 'Aktif' ? 'ok' : 'off') + '">' + p.status + '</span></div>' +
        '<div class="c-act"><button class="ib" data-a="edit" aria-label="Ubah">' + ic('edit', 18) + '<span class="lbl"> Ubah</span></button><button class="ib dng" data-a="hapus" aria-label="Hapus">' + ic('trash', 18) + '<span class="lbl"> Hapus</span></button></div></div>';
    }).join('');
    if (!rows.length) h += '<div class="empty-s">' + (A.produk.length ? 'Tidak ada produk yang cocok dengan filter.' : 'Belum ada produk. Klik "Produk Baru" untuk mulai.') + '</div>';
    h += '</div><div class="pager"><span>Menampilkan ' + rows.length + ' dari ' + L.length + ' produk</span><div>';
    for (var i = 1; i <= pages; i++) h += '<button data-a="page" data-p="' + i + '" class="' + (i === A.page ? 'on' : '') + '">' + i + '</button>';
    el.innerHTML = h + '</div></div>';
  }
  function payloadP(p) { return { id: p.id, nama: p.nama, kat: p.kat, ring: p.ring, isi: p.isi, harga: p.harga, link: p.link, urutan: p.urutan, status: p.status, foto: p.foto }; }
  async function kirimP(p, formUlang) {
    try {
      var r = await post('produk.simpan', payloadP(p)), s = r.data.produk, i = A.produk.map(function (x) { return x.id; }).indexOf(s.id);
      if (i > -1) A.produk[i] = s; else A.produk.push(s);
      A.produk.sort(cmp); persist(); refreshSoon(); if (A.tab === 'produk' && !modalOpen()) paintTable();
      if (formUlang) toast('Produk tersimpan.', 'ok');
    } catch (e) { onErr(e); if (formUlang) formProduk(p, false, true); sinkron(); }
  }
  function upsertLocal(list, item) { var i = list.map(function (x) { return x.id; }).indexOf(item.id); if (i > -1) list[i] = item; else list.push(item); list.sort(cmp); }
  function geser(list, id, dir, kirim) {
    var L = list.slice().sort(cmp), i = L.map(function (x) { return x.id; }).indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= L.length) return;
    var ch = [], vals = L.map(function (x) { return x.urutan; });
    if (vals.indexOf(0) > -1 || vals.filter(function (v, k) { return vals.indexOf(v) !== k; }).length) L.forEach(function (x, k) { if (x.urutan !== k + 1) { x.urutan = k + 1; ch.push(x); } });
    var a = L[i], b = L[j], t = a.urutan; a.urutan = b.urutan; b.urutan = t;
    [a, b].forEach(function (x) { if (ch.indexOf(x) < 0) ch.push(x); });
    list.sort(cmp); persist(); if (A.tab === 'produk') paintTable(); else paintTab();
    ch.forEach(function (x) { kirim(x); });
  }

  // ---------- form produk ----------
  var F = null;
  function paintFotos() {
    var el = $('#fotos'); if (!el) return;
    el.innerHTML = F.fotos.map(function (t, i) {
      return '<div class="ft ' + (t.state === 'up' ? 'up' : '') + '"><img src="' + esc(t.url) + '" alt="">' + (i === 0 ? '<span class="cv">Sampul</span>' : '') +
        '<div class="ctl"><button type="button" data-a="ft-mv" data-i="' + i + '" data-d="-1" aria-label="Geser kiri">' + ic('chevL', 14) + '</button><button type="button" class="r" data-a="ft-rm" data-i="' + i + '" aria-label="Hapus foto">' + ic('x', 14) + '</button><button type="button" data-a="ft-mv" data-i="' + i + '" data-d="1" aria-label="Geser kanan">' + ic('chevR', 14) + '</button></div></div>';
    }).join('') + (F.fotos.length < (F.single ? 1 : 10) ? '<label class="add-ft">' + ic('upload', 22) + '<span>Tambah foto</span><input type="file" id="ffile" accept="image/jpeg,image/png,image/webp"' + (F.single ? '' : ' multiple') + '></label>' : '');
  }
  async function tambahFoto(files) {
    var max = F.single ? 1 : 10;
    for (var n = 0; n < files.length; n++) {
      if (F.fotos.length >= max) { toast('Maksimal ' + max + ' foto.', 'err'); break; }
      var k; try { k = await kompres(files[n]); } catch (e) { toast(e.message, 'err'); continue; }
      var t = { id: '', url: k.url, state: 'up' }; F.fotos.push(t); paintFotos();
      (function (t, k) {
        F.chain = F.chain.then(function () {
          return post('foto.unggah', { tipe: F.tipe, ref: F.ref, mime: k.mime, b64: k.b64 }).then(function (r) { t.id = r.data.id; t.state = 'ok'; paintFotos(); },
            function (e) { F.fotos.splice(F.fotos.indexOf(t), 1); paintFotos(); onErr(e); });
        });
      })(t, k);
    }
  }
  function fld(id, label, inner, hint, req) { return '<div class="fld"><label for="' + id + '">' + label + (req ? ' <i>*</i>' : '') + '</label>' + inner + (hint ? '<span class="hint">' + hint + '</span>' : '') + '<span class="ferr-i" id="e-' + id + '"></span></div>'; }
  function formProduk(item, isNew, retry) {
    var p = Object.assign({ id: newId('PRD'), nama: '', kat: '', ring: '', isi: '', harga: '', link: 'https://', urutan: '', status: 'Aktif', foto: [] }, item || {});
    F = { tipe: 'produk', ref: p.id, isNew: isNew, p: p, chain: Promise.resolve(), fotos: p.foto.map(function (id) { return { id: id, url: DA.fotoUrl(id, 300), state: 'ok' }; }) };
    var kats = []; A.produk.forEach(function (x) { if (x.kat && kats.indexOf(x.kat) < 0) kats.push(x.kat); });
    var d = DA.modal('<div class="dlg-h"><h3>' + (isNew ? 'Tambah Produk Baru' : 'Ubah Produk') + '</h3><button class="ib" data-a="tutup" aria-label="Tutup">' + ic('x', 20) + '</button></div><div class="dlg-b">' +
      fld('f-nama', 'Nama Produk', '<input class="inp" id="f-nama" maxlength="120" value="' + esc(p.nama) + '" data-autofocus>', '', true) +
      '<div class="grid2">' + fld('f-kat', 'Kategori', '<input class="inp" id="f-kat" list="kl" maxlength="60" value="' + esc(p.kat) + '" placeholder="mis. UI/UX Kits"><datalist id="kl">' + kats.map(function (k) { return '<option value="' + esc(k) + '">'; }).join('') + '</datalist>') +
      fld('f-harga', 'Harga Tampil', '<input class="inp" id="f-harga" maxlength="60" value="' + esc(p.harga) + '" placeholder="Rp 99.000 atau Gratis">') + '</div>' +
      fld('f-link', 'Link Lynk.id', '<input class="inp" id="f-link" type="url" inputmode="url" value="' + esc(p.link) + '" placeholder="https://lynk.id/…">', 'Harus diawali https://', true) +
      fld('f-ring', 'Deskripsi Singkat', '<input class="inp" id="f-ring" maxlength="200" value="' + esc(p.ring) + '">', 'Tampil di kartu produk (maks. 200 karakter).') +
      fld('f-isi', 'Deskripsi Lengkap', '<textarea class="inp" id="f-isi" rows="6">' + esc(p.isi) + '</textarea>', 'Awali baris dengan "- " untuk membuat daftar poin.') +
      '<div class="grid2">' + fld('f-urut', 'Urutan Tampil', '<input class="inp" id="f-urut" type="number" inputmode="numeric" step="1" value="' + esc(p.urutan || '') + '" placeholder="Otomatis di urutan terakhir">') +
      fld('f-st', 'Status Tampil', '<select class="inp" id="f-st"><option' + (p.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (p.status === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select>') + '</div>' +
      '<div class="fld"><label>Foto Produk</label><div class="fotos" id="fotos"></div><span class="hint">JPG, PNG, atau WEBP, maks. 5 MB per foto. Foto pertama jadi sampul; semua foto tampil sebagai slide di halaman detail.</span></div></div>' +
      '<div class="dlg-f"><button class="btn line" data-a="tutup">Batal</button><button class="btn" data-a="simpan-p" id="sbtn">Simpan Produk</button></div>', 'dlg-lg');
    paintFotos();
    if (retry) toast('Perubahan gagal disimpan. Data Anda dikembalikan ke formulir.', 'err');
    return d;
  }
  async function simpanForm() {
    var p = F.p, bad = false;
    var seterr = function (id, m) { var e = $('#e-' + id); if (e) e.textContent = m || ''; var i = $('#' + id); if (i) i.classList.toggle('bad', !!m); if (m) bad = true; };
    var nama = val('#f-nama').trim(), link = val('#f-link').trim(), urut = val('#f-urut').trim();
    seterr('f-nama', nama ? '' : 'Nama produk wajib diisi.');
    seterr('f-link', /^https:\/\/\S+$/i.test(link) ? '' : 'Link wajib diisi dan diawali https://');
    seterr('f-urut', urut === '' || isFinite(Number(urut)) ? '' : 'Urutan harus berupa angka.');
    if (bad) { var f = $('.inp.bad'); if (f) f.focus(); return; }
    var b = $('#sbtn'); b.disabled = true; b.textContent = F.fotos.some(function (t) { return t.state === 'up'; }) ? 'Menunggu unggahan foto…' : 'Menyimpan…';
    await F.chain;
    var item = Object.assign({}, p, { nama: nama, kat: val('#f-kat').trim() || 'Lainnya', harga: val('#f-harga').trim(), link: link, ring: val('#f-ring').trim(), isi: val('#f-isi'), urutan: urut === '' ? (F.isNew ? Math.max.apply(null, [0].concat(A.produk.map(function (x) { return x.urutan; }))) + 1 : p.urutan) : Number(urut), status: val('#f-st'), foto: F.fotos.filter(function (t) { return t.id; }).map(function (t) { return t.id; }) });
    DA.closeModal(); toast('Menyimpan…');
    upsertLocal(A.produk, item); persist(); if (A.tab === 'produk') paintTable(); else if (A.tab === 'ringkasan') paintTab();
    kirimP(item, true);
  }

  // ---------- HERO ----------
  function vHero() {
    var L = A.hero.slice().sort(cmp);
    return '<div class="adm-head"><div><h1 style="font-size:24px;margin:0">Hero Slider</h1><p>Slide foto yang bergulir otomatis di halaman depan. Atur urutan dan status tampilnya.</p></div><button class="btn" data-a="hero-baru">' + ic('plus', 18) + ' Slide Baru</button></div>' +
      '<div class="box"><div class="tbl">' + (L.length ? L.map(function (h) {
        return '<div class="tr" data-id="' + esc(h.id) + '" style="grid-template-columns:minmax(200px,2.4fr) 1.4fr 96px 110px 92px"><div class="c-prod"><span class="th-img" style="width:84px;height:54px">' + DA.imgTag(h.foto, h.judul || 'S', 200) + '</span><div style="min-width:0"><b>' + esc(h.judul || '(tanpa judul)') + '</b><small>' + esc(h.sub) + '</small></div></div>' +
          '<div class="c-link">' + (h.link ? '<a href="' + esc(h.link) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(host(h.link)) + '</span>' + ic('ext', 14) + '</a>' : '<small style="color:var(--mute)">Tanpa tautan</small>') + '</div>' +
          '<div class="c-ord"><button class="ib sm" data-a="h-naik">' + ic('up', 14) + '</button><span>#' + (h.urutan || '-') + '</span><button class="ib sm" data-a="h-turun">' + ic('down', 14) + '</button></div>' +
          '<div class="c-st"><button class="sw ' + (h.status === 'Aktif' ? 'on' : '') + '" role="switch" aria-checked="' + (h.status === 'Aktif') + '" data-a="h-toggle"></button><span class="badge ' + (h.status === 'Aktif' ? 'ok' : 'off') + '">' + h.status + '</span></div>' +
          '<div class="c-act"><button class="ib" data-a="h-edit">' + ic('edit', 18) + '<span class="lbl"> Ubah</span></button><button class="ib dng" data-a="h-hapus">' + ic('trash', 18) + '<span class="lbl"> Hapus</span></button></div></div>';
      }).join('') : '<div class="empty-s">Belum ada slide. Tanpa slide, etalase menampilkan foto produk di hero.</div>') + '</div></div>';
  }
  async function kirimH(h, formUlang) {
    try { var r = await post('hero.simpan', { id: h.id, judul: h.judul, sub: h.sub, foto: h.foto, link: h.link, urutan: h.urutan, status: h.status }); upsertLocal(A.hero, r.data.hero); persist(); refreshSoon(); if (A.tab === 'hero' && !modalOpen()) paintTab(); if (formUlang) toast('Slide tersimpan.', 'ok'); }
    catch (e) { onErr(e); if (formUlang) formHero(h, false, true); sinkron(); }
  }
  function formHero(item, isNew, retry) {
    var h = Object.assign({ id: newId('SLD'), judul: '', sub: '', foto: '', link: '', urutan: '', status: 'Aktif' }, item || {});
    F = { tipe: 'hero', ref: '', single: true, isNew: isNew, p: h, chain: Promise.resolve(), fotos: h.foto ? [{ id: h.foto, url: DA.fotoUrl(h.foto, 300), state: 'ok' }] : [] };
    DA.modal('<div class="dlg-h"><h3>' + (isNew ? 'Tambah Slide Hero' : 'Ubah Slide Hero') + '</h3><button class="ib" data-a="tutup" aria-label="Tutup">' + ic('x', 20) + '</button></div><div class="dlg-b">' +
      fld('h-judul', 'Judul Slide', '<input class="inp" id="h-judul" maxlength="100" value="' + esc(h.judul) + '" data-autofocus>') +
      fld('h-sub', 'Subjudul', '<input class="inp" id="h-sub" maxlength="200" value="' + esc(h.sub) + '">') +
      fld('h-link', 'Link Tujuan (opsional)', '<input class="inp" id="h-link" type="url" value="' + esc(h.link) + '" placeholder="https://…">', 'Bila diisi, slide bisa diklik dan membuka tautan ini di tab baru.') +
      '<div class="grid2">' + fld('h-urut', 'Urutan', '<input class="inp" id="h-urut" type="number" step="1" value="' + esc(h.urutan || '') + '" placeholder="Otomatis">') +
      fld('h-st', 'Status Tampil', '<select class="inp" id="h-st"><option' + (h.status === 'Aktif' ? ' selected' : '') + '>Aktif</option><option' + (h.status === 'Nonaktif' ? ' selected' : '') + '>Nonaktif</option></select>') + '</div>' +
      '<div class="fld"><label>Foto Slide</label><div class="fotos" id="fotos"></div><span class="hint">Disarankan landscape (rasio 4:3 atau 16:11). JPG, PNG, atau WEBP, maks. 5 MB.</span></div></div>' +
      '<div class="dlg-f"><button class="btn line" data-a="tutup">Batal</button><button class="btn" data-a="simpan-h" id="sbtn">Simpan Slide</button></div>', 'dlg-lg');
    paintFotos();
    if (retry) toast('Perubahan gagal disimpan. Data Anda dikembalikan ke formulir.', 'err');
  }
  async function simpanHero() {
    var h = F.p, judul = val('#h-judul').trim(), link = val('#h-link').trim(), urut = val('#h-urut').trim(), bad = false;
    var seterr = function (id, m) { var e = $('#e-' + id); if (e) e.textContent = m || ''; if (m) bad = true; };
    seterr('h-link', !link || /^https:\/\/\S+$/i.test(link) ? '' : 'Link harus diawali https://');
    seterr('h-urut', urut === '' || isFinite(Number(urut)) ? '' : 'Urutan harus berupa angka.');
    if (!judul && !F.fotos.length) { toast('Isi minimal judul atau foto slide.', 'err'); return; }
    if (bad) return;
    var b = $('#sbtn'); b.disabled = true; b.textContent = 'Menyimpan…'; await F.chain;
    var item = Object.assign({}, h, { judul: judul, sub: val('#h-sub').trim(), link: link, urutan: urut === '' ? Math.max.apply(null, [0].concat(A.hero.map(function (x) { return x.urutan; }))) + 1 : Number(urut), status: val('#h-st'), foto: (F.fotos[0] || {}).id || '' });
    DA.closeModal(); toast('Menyimpan…'); upsertLocal(A.hero, item); persist(); paintTab(); kirimH(item, true);
  }

  // ---------- PENGATURAN ----------
  function vSet() {
    var s = A.set;
    return '<div class="adm-head"><div><h1 style="font-size:24px;margin:0">Pengaturan</h1><p>Ubah identitas brand, teks hero, dan kontak. Perubahan langsung tampil di etalase.</p></div></div>' +
      '<div class="box grp"><h3>Brand &amp; Hero</h3>' +
      fld('s-brand', 'Nama Brand', '<input class="inp" id="s-brand" maxlength="60" value="' + esc(s.brand) + '">', '', true) +
      fld('s-judul', 'Judul Hero', '<input class="inp" id="s-judul" maxlength="120" value="' + esc(s.judul) + '">') +
      fld('s-sub', 'Subjudul Hero', '<textarea class="inp" id="s-sub" rows="2" maxlength="300">' + esc(s.sub) + '</textarea>') +
      fld('s-toko', 'Link Toko Lynk.id (tombol "Beli Sekarang" di menu atas)', '<input class="inp" id="s-toko" type="url" value="' + esc(s.toko) + '" placeholder="https://lynk.id/nama-toko">', 'Kosongkan agar tombol membuka halaman Portofolio.') +
      fld('s-kontak', 'Kontak', '<textarea class="inp" id="s-kontak" rows="3" maxlength="300">' + esc(s.kontak) + '</textarea>', 'Tampil di bagian bawah halaman. Boleh beberapa baris.') +
      fld('s-sosial', 'Tautan Sosial Media', '<textarea class="inp" id="s-sosial" rows="3" maxlength="600" placeholder="https://instagram.com/akunanda">' + esc(s.sosial) + '</textarea>', 'Satu tautan per baris, diawali https://') +
      '<div class="fld"><label>Foto Profil / Logo</label><div class="fotos" id="fotos"></div></div>' +
      '<div><button class="btn" data-a="simpan-s" id="sbtn">Simpan Pengaturan</button></div></div>' +
      '<div class="box grp"><h3>Keamanan</h3><p>Ganti kata sandi superadmin (minimal 10 karakter, huruf dan angka).</p>' +
      '<div class="grid2">' + fld('k-lama', 'Kata sandi lama', '<input class="inp" id="k-lama" type="password" autocomplete="current-password">') + fld('k-baru', 'Kata sandi baru', '<input class="inp" id="k-baru" type="password" autocomplete="new-password">') + '</div>' +
      '<div class="row-b"><button class="btn" data-a="ganti-sandi" id="kbtn">Ganti Kata Sandi</button><button class="btn line" data-a="cabut">Keluarkan Semua Perangkat Lain</button></div></div>' +
      '<div class="box grp"><h3>Impor Data dari Spreadsheet Lain</h3><p>Pindahkan Produk dan Hero Slide dari database lama dengan aman: sumber hanya dibaca, bisa diulang tanpa data ganda, dan ada mode pindai (dry-run). Gunakan akun Google yang sama agar foto tetap terbaca.</p>' +
      fld('i-src', 'URL atau ID Spreadsheet Sumber', '<input class="inp" id="i-src" placeholder="https://docs.google.com/spreadsheets/d/…">') +
      '<label class="chk"><input type="checkbox" id="i-timpa"> Timpa data yang sudah ada (berdasarkan ID)</label>' +
      '<div class="row-b"><button class="btn ghost" data-a="impor" data-dry="1">Pindai (Dry-run)</button><button class="btn" data-a="impor" data-dry="0">Jalankan Impor</button></div><div id="irep"></div></div>';
  }
  function initSetFoto() {
    var s = A.set; F = { tipe: 'profil', ref: '', single: true, chain: Promise.resolve(), fotos: s.foto ? [{ id: s.foto, url: DA.fotoUrl(s.foto, 300), state: 'ok' }] : [] }; paintFotos();
  }
  async function simpanSet() {
    var brand = val('#s-brand').trim(), toko = val('#s-toko').trim(), bad = false;
    var seterr = function (id, m) { var e = $('#e-' + id); if (e) e.textContent = m || ''; if (m) bad = true; };
    seterr('s-brand', brand ? '' : 'Nama brand wajib diisi.'); seterr('s-toko', !toko || /^https:\/\/\S+$/i.test(toko) ? '' : 'Link harus diawali https://');
    if (bad) return;
    var b = $('#sbtn'); b.disabled = true; b.textContent = 'Menyimpan…'; await F.chain;
    var prev = Object.assign({}, A.set);
    A.set = { brand: brand, judul: val('#s-judul').trim(), sub: val('#s-sub').trim(), toko: toko, kontak: val('#s-kontak'), sosial: val('#s-sosial'), foto: (F.fotos[0] || {}).id || '' };
    persist(); b.disabled = false; b.textContent = 'Simpan Pengaturan'; toast('Menyimpan…');
    try { await post('pengaturan.simpan', A.set); toast('Pengaturan tersimpan.', 'ok'); refreshSoon(); }
    catch (e) { A.set = prev; persist(); onErr(e); paintTab(); }
  }

  // ---------- aksi (delegasi klik) ----------
  document.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-a]'); if (!el || !(window.AdminApp)) return;
    var a = el.dataset.a, row = el.closest('[data-id]'), id = row ? row.dataset.id : '';
    var P = function () { return A.produk.filter(function (x) { return x.id === id; })[0]; };
    var H = function () { return A.hero.filter(function (x) { return x.id === id; })[0]; };
    switch (a) {
      case 'eye': var i = $('#lp'); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = ic(i.type === 'password' ? 'eye' : 'eyeoff', 20); break;
      case 'keluar': DA.Auth.clear(); clearCache(); A.loaded = false; A.stat = {}; location.hash = '#/masuk'; break;
      case 'muat': sinkron(); break;
      case 'range': A.range = el.dataset.r; document.querySelectorAll('.seg [data-r]').forEach(function (b) { b.classList.toggle('on', b.dataset.r === A.range); }); loadStat(A.range); break;
      case 'tutup': DA.closeModal(); if (A.pend) { A.pend = false; paintTab(); } break;
      case 'produk-baru': formProduk(null, true); break;
      case 'edit': if (P()) formProduk(P(), false); break;
      case 'simpan-p': simpanForm(); break;
      case 'toggle': { var p = P(); if (!p) break; p.status = p.status === 'Aktif' ? 'Nonaktif' : 'Aktif'; persist(); paintTable(); kirimP(p); break; }
      case 'naik': geser(A.produk, id, -1, kirimP); break;
      case 'turun': geser(A.produk, id, 1, kirimP); break;
      case 'sort': if (A.sk === el.dataset.k) A.sd = -A.sd; else { A.sk = el.dataset.k; A.sd = 1; } paintTable(); break;
      case 'page': A.page = +el.dataset.p; paintTable(); break;
      case 'hapus': {
        var pr = P(); if (!pr) break;
        if (await DA.confirmDlg({ judul: 'Hapus produk ini?', teks: '"' + pr.nama + '" akan dihapus permanen beserta fotonya dan tidak lagi tampil di halaman publik.', ok: 'Ya, Hapus', bahaya: true })) {
          A.produk = A.produk.filter(function (x) { return x.id !== pr.id; }); persist(); paintTable(); toast('Produk dihapus.', 'ok');
          post('produk.hapus', { id: pr.id }).then(refreshSoon, function (er) { onErr(er); sinkron(); });
        } break;
      }
      case 'hero-baru': formHero(null, true); break;
      case 'h-edit': if (H()) formHero(H(), false); break;
      case 'simpan-h': simpanHero(); break;
      case 'h-toggle': { var h = H(); if (!h) break; h.status = h.status === 'Aktif' ? 'Nonaktif' : 'Aktif'; persist(); paintTab(); kirimH(h); break; }
      case 'h-naik': geser(A.hero, id, -1, kirimH); break;
      case 'h-turun': geser(A.hero, id, 1, kirimH); break;
      case 'h-hapus': {
        var hh = H(); if (!hh) break;
        if (await DA.confirmDlg({ judul: 'Hapus slide ini?', teks: 'Slide "' + (hh.judul || 'tanpa judul') + '" akan dihapus permanen.', ok: 'Ya, Hapus', bahaya: true })) {
          A.hero = A.hero.filter(function (x) { return x.id !== hh.id; }); persist(); paintTab(); toast('Slide dihapus.', 'ok');
          post('hero.hapus', { id: hh.id }).then(refreshSoon, function (er) { onErr(er); sinkron(); });
        } break;
      }
      case 'ft-mv': { var k = +el.dataset.i, d = +el.dataset.d, j = k + d; if (j >= 0 && j < F.fotos.length) { var t = F.fotos[k]; F.fotos[k] = F.fotos[j]; F.fotos[j] = t; paintFotos(); } break; }
      case 'ft-rm': F.fotos.splice(+el.dataset.i, 1); paintFotos(); break;
      case 'simpan-s': simpanSet(); break;
      case 'ganti-sandi': {
        var lama = val('#k-lama'), baru = val('#k-baru'); if (!lama || !baru) { toast('Isi kata sandi lama dan baru.', 'err'); break; }
        el.disabled = true; el.textContent = 'Memproses…';
        try { var r = await post('sandi.ganti', { lama: lama, baru: baru }); DA.Auth.set(r.data.token, r.data.exp); toast(r.message, 'ok'); $('#k-lama').value = ''; $('#k-baru').value = ''; }
        catch (er) { onErr(er); }
        el.disabled = false; el.textContent = 'Ganti Kata Sandi'; break;
      }
      case 'cabut': try { var r2 = await post('sesi.cabut'); DA.Auth.set(r2.data.token, r2.data.exp); toast(r2.message, 'ok'); } catch (er) { onErr(er); } break;
      case 'impor': {
        var dry = el.dataset.dry === '1', src = val('#i-src').trim(); if (!src) { toast('Tempel URL spreadsheet sumber dulu.', 'err'); break; }
        if (!dry && !(await DA.confirmDlg({ judul: 'Jalankan impor?', teks: 'Data dari spreadsheet sumber akan ditambahkan ke database ini. Aman diulang, tidak membuat data ganda.', ok: 'Jalankan' }))) break;
        var rep = $('#irep'); rep.innerHTML = '<p class="hint" style="margin-top:.75rem">Memproses…</p>';
        try {
          var j = await post('impor.jalan', { sumber: src, dryRun: dry, timpa: $('#i-timpa').checked }), L = j.data.laporan;
          rep.innerHTML = '<p class="hint" style="margin-top:.75rem">' + (dry ? 'Hasil pindai (belum ada yang ditulis)' : 'Impor selesai') + ' dari "' + esc(j.data.sumber) + '"</p><div style="overflow-x:auto"><table class="rep"><tr><th>Data</th><th>Di sumber</th><th>Ditambah</th><th>Diperbarui</th><th>Dilewati</th></tr>' +
            Object.keys(L).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + L[k].sumber + '</td><td>' + L[k].ditambah + '</td><td>' + L[k].diperbarui + '</td><td>' + L[k].dilewati + '</td></tr>'; }).join('') + '</table></div>' +
            j.data.peringatan.map(function (w) { return '<div class="warn">' + esc(w) + '</div>'; }).join('');
          if (!dry) { await sinkron(); refreshSoon(); toast('Impor selesai.', 'ok'); }
        } catch (er) { rep.innerHTML = ''; onErr(er); }
        break;
      }
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'aq') { A.q = e.target.value; A.page = 1; paintTable(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'afk') { A.fk = t.value; A.page = 1; paintTable(); }
    else if (t.id === 'afs') { A.fs = t.value; A.page = 1; paintTable(); }
    else if (t.id === 'ffile' && F) { tambahFoto([].slice.call(t.files)); t.value = ''; }
  });
  // foto profil di tab pengaturan perlu diinisialisasi setelah tab digambar
  var _paint = paintTab;
  paintTab = function () { _paint(); if (A.loaded && A.tab === 'pengaturan' && !modalOpen()) initSetFoto(); };

  window.AdminApp = { render: render, leave: leave };
  // render pertama: app.js memanggil render() setelah skrip ini selesai dimuat
})();
