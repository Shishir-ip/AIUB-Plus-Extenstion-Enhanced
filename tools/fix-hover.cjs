const fs = require('fs');
const file = 'src/theme.css';
const lines = fs.readFileSync(file, 'utf8').split('\n');
// find the broken unescaped hover rule (the one WITHOUT a backslash before :bg)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('html.apx-dark .hover:bg-slate-50:hover')) {
    // target: literal backslash before the colon in the class name
    lines[i] = 'html.apx-dark .hover\\:bg-slate-50:hover {';
    console.log('fixed line', i + 1, '→', lines[i]);
    break;
  }
}
fs.writeFileSync(file, lines.join('\n'));
