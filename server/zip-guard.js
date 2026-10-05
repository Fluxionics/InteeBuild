'use strict';

const JSZip = require('jszip');

const DEFAULT_LIMITS = Object.freeze({
  maxEntries: 20000,
  maxTotalUncompressed: 512 * 1024 * 1024,
  maxEntryUncompressed: 128 * 1024 * 1024
});
const DEFAULT_MAX_TEXT = 8 * 1024 * 1024;
const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

function toLimit(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeLimits(limits) {
  const src = limits && typeof limits === 'object' ? limits : {};
  return {
    maxEntries: toLimit(src.maxEntries, DEFAULT_LIMITS.maxEntries),
    maxTotalUncompressed: toLimit(src.maxTotalUncompressed, DEFAULT_LIMITS.maxTotalUncompressed),
    maxEntryUncompressed: toLimit(src.maxEntryUncompressed, DEFAULT_LIMITS.maxEntryUncompressed)
  };
}

function reject(error) {
  return { ok: false, zip: null, error, status: 400 };
}

async function loadZipGuarded(buf, limits) {
  const lim = normalizeLimits(limits);
  let zip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return reject('Archivo no es ZIP válido');
  }
  let entries = 0;
  let totalUncompressed = 0;
  let unknownSize = false;
  for (const name of Object.keys(zip.files)) {
    entries += 1;
    if (entries > lim.maxEntries) return reject('ZIP rechazado: demasiadas entradas (max ' + lim.maxEntries + ')');
    const entry = zip.files[name];
    const data = entry && entry._data;
    const size = data && typeof data.uncompressedSize === 'number' ? data.uncompressedSize : null;
    if (size === null) {
      if (!entry || !entry.dir) unknownSize = true;
      continue;
    }
    if (size > lim.maxEntryUncompressed) return reject('ZIP rechazado: entrada demasiado grande');
    totalUncompressed += size;
    if (totalUncompressed > lim.maxTotalUncompressed) return reject('ZIP rechazado: contenido descomprimido demasiado grande');
  }
  return { ok: true, zip, error: null, entries, totalUncompressed, unknownSize };
}

async function entryText(entry, maxBytes) {
  if (!entry || typeof entry.async !== 'function') return null;
  const limit = toLimit(maxBytes, DEFAULT_MAX_TEXT);
  const data = entry._data;
  if (data && typeof data.uncompressedSize === 'number' && data.uncompressedSize > limit) return null;
  try {
    const text = await entry.async('string');
    if (typeof text !== 'string' || text.length > limit) return null;
    return text;
  } catch {
    return null;
  }
}

async function entryBuffer(entry, maxBytes) {
  if (!entry || typeof entry.async !== 'function') return null;
  const limit = toLimit(maxBytes, DEFAULT_MAX_BUFFER);
  const data = entry._data;
  if (data && typeof data.uncompressedSize === 'number' && data.uncompressedSize > limit) return null;
  try {
    const buf = await entry.async('nodebuffer');
    if (!Buffer.isBuffer(buf) || buf.length > limit) return null;
    return buf;
  } catch {
    return null;
  }
}

module.exports = { DEFAULT_LIMITS, loadZipGuarded, entryText, entryBuffer };
