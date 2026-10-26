/**
 * restore-luna-cardpalette.mjs
 * 把 Luna 的卡片调色板项加回补丁，让 patch 与已贴入的安装目录（16 项）一致。
 * 圆角保留 Luna 原设计 16px —— check.ps1 会因此报 1 条口径警告，
 * 那是它假定所有主题圆角都是 12px 所致，不是错误。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/patches/card-palette-server.patch';
const j = JSON.parse(readFileSync(p, 'utf8'));

const pal = {
  '--bg': '#141313',
  '--bg-card': '#1E1D1E',
  '--sidebar-bg': '#191719',
  '--text': '#F0EFF0',
  '--text-light': '#D0CAD1',
  '--text-muted': '#AAA2AD',
  '--border': 'rgba(184, 150, 193, 0.22)',
  '--accent': '#CD5B85',
  '--accent-hover': '#DA84A4',
  '--accent-light': 'rgba(205, 91, 133, 0.15)',
  '--accent-rgb': '205, 91, 133',
  '--green': '#9DCCAC',
  '--danger': '#F09AAB',
  '--radius-chat-card': '16px',
  '--radius-chat-card-inner': 'max(2px, calc(16px - 2px))',
};

if (!j.byThemeId) j.byThemeId = {};
j.byThemeId['hana-luna'] = pal;

if (!j.newThemeIds.includes('hana-luna')) j.newThemeIds.push('hana-luna');
j.expectedCountAfter = 16;

if (!j.insertText.includes('"hana-luna": {')) {
  j.insertText += ',\n  "hana-luna": {\n' +
    Object.entries(pal).map(([k, v]) => `    "${k}": "${v}"`).join(',\n') + '\n  }';
}

writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
console.log('已恢复：byThemeId=' + Object.keys(j.byThemeId).length +
  ' 项，newThemeIds=' + j.newThemeIds.length +
  ' 个，expectedCountAfter=' + j.expectedCountAfter);
