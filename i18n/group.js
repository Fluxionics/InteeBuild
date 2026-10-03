'use strict';

const fs = require('fs');
const path = require('path');

const keys = JSON.parse(fs.readFileSync(path.join(__dirname, 'keys.json'), 'utf8'));
const groups = {};

for (const [k, meta] of Object.entries(keys)) {
  for (const f of meta.files) {
    if (!groups[f]) groups[f] = [];
    groups[f].push(k);
  }
}

for (const f of Object.keys(groups)) groups[f].sort((a, b) => a.localeCompare(b, 'es'));

const order = ['terms.html', 'privacy.html', 'license.html', 'about.html', 'docs.html', 'developer.html', 'index.html'];
const sorted = {};
for (const f of order) if (groups[f]) sorted[f] = groups[f];
for (const f of Object.keys(groups)) if (!sorted[f]) sorted[f] = groups[f];

fs.writeFileSync(path.join(__dirname, 'groups.json'), JSON.stringify(sorted, null, 2));

for (const [f, ks] of Object.entries(sorted)) {
  const chars = ks.reduce((n, k) => n + k.length, 0);
  console.log(f, '-', ks.length, 'strings,', chars, 'chars');
}
