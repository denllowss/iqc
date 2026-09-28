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

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bacaParams(req) {
  const url = new URL(req.url, 'http://x'); // host diabaikan; path+query saja
  let pesan = (url.searchParams.get('pesan') || '').trim();
  pesan = pesan.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, MAX_LEN);
  if (!pesan) pesan = DEFAULT_MSG;
  const seedQ = url.searchParams.get('seed');
  const seed = /^\d+$/.test(seedQ || '') ? parseInt(seedQ, 10) >>> 0
             : (Math.random() * 4294967296) >>> 0;
  const htmlMode = ['1', 'true'].includes((url.searchParams.get('html') || '').toLowerCase());
  const modeQ = (url.searchParams.get('mode') || '').toLowerCase();
  const mode = modeQ === 'dark' ? 'dark' : modeQ === 'light' ? 'light' : null;
  return { pesan, seed, htmlMode, mode };
}

function buildHtml(pesan, seed, mode) {
  const safe = esc(pesan).replace(/\r?\n/g, '<br>');
  let html = getTemplate().split('__PESAN__').join(safe);
  // injeksi seed + mode agar hasil deterministik saat dirender headless
  html = html.replace('<body>',
    '<body><script>window.__SEED=' + seed + ';' +
    (mode ? 'window.__MODE="' + mode + '";' : '') + '</script>');
  return html;
}

function kirimHtml(res, html, cacheTime) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control',
    cacheTime > 0 ? 'public, s-maxage=' + cacheTime + ', stale-while-revalidate=600'
                  : 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(html);
}

/* ---------- render JPG via headless Chromium ---------- */
let chromiumMod = null, puppeteerMod = null;
async function renderJpg(html) {
  if (!chromiumMod) chromiumMod = require('@sparticuz/chromium');
  if (!puppeteerMod) puppeteerMod = require('puppeteer-core');

  const chromium = chromiumMod;
  const puppeteer = puppeteerMod;

  const browser = await puppeteer.launch({
    args: [...chromium.args, '--force-device-scale-factor=' + SCALE],
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    defaultViewport: { width: W, height: H, deviceScaleFactor: SCALE },
  });

  try {
    const page = await browser.newPage();
    // muat halaman; tunggu jaringan selesai (emoji CDN) — kalau timeout lanjut saja
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
      .catch(() => {});
    // pastikan wallpaper final (render ulang setelah emoji termuat) & emoji bubble siap
    await page.waitForFunction(() => {
      const bg = document.querySelector('.bg');
      const imgs = document.querySelectorAll('#msg img.apple-emoji');
      return window.__wpDone === true &&
             !!bg && bg.style.backgroundImage.length > 60 &&
             Array.prototype.every.call(imgs, function (i) { return i.complete; });
    }, { timeout: 20000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 900)); // buffer render akhir + encode JPEG

    const buf = await page.screenshot({ type: 'jpeg', quality: 92, fullPage: false });
    return buf;
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = async (req, res) => {
  try {
    const { pesan, seed, htmlMode, mode } = bacaParams(req);
    const html = buildHtml(pesan, seed, mode);

    // mode halaman interaktif
    if (htmlMode) return kirimHtml(res, html, 0);

    // default: hasil FOTO JPG
    const jpg = await renderJpg(html);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', String(jpg.length));
    res.setHeader('Cache-Control', 'no-store'); // tanpa seed = tiap request beda wallpaper
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(jpg);
  } catch (e) {
    // gagal render -> kirim halaman HTML agar tautan tetap bisa dibuka
    try {
      const { pesan, seed } = bacaParams(req);
      return kirimHtml(res, buildHtml(pesan, seed), 0);
    } catch (e2) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Terjadi kesalahan: ' + e.message);
    }
  }
};
