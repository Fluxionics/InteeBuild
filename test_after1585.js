const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');
const lines = content.split('\n');

// Check lines after 1585 for double quotes outside template literals
for (let i = 1585; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('"')) {
    console.log(`Line ${i+1}: ${JSON.stringify(line)}`);
  }
}