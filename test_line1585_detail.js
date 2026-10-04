const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');
const lines = content.split('\n');
const line = lines[1584]; // line 1585
console.log('Line length:', line.length);
console.log('Line:', JSON.stringify(line));

// Find the double quote positions
for (let i = 0; i < line.length; i++) {
  if (line[i] === '"' || line[i] === '\\' || line[i] === "'") {
    console.log(`Index ${i}: char=${JSON.stringify(line[i])}, next=${JSON.stringify(line[i+1])}, prev=${JSON.stringify(line[i-1])}`);
  }
}

// Simulate the detector on just this line
let escape = false;
let inDouble = false;
for (let i = 0; i < line.length; i++) {
  const c = line[i];
  if (escape) { console.log(`  ${i}: ${JSON.stringify(c)} - escape was true, now false`); escape = false; continue; }
  if (c === '\\') { console.log(`  ${i}: ${JSON.stringify(c)} - set escape=true`); escape = true; continue; }
  if (inDouble) {
    if (c === '"') { console.log(`  ${i}: ${JSON.stringify(c)} - CLOSE double`); inDouble = false; continue; }
    console.log(`  ${i}: ${JSON.stringify(c)} - in double`);
    continue;
  }
  if (c === '"') { console.log(`  ${i}: ${JSON.stringify(c)} - OPEN double`); inDouble = true; continue; }
}
console.log('Final inDouble:', inDouble);