/**
 * build-eva-skinpack.mjs
 * 把 custom-themes/eva-002 的 theme.css 转成 SKINPACK。
 * 它原本是"内置注册表主题"（71 变量 + 组件 CSS），这里只取 61 词表内的部分，
 * 其余（暗纹、滚动条、::selection、overlay 模糊）如实记进 losses。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const host = await import(
  pathToFileURL('W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/sdk/app-custom-themes.js').href
);
const VOCAB = new Set(host.CUSTOM_THEME_VARIABLE_NAMES);
const OPAQUE = new Set(host.CUSTOM_THEME_OPAQUE_COLOR_NAMES);
const SPECS = host.CUSTOM_THEME_VARIABLE_SPECS;

const SRC = 'W:/Games/Hanako/Work/projects/custom-themes/eva-002/theme.css';
const OUT = 'W:/Games/Hanako/Work/projects/hana-skin-app/dist/skins';

const css = readFileSync(SRC, 'utf8');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* 只取 [data-theme="eva-002"] 块里的声明 */
const blockMatch = /\[data-theme="eva-002"\]\s*\{([\s\S]*?)\}/.exec(body);
if (!blockMatch) { console.error('找不到 eva-002 变量块'); process.exit(1); }

const raw = {};
for (const m of blockMatch[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  if (!(m[1] in raw)) raw[m[1]] = m[2].trim();
}

/* var() 解引用 */
const deref = (v, depth = 0) => {
  const r = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (!r || depth > 3) return v;
  const n = raw[r[1]];
  return n === undefined ? v : deref(n, depth + 1);
};

const rgbaToHex = (v) => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+))?\s*\)$/i.exec(v);
  if (!m) return v;
  const hx = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const a = m[4] === undefined ? 255 : Math.round(parseFloat(m[4]) * 255);
  return ('#' + hx(+m[1]) + hx(+m[2]) + hx(+m[3]) + (a === 255 ? '' : hx(a))).toUpperCase();
};

const vars = {};
const dropped = [];
const flattened = [];

for (const [name, originalValue] of Object.entries(raw)) {
  if (!VOCAB.has(name)) { dropped.push(name); continue; }
  let v = deref(originalValue);
  const spec = SPECS.find((s) => s.name === name);

  if (spec && spec.type === 'length') {
    const n = parseFloat(String(v).replace(/px$/i, ''));
    if (Number.isFinite(n)) { vars[name] = n; continue; }
    dropped.push(name + '(非法 length)'); continue;
  }
  if (spec && spec.type === 'font-family') {
    vars[name] = String(v).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    continue;
  }
  if (v.startsWith('#')) v = v.toUpperCase();
  else if (/^rgba?\(/i.test(v)) v = rgbaToHex(v);
  if (!/^#[0-9a-f]{6,8}$/i.test(v)) { dropped.push(name + '(非法值 ' + v + ')'); continue; }
  if (OPAQUE.has(name) && v.length === 9) { flattened.push(name); v = v.slice(0, 7); }
  vars[name] = v;
}

const CORE = ['--bg', '--bg-card', '--bg-glass', '--sidebar-bg', '--text', '--text-muted', '--border', '--accent'];
const missingCore = CORE.filter((n) => !(n in vars));

const pack = {
  schema: 'hana-skinpack/1',
  packId: 'eva-002',
  packVersion: '1.0.0',
  names: { zh: 'Eva 002 · 二号机', en: 'Eva 002 · Unit-02' },
  description: '亮色驾驶舱面板 + 机甲红主操作色 + 初号机荧光绿点缀。取自 custom-themes/eva-002。',
  source: { kind: 'original', publisher: 'local', license: 'unspecified' },
  themes: [{
    key: 'cockpit',
    kind: 'vars',
    appearance: 'light',
    base: 'host-light',
    palette: { bg: vars['--bg'], panel: vars['--bg-card'], accent: vars['--accent'], text: vars['--text'] },
    theme: { formatVersion: 1, name: 'Eva 002 · 二号机', appearance: 'light', variables: vars },
    losses: [
      ...dropped.map((n) => n + '（官方词表无此变量）'),
      ...flattened.map((n) => n + '（原带 alpha，要求不透明已压成 6 位）'),
      '滚动条配色微调（组件 CSS）',
      '::selection 荧光绿（组件 CSS）',
      '设置面板遮罩 blur(8px) + 机甲红渐变（组件 CSS + 哈希类名）',
      '未定义的字体栈由宿主浅色底补全',
    ],
  }],
};

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, 'eva-002.skin.json');
writeFileSync(outFile, JSON.stringify(pack, null, 2), 'utf8');

/* 自检：补全后过宿主校验 */
const sp = await import(
  pathToFileURL('W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/ui/assets/skinpack.mjs').href
);
const analysis = sp.analyzeTheme(pack.themes[0], { vars: {}, skipped: [] }, [...VOCAB]);
const vr = host.validateCustomThemeDefinition(analysis.definition);

console.log('变量: ' + Object.keys(vars).length + '/61');
console.log('丢弃: ' + dropped.length + ' 项 ' + (dropped.join(' ') || ''));
console.log('压不透明: ' + (flattened.join(' ') || '无'));
console.log('核心 8 项: ' + (missingCore.length ? '缺 ' + missingCore.join(' ') : '齐全'));
console.log('补全后宿主校验: ' + vr.state + (vr.ok === false ? ' -> ' + vr.message : ''));
console.log('输出: ' + outFile);
