const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const acorn = require(path.join(ROOT, 'node_modules', 'acorn'));
const SKIP = new Set(['node_modules', '.git', 'android', 'dist', 'build', 'www']);
const out = { js: 0, css: 0, html: 0 };
const detail = [];

(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(f); continue; }
    const rel = path.relative(ROOT, f);
    if (/\.js$/.test(e.name)) {
      const code = fs.readFileSync(f, 'utf8');
      const cs = [];
      try {
        acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, onComment: (b, t, s, en) => cs.push({ b, t: t.slice(0, 40), s }) });
      } catch (err) { detail.push('PARSE ' + rel + ': ' + err.message); out.js++; continue; }
      if (cs.length) { out.js += cs.length; detail.push(rel + ' -> ' + cs.map(c => c.t.replace(/\s+/g, ' ')).join(' || ')); }
    } else if (/\.css$/.test(e.name)) {
      const code = fs.readFileSync(f, 'utf8');
      const m = code.match(/\/\*[\s\S]*?\*\//g);
      if (m) { out.css += m.length; detail.push(rel + ' -> ' + m.length); }
    } else if (/\.html$/.test(e.name)) {
      const code = fs.readFileSync(f, 'utf8');
      const m = code.match(/<!--[\s\S]*?-->/g);
      if (m) { out.html += m.length; detail.push(rel + ' -> ' + m.length); }
    }
  }
})(ROOT);

console.log('comentarios restantes -> js:', out.js, 'css:', out.css, 'html:', out.html);
detail.slice(0, 40).forEach(d => console.log('  ' + d));
process.exit(out.js + out.css + out.html === 0 ? 0 : 1);
