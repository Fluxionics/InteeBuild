'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname);
const keys = JSON.parse(fs.readFileSync(path.join(root, 'keys.json'), 'utf8'));
const langs = ['en', 'ru', 'ch', 'br'];
let errors = 0;
let total = 0;

for (const lang of langs) {
  const dir = path.join(root, lang);
  if (!fs.existsSync(dir)) { console.log(lang + ': carpeta no existe'); continue; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const p = path.join(dir, f);
    let dict;
    try {
      dict = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.log('JSON INVALIDO ' + lang + '/' + f + ': ' + e.message);
      errors++;
      continue;
    }
    const klist = Object.keys(dict);
    total += klist.length;
    for (const k of klist) {
      if (!keys[k]) {
        console.log('KEY INEXISTENTE ' + lang + '/' + f + ': ' + JSON.stringify(k.slice(0, 70)));
        errors++;
      }
      if (typeof dict[k] !== 'string' || dict[k].length === 0) {
        console.log('VALOR VACIO ' + lang + '/' + f + ': ' + JSON.stringify(k.slice(0, 50)));
        errors++;
      }
      if (dict[k].includes('undefined')) {
        console.log('VALOR CON undefined ' + lang + '/' + f + ': ' + JSON.stringify(k.slice(0, 50)));
        errors++;
      }
    }
  }
  console.log(lang + ': ' + files.length + ' archivos OK');
}

console.log('total claves traducidas: ' + total);
console.log(errors === 0 ? 'VALIDACION OK' : 'ERRORES: ' + errors);
process.exit(errors === 0 ? 0 : 1);
