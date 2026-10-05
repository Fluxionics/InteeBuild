'use strict';

const MAX_DETAIL_CHARS = 4000;
const DEFAULT_MAX_LINES = 40;
const CONTEXT_LINES = 3;
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const FAILURE_RE = /(##\[error\]|error:|ERROR|FAILURE:|BUILD FAILED|FAILED|What went wrong:|Execution failed for task|cannot find symbol|A problem occurred)/;
const SECTION_RE = /^=====/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[\d:.]*Z\s?/;

function clipText(value, max = 2000) {
  const s = String(value || '');
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function collectCandidates(text) {
  const lines = text.replace(ANSI_RE, '').split(/\r?\n/);
  const candidates = [];
  const seen = new Set();
  const push = (line) => {
    const key = line.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(line.replace(/\s+$/, ''));
  };
  for (let i = 0; i < lines.length; i++) {
    if (!FAILURE_RE.test(lines[i])) continue;
    push(lines[i]);
    let context = 0;
    while (context < CONTEXT_LINES && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!next.trim() || SECTION_RE.test(next.trim()) || FAILURE_RE.test(next)) break;
      if (!/^[\s>]/.test(next.replace(TIMESTAMP_RE, ''))) break;
      i++;
      context++;
      push(next);
    }
  }
  return candidates;
}

function extractFailure(text, maxLines = DEFAULT_MAX_LINES) {
  if (typeof text !== 'string') return null;
  if (!text.replace(ANSI_RE, '').trim()) return null;
  const candidates = collectCandidates(text);
  if (!candidates.length) return null;
  const kept = [];
  let size = 0;
  let dropped = 0;
  for (let i = 0; i < candidates.length; i++) {
    const line = candidates[i];
    if (kept.length >= maxLines || size + line.length + 1 > MAX_DETAIL_CHARS) {
      dropped = candidates.length - i;
      break;
    }
    kept.push(line);
    size += line.length + 1;
  }
  if (!kept.length) {
    const head = candidates[0].slice(0, MAX_DETAIL_CHARS);
    const rest = candidates.length - 1;
    return rest ? head + '\n... (' + rest + ' líneas más)' : head;
  }
  const out = kept.join('\n');
  return dropped ? out + '\n... (' + dropped + ' líneas más)' : out;
}

async function summarizeRunLogs(source) {
  if (typeof source === 'string') return extractFailure(source);
  if (!source || !source.files) return null;
  const names = Object.keys(source.files)
    .filter((name) => !source.files[name].dir && /\.txt$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  const parts = [];
  for (const name of names) {
    let text = '';
    try {
      text = await source.files[name].async('string');
    } catch (_) {
      continue;
    }
    const failure = extractFailure(text);
    if (!failure) continue;
    const title = name.replace(/\.txt$/i, '').split('/').join(' > ');
    parts.push('===== ' + title + ' =====\n' + failure);
  }
  if (!parts.length) return null;
  return clipText(parts.join('\n\n'), MAX_DETAIL_CHARS);
}

module.exports = { extractFailure, summarizeRunLogs, clipText };
