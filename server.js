// Server lokal (tanpa dependensi) — perilaku sama dgn endpoint Vercel.
// Jalankan:  npm start   lalu buka http://localhost:3000/iqc?pesan=halo
const http = require('http');
const handler = require('./api/iqc');

const port = process.env.PORT || 3000;

http.createServer((req, res) => handler(req, res)).listen(port, '0.0.0.0', () => {
  console.log('IQC API siap:');
  console.log('  http://localhost:' + port + '/iqc?pesan=halo');
  console.log('  http://localhost:' + port + '/iqc?pesan=halo%F0%9F%92%95&seed=7');
});
