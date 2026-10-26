/**
 * patch/scripts/wardrobe-exec.mjs —— 执行衣橱待办
 *
 * 用户在意橱里点「启用」，只会在 app-data 里留一条待办。
 * 这个脚本负责把它变成宿主里的真主题：
 *   1. 读包 → 生成 themes/hana-<packId>.css（配色 + 背景）
 *   2. 三处注册表加一条
 *   3. 待办标记完成
 *
 * 材质不用管：通用材质用 [data-theme^="hana-"] 通配，新主题自动继承。
 *
 * 用法：
 *   node patch/scripts/wardrobe-exec.mjs            干跑，只报告
 *   node patch/scripts/wardrobe-exec.mjs --apply    真执行
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HANA = join(homedir(), '.hanako');
const APP_DATA = join(HANA, 'app-data', 'skin-wardrobe');
const PENDING = join(APP_DATA, 'pending.json');
const SKINS = join(APP_DATA, 'skins');

const ROOT = 'W:/Games/Hanako/Work/projects/hana-skin-app';
const TEMPLATE_BG = join(ROOT, 'patch', 'src', 'background-luna', 'dark.css');
const REGISTRY_OPS = join(ROOT, 'patch', 'scripts', 'registry-ops.mjs');
const BACKUP_ROOT = join(ROOT, 'patch', 'backups');

const APPLY = process.argv.includes('--apply');

const target = JSON.parse(readFileSync(join(HANA, 'artifacts', 'desktop-target.json'), 'utf8')).current;
const THEMES_DIR = join(target.renderer.versionDir, 'themes');

/* ── 读待办 ── */
function readPending() {
  if (!existsSync(PENDING)) return [];
  try { return JSON.parse(readFileSync(PENDING, 'utf8')); } catch { return []; }
}
function writePending(list) {
  writeFileSync(PENDING, JSON.stringify(list, null, 2), 'utf8');
}

/* ── 工具 ── */
const hexToRgb = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
};

/** 生成该皮肤的 CSS：配色块 + 背景块（用 Luna 的背景结构做模板） */
function buildCss(pack) {
  const theme = pack.theme || {};
  const colors = theme.colors || {};
  const id = 'hana-' + pack.packId;
  const bgHex = colors['--bg'] || '#141313';
  const rgb = hexToRgb(bgHex) || [20, 19, 19];

  const name = (pack.names && (pack.names.zh || pack.names.en)) || pack.packId;
  const lines = [];
  lines.push(`/* 衣橱导出 · ${name} · ${new Date().toISOString().slice(0, 10)} */`);

  /* 1. 配色块 */
  lines.push(`[data-theme="${id}"] {`);
  for (const [k, v] of Object.entries(colors)) {
    if (k === '--bg-rgb') continue;
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`  --bg-rgb: ${rgb.join(', ')};`);
  lines.push('}');

  /* 2. 背景块：拿 Luna 的背景结构当模板，换图换色换主题 id */
  if (theme.background && theme.background.asset) {
    let tpl = existsSync(TEMPLATE_BG) ? readFileSync(TEMPLATE_BG, 'utf8') : '';
    if (tpl) {
      // 去掉模板里的所有块注释（会带出 Luna 的说明文字）
      tpl = tpl.replace(/\/\*[\s\S]*?\*\//g, '');
      tpl = tpl.replace(/\n{3,}/g, '\n\n').trim();

      // 主题 id
      tpl = tpl.replaceAll('[data-theme="hana-luna"]', `[data-theme="${id}"]`);
      tpl = tpl.replaceAll('[data-theme^="hana-"]', `[data-theme="${id}"]`);

      // 图片占位符
      tpl = tpl.replaceAll('__BG_DARK_DATA_URI__', theme.background.asset);

      // 底色：把模板里的 Luna 底色换成本皮肤底色
      tpl = tpl.replaceAll('20, 19, 19', rgb.join(', '));
      tpl = tpl.replaceAll('#141313', bgHex);

      // 透明度参数
      const pa = theme.background.panelAlpha;
      const ca = theme.background.cardAlpha;
      if (typeof pa === 'number') {
        tpl = tpl.replaceAll(`rgba(${rgb.join(', ')}, 0.55)`, `rgba(${rgb.join(', ')}, ${pa})`);
      }
      if (typeof ca === 'number') {
        tpl = tpl.replaceAll(`rgba(${rgb.join(', ')}, 0.45)`, `rgba(${rgb.join(', ')}, ${ca})`);
      }

      lines.push('');
      lines.push(`/* ── 背景层 ── */`);
      lines.push(tpl.trim());
    }
  }

  /* 3. 材质层：通用材质源用 [data-theme^="hana-"] 通配，贴进任何 hana-* 都生效 */
  const matFile = join(ROOT, 'patch', 'src', 'material-universal', 'bold.css');
  if (existsSync(matFile)) {
    let mat = readFileSync(matFile, 'utf8');
    mat = mat.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (mat) {
      lines.push('');
      lines.push('/* ── 材质层（通用）── */');
      lines.push(mat);
    }
  }

  /* 4. 材质参数覆盖：包里的值优先于通用材质默认值 */
  const mi = theme.material || {};
  const overrides = [];
  if (typeof mi.rim === 'number') overrides.push(`--mat-rim: ${mi.rim};`);
  if (typeof mi.blur === 'number') overrides.push(`--mat-blur: ${Math.round(mi.blur)}px;`);
  if (mi.edge) overrides.push(`--mat-edge: ${mi.edge};`);
  if (overrides.length) {
    lines.push('');
    lines.push(`/* ── 材质参数（本皮肤）── */`);
    // 特异性高于通用层的 [data-theme^="hana-"]，所以会盖住默认值
    lines.push(`[data-theme="${id}"] {`);
    for (const o of overrides) lines.push('  ' + o);
    lines.push('}');
  }

  /* 5. 兜底 */
  lines.push('');
  lines.push(`/* ── 兜底 ── */`);
  lines.push(`[data-theme="${id}"] {`);
  lines.push(`  color-scheme: ${theme.appearance === 'light' ? 'light' : 'dark'};`);
  lines.push('}');

  return lines.join('\n') + '\n';
}

/* ── 注册表操作：委托给 registry-ops.mjs ── */
function registryOps(args) {
  const out = execFileSync(process.execPath, [REGISTRY_OPS, ...args], { encoding: 'utf8' });
  return out;
}

/* ── 真跑前先备份三处注册表（纪律：动宿主先备） ── */
function backupRegistries() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const dir = join(BACKUP_ROOT, 'exec-' + stamp);
  mkdirSync(dir, { recursive: true });

  const rd = target.renderer.versionDir;
  const sd = target.server.versionDir;
  const files = [join(rd, 'lib', 'theme.js'), join(sd, 'bundle', 'index.js')];

  // renderer bundle 名字带哈希，用内容特征找
  const assetsDir = join(rd, 'assets');
  if (existsSync(assetsDir)) {
    for (const n of readdirSync(assetsDir)) {
      if (!n.endsWith('.js')) continue;
      const p = join(assetsDir, n);
      try {
        const t = readFileSync(p, 'utf8');
        if (t.includes('cssPath:') && t.includes('themes/')) { files.push(p); break; }
      } catch { /* 读不了就跳 */ }
    }
  }

  for (const f of files) {
    if (!existsSync(f)) continue;
    copyFileSync(f, join(dir, basename(f) + '.bak'));
  }
  console.log('已备份注册表 → ' + dir + '\n');
  return dir;
}

/* ── 主流程 ── */
const pending = readPending();
const open = pending.filter((x) => !x.done);

if (!open.length) {
  console.log('没有待执行的待办。');
  process.exit(0);
}

console.log(`待办 ${open.length} 条${APPLY ? '' : '（干跑，加 --apply 才真做）'}\n`);

if (APPLY) backupRegistries();

for (const item of open) {
  console.log(`[${item.id}] ${item.op}  ${item.packId || ''}`);
  const packDir = join(SKINS, item.packId || '');
  const skinFile = join(packDir, 'skin.json');

  if (item.op === 'enable') {
    if (!existsSync(skinFile)) { console.log('   跳过：包里找不到 ' + skinFile); continue; }
    const pack = JSON.parse(readFileSync(skinFile, 'utf8'));
    const themeId = 'hana-' + pack.packId;
    const cssOut = join(THEMES_DIR, themeId + '.css');

    const css = buildCss(pack);
    console.log(`   生成 CSS ${themeId}.css（${(css.length / 1024).toFixed(0)} KB）`);
    console.log(`   注册表插入 ${themeId}`);

    if (APPLY) {
      writeFileSync(cssOut, css, 'utf8');
      // i18n 用包里的名字：宿主找不到 key 时会直接显示原文，
      // 自用场景下「Luna 龙娘 · 玫瑰月影」比一串 key 好得多。
      const displayName = (pack.names && (pack.names.zh || pack.names.en)) || pack.packId;
      const spec = JSON.stringify({
        cssPath: `themes/${themeId}.css`,
        backgroundColor: (pack.theme.colors || {})['--bg'] || '#141313',
        appearance: pack.theme.appearance || 'dark',
        i18nName: displayName,
        i18nMode: displayName + ' · 模式',
      });
      const r = registryOps(['add', '--id', themeId, '--spec', spec, '--apply']);
      console.log('   ' + r.trim().split('\n').join('\n   '));
      item.done = true;
      item.doneAt = new Date().toISOString();
      item.result = 'enabled ' + themeId;
    }
  } else if (item.op === 'disable') {
    const themeId = item.themeId || ('hana-' + item.packId);
    const cssOut = join(THEMES_DIR, themeId + '.css');
    console.log(`   注册表移除 ${themeId}`);
    if (APPLY) {
      const r = registryOps(['remove', '--id', themeId, '--apply']);
      console.log('   ' + r.trim().split('\n').join('\n   '));
      if (existsSync(cssOut)) { writeFileSync(cssOut + '.disabled', readFileSync(cssOut)); }
      item.done = true;
      item.doneAt = new Date().toISOString();
      item.result = 'disabled ' + themeId;
    }
  }
  console.log('');
}

if (APPLY) {
  writePending(pending);
  console.log('待办已全部标记完成。');
  console.log('需要重启 Hana 主题才会出现在设置里。');
} else {
  console.log('（干跑结束，未改动任何文件）');
}
