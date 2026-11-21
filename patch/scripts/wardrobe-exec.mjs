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
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANA = join(homedir(), '.hanako');
const APP_DATA = join(HANA, 'app-data', 'skin-wardrobe');
const PENDING = join(APP_DATA, 'pending.json');
const SKINS = join(APP_DATA, 'skins');

/* 同一个脚本要能在两套布局下跑：
 *   repo 布局  <repo>/patch/scripts/wardrobe-exec.mjs  → 模板在 ../src/...
 *   app 包布局 <app>/assets/exec/wardrobe-exec.mjs      → 模板在 ./templates/...
 * 不再硬编码开发机路径，拷到哪里都能用。 */
function pickFile(candidates) {
  for (const f of candidates) if (f && existsSync(f)) return f;
  return null;
}
const TEMPLATE_BG = pickFile([
  join(HERE, 'templates', 'background-dark.css'),
  join(HERE, '..', 'src', 'background-luna', 'dark.css'),
]);
const MATERIAL_BOLD = pickFile([
  join(HERE, 'templates', 'material-bold.css'),
  join(HERE, '..', 'src', 'material-universal', 'bold.css'),
]);
const REGISTRY_OPS = pickFile([
  join(HERE, 'registry-ops.mjs'),
  join(HERE, '..', 'scripts', 'registry-ops.mjs'),
]);
const BACKUP_ROOT = join(APP_DATA, 'backups');

const APPLY = process.argv.includes('--apply');
const target = JSON.parse(readFileSync(join(HANA, 'artifacts', 'desktop-target.json'), 'utf8')).current;
const THEMES_DIR = join(target.renderer.versionDir, 'themes');

/* 主题要写两份。
 *   主窗口：renderer 目录下的 themes/，直接引用文件。
 *   App   ：/api/apps/theme.css 只去 server 安装目录里的 desktop/dist-renderer/themes
 *           找文件，找不到就回一句「theme not found」。
 * 过去只写了前一份，所以换皮之后主窗口变了、所有 App 都还是原色。
 * 两处各写一份，窗口和 App 才看见同一张皮（关掉待办里那份的重复逻辑也在这）。 */
const APP_THEMES_DIR = join(target.server.versionDir, 'desktop', 'dist-renderer', 'themes');

function mirrorToApps(themeId, css) {
  try {
    mkdirSync(APP_THEMES_DIR, { recursive: true });
    writeFileSync(join(APP_THEMES_DIR, themeId + '.css'), css, 'utf8');
    console.log(`   App 侧副本 ${themeId}.css`);
  } catch (e) {
    // 写不进去不拖累主窗口那一份，但要说出来，不静默。
    console.log(`   App 侧副本写入失败：${e.message}`);
  }
}

function unmirrorFromApps(themeId) {
  const f = join(APP_THEMES_DIR, themeId + '.css');
  try {
    if (!existsSync(f)) return;
    writeFileSync(f + '.disabled', readFileSync(f));
    rmSync(f);
    console.log(`   App 侧副本已撤 ${themeId}.css`);
  } catch (e) {
    console.log(`   App 侧副本撤销失败：${e.message}`);
  }
}

/* ── 直接应用模式：node wardrobe-exec.mjs apply --theme <id> ──
   跨 App 通道（app:skin-wardrobe/apply-theme）与 agent 工具共用。
   只切换宿主偏好的 appearance.theme，不碰注册表、不碰待办。
   前提：主题必须在宿主注册表里（内置或已由执行器启用）。
   生效时机：重启 Hana（渲染器启动时读偏好）。 */
if (process.argv[2] === 'apply') {
  const themeId = String(process.argv[4] || '');
  if (process.argv[3] !== '--theme' || !/^[A-Za-z0-9_.-]+$/.test(themeId)) {
    console.error('用法: wardrobe-exec.mjs apply --theme <已注册的主题id>');
    process.exit(2);
  }
  const listed = registryOps(['list']).split(/\r?\n/).flatMap((l) => l.split(/,\s*/)).map((s) => s.trim());
  if (!listed.includes(themeId)) {
    console.error('未注册：' + themeId + '（先用启用待办把主题写进宿主，再应用）');
    process.exit(3);
  }
  const prefsPath = join(HANA, 'user', 'preferences.json');
  if (!existsSync(prefsPath)) {
    console.error('宿主偏好文件不存在：' + prefsPath);
    process.exit(3);
  }
  const raw = readFileSync(prefsPath, 'utf8');
  let prefs;
  try { prefs = JSON.parse(raw); } catch (e) {
    console.error('偏好文件解析失败：' + e.message);
    process.exit(3);
  }
  const prev = (prefs.appearance && prefs.appearance.theme) || null;
  if (prev === themeId) {
    console.log('apply:已是当前主题 ' + themeId + '（无变化）');
    process.exit(0);
  }
  const bak = prefsPath + '.bak-' + new Date().toISOString().replace(/[:.]/g, '-');
  copyFileSync(prefsPath, bak);
  if (!prefs.appearance || typeof prefs.appearance !== 'object') prefs.appearance = {};
  prefs.appearance.theme = themeId;
  writeFileSync(prefsPath, JSON.stringify(prefs, null, 2) + '\n', 'utf8');
  console.log('apply:' + prev + ' -> ' + themeId);
  console.log('apply:备份 ' + basename(bak));
  console.log('apply:重启 Hana 后生效');
  process.exit(0);
}

/* ── 读待办 ── */
function readPending() {
  if (!existsSync(PENDING)) return [];
  try { return JSON.parse(readFileSync(PENDING, 'utf8')); } catch { return []; }
}
function writePending(list) {
  writeFileSync(PENDING, JSON.stringify(list, null, 2), 'utf8');
}

/* ── 工具 ── */
/** 归一化任意 CSS 颜色为 RGB 三元；解析不了返回 null（调用方必须报错，不许静默回退） */
function parseRgbTriple(input) {
  const s = typeof input === 'string' ? input.trim() : '';
  if (!s) return null;
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((c) => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i.exec(s);
  if (m) {
    const out = [m[1], m[2], m[3]].map((v) => Math.round(Number(v)));
    return out.every((n) => Number.isFinite(n) && n >= 0 && n <= 255) ? out : null;
  }
  return null;
}
const rgbToHex6 = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
/** 注册表要求 6 位不透明 hex：从配色取 --bg 归一化后再转 */
function bgHexOf(colors) {
  const rgb = parseRgbTriple((colors || {})['--bg']);
  return rgb ? rgbToHex6(rgb) : '#141313';
}
/** 老名字保留（若别处还在用） */
const hexToRgb = (hex) => parseRgbTriple(hex);

/** 生成该皮肤的 CSS：配色块 + 背景块（用 Luna 的背景结构做模板） */
function buildCss(pack, variant, appearance, suffix) {
  const colors = variant.colors || {};
  const id = 'hana-' + pack.packId + (suffix || '');
  const rawBg = colors['--bg'];
  let rgb;
  if (rawBg === undefined || rawBg === null || rawBg === '') {
    // 缺 --bg：沿用旧行为（Luna 底），但明确告警，不假装正常
    rgb = [20, 19, 19];
    console.warn(`[warn] ${id}: 缺少 --bg，回落到 #141313`);
  } else {
    rgb = parseRgbTriple(rawBg);
    if (!rgb) {
      throw new Error(`--bg 无法解析：${JSON.stringify(rawBg)}（支持 #RGB / #RRGGBB / #RRGGBBAA / rgb() / rgba()）`);
    }
  }
  const bgHex = rgbToHex6(rgb);

  const rawName = (pack.names && (pack.names.zh || pack.names.en)) || pack.packId;
  const commentName = String(rawName).replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ').slice(0, 120);
  const lines = [];
  const commentSuffix = suffix ? ` · ${appearance}` : '';
  lines.push(`/* 衣橱导出 · ${commentName}${commentSuffix} · ${new Date().toISOString().slice(0, 10)} */`);

  /* 1. 配色块 */
  lines.push(`[data-theme="${id}"] {`);
  for (const [k, v] of Object.entries(colors)) {
    if (k === '--bg-rgb') continue;
    if (!/^--[A-Za-z0-9-]+$/.test(k)) continue;
    if (typeof v !== 'string' || !/^[^;{}\r\n]{1,200}$/.test(v)) continue;
    lines.push(`  ${k}: ${v};`);
  }
  lines.push(`  --bg-rgb: ${rgb.join(', ')};`);
  lines.push('}');

  /* 2. 背景块：拿 Luna 的背景结构当模板，换图换色换主题 id */
  const bg = variant.background || {};
  const bgAsset = bg.asset;
  const safeBgAsset = (typeof bgAsset === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(bgAsset)) ? bgAsset : null;
  if (safeBgAsset) {
    let tpl = TEMPLATE_BG ? readFileSync(TEMPLATE_BG, 'utf8') : '';
    if (tpl) {
      // 去掉模板里的所有块注释（会带出 Luna 的说明文字）
      tpl = tpl.replace(/\/\*[\s\S]*?\*\//g, '');
      tpl = tpl.replace(/\n{3,}/g, '\n\n').trim();

      // 主题 id
      tpl = tpl.replaceAll('[data-theme="hana-luna"]', `[data-theme="${id}"]`);
      tpl = tpl.replaceAll('[data-theme^="hana-"]', `[data-theme="${id}"]`);

      // 图片占位符
      tpl = tpl.replaceAll('__BG_DARK_DATA_URI__', safeBgAsset);

      // ⚠️⚠️ 背景层必须编译成字面量（2026-11-12 本地二分定案，不要回退成 var()）：
      //   含 var() 的声明在 Blink 里走「待替换」路径，与超大 url() 同条声明时会撞上
      //   ~2MB 的替换值上限（与 panel-frame/bg.js 注释 ② 的自定义属性值上限同族），
      //   超限 → 整条 background-image 被静默丢弃 → 黑屏。
      //   实验矩阵：var+80KB url 活、var+2.8MB url 黑、var+6.3MB url 黑、
      //   literal+2.8MB url 活、Luna literal+3.9MB 一直活。
      //   Luna 手工管线（apply.ps1）从来都是字面量，这就是它没黑过的原因。
      tpl = tpl.replaceAll('var(--bg-rgb)', rgb.join(', '));
      tpl = tpl.replaceAll('#141313', bgHex);

      // 透明度参数（模板已编译为字面量，按字面量覆盖；顺序必须在上面编译之后）
      const pa = bg.panelAlpha;
      const ca = bg.cardAlpha;
      if (typeof pa === 'number' && Number.isFinite(pa) && pa >= 0 && pa <= 1) {
        tpl = tpl.replaceAll(`rgba(${rgb.join(', ')}, 0.55)`, `rgba(${rgb.join(', ')}, ${pa})`);
      }
      if (typeof ca === 'number' && Number.isFinite(ca) && ca >= 0 && ca <= 1) {
        tpl = tpl.replaceAll(`rgba(${rgb.join(', ')}, 0.45)`, `rgba(${rgb.join(', ')}, ${ca})`);
      }

      lines.push('');
      lines.push(`/* ── 背景层 ── */`);
      lines.push(tpl.trim());

      /* 2b. 动图降级：prefers-reduced-motion 下用 poster 替代动图（spec §2.1）。
       * 只换照片位（url），scrim 层序不变、不新增不删除层。 */
      const motion = bg.motion || {};
      const poster = bg.poster;
      const safePoster = (typeof poster === 'string' && /^data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/.test(poster)) ? poster : null;
      if (motion.mode === 'animated-image' && safePoster) {
        const m = tpl.match(/background-image:\s*([^;]*url\([^)]*\)[^;]*);/);
        if (m) {
          const posterValue = m[1].replace(`url("${safeBgAsset}")`, `url("${safePoster}")`);
          lines.push('');
          lines.push('@media (prefers-reduced-motion: reduce) {');
          lines.push(`  :is([data-theme="${id}"]) [data-chalkboard-root] { background-image: ${posterValue}; }`);
          lines.push('}');
        }
      }
    }
  }

  /* 3. 材质层：通用材质源用 [data-theme^="hana-"] 通配，贴进任何 hana-* 都生效 */
  const matFile = MATERIAL_BOLD;
  if (matFile) {
    let mat = readFileSync(matFile, 'utf8');
    mat = mat.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (mat) {
      lines.push('');
      lines.push('/* ── 材质层（通用）── */');
      lines.push(mat);
    }
  }

  /* 4. 材质参数覆盖：包里的值优先于通用材质默认值 */
  const mi = variant.material || {};
  const overrides = [];
  if (typeof mi.rim === 'number' && Number.isFinite(mi.rim)) overrides.push(`--mat-rim: ${mi.rim};`);
  if (typeof mi.blur === 'number' && Number.isFinite(mi.blur)) overrides.push(`--mat-blur: ${Math.round(mi.blur)}px;`);
  if (typeof mi.edge === 'string' && /^[^;{}\r\n]{1,200}$/.test(mi.edge)) overrides.push(`--mat-edge: ${mi.edge};`);
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
  lines.push(`  color-scheme: ${appearance === 'light' ? 'light' : 'dark'};`);
  lines.push('}');

  return lines.join('\n') + '\n';
}

/* ── 注册表操作：委托给 registry-ops.mjs ── */
function registryOps(args) {
  if (!REGISTRY_OPS) throw new Error('找不到 registry-ops.mjs（repo 或 app 包布局都未命中）');
  const perm = process.permission
    ? ['--allow-fs-read=*', '--allow-fs-write=*', '--allow-child-process']
    : [];
  const out = execFileSync(process.execPath, [...perm, REGISTRY_OPS, ...args], { encoding: 'utf8' });
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

/* ── 报告模式：node wardrobe-exec.mjs report ──
   给 App 进程用。App 自己被权限模型关在自己的目录里，读不了 ~/.hanako/artifacts，
   而执行器是独立进程，读得到。只输出一行 JSON，不写任何东西。
   字段：
     themes   renderer themes 目录下现有的主题 id（= 已装到宿主的，停用会改名 .disabled）
     current  宿主偏好里当前主题 id
     appSide  App 侧那份副本的 id（给排错看） */
if (process.argv.includes('report')) {
  const out = { ok: true, themes: [], appSide: [], current: null };
  try {
    if (existsSync(THEMES_DIR)) {
      for (const n of readdirSync(THEMES_DIR)) if (n.endsWith('.css')) out.themes.push(n.slice(0, -4));
    }
  } catch (e) {
    out.ok = false;
    out.error = 'themes 目录读取失败：' + e.message;
  }
  try {
    if (existsSync(APP_THEMES_DIR)) {
      for (const n of readdirSync(APP_THEMES_DIR)) if (n.endsWith('.css')) out.appSide.push(n.slice(0, -4));
    }
  } catch { /* App 侧副本读不到不影响主结果 */ }
  try {
    const prefs = JSON.parse(readFileSync(join(HANA, 'user', 'preferences.json'), 'utf8'));
    out.current = (prefs.appearance && prefs.appearance.theme) || null;
  } catch { out.current = null; }
  console.log(JSON.stringify(out));
  process.exit(0);
}

/* ── 主流程 ──
   每条待办单独 try：一条崩（如包损坏）不拖累其他条目，
   且账本按条落盘 —— 上次半途崩掉、全部待办重做的坑不再踩。 */
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
  try {
    const packDir = join(SKINS, item.packId || '');
    const skinFile = join(packDir, 'skin.json');

    if (item.op === 'enable') {
      if (!existsSync(skinFile)) {
        // 包已从衣橱删掉：这条启用永远做不成，落账跳过，别让它永挂待办
        console.log('   跳过：包里找不到 ' + skinFile + '（包已移除？落账）');
        if (APPLY) {
          item.done = true;
          item.doneAt = new Date().toISOString();
          item.result = 'skipped: skin.json 不存在';
        }
        continue;
      }
      const pack = JSON.parse(readFileSync(skinFile, 'utf8'));
      if (!/^[A-Za-z0-9_.-]+$/.test(String(pack.packId || ''))) {
        console.log('   跳过：packId 含非法字符（只允许字母数字 _ . -）');
        if (APPLY) { item.done = true; item.doneAt = new Date().toISOString(); item.result = 'skipped: unsafe packId'; }
        continue;
      }
      const theme = pack.theme || {};
      const variants = Array.isArray(theme.variants) ? theme.variants : null;
      const darkV = variants && variants.find((v) => v && v.appearance === 'dark');
      const lightV = variants && variants.find((v) => v && v.appearance === 'light');
      const isDual = !!(darkV && lightV);
      const displayName = (pack.names && (pack.names.zh || pack.names.en)) || pack.packId;

      if (!isDual) {
        // 老包 / 单套：完全走 v2 老路（spec §1），逐字节兼容、不产生带后缀 id
        const appearance = theme.appearance === 'light' ? 'light' : 'dark';
        const themeId = 'hana-' + pack.packId;
        const cssOut = join(THEMES_DIR, themeId + '.css');
        const css = buildCss(pack, { colors: theme.colors, background: theme.background, material: theme.material }, appearance, '');
        console.log(`   生成 CSS ${themeId}.css（${(css.length / 1024).toFixed(0)} KB）`);
        console.log(`   注册表插入 ${themeId}`);
        if (APPLY) {
          writeFileSync(cssOut, css, 'utf8');
          mirrorToApps(themeId, css);
          const spec = JSON.stringify({
            cssPath: `themes/${themeId}.css`,
            backgroundColor: bgHexOf(theme.colors),
            appearance,
            i18nName: displayName,
            i18nMode: displayName + ' · 模式',
          });
          const r = registryOps(['add', '--id', themeId, '--spec', spec, '--apply']);
          console.log('   ' + r.trim().split('\n').join('\n   '));
          item.done = true;
          item.doneAt = new Date().toISOString();
          item.result = 'enabled ' + themeId;
        }
      } else {
        // 双套：暗 + 亮，各一份 CSS 与一条注册表条目（spec §1 / §3.1）
        const order = [
          { v: darkV, ap: 'dark' },
          { v: lightV, ap: 'light' },
        ];
        for (const { v, ap } of order) {
          const themeId = 'hana-' + pack.packId + '-' + ap;
          const cssOut = join(THEMES_DIR, themeId + '.css');
          const css = buildCss(pack, v, ap, '-' + ap);
          console.log(`   生成 CSS ${themeId}.css（${(css.length / 1024).toFixed(0)} KB）`);
          console.log(`   注册表插入 ${themeId}`);
          if (APPLY) {
            writeFileSync(cssOut, css, 'utf8');
            mirrorToApps(themeId, css);
            const bgHex6 = bgHexOf(v.colors);
            const spec = JSON.stringify({
              cssPath: `themes/${themeId}.css`,
              backgroundColor: bgHex6,
              appearance: ap,
              i18nName: displayName + ' · ' + (ap === 'dark' ? '暗色' : '亮色'),
              i18nMode: displayName + ' · ' + (ap === 'dark' ? '暗色' : '亮色') + ' · 模式',
            });
            const r = registryOps(['add', '--id', themeId, '--spec', spec, '--apply']);
            console.log('   ' + r.trim().split('\n').join('\n   '));
          }
        }

        // 自适应策略（spec §3.4）：本版只做 manual。
        // auto 指针已关闭 —— 宿主 server bundle 里是 `autoLightDefault: zYr`（变量间接引用），
        // 朴素字符串替换只能改到 renderer 那一处，会造成「一半生效」的静默错。
        const adaptive = theme.adaptive || {};
        if (adaptive.mode === 'auto') {
          console.log('   自适应：adaptive.mode=auto 本版不支持，按 manual 处理（只注册两条，不动宿主 auto 指针）');
        } else {
          console.log('   自适应 manual：仅注册两条，不动宿主 auto 指针');
        }
        if (APPLY) {
          item.done = true;
          item.doneAt = new Date().toISOString();
          item.result = 'enabled dual ' + pack.packId;
        }
      }
    } else if (item.op === 'disable') {
      const themeId = item.themeId || ('hana-' + item.packId);
      if (!/^[A-Za-z0-9_.-]+$/.test(String(themeId || ''))) {
        console.log('   跳过：themeId 含非法字符（只允许字母数字 _ . -）');
        if (APPLY) { item.done = true; item.doneAt = new Date().toISOString(); item.result = 'skipped: unsafe themeId'; }
        continue;
      }
      // 双套包：enable 写的是 -dark/-light 两条，停用带无后缀 id 会去摘不存在的条目（BUG：双生·极光删不掉的根因）。
      // 存在性判定：THEMES_DIR 里若有 -dark/-light CSS，就把它们当真实 id 一并摘。
      const dualIds = [themeId + '-dark', themeId + '-light']
        .filter((id) => existsSync(join(THEMES_DIR, id + '.css')));
      const idsToRemove = dualIds.length ? dualIds : [themeId];
      for (const id of idsToRemove) {
        const cssOut = join(THEMES_DIR, id + '.css');
        console.log(`   注册表移除 ${id}`);
        if (APPLY) {
          const r = registryOps(['remove', '--id', id, '--apply']);
          console.log('   ' + r.trim().split('\n').join('\n   '));
          if (existsSync(cssOut)) { writeFileSync(cssOut + '.disabled', readFileSync(cssOut)); }
          unmirrorFromApps(id);
        }
      }
      if (APPLY) {
        item.done = true;
        item.doneAt = new Date().toISOString();
        item.result = 'disabled ' + idsToRemove.join(' + ');
      }
    } else {
      console.log('   未知 op：' + item.op);
    }
  } catch (e) {
    console.log(`   失败：${e.message}（跳过，下轮重试）`);
  }
  console.log('');
}

if (APPLY) {
  const doneCount = pending.filter((x) => x.done).length;
  writePending(pending);
  console.log(`账本已写：${doneCount}/${pending.length} 条完成。`);
  if (pending.some((x) => !x.done)) console.log('仍有未完成条目（见上方失败原因）。');
  console.log('需要重启 Hana 主题才会出现在设置里。');
} else {
  console.log('（干跑结束，未改动任何文件）');
}
