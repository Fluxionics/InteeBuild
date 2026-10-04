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

// Process up to line 1585
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  
  if (c === '\n') { line++; col = 1; }
  else { col++; }
  
  if (line > 1586) break;
  
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
    if (c === "'") { inSingle = false; console.log(`Line ${line}: Closed single quote`); continue; }
    continue;
  }
  
  if (inDouble) {
    if (c === '"') { inDouble = false; console.log(`Line ${line}: Closed double quote at col ${col}`); continue; }
    continue;
  }
  
  if (c === '`') { inTemplate = true; console.log(`Line ${line}: Opened template`); continue; }
  if (c === "'") { inSingle = true; console.log(`Line ${line}: Opened single quote`); continue; }
  if (c === '"') { inDouble = true; console.log(`Line ${line}: Opened double quote at col ${col}`); continue; }
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
}

console.log('Final state at line 1586:');
console.log('inDouble:', inDouble);
console.log('inSingle:', inSingle);
console.log('inTemplate:', inTemplate);
console.log('templateDepth:', templateDepth);