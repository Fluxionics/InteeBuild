const fs = require('fs');
const content = fs.readFileSync('C:/Users/memit/Documents/Default Project/InteeBuild/server/generator/runtime.js', 'utf8');
const lines = content.split('\n');
for (let i = 835; i < 870; i++) {
  if (lines[i].includes('`')) {
    console.log('Line ' + (i+1) + ': ' + JSON.stringify(lines[i]));
  }
}