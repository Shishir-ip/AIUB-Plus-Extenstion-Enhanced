/**
 * Theme tokenization pass for AIUB Portal+ Enhanced (per-hex tokens).
 *
 * Rewrites every hardcoded color in the upstream source into a per-hex CSS
 * variable so the whole UI switches between Light and Dark via the token
 * definitions generated into src/theme.css:
 *
 *   --apx-c-<hex> : colors used in background/border role  (darken on dark)
 *   --apx-t-<hex> : colors used in text role               (brighten on dark)
 *
 * Light values are the ORIGINAL upstream hexes, so the light theme stays
 * pixel-identical to upstream. Special handling:
 *   - Tailwind arbitrary class fragments ([#hex]) are never touched
 *   - canvas fillStyle assignments are skipped (CSS vars invalid there)
 *   - rgba(255,255,255,a) overlays map to overlay tokens
 *   - #fff as text stays literal white (never tokenized)
 *
 * Usage: node tools/recolor.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const THEME_CSS = join(SRC, 'theme.css');

/* ------------------------------------------------ dark value mapping ---- */
// Normalized 6-digit hex -> dark equivalent.
// Missing entries fall back to a sensible default per role.
const DARK_BG = {
  // whites & near-whites
  '#ffffff': '#1c2534',
  '#f8fafc': '#151c28', '#f1f5f9': '#1a2231', '#f3f4f6': '#1a2231',
  '#fafafa': '#151c28', '#f5f5f5': '#1a2231', '#f9fafb': '#151c28',
  '#e2e8f0': '#2a3547', '#e5e7eb': '#2a3547', '#eeeeee': '#2a3547',
  '#e8e8e8': '#2a3547', '#cccccc': '#38455c', '#cbd5e1': '#38455c',
  '#d1d5db': '#38455c', '#e8edf3': '#2a3547',
  // blue tints
  '#f8fbff': '#1b2434', '#eff6ff': '#1b2434', '#f0f7ff': '#1b2434', '#f8faff': '#1b2434',
  '#dbeafe': '#22334a', '#bfdbfe': '#2a3d5c', '#eef2f9': '#1c2534',
  '#e0f2fe': '#1c2e46', '#f0f9ff': '#17202e', '#bae6fd': '#25405e',
  '#eef2ff': '#1d2440', '#e0e7ff': '#232e4a', '#c7d2fe': '#2e3c66',
  // green tints
  '#f0fdf4': '#14251b', '#dcfce7': '#1a2f22', '#d1fae5': '#1a2f22',
  '#bbf7d0': '#21402c', '#a7f3d0': '#21402c', '#ccfbf1': '#183430',
  '#f7fee7': '#1a2a16',
  // red/rose tints
  '#fef2f2': '#2e1a1c', '#fee2e2': '#3a2226', '#fecaca': '#3a2226',
  '#fff1f2': '#2e1a20', '#ffe4e6': '#3a2228', '#fecdd3': '#3a2228',
  '#fff8f8': '#2e1a20',
  // amber/orange tints
  '#fffbeb': '#2e2712', '#fef3c7': '#383018', '#fde68a': '#453b1e',
  '#fef08a': '#453b1e', '#fefce8': '#2e2712', '#fef9c3': '#383018',
  '#fff7ed': '#2e2214', '#ffedd5': '#382a19',
  // purple/pink/teal tints
  '#faf5ff': '#231a33', '#ede9fe': '#2b2140', '#f3e8ff': '#2b2140',
  '#ddd6fe': '#342a4e', '#e9d5ff': '#342a4e', '#fdf4ff': '#2e1a28',
  '#fdf2f8': '#2e1a28', '#fce7f3': '#3a2130', '#f5f3ff': '#231a33',
  '#f0fdfa': '#122724',
  // brand accents used as backgrounds — keep the brand, tiny tweaks
  '#2563eb': '#2563eb', '#1e3a8a': '#1e3a8a', '#1d4ed8': '#1d4ed8',
  '#1a73c8': '#1a73c8', '#003b95': '#003b95', '#1e67df': '#1e67df', '#2f7be7': '#2f7be7',
  '#1e40af': '#1e40af', '#4338ca': '#4338ca', '#4f46e5': '#4f46e5',
  '#0369a1': '#0a5c94', '#0284c7': '#0284c7', '#0ea5e9': '#0ea5e9', '#06b6d4': '#06b6d4',
  '#dc2626': '#c0392f', '#ef4444': '#d0524e', '#e53e3e': '#c0392f', '#b91c1c': '#9c3028',
  '#059669': '#0e7a52', '#10b981': '#0f8f63', '#16a34a': '#15803d',
  '#15803d': '#15803d', '#166534': '#166534', '#22c55e': '#16a34a', '#34d399': '#0f8f63',
  '#d97706': '#b3651c', '#b45309': '#9c5215', '#f59e0b': '#c88a1f',
  '#fbbf24': '#c8a21f', '#fcd34d': '#c8a21f',
  '#8b5cf6': '#7440d0', '#a855f7': '#8b47d6', '#7c3aed': '#6d31d0', '#9333ea': '#7440d0',
  '#0f766e': '#0f766e', '#0a66c2': '#1a73c8',
  // soft accents (borders) — slightly dimmed
  '#93c5fd': '#2e4058', '#60a5fa': '#2e4058', '#fca5a5': '#54262a',
  '#6ee7b7': '#1e4a2b', '#a5d6fd': '#2e4058', '#90a4ae': '#38455c',
  '#c4b5fd': '#3c3158',
};

const DARK_TEXT = {
  '#ffffff': '#ffffff', '#fff': '#ffffff',
  '#0f172a': '#e8edf4', '#111827': '#e8edf4',
  '#1e293b': '#dde5f0', '#1f2937': '#dde5f0',
  '#334155': '#c3cfdf', '#374151': '#c3cfdf', '#334669': '#c3cfdf',
  '#475569': '#a9b6c8', '#4b5563': '#a9b6c8',
  '#64748b': '#8b9aad', '#6b7280': '#8b9aad',
  '#94a3b8': '#6d7d94', '#9ca3af': '#6d7d94',
  '#cbd5e1': '#55637a', '#d1d5db': '#55637a',
  '#1e3a8a': '#9db8e8', '#1e40af': '#9db8e8', '#1e3a5f': '#cfe0f5',
  '#1a73c8': '#5fb2ff', '#0d47a1': '#8cc7ff', '#0a66c2': '#5fb2ff', '#1d4ed8': '#6ea8ff',
  '#0369a1': '#7cb8e8', '#0284c7': '#7cb8e8',
  '#166534': '#63d68f', '#15803d': '#63d68f', '#059669': '#4cd49a', '#10b981': '#4cd49a',
  '#047857': '#63d68f', '#065f46': '#63d68f', '#0f766e': '#4ad0c0',
  '#dc2626': '#f28b8b', '#b91c1c': '#f28b8b', '#991b1b': '#ef8a8a', '#7f1d1d': '#ef8a8a',
  '#be123c': '#f8a0a8', '#e11d48': '#f8a0b0', '#f43f5e': '#f8a0b0',
  '#92400e': '#e5c558', '#b45309': '#e5c558', '#d97706': '#edc258', '#a16207': '#e5c558',
  '#78350f': '#e5c558', '#c2410c': '#f0a35c',
  '#5b21b6': '#c3a6f5', '#6d28d9': '#c3a6f5', '#7c3aed': '#c3a6f5', '#7e22ce': '#c3a6f5',
  '#4c1d95': '#c3a6f5', '#3b0764': '#c3a6f5', '#3730a3': '#a5b4fc', '#4338ca': '#a5b4fc',
  '#3b82f6': '#60a5fa', '#6366f1': '#818cf8',
  '#be185d': '#f8a0c8',
};

// rgba(255,255,255,a) overlays -> tokens
const WHITE_ALPHA = [
  [/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, 'apx-ov-10'],
  [/rgba\(255,\s*255,\s*255,\s*0\.12\)/g, 'apx-ov-12'],
  [/rgba\(255,\s*255,\s*255,\s*0\.15\)/g, 'apx-ov-15'],
  [/rgba\(255,\s*255,\s*255,\s*0\.25\)/g, 'apx-ov-25'],
  [/rgba\(255,\s*255,\s*255,\s*0\.3\)/g, 'apx-ov-30'],
  [/rgba\(255,\s*255,\s*255,\s*0\.35\)/g, 'apx-ov-35'],
  [/rgba\(255,\s*255,\s*255,\s*0\.4\)/g, 'apx-ov-40'],
  [/rgba\(255,\s*255,\s*255,\s*0\.5\)/g, 'apx-ov-50'],
  [/rgba\(255,\s*255,\s*255,\s*0\.55\)/g, 'apx-ov-55'],
  [/rgba\(255,\s*255,\s*255,\s*0\.6\)/g, 'apx-ov-60'],
  [/rgba\(255,\s*255,\s*255,\s*0\.7\)/g, 'apx-ov-70'],
  [/rgba\(255,\s*255,\s*255,\s*0\.75\)/g, 'apx-ov-75'],
  [/rgba\(255,\s*255,\s*255,\s*0\.85\)/g, 'apx-ov-85'],
  [/rgba\(255,\s*255,\s*255,\s*0\.88\)/g, 'apx-ov-88'],
  [/rgba\(255,\s*255,\s*255,\s*0\.9\)/g, 'apx-ov-90'],
];
// dark overlay values (white -> dark-blue equivalents)
const DARK_ALPHA = (a) => `rgba(13, 20, 33, ${a})`;

const DARK_ALPHA_DEFAULT = {
  'apx-ov-10': 0.10, 'apx-ov-12': 0.12, 'apx-ov-15': 0.15, 'apx-ov-25': 0.25,
  'apx-ov-30': 0.30, 'apx-ov-35': 0.35, 'apx-ov-40': 0.40, 'apx-ov-50': 0.50,
  'apx-ov-55': 0.55, 'apx-ov-60': 0.60, 'apx-ov-70': 0.70, 'apx-ov-75': 0.75,
  'apx-ov-85': 0.85, 'apx-ov-88': 0.88, 'apx-ov-90': 0.90,
};

/* ------------------------------------------------------------- helpers */

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const norm = (hex) => {
  let h = hex.toLowerCase();
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
};

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (['.jsx', '.js'].includes(extname(p))) files.push(p);
  }
  return files;
}

const usedTokens = new Map(); // key "role:hex" -> { role, hex }

function tokenFor(role, hex) {
  const n = norm(hex);
  usedTokens.set(`${role}:${n}`, { role, hex: n });
  return `var(--apx-${role}-${n.slice(1)})`;
}

function processContent(text) {
  // 0. white-alpha overlays (before hex pass — their rgba could hide hexes? no, independent)
  for (const [re, token] of WHITE_ALPHA) {
    text = text.replace(re, `var(--${token})`);
    usedTokens.set(`ov:${token}`, { role: 'ov', hex: token });
  }

  // 1. property-scoped pass
  const PROP_RE = /([A-Za-z-]*(?:color|background|border|shadow|outline|fill|gradient|decoration)[A-Za-z-]*)\s*:\s*([^;}'"`]*)/g;
  let out = text.replace(PROP_RE, (full, prop, value) => {
    const p = prop.toLowerCase().replace(/-/g, '');
    // never touch canvas fillStyle assignments (JS API, not CSS)
    if (/^(fillstyle|strokestyle)$/.test(p)) return full;
    const isText = p === 'color' || p === 'webkittextfillcolor' || p === 'webkittextstrokecolor' ||
                   p === 'caretcolor' || p === 'textdecorationcolor';
    const newValue = value.replace(COLOR_RE, (hex) => {
      const n = norm(hex);
      if (/^\#[0-9a-f]{6}$/.test(n) === false) return hex;
      return tokenFor(isText ? 't' : 'c', n);
    });
    return `${prop}: ${newValue}`;
  });

  // 2. bare-hex pass — skip Tailwind arbitrary fragments and JS property assignments
  out = out.replace(COLOR_RE, (hex, offset, full) => {
    const before = full.slice(Math.max(0, offset - 2), offset);
    if (before === '[-' || before === '-[') return hex;           // Tailwind [#...]
    if (/(fillStyle|strokeStyle)\s*=\s*['"]$/.test(full.slice(0, offset))) return hex;
    const n = norm(hex);
    if (!/^#[0-9a-f]{6}$/.test(n)) return hex;
    // bare hexes are almost always backgrounds/borders in this codebase
    return tokenFor('c', n);
  });

  return out;
}

/* ------------------------------------------------------------ generate */

function generateThemeCss() {
  const light = [];
  const dark = [];
  const ovLight = [];
  const ovDark = [];

  for (const { role, hex } of usedTokens.values()) {
    if (role === 'ov') {
      const a = DARK_ALPHA_DEFAULT[hex];
      ovLight.push(`  --${hex}: rgba(255, 255, 255, ${a});`);
      ovDark.push(`  --${hex}: ${DARK_ALPHA(a)};`);
      continue;
    }
    const n = norm(hex);
    const lightVal = n;
    const darkVal = (role === 'c' ? DARK_BG : DARK_TEXT)[n];
    light.push(`  --apx-${role}-${n.slice(1)}: ${lightVal};`);
    dark.push(`  --apx-${role}-${n.slice(1)}: ${darkVal || (role === 'c' ? '#1c2534' : '#c3cfdf')};`);
  }
  void norm;

  const sortFn = (a, b) => a.localeCompare(b);
  return `/* ============================================================================
   AIUB Portal+ Enhanced — theme tokens (GENERATED by tools/recolor.mjs)
   Light = original upstream values (pixel-identical).
   Dark  = navy-tinted equivalents applied under html.apx-dark.
   Manual theme layers live below the TOKENS block.
   ========================================================================== */

/* ==== TOKENS:BEGIN (generated) ==== */
:root {
${light.sort(sortFn).join('\n')}
${ovLight.sort(sortFn).join('\n')}
}

html.apx-dark {
${dark.sort(sortFn).join('\n')}
${ovDark.sort(sortFn).join('\n')}
}
/* ==== TOKENS:END ==== */
`;
}

/* -------------------------------------------------------------- drive */

const files = walk(SRC);

// Seed from already-tokenized references so the pass is idempotent
const EXISTING_RE = /var\(--apx-([ct])-([0-9a-f]{6})\)|var\(--(apx-ov-\d+)\)/g;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  let m;
  while ((m = EXISTING_RE.exec(text))) {
    if (m[3]) usedTokens.set(`ov:${m[3]}`, { role: 'ov', hex: m[3] });
    else usedTokens.set(`${m[1]}:${m[2]}`, { role: m[1], hex: '#' + m[2] });
  }
}

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const out = processContent(text);
  if (out !== text) writeFileSync(file, out);
}

// merge generated tokens into theme.css (replace between markers, or prepend)
let themeCss = '';
try { themeCss = readFileSync(THEME_CSS, 'utf8'); } catch { themeCss = ''; }
const tokens = generateThemeCss();
if (/\/\* ==== TOKENS:BEGIN/.test(themeCss)) {
  themeCss = themeCss.replace(
    /\/\* ==== TOKENS:BEGIN[\s\S]*?\/\* ==== TOKENS:END ==== \*\//,
    tokens.trim().replace(/^\/\* =+$/, '').replace('/*', '').trim().replace(/^=+ \n/, '/* =').replace(/^/, '/* ==')
  );
  // simpler: regenerate header line
  themeCss = themeCss.replace(/\/\* ==+[\s\S]*?\/\* ==== TOKENS:BEGIN/, '/* ==== TOKENS:BEGIN');
  themeCss = themeCss.replace(/\/\* ==== TOKENS:BEGIN[\s\S]*?\/\* ==== TOKENS:END ==== \*\//, tokens.slice(tokens.indexOf('/* ==== TOKENS:BEGIN'), tokens.indexOf('/* ==== TOKENS:END ==== ') + '/* ==== TOKENS:END ==== */'.length));
} else {
  themeCss = tokens + '\n' + themeCss;
}
writeFileSync(THEME_CSS, themeCss);

console.log(`tokenized ${usedTokens.size} color roles across ${files.length} files`);
console.log(`theme.css tokens regenerated (${themeCss.length} bytes)`);
