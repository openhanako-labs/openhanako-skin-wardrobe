/**
 * scripts/build-skinpacks.mjs — 把 hana-skin v0.1.4 的三个主题转成 SKINPACK 信封。
 *
 * 依据实测：src/hana-*.css 是**纯变量块**（69 项，规则块只有 [data-theme="…"] 本身），
 * 词表内 58 项，核心 8 项全齐 —— 所以三个主题都能走官方 API（vars 类），不碰安装目录。
 *
 * 词表外 11 项按可推导 / 真丢失分开记账：
 *   - --*-rgb、--select-arrow 由宿主推导，不算损失
 *   - --tab-slider-shadow / --radius-sm|md|lg / --border-width 是真丢失，写进 losses
 *
 * 材质 / 背景 / 取景框三层不进这里（必须打补丁），在包级 note 里说明。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';

const sp = await import(
  pathToFileURL('W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/ui/assets/skinpack.mjs').href
);
const { readPack, analyzeTheme, parsePaletteCss, GEOMETRY_DEFAULTS } = sp;

const host = await import(
  pathToFileURL('W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/sdk/app-custom-themes.js').href
);
const VOCAB = new Set(host.CUSTOM_THEME_VARIABLE_NAMES);
const OPAQUE = new Set(host.CUSTOM_THEME_OPAQUE_COLOR_NAMES);
const DERIVED = new Set(host.CUSTOM_THEME_RGB_SOURCE_NAMES.map((n) => n + '-rgb').concat(['--select-arrow']));

const SRC = 'W:/Games/Hanako/Work/临时/skin-v014/hana-skin-皮肤包/src';
const OUT = 'W:/Games/Hanako/Work/projects/hana-skin-app/dist/skins';
mkdirSync(OUT, { recursive: true });

const THEMES = [
  { file: 'hana-moonlit-court.css', key: 'moonlit-court', zh: '月满庭', en: 'Moonlit Court', mode: '夜阑', bg: '#172725', accent: '#D9B77C' },
  { file: 'hana-violet-dusk.css', key: 'violet-dusk', zh: '极光', en: 'Violet Dusk', mode: '夜穹', bg: '#3C354A', accent: '#7662BA' },
  { file: 'hana-deepsleep.css', key: 'deepsleep', zh: 'Deepsleep', en: 'Deepsleep', mode: 'Zzz', bg: '#f6f7fb', accent: '#5D79FF' },
];

/** 从 CSS 里取变量（去注释，只认块内声明）。 */
function extractVars(css) {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/gi)) {
    const name = m[1];
    if (!(name in out)) out[name] = m[2].trim();
  }
  return out;
}

/** 解 var() 引用（实测 --tab-slider-bg = var(--overlay-strong)）。 */
function derefVars(vars) {
  const out = {};
  for (const [name, raw] of Object.entries(vars)) {
    let v = raw;
    for (let depth = 0; depth < 4; depth++) {
      const ref = /^var\((--[a-z0-9-]+)\)$/i.exec(v);
      if (!ref) break;
      const next = vars[ref[1]];
      if (!next) { v = null; break; }
      v = next;
    }
    if (v !== null) out[name] = v;
  }
  return out;
}

/** 宿主定义只认 #RRGGBB / #RRGGBBAA，这里统一转一遍。 */
function rgbaToHex(v) {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i.exec(v);
  if (!m) return v;
  const hx = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  const a = m[4] === undefined ? 255 : Math.round(parseFloat(m[4]) * 255);
  return ('#' + hx(+m[1]) + hx(+m[2]) + hx(+m[3]) + (a === 255 ? '' : hx(a))).toUpperCase();
}

/** 拿来补全的宿主深色底：从本机 1.1.111 的 midnight.css 解析（与运行时同源）。 */
const DEMO_BASE = (() => {
  const root = join(homedir(), '.hanako', 'artifacts', 'renderer');
  const dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const p = join(root, dirs[i], 'themes', 'midnight.css');
    if (existsSync(p)) return parsePaletteCss(readFileSync(p, 'utf8'), [...VOCAB]);
  }
  return { vars: {}, skipped: [] };
})();

const report = [];

for (const t of THEMES) {
  const css = readFileSync(join(SRC, t.file), 'utf8');
  const raw = derefVars(extractVars(css));

  const variables = {};
  const dropped = [];
  const flattened = [];   // 带 alpha 但宿主要求不透明的项
  for (const [name, value] of Object.entries(raw)) {
    if (!VOCAB.has(name)) { dropped.push(name); continue; }
    let v = value;
    if (v.startsWith('#')) v = v.toUpperCase();
    else if (/^rgba?\(/i.test(v)) v = rgbaToHex(v);
    if (!/^#[0-9a-f]{6,8}$/i.test(v)) {
      const spec = host.CUSTOM_THEME_VARIABLE_SPECS.find((s) => s.name === name);
      // length 类型要的是数字（CSS 像素），不是带单位字符串
      if (spec && spec.type === 'length') {
        const num = parseFloat(String(v).replace(/px$/i, ''));
        if (Number.isFinite(num)) { variables[name] = num; continue; }
        dropped.push(name + '(非法 length ' + v + ')');
        continue;
      }
      // font-family 要的是字符串数组
      if (spec && spec.type === 'font-family') {
        variables[name] = String(v).split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
        continue;
      }
      dropped.push(name + '(非法值 ' + v + ')');
      continue;
    }
    // 宿主硬约束：部分变量必须是不透明 #RRGGBB（实测 --bg-card 会被拒）
    if (OPAQUE.has(name) && v.length === 9) {
      flattened.push(name);
      v = v.slice(0, 7);
    }
    variables[name] = v;
  }

  const realLoss = dropped.filter((n) => !DERIVED.has(n.split('(')[0]));
  const derivedLoss = dropped.filter((n) => DERIVED.has(n.split('(')[0]));

  const appearance = t.key === 'deepsleep' ? 'light' : 'dark';
  const pack = {
    schema: 'hana-skinpack/1',
    packId: 'hana-skin-' + t.key,
    packVersion: '0.1.4',
    names: { zh: 'hana-skin · ' + t.zh, en: 'hana-skin · ' + t.en },
    description: t.zh + '（' + t.mode + '）— 来自 hana-skin v0.1.4 的配色层。',
    source: {
      kind: 'derived',
      publisher: 'hana-skin v0.1.4',
      license: 'unspecified',
      derivedFrom: 'hana-skin@0.1.4/src/' + t.file,
      notes: '仅含配色层；材质 / 背景 / 取景框属补丁层，未包含。',
    },
    themes: [{
      key: t.key,
      kind: 'vars',
      appearance,
      base: 'host-' + appearance,
      palette: { bg: t.bg, accent: t.accent },
      theme: {
        formatVersion: 1,
        name: 'hana-skin · ' + t.zh,
        appearance,
        variables,
      },
      losses: [
        ...realLoss.map((n) => n + '（官方词表无此变量）'),
        ...flattened.map((n) => n + '（原本带 alpha，宿主要求不透明，已压成 6 位）'),
        '材质层（material/*.css，约 71KB）',
        '背景图层（background/*/dark.css + PNG）',
        '取景框（panel-frame/bg.js canvas 动画）',
      ],
    }],
  };

  const file = join(OUT, 'hana-skin-' + t.key + '.skin.json');
  writeFileSync(file, JSON.stringify(pack, null, 2), 'utf8');

  // 自检：信封过 readPack；变量层要**先补全**再过宿主校验（包内存的是部分变量）
  const checked = readPack(JSON.parse(readFileSync(file, 'utf8')));
  const full = analyzeTheme(pack.themes[0], DEMO_BASE, [...VOCAB]);
  const vr = host.validateCustomThemeDefinition(full.definition);
  report.push({
    theme: t.zh,
    vars: Object.keys(variables).length,
    dropped: realLoss,
    flattened,
    derived: derivedLoss.length,
    file: file.split('\\').pop(),
    envelopeOk: checked.ok,
    envelopeErr: checked.errors,
    fillCounts: `作者 ${full.authoredCount} + 继承 ${full.inheritedCount} + 默认 ${full.defaultedCount} = ${Object.keys(full.definition.variables).length}`,
    coreMissing: full.missingCore,
    valid: vr.state,
    validMsg: vr.ok === false ? vr.message : '',
  });
}

console.log('=== 生成 SKINPACK ===');
for (const r of report) {
  console.log(`${r.file}`);
  console.log(`  变量 ${r.vars}/61 · 词表外丢弃 ${r.dropped.length} · 宿主推导 ${r.derived}`);
  if (r.dropped.length) console.log(`  丢弃: ${r.dropped.join(' ')}`);
  if (r.flattened.length) console.log(`  压不透明: ${r.flattened.join(' ')}`);
  console.log(`  补全: ${r.fillCounts}  |  核心缺失: ${r.coreMissing.length ? r.coreMissing.join(' ') : '无'}`);
  console.log(`  信封: ${r.envelopeOk ? '通过' : '拒绝 ' + r.envelopeErr.join('; ')}  |  补全后变量层: ${r.valid}${r.validMsg ? ' (' + r.validMsg + ')' : ''}`);
}
