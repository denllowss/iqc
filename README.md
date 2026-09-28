# IQC — Instagram DM Quote Card API

Kirim URL → dapat **foto JPG** kartu DM Instagram (emoji iPhone, wallpaper percakapan
blur acak, jam WIB otomatis). Siap deploy ke **Vercel**.

## Contoh

```
https://domain.com/iqc?pesan=halo❤        -> foto JPG mode terang (1350x2400, rasio 9:16)
https://domain.com/iqc?pesan=halo❤&mode=dark -> foto JPG DARK MODE (Instagram gelap)
https://domain.com/iqc?pesan=miss you😭   -> foto JPG, wallpaper acak
https://domain.com/iqc?pesan=halo&seed=42 -> foto JPG, wallpaper & baterai terkunci (identik)
https://domain.com/iqc?pesan=halo&html=1  -> halaman interaktif (HTML, bukan JPG)
```

| Parameter | Keterangan |
|---|---|
| `pesan` | Isi bubble chat. Mendukung emoji (dirender sebagai emoji Apple/iPhone), maks. 1000 karakter, aman dari XSS, baris baru diizinkan. |
| `mode` | `mode=dark` untuk dark mode (UI gelap + wallpaper percakapan gelap). `mode=light` memaksa terang. Tanpa parameter: terang (versi interaktif mengikuti preferensi sistem, ada tombol 🌙/☀️ untuk ganti). |
| `seed` | (Opsional) Angka — wallpaper **dan level baterai (30–100%)** jadi deterministik/identik. Tanpa `seed`, tiap request menghasilkan wallpaper & baterai berbeda. |
| `html` | `html=1` untuk mendapat halaman HTML interaktif (teks bisa diedit) alih-alih JPG. |

## Contoh hasil

Lihat [`contoh-hasil.jpg`](contoh-hasil.jpg) — hasil nyata dari
`/iqc?pesan=halo❤` (1350×2400 px, kualitas 92).

## Struktur

```
iqc/
├── api/
│   ├── iqc.js           # Serverless function: render headless -> JPG
│   └── _template.html   # Template halaman (font Inter + emoji tertanam)
├── server.js            # Server lokal (npm start)
├── vercel.json          # Rewrite /iqc -> /api/iqc, memory 3009 MB, maxDuration 60s
└── package.json
```

## Deploy ke Vercel

**GitHub:** push folder `iqc/` → import di [vercel.com](https://vercel.com) → Deploy.
**CLI:**
```bash
npm i -g vercel
cd iqc && vercel --prod
```

Setelah live:
```
https://nama-anda.vercel.app/iqc?pesan=halo❤
```

## Jalankan lokal

```bash
npm install
npm start
# http://localhost:3000/iqc?pesan=halo
```

## Catatan teknis

- JPG dirender **headless Chromium** (`puppeteer-core` + `@sparticuz/chromium`,
  paket standar yang ramah serverless Vercel) pada viewport 675×1200 @2x.
- `vercel.json` men-set `memory: 3009` & `maxDuration: 60` — direkomendasikan agar
  render Chromium cepat dan tidak timeout di paket Hobby/Pro.
- Emoji umum (❤😂🔥💯🙏 dll.) tertanam di template; sisanya dimuat dari CDN gambar
  Apple saat render, dengan fallback otomatis ke teks bila CDN gagal.
- Font Inter ter-embed (mendekati tampilan SF Pro iPhone) sehingga hasil render
  server konsisten di semua region.
- Tanpa `seed`, respons di-set `Cache-Control: no-store` agar tiap request
  mendapat wallpaper acak baru. Dengan `seed`, hasil deterministik & bisa di-cache.
