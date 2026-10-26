/**
 * scripts/patch-registry-for-luna.mjs
 * 让 hana-luna 真正进主题注册表：把三个 registry patch 的
 * expectedCountAfter 14 -> 15、newThemeIds 追加 hana-luna。
 *
 * 明确不做（留作已知缺口）：
 *   - card-palette-server.patch 的 byThemeId 需要 Luna 的 15 个卡片调色键
 *   - theme-card-preview.patch 的 newThemeIds（设置页卡片预览配色）
 * 这两处不加，脚本按原 3 个主题处理，不会报错；后果是
 * folio 烧入 Luna 会抛 no card palette、设置页里 Luna 卡片预览用默认配色。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna/patches';
const TARGETS = [
  'theme-registry-renderer.patch',
  'theme-registry-bundle.patch',
  'theme-registry-server.patch',
];

for (const file of TARGETS) {
  const p = join(DIR, file);
  const json = JSON.parse(readFileSync(p, 'utf8'));

  const before = json.expectedCountAfter;
  json.expectedCountAfter = 14 + 1;

  const ids = Array.isArray(json.newThemeIds) ? json.newThemeIds : [];
  if (!ids.includes('hana-luna')) ids.push('hana-luna');
  json.newThemeIds = ids;

  writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`${file}: expectedCountAfter ${before} -> ${json.expectedCountAfter}；newThemeIds=${ids.join(', ')}`);
}
