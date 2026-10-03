'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SKIP = new Set(['SCRIPT', 'STYLE', 'SVG', 'TEMPLATE', 'NOSCRIPT']);
const ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'value', 'content'];

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function norm(s) {
  return decodeEntities(s).trim().replace(/\s+/g, ' ');
}

const RE_JS_ES = /[áéíóúñü¿¡]|\b(el|la|los|las|un|una|unos|unas|de|del|para|con|por|que|se|en|al|sin|sobre|tu|te|es|está|están|hay|cargando|primero|paso|pasos|permiso|permisos|plantilla|plantillas|seguridad|salidas|versiones|problemas|resultados|historial|configuración|compilación|compilaciones|instalar|selecciona|elige|revisa|activa|falta|faltan|listo|lista|nuevo|nueva|tus|sus|archivo|archivos|nombre|versión|disponible|disponibles|automática|automático|automáticos|mensaje|mensajes|búsqueda|registro|registros|descargar|generar|generado|generada|generando|error|errores|aviso|también|cuando|cómo|dónde|necesitas|puedes|debe|deben|ser|tener|hay|uno|una|dos|tres|hoy|aquí|ahora|después|antes|mientras|todas|todos|otro|otra|otros|estas|estos)\b/i;

function scanJsLiterals(src, file, keys) {
  const add = (raw) => {
    let k = raw.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');
    k = norm(k);
    if (!k || k.length < 2 || k.length > 140) return;
    if (/^[a-z]{1,3}$/.test(k)) return;
    if (k.includes('${')) return;
    if (/<[^>]+>/.test(k)) return;
    if (!RE_JS_ES.test(k)) return;
    if (!keys[k]) keys[k] = { count: 0, files: [] };
    keys[k].count++;
    if (!keys[k].files.includes(file)) keys[k].files.push(file);
  };
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const v = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
    if (v !== undefined) add(v);
  }
}

function extractHtml(html, file, keys) {
  const add = (raw) => {
    const k = norm(raw);
    if (!k || k.length < 2) return;
    if (!/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ¿¡]/.test(k)) return;
    if (!keys[k]) keys[k] = { count: 0, files: [] };
    keys[k].count++;
    if (!keys[k].files.includes(file)) keys[k].files.push(file);
  };

  let codeDepth = 0;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<(script|style|svg|template|noscript)\b[\s\S]*?<\/\1\s*>|<(pre|code)\b|<\/(pre|code)\s*>|<\/?[a-zA-Z][^>]*>|([^<]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[0].startsWith('<!--') || m[0].startsWith('<![CDATA[') || m[0].startsWith('<!')) continue;
    if (m[1]) {
      if (m[1].toLowerCase() === 'script') {
        const inner = m[0].replace(/^<script\b[^>]*>/i, '').replace(/<\/script\s*>$/i, '');
        scanJsLiterals(inner, file, keys);
      }
      continue;
    }
    if (m[2]) { codeDepth++; continue; }
    if (m[3]) { if (codeDepth > 0) codeDepth--; continue; }
    if (codeDepth > 0) continue;
    if (m[4] !== undefined) {
      add(m[4]);
      continue;
    }
    const tag = m[0];
    const open = tag.match(/^<([a-zA-Z][\w-]*)/);
    if (!open) continue;
    const el = open[1].toUpperCase();
    if (SKIP.has(el)) continue;
    const attrRe = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = attrRe.exec(tag)) !== null) {
      const name = a[1].toLowerCase();
      if (!ATTRS.includes(name)) continue;
      if (name === 'content' && /property\s*=\s*["']og:(url|locale)["']/i.test(tag)) continue;
      const val = a[3] !== undefined ? a[3] : a[4];
      add(val);
    }
  }
}

function walkDir(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'i18n' || e.name === 'platforms' || e.name === 'android') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(p, out);
    else if (/\.html?$/i.test(e.name)) out.push(path.relative(ROOT, p).replace(/\\/g, '/'));
  }
}

const files = [];
walkDir(ROOT, files);

const keys = {};
for (const f of files) {
  const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
  extractHtml(html, f, keys);
}

const jsTargets = ['js/app.js', 'js/ads.js'];
const modsDir = path.join(ROOT, 'js', 'modules');
if (fs.existsSync(modsDir)) {
  for (const e of fs.readdirSync(modsDir)) if (e.endsWith('.js')) jsTargets.push('js/modules/' + e);
}
for (const jf of jsTargets) {
  const p = path.join(ROOT, jf);
  if (!fs.existsSync(p)) continue;
  scanJsLiterals(fs.readFileSync(p, 'utf8'), 'index.html', keys);
}

const sorted = Object.keys(keys).sort((a, b) => a.localeCompare(b, 'es'));
const out = {};
for (const k of sorted) out[k] = keys[k];

fs.writeFileSync(path.join(__dirname, 'keys.json'), JSON.stringify(out, null, 2));

let chars = 0;
for (const k of sorted) chars += k.length;
console.log('archivos:', files.length);
console.log('archivos:', files.join(', '));
console.log('strings unicos:', sorted.length);
console.log('chars totales:', chars);
console.log('muestreo:');
for (const k of sorted.slice(0, 15)) console.log('  [' + keys[k].count + ']', JSON.stringify(k.slice(0, 80)));
