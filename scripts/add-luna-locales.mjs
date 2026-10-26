/**
 * scripts/add-luna-locales.mjs
 * 给 pack-luna 的 5 个语言补丁加入 Luna 的两个键。
 * 脚本的 locale 步骤只从这些 patch.json 里取"要新建的键"，
 * ThemeDefs.Labels 走的是改名通道，用不上。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna/patches/locales';

const ADD = {
  'zh.patch.json': {
    'settings.appearance.lunaDragon': 'Luna 龙娘',
    'settings.appearance.lunaDragonMode': '玫瑰月影',
  },
  'zh-TW.patch.json': {
    'settings.appearance.lunaDragon': 'Luna 龍娘',
    'settings.appearance.lunaDragonMode': '玫瑰月影',
  },
  'en.patch.json': {
    'settings.appearance.lunaDragon': 'Luna Dragon',
    'settings.appearance.lunaDragonMode': 'Rose Moonlight',
  },
  'ja.patch.json': {
    'settings.appearance.lunaDragon': 'ルナ ドラゴン',
    'settings.appearance.lunaDragonMode': '薔薇の月光',
  },
  'ko.patch.json': {
    'settings.appearance.lunaDragon': '루나 드래곤',
    'settings.appearance.lunaDragonMode': '장미 월광',
  },
};

for (const [file, kv] of Object.entries(ADD)) {
  const p = join(DIR, file);
  const json = JSON.parse(readFileSync(p, 'utf8'));
  const before = Object.keys(json).length;
  Object.assign(json, kv);
  writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${file}: ${before} -> ${Object.keys(json).length} 键`);
}
