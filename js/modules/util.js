'use strict';

const state = {
  iconBase64: null,
  activeBuildId: null
};

window.state = state;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const on = (sel, type, handler) => {
  const el = $(sel);
  if (el) el.addEventListener(type, handler);
  return el;
};

const onAll = (sel, type, handler) => $$(sel).forEach((el) => el.addEventListener(type, handler));

const escHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const show = (el) => {
  if (el) el.classList.remove('hidden');
};

const hide = (el) => {
  if (el) el.classList.add('hidden');
};

const setVisible = (el, visible) => {
  if (el) el.classList.toggle('hidden', !visible);
};




const paintIcons = (root = document) => {
  if (typeof IBIcon !== 'function') return;
  $$('[data-ib-icon]', root).forEach((el) => {
    el.innerHTML = IBIcon(el.dataset.ibIcon);
  });
};

const kb = (bytes) => Math.round(bytes / 1024);

const setField = (name, val) => {
  const el = $(`[name="${name}"]`);
  if (!el) return;
  if (el.type === 'checkbox') {
    el.checked = !!val;
    const tile = el.closest('.perm-tile, .plugin-card');
    if (tile) tile.classList.toggle('checked', !!val);
  } else {
    el.value = val == null ? '' : val;
  }
};

const timeAgo = (ts) => {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return 'hace ' + sec + 's';
  const min = Math.floor(sec / 60);
  if (min < 60) return 'hace ' + min + 'm';
  const hr = Math.floor(min / 60);
  if (hr < 24) return 'hace ' + hr + 'h';
  return 'hace ' + Math.floor(hr / 24) + 'd';
};

const readFileAsDataURL = (file, onLoad) => {
  const reader = new FileReader();


  reader.onload = () => onLoad(reader.result);
  reader.readAsDataURL(file);
};

const saveBlob = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
};
