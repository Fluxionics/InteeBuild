const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'developer.html'), 'utf8');
const icons = fs.readFileSync(path.join(ROOT, 'js', 'icons.js'), 'utf8');

let fails = 0;
function ok(cond, msg) { console.log((cond ? '  ok  ' : '  FAIL ') + msg); if (!cond) fails++; }

const ids = ['baseUrl', 'copyBase', 'epSearch', 'epCount', 'keyName', 'keyCreate', 'keyList', 'keyOut', 'tryUrl', 'tryName', 'tryKey', 'tryBuild', 'tryOut', 'apkFile', 'apkBtn', 'apkOut'];
for (const id of ids) ok(html.includes('id="' + id + '"'), 'id ' + id);

const iconKeys = new Set([...icons.matchAll(/^\s{2}'?([a-zA-Z0-9-]+)'?:/gm)].map(m => m[1]));
const used = [...html.matchAll(/data-ib-icon="([a-z0-9-]+)"/g)].map(m => m[1]);
const badIcons = used.filter(k => !iconKeys.has(k));
ok(badIcons.length === 0, 'iconos validos (' + used.length + ' usados)' + (badIcons.length ? ' invalidos: ' + badIcons.join(',') : ''));

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok(scripts.length === 1, 'un script inline (' + scripts.length + ')');
if (scripts[0]) {
  try { new Function(scripts[0]); ok(true, 'script inline: sintaxis valida'); }
  catch (e) { ok(false, 'script inline: ' + e.message); }
}

const codeBlocks = (html.match(/<div class="code">/g) || []).length;
const copyBtns = (html.match(/copy-btn" data-copy>/g) || []).length;
ok(codeBlocks > 0 && copyBtns === codeBlocks, 'botones copiar por bloque de codigo (' + copyBtns + '/' + codeBlocks + ')');

const endpoints = (html.match(/class="endpoint"/g) || []).length;
ok(endpoints >= 20, 'endpoints listados (' + endpoints + ')');

const tabs = [...html.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]);
const panes = [...html.matchAll(/id="tab-([a-z]+)"/g)].map(m => m[1]);
ok(tabs.length === panes.length && tabs.every(t => panes.includes(t)), 'tabs emparejados con panes');

ok(html.includes('<div class="ep-group">'), 'grupos de endpoints');
ok(html.includes('id="epSearch"'), 'buscador de endpoints');

console.log(fails ? 'FALLOS: ' + fails : 'TODO OK');
process.exit(fails ? 1 : 0);
