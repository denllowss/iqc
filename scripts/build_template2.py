#!/usr/bin/env python3
"""Rakit api/_template2.html (replika menu konteks WhatsApp iOS) dari api/_template.html.
Mengambil: seluruh blok <style> (font & CSS) + blok JS emoji Apple.
Body baru: status bar ala iOS/WA (jam putih), kartu preview pesan, menu konteks 7
baris, latar TETAP berupa percakapan WhatsApp tema gelap yang diburamkan.
Idempoten — jalankan ulang kapan saja."""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
T1 = open(os.path.join(BASE, '..', 'api', '_template.html'), encoding='utf-8').read()

# ---- 1) styles: dari <style> pertama sampai </style> terakhir sebelum <body>
i = T1.index('<style>')
j = T1.index('<body>')
styles = T1[i:T1.rindex('</style>', 0, j) + len('</style>')]

# ---- 2) emoji JS: dari komentar emoji sampai renderAppleEmojis() pertama
a = T1.index('/* ====== Emoji bergaya')
b = T1.index('renderAppleEmojis();', a) + len('renderAppleEmojis();')
emoji_js = T1[a:b]

TPL2 = '''<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IQC2 — Menu Konteks WhatsApp</title>
<meta property="og:title" content="IQC2">
<meta property="og:description" content="__PESAN_TEXT__">
@@STYLES@@
<style>
  /* ====== Semua teks memakai font iPhone (SF); Inter sbg fallback server ====== */
  #screen { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
            "SF Pro Display", "Inter", "NotoFancy", "XLang", "XTC", "XJP", "XKR",
            "Segoe UI", Roboto, sans-serif; }
  /* ====== Lingkungan luar: latar sama, gelapkan + blur ====== */
  html, body { background: #0b141a; }
  .backdrop { position: fixed; inset: 0; background-size: cover;
    background-position: center; background-repeat: no-repeat;
    filter: blur(30px) brightness(0.62) saturate(0.92);
    transform: scale(1.12); }
  /* ====== Status bar ala iOS (WhatsApp dark) ====== */
  .sb { position: absolute; left: 0; top: 0; width: 675px; height: 46px;
        z-index: 5; color: #fff; }
  .sb .carrier { position: absolute; left: 13px; top: 10px; display: flex;
        align-items: center; gap: 6px; font-size: 19.5px; font-weight: 600;
        color: #fff; letter-spacing: 0.1px; }
  .sb .carrier svg { width: 22px; height: 15px; }
  .sb .time { position: absolute; left: 0; right: 0; top: 8px; text-align: center;
        font-size: 20.5px; font-weight: 600; letter-spacing: 0.3px;
        color: #fff; /* jam selalu putih */ }
  .sb .sright { position: absolute; right: 14px; top: 11px; display: flex;
        align-items: center; gap: 6.5px; font-size: 17.5px; font-weight: 500;
        color: #fff; }
  .sb .sright svg.ic { width: 17px; height: 17px; }
  .batt { position: relative; left: 0; top: 0; width: 29px; height: 14px; }
  .batt .case { position: absolute; inset: 0; border: 1.4px solid __BATTCOLOR__;
        border-radius: 4.4px; }
  .batt .nub  { position: absolute; right: -3.8px; top: 4.3px; width: 2.5px; height: 5.4px;
        background: __BATTCOLOR__; border-radius: 0 2px 2px 0; }
  .batt .lvl  { position: absolute; left: 1.8px; top: 1.8px; bottom: 1.8px;
        background: __BATTCOLOR__; border-radius: 2.4px; }
  /* ====== Kartu preview + menu konteks ====== */
  #stack { position: absolute; left: 29px; bottom: 30px; width: 457px; z-index: 4;
        display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .preview { max-width: 446px; background: rgba(61, 61, 63, 0.98);
        border-radius: 18px; padding: 13px 16px 5px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.45); }
  .preview .sender { color: #EDAA1B; font-weight: 600; font-size: 24px; }
  .preview .msgtext { font-size: 26px; line-height: 33px; color: #fff;
        margin-top: 4px; overflow-wrap: anywhere; }
  .preview .msgtext img.apple-emoji { height: 27px; vertical-align: -5px; }
  .preview .msgtime { text-align: right; color: #7D7D7F; font-size: 19px;
        margin-top: 3px; line-height: 26px; }
  .menu { width: 457px; background: rgba(49, 49, 49, 0.9); border-radius: 14px;
        overflow: hidden; box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4); }
  .menu .row { height: 77.5px; display: flex; align-items: center;
        justify-content: space-between; padding: 0 18px 0 27px;
        font-size: 27px; color: #E8E7E5; }
  .menu .row + .row { border-top: 1px solid rgba(255, 255, 255, 0.07); }
  .menu .row svg { position: static; width: 29px; height: 29px; flex: none; }
  .menu .row.del { color: #E2554F; }
</style>
</head>
<body>
<div class="backdrop"></div>
<div id="screen">
  <div class="bg"></div>

  <div class="sb">
    <div class="carrier">
      <svg viewBox="0 0 22 15" fill="#fff"><rect x="0" y="10" width="3.5" height="5" rx="1"/><rect x="5.5" y="7.2" width="3.5" height="7.8" rx="1"/><rect x="11" y="4.2" width="3.5" height="10.8" rx="1"/><rect x="16.5" y="1" width="3.5" height="14" rx="1"/></svg>
      <span>XL Axiata LTE</span>
    </div>
    <div class="time"></div>
    <div class="sright">
      <svg class="ic" viewBox="0 0 17 17" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"><circle cx="8.5" cy="8.8" r="5.9"/><path d="M8.5 5.8v3.2l2.1 1.3"/><path d="M3.9 2.6L2.7 3.9M13.1 2.6l1.2 1.3"/></svg>
      <svg class="ic" viewBox="0 0 18 17" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M3.2 12.5v-3a5.8 5.8 0 0 1 11.6 0v3"/><rect x="1.8" y="10.6" width="3.5" height="5.2" rx="1.7"/><rect x="12.7" y="10.6" width="3.5" height="5.2" rx="1.7"/></svg>
      <span>__BATERAI__%</span>
      <div class="batt"><div class="case"></div><div class="lvl" style="width: calc((100% - 3.6px) * __BATTF__ + 0px);"></div><div class="nub"></div></div>
    </div>
  </div>

  <div id="stack">
    <div class="preview">
      <div class="sender">__NAMA__</div>
      <div class="msgtext" id="msg">__PESAN_HTML__</div>
      <div class="msgtime waktupesan"></div>
    </div>
    <div class="menu">
      <div class="row"><span>Beri Bintang</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.3 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.6l6.1-.8z"/></svg></div>
      <div class="row"><span>Balas</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L4 11l5.5 5.5"/><path d="M4 11h10a6 6 0 0 1 6 6v1.5"/></svg></div>
      <div class="row"><span>Teruskan</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L20 11l-5.5 5.5"/><path d="M20 11H10a6 6 0 0 0-6 6v1.5"/></svg></div>
      <div class="row"><span>Salin</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.8" stroke-linejoin="round"><rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></svg></div>
      <div class="row"><span>Balas Secara Pribadi</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5L4 11l5.5 5.5"/><path d="M4 11h10a6 6 0 0 1 6 6v1.5"/></svg></div>
      <div class="row"><span>Chat dengan __NAMA__</span><svg viewBox="0 0 24 24" fill="none" stroke="#E8E7E5" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c5 0 8.5 3.4 8.5 7.7S17 18.9 12 18.9c-1 0-2-.1-2.9-.4L4 20.5l1.6-4A7.6 7.6 0 0 1 3.5 11.2C3.5 6.9 7 3.5 12 3.5z"/></svg></div>
      <div class="row del"><span>Hapus</span><svg viewBox="0 0 24 24" fill="none" stroke="#E2554F" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16"/><path d="M9 6.5V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8v1.7"/><path d="M6 6.5l1 12.2A2 2 0 0 0 9 20.5h6a2 2 0 0 0 2-1.8l1-12.2"/><path d="M10 10.5v6M14 10.5v6"/></svg></div>
    </div>
  </div>
</div>

<script>
  var msg = document.getElementById('msg');
  var screenEl = document.getElementById('screen');

  /* ====== Skala kanvas — rasio TETAP 9:16 di semua perangkat ====== */
  function fit() {
    var vv = window.visualViewport;
    var vw = vv ? vv.width : window.innerWidth;
    var vh = vv ? vv.height : window.innerHeight;
    var sc = Math.min(vw / 675, vh / 1200);
    screenEl.style.transform = 'translate(-50%,-50%) scale(' + sc + ')';
  }
  window.addEventListener('resize', fit, { passive: true });
  window.addEventListener('orientationchange', fit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  fit();

  /* ====== Jam status bar & waktu pesan: WIB (Asia/Jakarta, UTC+7) ====== */
  function wib(d) {
    try {
      var t = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(d);
      if (t.indexOf('24') === 0) t = '00' + t.slice(2);
      return t;
    } catch (e) {
      var x = new Date(d.getTime() + (420 + d.getTimezoneOffset()) * 60000);
      return ('0' + x.getHours()).slice(-2) + '.' + ('0' + x.getMinutes()).slice(-2);
    }
  }
  var timeEl = document.querySelector('.time');
  function tickClock() {
    var now = new Date();
    timeEl.textContent = wib(now);
    document.querySelector('.waktupesan').textContent =
      wib(new Date(now.getTime() - 60000)); // pesan datang 1 menit lalu
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ====== Latar TETAP: percakapan WhatsApp tema gelap, diburamkan kuat ======
     Selalu percakapan yang sama (seed tetap) — bukan acak. */
  (function () {
    function mulberry32(a) {
      return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    var rnd = mulberry32(0x57A17A); // tetap -> latar identik tiap muat
    var W = 675, H = 1200;
    var off = document.createElement('canvas');
    off.width = W; off.height = H;
    var g = off.getContext('2d');

    /* dasar: kertas chat WA gelap + dinding samar */
    g.fillStyle = '#0B141A'; g.fillRect(0, 0, W, H);
    var i, x, y;
    for (i = 0; i < 90; i++) { /* doodle samar ala WA */
      g.fillStyle = 'rgba(222,232,238,0.028)';
      x = rnd() * W; y = rnd() * H; var r = 5 + rnd() * 16;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    function pill(c, px, py, pw, ph, rad) {
      g.fillStyle = c; g.beginPath();
      g.moveTo(px + rad, py);
      g.arcTo(px + pw, py, px + pw, py + ph, rad);
      g.arcTo(px + pw, py + ph, px, py + ph, rad);
      g.arcTo(px, py + ph, px, py, rad);
      g.arcTo(px, py, px + pw, py, rad);
      g.closePath(); g.fill();
    }
    function line(lx, ly, lw, lh, c) { g.fillStyle = c; g.fillRect(lx, ly, lw, lh); }
    function tick(tx, ty) { /* centang ganda biru */
      g.strokeStyle = '#53BDEB'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tx, ty + 4); g.lineTo(tx + 4, ty + 8); g.lineTo(tx + 12, ty - 2); g.stroke();
      g.beginPath(); g.moveTo(tx + 8, ty + 4); g.lineTo(tx + 12, ty + 8); g.lineTo(tx + 20, ty - 2); g.stroke();
    }
    /* pembatas tanggal (bar, tanpa teks -> deterministik) */
    pill('#182229', (W - 170) / 2, 96, 170, 42, 10);
    line(W / 2 - 31, 112, 62, 9, 'rgba(134,150,160,0.75)');

    var IN = '#202C33', OUT = '#005C4B', TXT = 'rgba(233,237,239,0.85)', META = 'rgba(134,150,160,0.8)';
    y = 175;
    var turn = 0;
    while (y < 1120) {
      var kanan = rnd() < 0.46;
      var bw = 190 + rnd() * 200;
      var tipe = rnd();
      if (tipe < 0.14) { /* foto */
        var bh = 130 + rnd() * 90;
        pill(kanan ? OUT : IN, kanan ? W - 44 - bw : 44, y, bw, bh, 16);
        g.fillStyle = kanan ? 'rgba(11,20,26,0.35)' : '#2A3942';
        g.beginPath();
        g.moveTo(kanan ? W - 44 - bw + 14 : 58, y + bh - 14);
        g.lineTo((kanan ? W - 44 - bw : 44) + bw * 0.45, y + 26);
        g.lineTo((kanan ? W - 44 - bw : 44) + bw * 0.8, y + bh - 14);
        g.closePath(); g.fill();
        g.beginPath(); g.arc((kanan ? W - 44 - bw : 44) + bw * 0.72, y + 38, 13, 0, 7);
        g.fillStyle = 'rgba(233,237,239,0.5)'; g.fill();
        y += bh;
      } else if (tipe < 0.26) { /* voice note */
        var bh2 = 66;
        pill(kanan ? OUT : IN, kanan ? W - 44 - 300 : 44, y, 300, bh2, 30);
        g.fillStyle = 'rgba(233,237,239,0.55)';
        g.beginPath(); g.arc((kanan ? W - 44 - 300 : 44) + 32, y + bh2 / 2, 12, 0, 7); g.fill();
        g.fillStyle = kanan ? '#0B141A' : '#202C33';
        g.beginPath();
        var px0 = (kanan ? W - 44 - 300 : 44) + 32;
        g.moveTo(px0 - 4, y + bh2 / 2 - 7); g.lineTo(px0 + 9, y + bh2 / 2); g.lineTo(px0 - 4, y + bh2 / 2 + 7);
        g.closePath(); g.fill();
        for (var wv = 0; wv < 22; wv++) {
          var wh = 4 + rnd() * 18;
          line((kanan ? W - 44 - 300 : 44) + 58 + wv * 10.5, y + bh2 / 2 - wh / 2, 3.5, wh,
               kanan ? 'rgba(11,20,26,0.5)' : 'rgba(134,150,160,0.55)');
        }
        y += bh2;
      } else { /* teks */
        var lines = 1 + Math.floor(rnd() * 3);
        var bh3 = 24 + lines * 26;
        pill(kanan ? OUT : IN, kanan ? W - 44 - bw : 44, y, bw, bh3, 16);
        for (var ln = 0; ln < lines; ln++) {
          var lw2 = (bw - 40) * (ln === lines - 1 ? 0.45 + rnd() * 0.35 : 0.8 + rnd() * 0.2);
          line((kanan ? W - 44 - bw : 44) + 20, y + 18 + ln * 26, lw2, 9, TXT);
        }
        var mx = (kanan ? W - 44 - bw : 44) + bw - (kanan ? 62 : 44);
        line(mx, y + bh3 - 24, 30, 8, META);
        if (kanan) tick(mx + 40, y + bh3 - 26);
        y += bh3;
      }
      y += 14 + rnd() * 16;
      turn++;
    }
    /* beberapa titik emoji samar */
    for (i = 0; i < 12; i++) {
      var cols = ['#F4B400', '#E5564B', '#4FAE4E', '#5B8DEF', '#F6D45C'];
      g.fillStyle = cols[Math.floor(rnd() * cols.length)];
      g.globalAlpha = 0.55;
      g.beginPath(); g.arc(60 + rnd() * (W - 120), 160 + rnd() * (H - 320), 8 + rnd() * 9, 0, 7); g.fill();
      g.globalAlpha = 1;
    }

    /* buramkan secukupnya (12px) — bubble tetap jelas terlihat */
    var fin = document.createElement('canvas');
    fin.width = W; fin.height = H;
    var fc = fin.getContext('2d');
    fc.filter = 'blur(12px)';
    fc.drawImage(off, 0, 0);
    fc.filter = 'none';
    var url = fin.toDataURL('image/jpeg', 0.9);
    var bg = document.querySelector('.bg');
    var bd = document.querySelector('.backdrop');
    if (bg) bg.style.backgroundImage = 'url("' + url + '")';
    if (bd) bd.style.backgroundImage = 'url("' + url + '")';
    window.__wpDone = true;
  })();

@@EMOJI@@
</script>
</body>
</html>
'''.replace('@@STYLES@@', styles).replace('@@EMOJI@@', emoji_js)

out = os.path.join(BASE, '..', 'api', '_template2.html')
open(out, 'w', encoding='utf-8').write(TPL2)
for ph in ('__NAMA__', '__PESAN_HTML__', '__PESAN_TEXT__', '__BATERAI__', '__BATTF__', '__BATTCOLOR__'):
    assert ph in TPL2, ph
print('template2 OK:', len(TPL2), 'bytes')
