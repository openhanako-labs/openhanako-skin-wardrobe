/**
 * scripts/prepare-luna-theme.mjs
 * 在 hana-skin 的工作副本里加第四主题「Luna 龙娘」：
 *   1. 用 Luna 的 61 个变量生成 src/hana-luna.css
 *   2. 复制材质 / 背景 / 取景框三层，把主题 id 换成 hana-luna
 *   3. 在 apply.ps1 的 ThemeDefs 里追加一项
 * 不动原包（原包在 临时\skin-v014），只改 pack-luna 工作副本。
 */
import { readFileSync, writeFileSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PACK = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna';
const LUNA_DEF =
  'W:/Games/Hanako/Work/临时/skin-inspect/luna/Luna-HanaAgent-0.2.3-Windows/app/hana-luna-theme/ui/assets/theme-definition.mjs';

const THEME_ID = 'hana-luna';
const OLD_ID = 'hana-moonlit-court';

const mod = await import(pathToFileURL(LUNA_DEF).href);
const def = mod.DEFINITION;

/* ── 1. 生成配色源 ── */
function toCssValue(name, v) {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number') return v + 'px';
  return String(v);
}

const lines = Object.entries(def.variables).map(
  ([k, v]) => '    ' + k.padEnd(26) + toCssValue(k, v) + ';'
);

const css = `/*
 * Hana Theme: ${def.name}
 * ---------------------------------------------------------------------------
 * 配色源。变量取自 hana-luna-theme 的 DEFINITION（61 项，原样，未增删）。
 * 作用域 id: ${THEME_ID}
 * 由 hana-skin 补丁管线贴入（配色源 -> 材质源 -> 背景源 合成）。
 */

[data-theme="${THEME_ID}"] {
${lines.join('\n')}
}
`;
writeFileSync(join(PACK, 'src', `${THEME_ID}.css`), css, 'utf8');
console.log('[1] 配色源 -> src/' + THEME_ID + '.css  (' + Object.keys(def.variables).length + ' 变量)');

/* ── 2. 复制三层源并替换主题 id ── */
const copyLayer = (fromDir, toDir, files) => {
  const from = join(PACK, 'src', fromDir);
  const to = join(PACK, 'src', toDir);
  if (!existsSync(from)) { console.log('    跳过（源不存在）: ' + fromDir); return; }
  cpSync(from, to, { recursive: true });
  let touched = 0;
  for (const f of files) {
    const p = join(to, f);
    if (!existsSync(p)) continue;
    const t = readFileSync(p, 'utf8');
    if (!t.includes(OLD_ID)) continue;
    writeFileSync(p, t.split(OLD_ID).join(THEME_ID), 'utf8');
    touched++;
  }
  console.log('    ' + fromDir + ' -> ' + toDir + '，替换 id 的文件 ' + touched + ' 个');
};

console.log('[2] 复制材质 / 背景 / 取景框');
copyLayer('material', 'material-luna', ['bold.css', 'subtle.css']);
copyLayer('background', 'background-luna', ['dark.css']);
copyLayer('panel-frame', 'panel-frame-luna', ['dark.css', 'bg.js']);

/* 背景目录里原本的 assets 是月满庭的图，换成 Luna 的 */
const bgAssets = join(PACK, 'src', 'background-luna', 'assets');
console.log('    背景 assets 现有：' +
  (existsSync(bgAssets) ? readFileSync ? '' : '' : ''));

/* ── 3. 给 apply.ps1 的 ThemeDefs 追加一项 ── */
const applyPath = join(PACK, 'scripts', 'apply.ps1');
let apply = readFileSync(applyPath, 'utf8');

const anchor = `    }
)

# 三份注册表 patch 与其所在树`;
if (!apply.includes(anchor)) {
  console.error('[3] 找不到 ThemeDefs 结束锚点，未改动 apply.ps1');
  process.exit(1);
}

const newEntry = `    }
    # 第四主题：Luna 龙娘（深色）。配色取自 hana-luna-theme 的完整 61 变量定义，
    # 材质 / 背景 / 取景框各自独立一份源（同前三个主题的做法）。
    [pscustomobject]@{
        Id             = '${THEME_ID}'
        File           = '${THEME_ID}.css'
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

apply = apply.replace(anchor, newEntry);
writeFileSync(applyPath, apply, 'utf8');
console.log('[3] apply.ps1 已追加第四主题定义');

console.log('\n完成。下一步：跑干跑验证');
