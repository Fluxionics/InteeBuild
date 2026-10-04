const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\memit\\Documents\\Default Project\\InteeBuild\\server\\generator\\runtime.js', 'utf8');
// Check for unclosed single quotes
let inSingle = false;
let inDouble = false;
let escape = false;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (escape) { escape = false; continue; }
  if (c === '\\') { escape = true; continue; }
  if (c === "'" && !inDouble) inSingle = !inSingle;
  if (c === '"' && !inSingle) inDouble = !inDouble;
}
console.log('In single quote:', inSingle);
console.log('In double quote:', inDouble);