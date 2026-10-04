const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');

let paren = 0;
let brace = 0;
let bracket = 0;
let inSingle = false;
let inDouble = false;
let inTemplate = false;
let inRegex = false;
let inCharClass = false;
let escape = false;
let line = 1;
let col = 1;

const snapshots = [];

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  
  if (c === '\n') { line++; col = 1; }
  else { col++; }
  
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  
  if (inRegex) {
    if (c === '[') inCharClass = true;
    else if (c === ']') inCharClass = false;
    else if (c === '/' && !inCharClass) inRegex = false;
    continue;
  }
  
  if (inTemplate) {
    if (c === '`') inTemplate = false;
    else if (c === '$' && content[i+1] === '{') { i++; col++; }
    continue;
  }
  
  if (inSingle) {
    if (c === "'") inSingle = false;
    continue;
  }
  
  if (inDouble) {
    if (c === '"') inDouble = false;
    continue;
  }
  
  if (c === '`') { inTemplate = true; continue; }
  if (c === "'") { inSingle = true; continue; }
  if (c === '"') { inDouble = true; continue; }
  if (c === '/' && i+1 < content.length) {
    const next = content[i+1];
    if (next !== '*' && next !== '/' && next !== '=') {
      const prev = i > 0 ? content[i-1] : '';
      if (!/[a-zA-Z0-9_)]/.test(prev)) {
        inRegex = true;
        continue;
      }
    }
  }
  
  if (c === '(') paren++;
  else if (c === ')') paren--;
  else if (c === '{') brace++;
  else if (c === '}') brace--;
  else if (c === '[') bracket++;
  else if (c === ']') bracket--;
  
  // Snapshot every 1000 chars
  if (i % 5000 === 0) {
    snapshots.push({ pos: i, line, col, paren, brace, bracket, inDouble });
  }
}

// Print snapshots where counts changed
let lastParen = 0, lastBrace = 0, lastBracket = 0, lastInDouble = false;
for (const s of snapshots) {
  if (s.paren !== lastParen || s.brace !== lastBrace || s.bracket !== lastBracket || s.inDouble !== lastInDouble) {
    console.log(`Line ${s.line}, Col ${s.col}: paren=${s.paren}, brace=${s.brace}, bracket=${s.bracket}, inDouble=${s.inDouble}`);
    lastParen = s.paren;
    lastBrace = s.brace;
    lastBracket = s.bracket;
    lastInDouble = s.inDouble;
  }
}

console.log('--- Final ---');
console.log('paren:', paren, 'brace:', brace, 'bracket:', bracket, 'inDouble:', inDouble);