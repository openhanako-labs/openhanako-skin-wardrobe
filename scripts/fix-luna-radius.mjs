/**
 * fix-luna-radius.mjs — 把 Luna 的卡片调色板圆角口径统一成 12px。
 * check.ps1 断言五项的 --radius-chat-card-inner 都是 max(2px, calc(12px - 2px))；
 * Luna 原始 radius-chat-card 是 16px，会让该断言数到 4/5。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/patches/card-palette-server.patch';
const j = JSON.parse(readFileSync(p, 'utf8'));

const luna = j.byThemeId['hana-luna'];
luna['--radius-chat-card'] = '12px';
luna['--radius-chat-card-inner'] = 'max(2px, calc(12px - 2px))';

// insertText 里同步替换
j.insertText = j.insertText
  .split('"--radius-chat-card": "16px"').join('"--radius-chat-card": "12px"')
  .split('max(2px, calc(16px - 2px))').join('max(2px, calc(12px - 2px))');

writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');

const n = (j.insertText.match(/--radius-chat-card-inner/g) || []).length;
console.log('Luna 圆角已统一 12px；insertText 内 inner 规则出现 ' + n + ' 处');
