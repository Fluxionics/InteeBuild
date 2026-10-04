const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');

// Find unclosed regex
let inRegex = false;
let inCharClass = false;
let escape = false;
let regexStart = -1;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === '[' && inRegex) inCharClass = true;
  if (c === ']' && inCharClass) inCharClass = false;
  if (c === '/' && !inCharClass && !inRegex && i+1 < content.length) {
    const next = content[i+1];
    if (next !== '*' && next !== '/' && next !== '=') {
      const prev = i > 0 ? content[i-1] : '';
      if (!/[a-zA-Z0-9_)]/.test(prev)) {
        inRegex = true;
        regexStart = i;
      }
    }
  } else if (c === '/' && inRegex && !inCharClass) {
    inRegex = false;
    regexStart = -1;
  }
}
console.log('In regex at end:', inRegex);
console.log('Regex started at char:', regexStart);

// Show context around regex start
if (regexStart >= 0) {
  const start = Math.max(0, regexStart - 100);
  const end = Math.min(content.length, regexStart + 200);
  console.log('Context:');
  console.log(JSON.stringify(content.slice(start, end)));
}