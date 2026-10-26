'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const buildJs = fs.readFileSync(path.join(ROOT, 'js', 'modules', 'build.js'), 'utf8');

test('review: el banner existe con GitHub y AlternativeTo, sin emojis', () => {
  const start = html.indexOf('id="reviewBanner"');
  assert.ok(start > -1, 'existe #reviewBanner en index.html');
  const chunk = html.slice(start, html.indexOf('</div>', start));
  assert.ok(chunk.includes('https://github.com/Fluxionics/InteeBuild'), 'link de GitHub');
  assert.ok(chunk.includes('https://alternativeto.net/software/inteebuild/about/'), 'link de AlternativeTo');
  assert.ok(/target="_blank"/.test(chunk) && /rel="noopener"/.test(chunk), 'los links abren en pestaña nueva segura');
  assert.ok(chunk.includes('id="reviewClose"'), 'tiene como cerrarlo');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(chunk), 'sin emojis en el banner');
  assert.ok(chunk.includes('¿Te funcionó?'), 'texto natural, no de manual');
});

test('review: se muestra cuando el build sale bien y respeta el cierre', () => {
  assert.ok(buildJs.includes('maybeShowReviewBanner()'), 'se invoca en el bloque de exito');
  const successIdx = buildJs.indexOf("s.status === 'success'");
  const showIdx = buildJs.indexOf('maybeShowReviewBanner()');
  assert.ok(showIdx > successIdx, 'la llamada vive dentro del manejo de success');
  assert.ok(buildJs.includes("'ib_review_dismissed'"), 'guarda el cierre en localStorage');
  assert.ok(buildJs.includes('onAll(\'[data-review-dismiss]\''), 'los links tambien lo descartan');
});
