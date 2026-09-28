#!/usr/bin/env python3
"""Rakit api/_template2.html (replika menu konteks WhatsApp iOS) dari api/_template.html.
Mengambil: seluruh blok <style> (font & CSS) + blok JS emoji Apple.
Body baru: status bar ala WA (carrier), kartu preview pesan, menu konteks 7 baris,
latar TETAP (bukan acak), jam WIB. Idempoten — jalankan ulang kapan saja."""
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
  /* ====== Lingkungan luar: gelap hangat + backdrop blur senada ====== */
  html, body { background: #0b0a09; }
  .backdrop { position: fixed; inset: 0; background-size: cover;
    background-position: center; background-repeat: no-repeat;
    filter: blur(26px) brightness(0.5) saturate(0.9);
    transform: scale(1.1); }
  /* ====== Layout khusus iqc2 (menu konteks WhatsApp iOS) ====== */
  .sb { position: absolute; left: 0; top: 0; width: 675px; height: 44px;
        z-index: 5; color: #fff; }
  .sb .carrier { position: absolute; left: 12px; top: 8px; display: flex;
        align-items: center; gap: 5px; font-size: 19px; font-weight: 600; }
  .sb .carrier svg { width: 21px; height: 15px; }
  .sb .time { position: absolute; left: 0; right: 0; top: 6px; text-align: center;
        font-size: 22px; font-weight: 600; letter-spacing: 0.2px; }
  .sb .sright { position: absolute; right: 14px; top: 9px; display: flex;
        align-items: center; gap: 6px; font-size: 17px; font-weight: 500; }
  .sb .sright svg.ic { width: 16px; height: 16px; }
  .batt { position: relative; width: 29px; height: 14px; }
  .batt .case { position: absolute; inset: 0; border: 1.4px solid rgba(255,255,255,0.55);
        border-radius: 4.2px; }
  .batt .nub  { position: absolute; right: -3.6px; top: 4.2px; width: 2.4px; height: 5.6px;
        background: rgba(255,255,255,0.55); border-radius: 0 2px 2px 0; }
  .batt .lvl  { position: absolute; left: 1.7px; top: 1.7px; bottom: 1.7px;
        background: __BATTCOLOR__; border-radius: 2.4px; }
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
  .menu { width: 457px; background: #313131; border-radius: 14px; overflow: hidden;
        box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5); }
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
      <svg viewBox="0 0 21 15" fill="#fff"><rect x="0" y="9.5" width="3.6" height="5.5" rx="1"/><rect x="5.6" y="6.5" width="3.6" height="8.5" rx="1"/><rect x="11.2" y="3.5" width="3.6" height="11.5" rx="1"/><rect x="16.8" y="0.5" width="3.6" height="14.5" rx="1" opacity="0.35"/></svg>
      <span>XL Axiata LTE</span>
    </div>
    <div class="time"></div>
    <div class="sright">
      <svg class="ic" viewBox="0 0 16 16" fill="none" stroke="#fff" stroke-width="1.5"><circle cx="8" cy="8" r="6.4"/><path d="M8 4.6V8l2.4 1.6" stroke-linecap="round"/></svg>
      <svg class="ic" viewBox="0 0 18 16" fill="none" stroke="#fff" stroke-width="1.6"><path d="M3 10v-2a6 6 0 0 1 12 0v2"/><rect x="1.6" y="9" width="3.6" height="5.4" rx="1.6"/><rect x="12.8" y="9" width="3.6" height="5.4" rx="1.6"/></svg>
      <span>__BATERAI__%</span>
      <div class="batt"><div class="case"></div><div class="lvl" style="width: calc((100% - 3.4px) * __BATTF__ + 0px);"></div><div class="nub"></div></div>
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

  /* ====== Latar TETAP: ruangan blur hangat (bukan acak) ====== */
  (function () {
    var cv = document.createElement('canvas');
    cv.width = 675; cv.height = 1200;
    var g = cv.getContext('2d');
    function blob(c, x, y, w, h) {
      g.fillStyle = c; g.beginPath();
      g.ellipse(x, y, w / 2, h / 2, 0, 0, 7); g.fill();
    }
    g.fillStyle = '#241f1a'; g.fillRect(0, 0, 675, 1200);
    g.filter = 'blur(46px)';
    blob('#18151a', 400, 40, 660, 300);   // langit-langit gelap
    blob('#5a4832', 140, 300, 420, 340);  // cahaya hangat kiri
    blob('#7a6244', 500, 400, 340, 300);  // lampu tengah kanan
    blob('#3a2f26', 90, 760, 430, 400);   // sofa/furnitur kiri
    blob('#4a3b2c', 450, 900, 400, 360);  // meja bawah kanan
    blob('#1a1512', 340, 1170, 600, 280); // lantai gelap
    blob('#8f7350', 60, 120, 240, 220);   // jendela terang kiri atas
    blob('#6f5a40', 620, 130, 220, 200);  // pantulan kanan atas
    g.filter = 'blur(18px)';
    blob('#a8895f', 190, 230, 96, 96);    // bokeh terang
    blob('#8d734f', 540, 330, 80, 80);
    blob('#7c6547', 100, 620, 110, 110);
    blob('#8a7052', 610, 760, 92, 92);
    blob('#6b5741', 330, 1010, 130, 130);
    g.filter = 'none';
    var url = cv.toDataURL('image/jpeg', 0.92);
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
