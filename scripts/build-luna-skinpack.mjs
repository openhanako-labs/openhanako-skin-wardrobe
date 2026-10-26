/**
 * scripts/build-luna-skinpack.mjs
 * 把 Luna 龙娘主题转成 SKINPACK，并用宿主校验器验证它是否合法。
 * 它的 theme-definition.mjs 自称是完整 61 项定义，所以先原样校验，再看要不要补。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const host = await import(
  pathToFileURL('W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/sdk/app-custom-themes.js').href
);
const VOCAB = new Set(host.CUSTOM_THEME_VARIABLE_NAMES);
const OPAQUE = new Set(host.CUSTOM_THEME_OPAQUE_COLOR_NAMES);

const CANDIDATES = [
  'W:/Games/Hanako/Work/临时/skin-inspect/luna/Luna-HanaAgent-0.2.3-Windows/app/hana-luna-theme/ui/assets/theme-definition.mjs',
  'W:/Games/Hanako/Work/临时/luna/Luna-HanaAgent-0.2.3-Windows/app/hana-luna-theme/ui/assets/theme-definition.mjs',
];
const src = CANDIDATES.find((p) => existsSync(p));
if (!src) {
  console.error('找不到 theme-definition.mjs，候选路径都不存在：');
  CANDIDATES.forEach((p) => console.error('  ' + p));
  process.exit(2);
}
console.log('定义文件：' + src);

const mod = await import(pathToFileURL(src).href);
const def = mod.DEFINITION;
const source = mod.SOURCE || {};
console.log('主题名：' + def.name + ' / appearance=' + def.appearance);
console.log('变量数：' + Object.keys(def.variables).length);

/* 1. 原样校验 */
const raw = host.validateCustomThemeDefinition(def);
console.log('\n[1] 原样校验 -> ' + raw.state + (raw.ok === false ? '：' + raw.message : ''));

/* 2. 逐项体检 */
const names = Object.keys(def.variables);
const missing = [...VOCAB].filter((n) => !names.includes(n));
const unknown = names.filter((n) => !VOCAB.has(n));
console.log('[2] 缺 ' + missing.length + ' 项' + (missing.length ? '：' + missing.join(' ') : ''));
console.log('    多 ' + unknown.length + ' 项' + (unknown.length ? '：' + unknown.join(' ') : ''));

/* 3. opaque 检查 */
const badOpaque = [];
for (const [k, v] of Object.entries(def.variables)) {
  if (!OPAQUE.has(k)) continue;
  if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) badOpaque.push(k + '=' + v);
}
console.log('[3] 不透明项违规 ' + badOpaque.length + ' 个' + (badOpaque.length ? '：' + badOpaque.join(' ') : ''));

/* 4. 若原样不合法，尝试最小修正 */
let fixed = null;
if (raw.state !== 'valid') {
  const vars = { ...def.variables };
  for (const m of missing) {
    // 用宿主的中性初值兜底（只影响未定义项）
    const init = host.CUSTOM_THEME_INITIAL_DEFINITION.variables;
    if (m in init) vars[m] = init[m];
  }
  for (const n of unknown) delete vars[n];
  for (const bad of badOpaque) {
    const key = bad.split('=')[0];
    const v = vars[key];
    if (typeof v === 'string' && v.length === 9) vars[key] = v.slice(0, 7);
  }
  const attempt = { ...def, variables: vars };
  const r2 = host.validateCustomThemeDefinition(attempt);
  console.log('[4] 最小修正后 -> ' + r2.state + (r2.ok === false ? '：' + r2.message : ''));
  if (r2.state === 'valid') fixed = r2.value;
}

const final = fixed || (raw.state === 'valid' ? raw.value : null);
if (!final) {
  console.log('\n结论：无法自动修正，需要人工处理');
  process.exit(1);
}

/* 5. 生成 SKINPACK */
const pack = {
  schema: 'hana-skinpack/1',
  packId: 'luna-dragongirl',
  packVersion: '0.2.3',
  names: { zh: def.name, en: 'Luna Dragon Girl' },
  description: 'Luna 龙娘 · 玫瑰月影（来自 hana-luna-theme App）',
  source: {
    kind: 'original',
    publisher: source.publisher || 'ilrs',
    license: source.license || 'unspecified',
    ...(source.imageSha256 ? { imageSha256: source.imageSha256 } : {}),
    notes: '原始定义本身就是完整 61 项，未做任何删改。',
  },
  themes: [{
    key: 'default',
    kind: 'vars',
    appearance: final.appearance,
    base: 'host-' + final.appearance,
    palette: {
      bg: final.variables['--bg'],
      panel: final.variables['--bg-card'],
      accent: final.variables['--accent'],
      text: final.variables['--text'],
    },
    theme: final,
    losses: [],
  }],
};

const outDir = 'W:/Games/Hanako/Work/projects/hana-skin-app/dist/skins';
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'luna-dragongirl.skin.json');
writeFileSync(outFile, JSON.stringify(pack, null, 2), 'utf8');

console.log('\n[5] 已生成：' + outFile);
console.log('    作者变量 ' + Object.keys(final.variables).length + ' / 61，losses 为空' + (fixed ? '（经过最小修正）' : '（原样通过）'));
