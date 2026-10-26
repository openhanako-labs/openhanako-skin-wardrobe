/**
 * drop-luna-cardpalette.mjs
 * 把 Luna 从卡片调色板补丁里摘掉（byThemeId / insertText / newThemeIds）。
 * 原因：追加第五项会让该补丁的"锚点后必须紧跟 }"结构断言失效；
 * 而卡片调色板只影响 folio 幻灯片烧入，不影响主题本身。
 * 记入已知损失，不硬凑。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/patches/card-palette-server.patch';
const j = JSON.parse(readFileSync(p, 'utf8'));

// 1. byThemeId
if (j.byThemeId) delete j.byThemeId['hana-luna'];

// 2. newThemeIds
j.newThemeIds = (j.newThemeIds || []).filter((id) => id !== 'hana-luna');

// 3. insertText：切掉追加的 Luna 块（从它前面的逗号到块尾）
const marker = '"hana-luna": {';
const idx = j.insertText.indexOf(marker);
if (idx >= 0) {
  // 往前找这个块前面的逗号
  let start = j.insertText.lastIndexOf(',', idx);
  if (start < 0) start = idx;
  j.insertText = j.insertText.slice(0, start).replace(/\s+$/, '');
  console.log('已从 insertText 摘除 Luna 块');
} else {
  console.log('insertText 里没有 Luna 块');
}

j.expectedCountAfter = 15;
writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('newThemeIds=' + j.newThemeIds.join(', ') + '  expectedCountAfter=' + j.expectedCountAfter);
