const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');
const lines = content.split('\n');
const line = lines[1584]; // 0-indexed, line 1585
console.log('Line 1585:', JSON.stringify(line));

// Find the double quote positions
for (let i = 0; i < line.length; i++) {
  if (line[i] === '"') {
    console.log(`Double quote at index ${i}: context="${line.slice(Math.max(0,i-10), i+10)}"`);
  }
}