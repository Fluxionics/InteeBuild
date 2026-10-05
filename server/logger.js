'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'server.log');
const MAX_BYTES = 2 * 1024 * 1024;
const KEEP_LINES = 500;

function toText(args) {
  return Array.from(args).map(a => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.message;
    try { return JSON.stringify(a); } catch (_) { return String(a); }
  }).join(' ');
}

function append(line) {
  try {
    fs.appendFileSync(FILE, line + '\n');
    const st = fs.statSync(FILE);
    if (st.size > MAX_BYTES) {
      const lines = fs.readFileSync(FILE, 'utf8').split(/\r?\n/);
      fs.writeFileSync(FILE, lines.slice(-KEEP_LINES).join('\n') + '\n');
    }
  } catch (_) {}
}

function install() {
  for (const m of ['log', 'info', 'warn', 'error']) {
    const orig = typeof console[m] === 'function' ? console[m].bind(console) : null;
    console[m] = function () {
      try { if (orig) orig.apply(console, arguments); } catch (_) {}
      try { append(new Date().toISOString() + ' ' + toText(arguments)); } catch (_) {}
    };
  }
}

function read() {
  try { return fs.readFileSync(FILE, 'utf8'); } catch (_) { return ''; }
}

module.exports = { install, read, FILE };
