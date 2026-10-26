/**
 * tests/completion.test.mjs — 验证规范 §5 的补全链路能不能过**宿主自己的**校验器。
 * 用真实数据：midnight.css（宿主内置深色主题）当底，Luna 的 61 项当完整样本。
 * 不启动宿主，直接 import 随包 SDK 里的 app-custom-themes.js。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { analyzeTheme, REQUIRED_CORE, parsePaletteCss, readPack } from '../skin-wardrobe/ui/assets/skinpack.mjs';

const host = await import('../skin-wardrobe/sdk/app-custom-themes.js');

/*
 * 不写死渲染资源的版本目录（带 hash，升级会变）。
 * 取 artifacts/renderer 下字典序最新、且确实有 midnight.css 的那个。
 */
function findBuiltinDarkTheme() {
  const root = join(homedir(), '.hanako', 'artifacts', 'renderer');
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (let i = dirs.length - 1; i >= 0; i--) {
    const p = join(root, dirs[i], 'themes', 'midnight.css');
    try { readFileSync(p, 'utf8'); return { path: p, versionDir: dirs[i] }; }
    catch (_) { /* 换下一个 */ }
  }
  throw new Error('找不到内置深色主题 midnight.css，已搜过：' + dirs.join(', '));
}

const found = findBuiltinDarkTheme();
console.log('  宿主深色底：' + found.versionDir);
const midnightCss = readFileSync(found.path, 'utf8');
const VOCAB = host.CUSTOM_THEME_VARIABLE_NAMES;
const paletteBase = parsePaletteCss(midnightCss, VOCAB);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

console.log('[1] 解析宿主深色底');
const baseVars = paletteBase.vars;
console.log('  底表 ' + Object.keys(baseVars).length + ' 项，跳过 ' + paletteBase.skipped.length + ' 项；' +
  '核心 8 项齐全：' + REQUIRED_CORE.every((n) => n in baseVars));
for (const s of paletteBase.skipped) {
  console.log('    跳过 ' + s.name + ' = ' + s.raw + '  (' + s.reason + ')');
}
check('底表不含有词表外变量',
  Object.keys(baseVars).every((n) => VOCAB.includes(n)),
  Object.keys(baseVars).filter((n) => !VOCAB.includes(n)).join(','));
check('底表值全部是 hex 格式',
  Object.values(baseVars).every((v) => /^#[0-9a-f]{6,8}$/i.test(v)),
  Object.entries(baseVars).filter(([, v]) => !/^#[0-9a-f]{6,8}$/i.test(v)).map(([k, v]) => k + '=' + v).join(' '));
check('核心 8 项真的在底表里', REQUIRED_CORE.every((n) => n in baseVars));

console.log('[2] 只给 8 项核心的深色皮肤 -> 补全 -> 宿主校验');
const minimal = {
  key: 'minimal', kind: 'vars', appearance: 'dark',
  theme: {
    formatVersion: 1, name: 'T 只给核心', appearance: 'dark',
    variables: {
      '--bg': '#101014', '--bg-card': '#18181C', '--bg-glass': '#18181CE8',
      '--sidebar-bg': '#141418', '--text': '#EDEDEF', '--text-muted': '#9A9AA2',
      '--border': '#3A3A42', '--accent': '#C0504D',
    },
  },
};
const a1 = analyzeTheme(minimal, paletteBase, VOCAB);
console.log('  作者 ' + a1.authoredCount + ' / 继承 ' + a1.inheritedCount + ' / 默认 ' + a1.defaultedCount +
  ' / 合计 ' + Object.keys(a1.definition.variables).length);
const r1 = host.validateCustomThemeDefinition(a1.definition);
check('补全结果过宿主校验', r1.state === 'valid', r1.ok === false ? r1.message : '');
check('完整性判定为可装', a1.complete && a1.missingCore.length === 0);

console.log('[3] 变量名与值都不许凭空多出来');
const names = Object.keys(a1.definition.variables);
check('没有词表外变量', names.every((n) => VOCAB.includes(n)),
  names.filter((n) => !VOCAB.includes(n)).join(','));
check('项数恰好 61', names.length === 61, 'got ' + names.length);

console.log('[4] 缺核心项 -> analyzeTheme 必须报出来（不能静默补）');
const sloppy = {
  key: 'sloppy', kind: 'vars', appearance: 'dark',
  theme: { formatVersion: 1, name: 'S 缺核心', appearance: 'dark',
    variables: { '--bg': '#101014', '--accent': '#C0504D' } },
};
const a2 = analyzeTheme(sloppy, paletteBase, VOCAB);
check('缺 6 项核心被识别', a2.missingCore.length === 6, JSON.stringify(a2.missingCore));
check('判定不可装', a2.complete === false);

console.log('[5] 词表外的作者变量（eva-002 那种）原样带上，由宿主拒绝');
const extra = {
  key: 'eva', kind: 'vars', appearance: 'light',
  theme: { formatVersion: 1, name: 'E 带词表外', appearance: 'light',
    variables: { ...REQUIRED_CORE.reduce((o, k) => (o[k] = '#FFFFFF', o), {}), '--bg-texture': 'none' } },
};
const a3 = analyzeTheme(extra, paletteBase, VOCAB);
console.log('  词表外被挑出：' + a3.outsideVocabulary.join(','));
const r3 = host.validateCustomThemeDefinition(a3.definition);
check('过滤掉词表外项后，补全结果合法', r3.state === 'valid', r3.message);
check('词表外作者变量被报损而非静默丢',
  a3.outsideVocabulary.includes('--bg-texture'), JSON.stringify(a3.outsideVocabulary));

console.log('[6] 信封校验：kind=patch 缺 patchRef 必须拒');
const badPack = readPack({
  schema: 'hana-skinpack/1', packId: 'p', packVersion: '1.0.0',
  themes: [{ key: 't', kind: 'patch', appearance: 'dark', losses: [] }],
});
check('缺 patchRef 被拒', badPack.ok === false && badPack.errors.some((e) => /patchRef/.test(e)));

const okPack = readPack({
  schema: 'hana-skinpack/1', packId: 'p', packVersion: '1.0.0',
  patchSets: { s: { engine: 'x', entry: 'a', check: 'b', restore: 'c' } },
  themes: [{ key: 't', kind: 'patch', appearance: 'dark', patchRef: 's', losses: ['x'] }],
});
check('引用完整的包通过', okPack.ok === true, okPack.errors.join(';'));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
