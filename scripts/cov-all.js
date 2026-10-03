const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'i18n') + path.sep;
const g = JSON.parse(fs.readFileSync(R + 'groups.json', 'utf8'));
const map = { 'terms.html': 'terms', 'privacy.html': 'privacy', 'license.html': 'license', 'about.html': 'about', 'docs/radio-face.html': 'docs/radio-face', 'docs.html': 'docs', 'developer.html': 'developer', 'historial.html': 'historial', 'index.html': 'index' };
let totalMiss = 0;
for (const lang of ['en', 'ru', 'ch', 'br']) {
  const per = [];
  for (const [page, base] of Object.entries(map)) {
    const d = JSON.parse(fs.readFileSync(R + lang + '/' + base + '.json', 'utf8'));
    const miss = g[page].filter(k => !Object.prototype.hasOwnProperty.call(d, k));
    totalMiss += miss.length;
    if (miss.length) { per.push(base + ':' + miss.length); miss.slice(0, 5).forEach(k => console.log('  FALTA ' + lang + ' [' + page + '] ' + JSON.stringify(k.slice(0, 60)))); }
  }
  console.log(lang + ': ' + (per.length ? per.join(' ') : 'cobertura completa'));
}
console.log(totalMiss === 0 ? 'COBERTURA TOTAL OK' : 'FALTAN ' + totalMiss);
process.exit(totalMiss ? 1 : 0);
