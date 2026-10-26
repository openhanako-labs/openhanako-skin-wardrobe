/**
 * scripts/add-luna-theme5.mjs
 * 在 v0.1.5 工作副本里加第五主题「Luna 龙娘」（深色）。
 * 照 v0.1.5 的第四主题 hana-claude-clay 的做法复制一份结构。
 */
import { readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5';
const DEF = 'W:/Games/Hanako/Work/临时/skin-inspect/luna/Luna-HanaAgent-0.2.3-Windows/app/hana-luna-theme/ui/assets/theme-definition.mjs';
const ID = 'hana-luna';
const OLD = 'hana-moonlit-court';

const mod = await import(pathToFileURL(DEF).href);
const v = mod.DEFINITION.variables;

const hex6 = (s) => String(s).slice(0, 7).toUpperCase();
const rgbaOf = (s) => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (!m) return s;
  const a = (parseInt(m[4], 16) / 255).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
};
const rgbTriple = (s) => {
  const h = hex6(s).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');
};

/* ── 1. 配色源 ── */
const cssLines = Object.entries(v).map(([k, val]) => {
  const out = Array.isArray(val) ? val.join(', ') : (typeof val === 'number' ? val + 'px' : String(val));
  // 冒号不能少：漏了它声明会被浏览器整条忽略（这次就踩了）
  return '    ' + k.padEnd(28) + ': ' + out + ';';
});
writeFileSync(join(ROOT, 'src', `${ID}.css`),
  `/*\n * Hana Theme: ${mod.DEFINITION.name}\n * 配色源（61 项，取自 hana-luna-theme 的 DEFINITION，未增删）\n */\n\n[data-theme="${ID}"] {\n${cssLines.join('\n')}\n}\n`, 'utf8');
console.log('[1] src/' + ID + '.css  ' + Object.keys(v).length + ' 变量');

/* ── 2. 复制三层源 ── */
const copyLayer = (from, to, files) => {
  const src = join(ROOT, 'src', from);
  const dst = join(ROOT, 'src', to);
  if (!existsSync(src)) { console.log('    缺失源: ' + from); return; }
  cpSync(src, dst, { recursive: true });
  let n = 0;
  for (const f of files) {
    const p = join(dst, f);
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    if (t.includes(OLD)) { writeFileSync(p, t.split(OLD).join(ID), 'utf8'); n++; }
  }
  console.log('    ' + from + ' -> ' + to + '（改 id ' + n + ' 个文件）');
};
copyLayer('material', 'material-luna', ['bold.css', 'subtle.css']);
copyLayer('background', 'background-luna', ['dark.css']);
copyLayer('panel-frame', 'panel-frame-luna', ['dark.css', 'bg.js']);

/* ── 3. 注册表三处 ── */
const REG_ITEM =
  ',"hana-luna":{cssPath:"themes/hana-luna.css",backgroundColor:"#141313",appearance:"dark"' +
  ',i18nName:"settings.appearance.lunaDragon",i18nMode:"settings.appearance.lunaDragonMode"}';

for (const f of ['theme-registry-renderer.patch', 'theme-registry-bundle.patch', 'theme-registry-server.patch']) {
  const p = join(ROOT, 'patches', f);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  if (!j.insertText.includes(ID)) j.insertText += REG_ITEM;
  j.expectedCountAfter = 16;
  if (!j.newThemeIds.includes(ID)) j.newThemeIds.push(ID);
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('[3] ' + f + '  项 ' + (j.insertText.match(/cssPath:/g) || []).length + '，期望 ' + j.expectedCountAfter);
}

/* ── 4. 卡片调色板 ── */
{
  const p = join(ROOT, 'patches', 'card-palette-server.patch');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const pal = {
    '--bg': hex6(v['--bg']),
    '--bg-card': hex6(v['--bg-card']),
    '--sidebar-bg': hex6(v['--sidebar-bg']),
    '--text': hex6(v['--text']),
    '--text-light': hex6(v['--text-light']),
    '--text-muted': hex6(v['--text-muted']),
    '--border': rgbaOf(v['--border']),
    '--accent': hex6(v['--accent']),
    '--accent-hover': hex6(v['--accent-hover']),
    '--accent-light': rgbaOf(v['--accent-light']),
    '--accent-rgb': rgbTriple(v['--accent']),
    '--green': hex6(v['--green']),
    '--danger': hex6(v['--danger']),
    '--radius-chat-card': v['--radius-chat-card'] + 'px',
    '--radius-chat-card-inner': `max(2px, calc(${v['--radius-chat-card']}px - 2px))`,
  };
  if (!j.byThemeId) j.byThemeId = {};
  j.byThemeId[ID] = pal;
  if (!j.insertText.includes(ID)) {
    const block = ',\n  "' + ID + '": {\n' +
      Object.entries(pal).map(([k, val]) => `    "${k}": "${val}"`).join(',\n') + '\n  }';
    j.insertText += block;
  }
  j.expectedCountAfter = 16;
  if (!j.newThemeIds.includes(ID)) j.newThemeIds.push(ID);
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('[4] card-palette  调色板项 ' + Object.keys(pal).length + ' 个键');
}

/* ── 5. 设置页卡片预览配色 ── */
{
  const p = join(ROOT, 'patches', 'theme-card-preview.patch');
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const cm = { appearance: 'dark', bg: v['--bg'].toLowerCase(), name: v['--text'].toLowerCase(), mode: v['--accent'].toLowerCase() };
  if (!j.colorMapping.byThemeId) j.colorMapping.byThemeId = {};
  j.colorMapping.byThemeId[ID] = cm;
  if (!j.newThemeIds.includes(ID)) j.newThemeIds.push(ID);
  for (const tg of j.targets) {
    if (tg.insertText && !tg.insertText.includes(ID)) {
      const c = tg.classNames;
      tg.insertText +=
        `.${c.card}[data-theme=${ID}]{background:${cm.bg}}` +
        `.${c.card}[data-theme=${ID}] .${c.name}{color:${cm.name}}` +
        `.${c.card}[data-theme=${ID}] .${c.mode}{color:${cm.mode}}`;
    }
  }
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('[5] theme-card-preview  ' + j.targets.length + ' 个 target 各补 3 条规则');
}

/* ── 6. locale 五语言 ── */
const LOCALES = {
  'zh.patch.json': ['Luna 龙娘', '玫瑰月影'],
  'zh-TW.patch.json': ['Luna 龍娘', '玫瑰月影'],
  'en.patch.json': ['Luna Dragon', 'Rose Moonlight'],
  'ja.patch.json': ['ルナ ドラゴン', '薔薇の月光'],
  'ko.patch.json': ['루나 드래곤', '장미 월광'],
};
for (const [f, [n, m]] of Object.entries(LOCALES)) {
  const p = join(ROOT, 'patches', 'locales', f);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  j['settings.appearance.lunaDragon'] = n;
  j['settings.appearance.lunaDragonMode'] = m;
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
}
console.log('[6] locale 5 语言各 +2 键');

/* ── 7. apply.ps1 的 ThemeDefs ── */
{
  const p = join(ROOT, 'scripts', 'apply.ps1');
  let t = readFileSync(p, 'utf8');
  if (!t.includes(`Id             = '${ID}'`)) {
    const anchor = `    }
)

# 三份注册表 patch 与其所在树`;
    if (!t.includes(anchor)) { console.error('[7] 找不到 ThemeDefs 锚点'); process.exit(1); }
    const entry = `    }
    # 第五主题：Luna 龙娘（深色）。配色取自 hana-luna-theme 的完整 61 变量定义。
    [pscustomobject]@{
        Id             = '${ID}'
        File           = '${ID}.css'
        MaterialDir    = 'material-luna'
        BackgroundDir  = 'background-luna'
        PanelFrameDir  = 'panel-frame-luna'
        BackgroundAsset = 'assets/luna-art.png'
        HasBackground  = $true
        Labels         = @{
            lunaDragon     = 'Luna 龙娘'
            lunaDragonMode = '玫瑰月影'
        }
    }
)

# 三份注册表 patch 与其所在树`;
    t = t.replace(anchor, entry);
    writeFileSync(p, t, 'utf8');
    console.log('[7] apply.ps1 ThemeDefs 已加第五项');
  } else {
    console.log('[7] ThemeDefs 已包含 ' + ID + '，跳过');
  }
}
console.log('\n完成。');
