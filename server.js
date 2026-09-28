// Server lokal (tanpa dependensi) — perilaku sama dgn endpoint Vercel.
// Jalankan:  npm start   lalu buka http://localhost:3000/iqc?pesan=halo
const http = require('http');
const fs = require('fs');

// Simulasi runtime Vercel agar @sparticuz/chromium mengekstrak library
// (LD_LIBRARY_PATH) sama seperti di production.
process.env.AWS_LAMBDA_JS_RUNTIME ||= 'nodejs20.x';

// Bersihkan sisa ekstraksi yang tidak lengkap (mis. /tmp/chromium ada
// tapi library-nya sudah terhapus) supaya chromium diekstrak ulang utuh.
try {
  if (fs.existsSync('/tmp/chromium') && !fs.existsSync('/tmp/al2023/lib')) {
    fs.rmSync('/tmp/chromium', { recursive: true, force: true });
  }
} catch (e) { /* abaikan */ }

const handler = require('./api/iqc');

const port = process.env.PORT || 3000;

http.createServer((req, res) => handler(req, res)).listen(port, '0.0.0.0', () => {
  console.log('IQC API siap:');
  console.log('  http://localhost:' + port + '/iqc?pesan=halo');
  console.log('  http://localhost:' + port + '/iqc?pesan=halo%F0%9F%92%95&mode=dark&seed=7');
});
