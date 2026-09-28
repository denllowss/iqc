// ============================================================
//  IQC — Instagram Quote Card API (Vercel Serverless Function)
//
//  GET /iqc?pesan=halo❤          ->  FOTO JPG (render headless Chromium)
//  GET /iqc?pesan=halo❤&html=1   ->  halaman interaktif (HTML)
//  GET /iqc?pesan=...&seed=42    ->  wallpaper terkunci sesuai seed
//  GET /iqc                      ->  pesan default
//
//  Dependensi: puppeteer-core + @sparticuz/chromium (ramah serverless)
// ============================================================
const fs = require('fs');
const path = require('path');

const DEFAULT_MSG = 'see u, hopefully we will meet in the next life.';
const MAX_LEN = 1000;
const W = 675, H = 1200, SCALE = 2; // hasil akhir 1350 x 2400 px (9:16)

let cache = null;
function getTemplate() {
  if (cache) return cache;
  const candidates = [
    path.join(__dirname, '_template.html'),
    path.join(process.cwd(), 'api', '_template.html'),
    path.join(process.cwd(), '_template.html'),
  ];
  for (const p of candidates) {
    try {
      cache = fs.readFileSync(p, 'utf8');
      return cache;
    } catch (e) { /* kandidat berikutnya */ }
  }
  throw new Error('template _template.html tidak ditemukan');
}

/* Gabung template dalam SATU lintas: template dipecah sekali (cache),
   lalu tiap request hanya menjahit nilai — hemat ~200ms di template v2. */
const segCache = {};
function segs(key, tpl) {
  if (!segCache[key]) {
    segCache[key] = tpl.split(/__(NAMA|PESAN_HTML|PESAN_TEXT|BATERAI|BATTF|BATTCOLOR)__/);
  }
  return segCache[key];
}
function gabung(arr, vals) {
  let out = '';
  for (let i = 0; i < arr.length; i++) {
    if (i & 1) { const v = vals[arr[i]]; out += v === undefined ? '' : v; }
    else out += arr[i];
  }
  return out;
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Format teks gaya WhatsApp ----------
   *tebal*  _miring_  ~coret~  `kode`  ```blok mono```
   Daftar : "* teks" / "- teks" / "1. teks"   Kutip: "> teks" */
function waInline(escaped) {
  // satu pass: span kode diproses lebih dulu (isi kode tak ikut diformat)
  return escaped.replace(
    /```([\s\S]+?)```|`([^`\n]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_|~([^~\n]+?)~/g,
    function (m, mono3, mono1, b, i, s) {
      if (mono3 !== undefined) return '<code class="wa-mono">' + mono3 + '</code>';
      if (mono1 !== undefined) return '<code class="wa-mono">' + mono1 + '</code>';
      if (b !== undefined) return '<b>' + b + '</b>';
      if (i !== undefined) return '<i>' + i + '</i>';
      return '<s>' + s + '</s>';
    }
  );
}

function waToHtml(raw) {
  raw = String(raw || '').replace(/\r\n?/g, '\n');

  // blok ```mono``` bisa multiline -> jadikan token agar aman dari split baris
  const codeBlocks = [];
  raw = raw.replace(/```([\s\S]+?)```/g, function (m, inner) {
    codeBlocks.push('<code class="wa-mono">' + esc(inner).replace(/\n/g, '<br>') + '</code>');
    return '\u0002' + (codeBlocks.length - 1) + '\u0002';
  });

  const lines = raw.split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol' | 'quote' | null

  function closeList() {
    if (!list) return;
    out.push('</' + (list === 'quote' ? 'blockquote' : list) + '>');
    list = null;
  }

  lines.forEach(function (line) {
    const t = line.trim();
    let m;

    if ((m = t.match(/^[*-]\s+(.+)$/))) {            // daftar berpoin
      if (list !== 'ul') { closeList(); out.push('<ul class="wa">'); list = 'ul'; }
      out.push('<li>' + waInline(esc(m[1])) + '</li>');
      return;
    }
    if ((m = t.match(/^(\d{1,3})[.)]\s+(.+)$/))) {   // daftar bernomor
      if (list !== 'ol') { closeList(); out.push('<ol class="wa">'); list = 'ol'; }
      out.push('<li>' + waInline(esc(m[2])) + '</li>');
      return;
    }
    if ((m = t.match(/^>\s?(.*)$/))) {               // tanda kutip
      if (list !== 'quote') { closeList(); out.push('<blockquote class="wa">'); list = 'quote'; }
      out.push((list === 'quote' && out[out.length - 1] !== '<blockquote class="wa">'
                ? '<br>' : '') + waInline(esc(m[1])));
      return;
    }

    closeList();
    if (t === '') {
      if (out.length && out[out.length - 1] !== '') out.push('');
      return;
    }
    out.push(waInline(esc(t)));
  });
  closeList();

  // rangkai: baris teks dipisah <br>, elemen blok mengalir tanpa <br> ekstra
  let html = '', prevBlock = true; // teks pertama tak perlu <br>
  out.forEach(function (piece) {
    if (piece === '') {
      if (html && !prevBlock) html += '<br>';
      prevBlock = false;
      return;
    }
    if (piece === '<br>') {              // jeda eksplisit (mis. antar baris kutipan)
      if (!prevBlock) html += '<br>';
      prevBlock = false;
      return;
    }
    const isOpen  = /^<(ul|ol|blockquote|li)/.test(piece);
    const isClose = /^<\/(ul|ol|blockquote|li)/.test(piece);
    if (isOpen || isClose) {
      if (isOpen && !prevBlock) html += '<br>';   // teks sebelum list: beri jeda baris
      html += piece;
      prevBlock = true;
      return;
    }
    const startsWithBr = piece.indexOf('<br>') === 0; // piece gabungan dari kutipan multi-baris
    if (!startsWithBr && html && !prevBlock) html += '<br>';
    html += piece;
    prevBlock = false;
  });
  // kembalikan blok kode dari token
  return html.replace(/\u0002(\d+)\u0002/g, function (m, i) { return codeBlocks[+i]; });
}

let tpl2Cache = null;
function getTemplate2() {
  if (!tpl2Cache) tpl2Cache = fs.readFileSync(path.join(__dirname, '_template2.html'), 'utf8');
  return tpl2Cache;
}

function bacaParams(req) {
  const url = new URL(req.url, 'http://x'); // host diabaikan; path+query saja
  let pesan = (url.searchParams.get('pesan') || '').trim();
  pesan = pesan.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, MAX_LEN);
  if (!pesan) pesan = DEFAULT_MSG;
  const seedQ = url.searchParams.get('seed');
  const seed = /^\d+$/.test(seedQ || '') ? parseInt(seedQ, 10) >>> 0
             : (Math.random() * 4294967296) >>> 0;
  const modeQ = (url.searchParams.get('mode') || '').toLowerCase();
  const mode = modeQ === 'dark' ? 'dark' : modeQ === 'light' ? 'light' : null;
  let nama = (url.searchParams.get('name') || '').replace(/[\u0000-\u001F]/g, '').trim().slice(0, 30);
  if (!nama) nama = 'Jidar';
  const isV2 = url.searchParams.get('v2') === '1' ||
               url.pathname.replace(/\/+$/, '').endsWith('/iqc2');
  return { pesan, seed, mode, nama, isV2 };
}

function buildHtml(pesan, seed, mode) {
  const pesanHtml = waToHtml(pesan);                                  // bubble (format WA)
  const pesanText = esc(pesan).replace(/\s*[\r\n]+\s*/g, ' ').trim(); // og:description (teks polos)
  // injeksi seed + mode agar hasil deterministik saat dirender headless
  const inj = '<script>window.__SEED=' + seed + ';' +
    (mode ? 'window.__MODE="' + mode + '";' : '') + '</script>';
  return gabung(segs('v1', getTemplate()),
                { PESAN_HTML: pesanHtml, PESAN_TEXT: pesanText })
    .replace('<body>', '<body>' + inj);
}

/* v2: replika menu konteks WhatsApp — nama bisa &name=, latar TETAP,
   baterai acak 30-100 (deterministik bila &seed=), jam WIB */
function buildHtml2(pesan, nama, seed, mode) {
  const pesanHtml = waToHtml(pesan);
  const pesanText = esc(pesan).replace(/\s*[\r\n]+\s*/g, ' ').trim();
  // baterai acak 30-100; seed sama -> baterai sama
  let t = seed >>> 0;
  t = (t + 0x6D2B79F5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const batt = 30 + (((r ^ (r >>> 14)) >>> 0) % 71);
  const warna = batt <= 60 ? '#F7CE46' : '#FFFFFF'; // kuning = mode hemat daya
  // tema light/dark (default dark, sesuai referensi WA iOS)
  const inj = '<script>' + (mode ? 'window.__MODE="' + mode + '";' : '') + '</script>';
  return gabung(segs('v2', getTemplate2()), {
    NAMA: esc(nama),
    PESAN_HTML: pesanHtml,
    PESAN_TEXT: pesanText,
    BATERAI: String(batt),
    BATTF: String(batt / 100),
    BATTCOLOR: warna,
  }).replace('<body>', '<body>' + inj);
}

/* ---------- render JPG via headless Chromium ----------
   Cepat: 1 browser hangat dipakai ulang antar request (launch hanya saat
   cold start / crash), tunggu 'load' + sinyal eksplisit, tanpa tidur panjang. */
let chromiumMod = null, puppeteerMod = null;
let browserPromise = null;   // promise browser yang dipakai bersama

function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      if (!chromiumMod) chromiumMod = require('@sparticuz/chromium');
      if (!puppeteerMod) puppeteerMod = require('puppeteer-core');
      const chromium = chromiumMod;
      const puppeteer = puppeteerMod;
      return puppeteer.launch({
        args: [...chromium.args, '--force-device-scale-factor=' + SCALE,
               '--disable-component-update', '--disable-sync',
               '--disable-features=Translate'],
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        defaultViewport: { width: W, height: H, deviceScaleFactor: SCALE },
      });
    })().catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

async function renderJpg(html) {
  const browser = await getBrowser();
  let page;
  try {
    page = await browser.newPage();

    // muat dokumen; emoji CDN ditunggu lewat waitForFunction di bawah
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
      .catch(() => {});
    // pastikan wallpaper final (render ulang setelah emoji termuat) & emoji bubble siap
    await page.waitForFunction(() => {
      const bg = document.querySelector('.bg');
      const imgs = document.querySelectorAll('#msg img.apple-emoji');
      return window.__wpDone === true &&
             !!bg && bg.style.backgroundImage.length > 60 &&
             Array.prototype.every.call(imgs, function (i) { return i.complete; });
    }, { polling: 120, timeout: 20000 }).catch(() => {});
    // font kustom (fraktur/CJK/dll) — dibatasi 4 dtk agar tak menggantung
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 4000)),
    ]).catch(() => {});
    await new Promise((r) => setTimeout(r, 250)); // buffer singkat paint akhir

    return await page.screenshot({ type: 'jpeg', quality: 90, fullPage: false });
  } catch (e) {
    // browser/tab mati (crash, OOM) -> buang instance hangat, request berikutnya launch baru
    const msg = String((e && e.message) || e);
    if (/Target closed|Session closed|Browser has been closed|detached|Disconnect/i.test(msg)) {
      browserPromise = null;
      try { await browser.close(); } catch (_) {}
    }
    throw e;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// pemanasan: saat cold start, browser langsung disiapkan di latar belakang
getBrowser().catch(() => {});

/* Foto "gagal membuat gambar" — dikirim bila render gagal total,
   supaya hasil endpoint SELALU berbentuk foto. */
const ERROR_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAQDAwMDAgQDAwMEBAQFBgoGBgUFBgwICQcKDgwPDg4MDQ0PERYTDxAVEQ0NExoTFRcYGRkZDxIbHRsYHRYYGRj/2wBDAQQEBAYFBgsGBgsYEA0QGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBj/wAARCASwAqMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7QooorhOoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKa7pGheRlVR1LHAplxN5EO4I0jkhURersegFauneH1Yx3mrqs0+04g4Mcefbuffp+QNVGLk9CZSSMeC4mvWK6fZXFzzgOF2pnGSCx6cetT/ZNe/6A3/kwldfRWyorqzP2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKPsmvf9Ab/wAmErr6KPYoPaM5D7Jr3/QG/wDJhKPsmvf9Ab/yYSuvoo9ig9ozkPsmvf8AQG/8mEo+ya9/0Bv/ACYSuvoo9ig9ozkPsmvf9Ab/AMmEo+ya9/0Bv/JhK6+ij2KD2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKPsmvf9Ab/wAmErr6KPYoPaM5D7Jr3/QG/wDJhKPsmvf9Ab/yYSuvoo9ig9ozkPsmvf8AQG/8mEo+ya9/0Bv/ACYSuvoo9ig9ozkPsmvf9Ab/AMmEo+ya9/0Bv/JhK6+ij2KD2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKPsmvf9Ab/wAmErr6KPYoPaM5D7Jr3/QG/wDJhKPsmvf9Ab/yYSuvoo9ig9ozkPsmvf8AQG/8mEo+ya9/0Bv/ACYSuvoo9ig9ozkPsmvf9Ab/AMmEo+ya9/0Bv/JhK6+ij2KD2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKPsmvf9Ab/wAmErr6KPYoPaM5D7Jr3/QG/wDJhKPsmvf9Ab/yYSuvoo9ig9ozkPsmvf8AQG/8mEo+ya9/0Bv/ACYSuvoo9ig9ozkPsmvf9Ab/AMmEo+ya9/0Bv/JhK6+ij2KD2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKPsmvf9Ab/wAmErr6KPYoPaM5D7Jr3/QG/wDJhKPsmvf9Ab/yYSuvoo9ig9ozkPsmvf8AQG/8mEo+ya9/0Bv/ACYSuvoo9ig9ozkPsmvf9Ab/AMmEo+ya9/0Bv/JhK6+ij2KD2jOQ+ya9/wBAb/yYSj7Jr3/QG/8AJhK6+ij2KD2jOQ+ya9/0Bv8AyYSj7Jr3/QG/8mErr6KPYoPaM5D7Jr3/AEBv/JhKRoNZiQyTaPKEHXypFkb8FHJrsKKPYoPaM4mG8gmkMWWjlUkNFINrAjtj8KsV0l/p1nqVsYbuFW4IV8fMnup7dBXM3VtdaXfJbzky2snyw3B65/uv7+/f88ZzpuOpcZpjqKKKzLCiiigAooooAKKKKACiiigAooooAKKKjnkMVrLKoBKoWGfYUAXPD1tHe6jNqjNuWBjDAA3AOPmYjv1AH8uldNWfoUCW/huyjQsQYg/Pq3zH9TWhXXBWic8ndhRRRVkhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABUF7Zw39hJZ3AYxyDB2nBHOQR+IFT0UAcTaO+2S2mZWmt3MUhBzkg4z68/wCNWKfqiCHxfKFyfPt1lbPYg7Rj2wKZXFJWdjpTurhRRRSGFFFFABRRRQAUUUUAFFFFABUN5/yD5/8Arm38qmqG8/5B8/8A1zb+VAHUaT/yALH/AK94/wD0EVcqnpP/ACALH/r3j/8AQRVyu1bHMwooopiCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKhnu7a2x50qqT26n8hWdfawFzFZn5geZMZH4etYpJZizEkk5JPesZ1ktEdNPDOWstDYl13qIIPozn+g/xqrJrF87ZV1jGOiqP65qhRWDqSfU6lRguhd/tW/wD+fj/xxf8ACp49cuVKiSONwBzjIJ/z9Ky6KFOS6jdKD6HRW+sWsoAlzC2cYbkfn/jV8EMoZSCCMgjvXHVZtL6ezf5DlCcsh6H/AArSNb+YwnhVvE6mioLW7hu4i8RPBwVPUVPXQnfVHG007MKKKKYgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAOW1r/kcE/68x/6GaiqXWv+RwT/AK8x/wChmoq45/EzojsFFFFSUFFFFABRRRQAUUUUAFFFFABUN5/yD5/+ubfyqaobz/kHz/8AXNv5UAdRpP8AyALH/r3j/wDQRVyqek/8gCx/694//QRVyu1bHMwooopiCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArF1bUDuNpA4xj94w/9Bq9qV2bSzLIR5jHC9/qf8+1czWFadvdR14elf3mFFFFcx2hRRRQAUUUUAFFFFAEtvcS204libDDt2I9DXUW1wl1bLMhHI5AP3T6VyVXdMuza3gViBHIQGz29DWtKfK7PYwr0udXW50tFFFdZ5wUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHLa1/wAjgn/XmP8A0M1FUutf8jgn/XmP/QzUVcc/iZ0R2CiiipKCiiigAooooAKKKKACiiigAqG8/wCQfP8A9c2/lU1Q3n/IPn/65t/KgDqNJ/5AFj/17x/+girlU9J/5AFj/wBe8f8A6CKuV2rY5mFFFFMQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAc9rMzSah5J4WMYH1Izn+X5VnVJPIJbqWVQQGcsM+5qOuGTu2z1YR5YpBRRRUlhRXB3fxJ+y/FtfBH9i78yxx/bPtOPvxh87NnbdjrXeVMZqV7dDor4WrQUXUVuZXXowoooqjnCiiigAooooA6qxma40+KZ/vEYPuQcZ/SrFZWhSA2ssWDlX3H8R/wDWrVrug7xTPKqx5ZtBRRRVEBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQBy2tf8jgn/AF5j/wBDNRVLrX/I4J/15j/0M1FXHP4mdEdgoooqSgooooAKKKKACiiigAooooAKhvP+QfP/ANc2/lU1Q3n/ACD5/wDrm38qAOo0n/kAWP8A17x/+girlU9J/wCQBY/9e8f/AKCKuV2rY5mFFFFMQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAcbRUk8YiupYlJIVyoz7Go6889hO4UUUUAeDat/ydvH/wBfNv8A+k6V7zXg2rf8nbx/9fNv/wCk6V7zXLht5+rPfzz4MN/17iFFFFdR4AUUUUAFFFFAGzoP/Lx/wH+tbNZWhRgWssuTln2n8B/9etWuyl8KPNru9RhRRRWhiFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAHLa1/yOCf9eY/9DNRVLrX/ACOCf9eY/wDQzUVcc/iZ0R2CiiipKCiiigAooooAKKKKACiiigAqG8/5B8//AFzb+VTVDef8g+f/AK5t/KgDqNJ/5AFj/wBe8f8A6CKuVT0n/kAWP/XvH/6CKuV2rY5mFFFFMQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAc9rMLR6h5x5WQZH1Axj+X51nV02pWhu7MqgHmKcr2+o/z7VzNcdWNpHo4efNC3YKKKKzNzz+7+HsN18Y18Yf2/GkoeOb7B5ALYSMJ97f325ztr0CvJP8AhWniT/hdv/CUf2lD9h+2fa/M8w+ZsznytuPT5euMflXrdY0V8Xu21PUzKV1SXtee0UtrW8v+H1CiiitjywooooAKKKu6ZaG6vAzAGOMgtnv6Cmld2RMpKKuzdsYWt9Pihf7wGT7EnOP1qxRRXclZWPKbu7sKKKKYgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA5bWv8AkcE/68x/6GaiqXWv+RwT/rzH/oZqKuOfxM6I7BRRRUlBRRRQAUUUUAFFFFABRRRQAVDef8g+f/rm38qmqG8/5B8//XNv5UAdRpP/ACALH/r3j/8AQRVyqek/8gCx/wCveP8A9BFXK7VsczCiiimIKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACsXVtPO43cCDGP3ij/0KtqiplFSVmXTm4O6ONorbvtHDZlsx8xPMecD8PSsUgqxVgQQcEHtXHKDi9T0oVFNXQlFFFSWFFFFABRRVm0sZ7x/kGEBwznoP8aaTeiE5KKuyO3t5bmcRRLlj37AeprqLa3S1tlhQDgckD7x9aba2kNpEUiB5OSx6mp66qdPl1e559atzuy2CiiitTAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigDlta/5HBP8ArzH/AKGaiqXWv+RwT/rzH/oZqKuOfxM6I7BRRRUlBRRRQAUUUUAFFFFABRRRQAVDef8AIPn/AOubfyqaobz/AJB8/wD1zb+VAHUaT/yALH/r3j/9BFXKp6T/AMgCx/694/8A0EVcrtWxzMKKKKYgooooAKKKKACiiigAoornvFXjvwb4Hs0ufFviTT9JR+Y1uZQHk9dqD5m/AGgDoaK8mtv2mfgbdXYtovH1srk4zLaXES/99NGF/WvS9I1rR/EGkx6poWqWepWUv3LmzmWWNvXDKSKAL1FFFABRRRQAUUUUAFFFYnjDxTp/gnwLqfiv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c16p4Z1n/hIfB2ma35Qia7t0laMHIViOQPbOa4Wy8D+O9I0+98OaRrWhwaLcSSsLprdzehZCSVJ+6TzjcckfgBXaeDtGuvD/AIE0vRb2SGS4tIBFI0JJQkehIBx+FKN76jdjboooqyQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKjuLiG1tnuLiRY4kGWY9qAOY1Zll8XuUOfJtljf2YsWA/I0yq9sXnea/lDCS6cyYLbtq/wrn2FWK4pO7udKVkFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFAEUySHbLbyeVcRndHJ/dP+B6Gt3S9bivSlrdKLe+25MJ6Njup6Ee3Xg+max6imt4LhNs0auO2eo+hqozcdiZRTOzorj4LjWLNibfUmnTOfLuhvzxjluvvxU/8AbXiD/nnpv5P/AI1uq0TL2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6moIbKzt7qe5t7SCKa4IaaWOMK0pAwCxHLEDjmud/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOpqtfadp+p2v2bUrG2vIc58q4iWRc+uGBFc/8A214g/wCeem/k/wDjR/bXiD/nnpv5P/jR7WIezZ0NlYWOm2gtdOsrezgByIreMRqPwAxViuW/trxB/wA89N/J/wDGj+2vEH/PPTfyf/Gj2sQ9mzevtK0vVBENT020vRE2+MXMKybG9RuBwfcVbrlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axo/trxB/zz038n/xo9rEPZs6miuW/trxB/zz038n/wAaP7a8Qf8APPTfyf8Axo9rEPZs6miuW/trxB/zz038n/xo/trxB/zz038n/wAaPaxD2bOporlv7a8Qf889N/J/8aP7a8Qf889N/J/8aPaxD2bOporlv7a8Qf8APPTfyf8Axpratr8qFC9jBn/lpEjMw+gY4o9tEPZs6e4uIbW2e4uJFjiQZZj2rltQ1CbV7kIilNNX5gG4M57EjsvcA+34VjbNPIJb+4lvJASR5pyq564XoO35VYrKdRy0RpGFtWFFFFZlhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB//2Q==',
  'base64'
);

function kirimJpg(res, jpg, status) {
  res.statusCode = status || 200;
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Content-Length', String(jpg.length));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(jpg);
}

async function renderSelaluFoto(req, res) {
  const { pesan, seed, mode, nama, isV2 } = bacaParams(req);
  const html = isV2 ? buildHtml2(pesan, nama, seed, mode)
                    : buildHtml(pesan, seed, mode);
  const jpg = await renderJpg(html);
  kirimJpg(res, jpg, 200);
}

module.exports = async (req, res) => {
  try {
    await renderSelaluFoto(req, res);
  } catch (e) {
    console.error('[iqc] render JPG gagal (coba ulang):', e && e.message);
    // percobaan kedua sebelum menyerah
    try {
      await new Promise((r) => setTimeout(r, 300));
      await renderSelaluFoto(req, res);
    } catch (e2) {
      console.error('[iqc] render JPG gagal total:', e2 && e2.message);
      // tetap berbentuk foto: gambar "gagal membuat gambar"
      kirimJpg(res, ERROR_JPG, 500);
    }
  }
};
