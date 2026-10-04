const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');

let inTemplate = false;
let templateDepth = 0;
let inSingle = false;
let inDouble = false;
let inRegex = false;
let inCharClass = false;
let escape = false;
let line = 1;
let col = 1;
let brace = 0;
let paren = 0;
let bracket = 0;

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
    if (c === '`') { inTemplate = false; templateDepth = 0; continue; }
    if (c === '$' && content[i+1] === '{') { templateDepth++; i++; col++; continue; }
    if (c === '}' && templateDepth > 0) { templateDepth--; continue; }
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
  else if (c === '{') { brace++; console.log(`Line ${line}: OPEN brace (${brace})`); }
  else if (c === '}') { brace--; console.log(`Line ${line}: CLOSE brace (${brace})`); }
  else if (c === '[') bracket++;
  else if (c === ']') bracket--;
  
  if (brace < 0) { console.log('Negative brace at line', line); break; }
}

console.log('Final: paren=', paren, 'brace=', brace, 'bracket=', bracket);
console.log('inDouble:', inDouble);