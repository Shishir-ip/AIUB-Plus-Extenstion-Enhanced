/**
 * Post-pass: correct text-role tokens that the main recolor pass
 * classified as background-role.
 *
 * Fixes:
 *  1. `color: 'var(--apx-c-…)'`   (React style objects / Object.assign / .style.color)
 *  2. grade-color maps            ('A+': 'var(--apx-c-…)' → t- tokens)
 *  3. styleActionBtn call args in Navbar (c- → t-)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (['.jsx', '.js'].includes(extname(p))) files.push(p);
  }
  return files;
}

let fixes = 0;
for (const file of walk(SRC)) {
  let text = readFileSync(file, 'utf8');
  const before = text;

  // 1. text-role property assignments and object keys
  text = text.replace(
    /(color|Color|WebkitTextFillColor)\s*(:|=)\s*(['"])var\(--apx-c-([0-9a-f]{6})\)(\s*!important)?\3/g,
    (full, prop, sep, q, hex, imp) => {
      fixes++;
      return `${prop}${sep}${q}var(--apx-t-${hex})${imp || ''}${q}`;
    }
  );

  // 2. grade color maps — keys like 'A+' / 'A' / 'W' etc. holding bg-role tokens
  text = text.replace(
    /('[A-Z+-]{1,2}':\s*')var\(--apx-c-([0-9a-f]{6})\)'/g,
    (full, prefix, hex) => {
      fixes++;
      return `${prefix}var(--apx-t-${hex})'`;
    }
  );

  // 3. Navbar helper args
  text = text.replace(
    /(styleActionBtn\([^,]+,\s*')var\(--apx-c-([0-9a-f]{6})\)'/g,
    (full, prefix, hex) => {
      fixes++;
      return `${prefix}var(--apx-t-${hex})'`;
    }
  );

  if (text !== before) writeFileSync(file, text);
}
console.log(`text-role fixes applied: ${fixes}`);
