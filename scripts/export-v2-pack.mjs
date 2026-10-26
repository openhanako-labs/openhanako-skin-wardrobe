/**
 * scripts/export-v2-pack.mjs —— 从补丁源反向导出一个 v2 皮肤包
 *
 * 补丁源是权威（贴进宿主的就是它），包是它的可分发快照。
 * 图片一律转成 data URI 内联，导出的包是自包含单文件。
 *
 * 用法：node scripts/export-v2-pack.mjs <themeKey>
 *   例：node scripts/export-v2-pack.mjs luna
 * 输出：dist/skins-v2/<packId>.skinpack.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = 'W:/Games/Hanako/Work/projects/hana-skin-app';
const SRC = join(ROOT, 'patch', 'src');
const OUT = join(ROOT, 'dist', 'skins-v2');

const key = process.argv[2];
if (!key) { console.error('用法: node scripts/export-v2-pack.mjs <themeKey>'); process.exit(2); }

/** 主题 → 源目录/文件映射。默认主题没有后缀，其他加 -<key>。 */
const LAYOUT = {
  luna: {
    colors: 'hana-luna.css',
    background: 'background-luna',
    frame: 'panel-frame-luna',
    packId: 'luna-dragongirl',
    names: { zh: 'Luna 龙娘 · 玫瑰月影', en: 'Luna Dragon Girl' },
    tags: ['暗色', '粉色', '动漫'],
    group: 'anime',
  },
  'moonlit-court': {
    colors: 'hana-moonlit-court.css',
    background: 'background',
    frame: 'panel-frame',
    packId: 'hana-skin-moonlit-court',
    names: { zh: '月满庭', en: 'Moonlit Court' },
    tags: ['暗色', '墨绿', '东方'],
    group: 'classic',
  },
  deepsleep: {
    colors: 'hana-deepsleep.css',
    background: 'background-deepseek',
    frame: 'panel-frame-deepseek',
    packId: 'hana-skin-deepsleep',
    names: { zh: '沉眠蓝', en: 'Deep Sleep' },
    tags: ['亮色', '蓝'],
    group: 'classic',
  },
  'violet-dusk': {
    colors: 'hana-violet-dusk.css',
    background: 'background-violet',
    frame: 'panel-frame-violet',
    packId: 'hana-skin-violet-dusk',
    names: { zh: '紫暮', en: 'Violet Dusk' },
    tags: ['暗色', '紫'],
    group: 'classic',
  },
  'claude-clay': {
    colors: 'hana-claude-clay.css',
    background: 'background-claude',
    frame: 'panel-frame-claude',
    packId: 'hana-skin-claude-clay',
    names: { zh: '陶土', en: 'Claude Clay' },
    tags: ['亮色', '暖'],
    group: 'classic',
  },
};

const cfg = LAYOUT[key];
if (!cfg) { console.error('未知主题：' + key + '\n可用：' + Object.keys(LAYOUT).join(', ')); process.exit(2); }

const themeId = 'hana-' + key;

/* ── 1. 配色：从配色源里取该主题块的所有自定义属性 ── */
const cssPath = join(SRC, cfg.colors);
if (!existsSync(cssPath)) { console.error('找不到配色源：' + cssPath); process.exit(2); }
const css = readFileSync(cssPath, 'utf8');

// 找到 `[data-theme="hana-x"] {` 那个块，做花括号配对
function extractBlock(text, selector) {
  const idx = text.indexOf(selector);
  if (idx < 0) return null;
  const open = text.indexOf('{', idx);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return null;
}

const block = extractBlock(css, `[data-theme="${themeId}"]`);
if (!block) { console.error('配色源里找不到 ' + themeId + ' 的选择器块'); process.exit(2); }

const colors = {};
for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
  const name = m[1];
  if (name === '--bg-rgb') continue;  // 派生量，不存包
  colors[name] = m[2].trim();
}

// 派生 --bg-rgb（材质柔光要用）
const bg = colors['--bg'] || '#141313';
const hex = /^#([0-9a-f]{6})$/i.exec(bg);
const bgRgb = hex
  ? [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)).join(', ')
  : null;

/* ── 2. 背景：图 → data URI ── */
const bgDir = join(SRC, cfg.background);
let backgroundColor = null;
let bgMeta = { fit: 'cover', position: '50% 40%', panelAlpha: 0.55, cardAlpha: 0.45 };

if (existsSync(bgDir)) {
  const cssFile = join(bgDir, 'dark.css');
  const bgCss = existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '';

  // 图可能在 bgDir 或 bgDir/assets；CSS 里的 url() 有时是占位符 __BG_DARK_DATA_URI__
  let imgPath = null;
  const urlMatch = /url\(\s*["']?([^"')]*\.(?:png|jpe?g|webp))["']?\s*\)/i.exec(bgCss);
  if (urlMatch) {
    const rel = urlMatch[1].replace(/^\/+/, '');
    for (const cand of [join(bgDir, rel), join(bgDir, 'assets', basename(rel))]) {
      if (existsSync(cand)) { imgPath = cand; break; }
    }
  }
  if (!imgPath) {
    // 占位符情况：从目录（含 assets/）挑最大的图
    const roots = [bgDir, join(bgDir, 'assets')].filter((d) => existsSync(d));
    const found = [];
    for (const r of roots) {
      for (const f of readdirSync(r)) {
        if (/\.(png|jpe?g|webp)$/i.test(f)) found.push({ full: join(r, f), size: statSize(join(r, f)) });
      }
    }
    found.sort((a, b) => b.size - a.size);
    if (found.length) imgPath = found[0].full;
  }

  if (imgPath) {
    const imgFile = basename(imgPath);
    if (existsSync(imgPath)) {
      const mime = /\.png$/i.test(imgFile) ? 'image/png'
        : /\.webp$/i.test(imgFile) ? 'image/webp' : 'image/jpeg';
      const b64 = readFileSync(imgPath).toString('base64');
      backgroundColor = `data:${mime};base64,${b64}`;
      console.log(`背景图 ${imgFile} → data URI (${(backgroundColor.length / 1048576).toFixed(2)} MB)`);
    }
  }

  // 遮罩参数：从 --bg / --panel-card-bg 的 alpha 里读
  const panel = /--bg\s*:\s*rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(bgCss);
  const card = /--bg-card\s*:\s*rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)/.exec(bgCss);
  if (panel) bgMeta.panelAlpha = parseFloat(panel[1]);
  if (card) bgMeta.cardAlpha = parseFloat(card[1]);
}

function statSize(p) { try { return readFileSync(p).length; } catch { return 0; } }

/* ── 3. 材质参数：从通用材质源里读默认值 ── */
const matCss = join(SRC, 'material-universal', 'bold.css');
let material = { tier: 'bold', edge: 'rgba(255,255,255,0.22)', rim: 0.26, glowFromBg: true };
if (existsSync(matCss)) {
  const t = readFileSync(matCss, 'utf8');
  const e = /--mat-edge\s*:\s*([^;]+);/.exec(t);
  const r = /--mat-rim\s*:\s*([^;]+);/.exec(t);
  if (e) material.edge = e[1].trim();
  if (r) material.rim = parseFloat(r[1]);
}

/* ── 4. 取景框：目录存在就算有 ── */
const frameDir = join(SRC, cfg.frame);
const frame = existsSync(frameDir)
  ? { kind: 'builtin', builtin: 'petals', asset: null, params: { density: 0.5, speed: 1.0 } }
  : { kind: 'none' };

/* ── 5. 组装 ── */
const pack = {
  schema: 'hana-skinpack/2',
  packId: cfg.packId,
  packVersion: '1.0.0',
  names: cfg.names,
  description: `从补丁源导出的 ${cfg.names.zh} 皮肤（配色 ${Object.keys(colors).length} 项 + 背景 + 材质 + 取景框）`,
  tags: cfg.tags,
  group: cfg.group,
  favorite: false,
  source: { kind: 'original', publisher: 'local', license: 'unspecified' },
  theme: {
    key: 'default',
    appearance: /^#(?:F|E|D)/i.test(bg) ? 'light' : 'dark',
    colors,
    ...(backgroundColor
      ? { background: { asset: backgroundColor, ...bgMeta, tint: null } }
      : {}),
    material,
    frame,
  },
  meta: {
    exportedAt: new Date().toISOString(),
    exportedFrom: `patch/src/${cfg.colors}`,
    bgRgb,
  },
};

mkdirSync(OUT, { recursive: true });
const outFile = join(OUT, cfg.packId + '.skinpack.json');
writeFileSync(outFile, JSON.stringify(pack, null, 2), 'utf8');

const sizeMB = (readFileSync(outFile).length / 1048576).toFixed(2);
console.log(`\n导出完成：${outFile}`);
console.log(`  packId    : ${pack.packId}`);
console.log(`  配色      : ${Object.keys(colors).length} 项`);
console.log(`  背景      : ${backgroundColor ? '有（data URI）' : '无'}`);
console.log(`  材质      : ${material.tier} / rim ${material.rim}`);
console.log(`  取景框    : ${frame.kind}`);
console.log(`  体积      : ${sizeMB} MB`);
