const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');

// Try parsing with acorn if available, otherwise try Function constructor
try {
  const acorn = require('acorn');
  acorn.parse(content, { ecmaVersion: 2020, sourceType: 'module' });
  console.log('acorn: Syntax OK');
} catch (e) {
  console.log('acorn error:', e.message);
  console.log('Line:', e.loc ? e.loc.line : 'unknown');
  console.log('Column:', e.loc ? e.loc.column : 'unknown');
}