const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');

// Check for unclosed regex
let inRegex = false;
let inCharClass = false;
let escape = false;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === '[' && inRegex) inCharClass = true;
  if (c === ']' && inCharClass) inCharClass = false;
  if (c === '/' && !inCharClass && !inRegex && i+1 < content.length) {
    const next = content[i+1];
    if (next !== '*' && next !== '/' && next !== '=') {
      // Check if this looks like a regex start
      const prev = i > 0 ? content[i-1] : '';
      if (!/[a-zA-Z0-9_)]/.test(prev)) {
        inRegex = true;
      }
    }
  } else if (c === '/' && inRegex && !inCharClass) {
    inRegex = false;
  }
}
console.log('In regex at end:', inRegex);