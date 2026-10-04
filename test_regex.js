const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/\/[^/\s].*\/[gimuy]*(\s|$|,|\))/) && !line.trim().startsWith('//')) {
    console.log((i+1).toString().padStart(4), ':', line.trim());
  }
}