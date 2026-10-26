/** 一次性探针：宿主深色底里，哪些变量的值不符合定义要求的 #RRGGBB(AA) 格式。 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const host = await import('../skin-wardrobe/sdk/app-custom-themes.js');
const root = join(homedir(), '.hanako', 'artifacts', 'renderer');
const dirs = readdirSync(root).sort();
let css = '', ver = '';
for (let i = dirs.length - 1; i >= 0; i--) {
  const p = join(root, dirs[i], 'themes', 'midnight.css');
  try { css = readFileSync(p, 'utf8'); ver = dirs[i]; break; } catch (_) {}
}
console.log('versionDir: ' + ver);

const opaque = new Set(host.CUSTOM_THEME_OPAQUE_COLOR_NAMES);
const vocab = new Set(host.CUSTOM_THEME_VARIABLE_NAMES);
const re = /(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi;
let m; const needFix = []; const fine = [];
while ((m = re.exec(css)) !== null) {
  const n = m[1], v = m[2].trim();
  if (!vocab.has(n)) continue;
  const hexOk = /^#[0-9a-f]{6}$/i.test(v) || /^#[0-9a-f]{8}$/i.test(v);
  if (!hexOk) needFix.push([n, v, opaque.has(n) ? 'OPAQUE' : 'alpha-ok']);
  else if (opaque.has(n) && v.length !== 7) needFix.push([n, v, 'OPAQUE-but-alpha']);
  else fine.push(n);
}
console.log('合规 ' + fine.length + ' 项 / 需处理 ' + needFix.length + ' 项');
for (const [n, v, kind] of needFix) console.log('  ' + kind.padEnd(16) + n.padEnd(24) + v);
console.log('\n词表内但 midnight 未定义: ' + [...vocab].filter((n) => !fine.includes(n) && !needFix.some((x) => x[0] === n)).join(', '));
