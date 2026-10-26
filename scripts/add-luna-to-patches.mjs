/**
 * scripts/add-luna-to-patches.mjs
 * 把 hana-luna 追加进三个注册表补丁的 insertText。
 * 只改注册表这一处——CSS/locale 已经是数据驱动，能自动跟上。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna/patches';

const LUNA_ITEM =
  ',"hana-luna":{cssPath:"themes/hana-luna.css",backgroundColor:"#141313",appearance:"dark"' +
  ',i18nName:"settings.appearance.lunaDragon",i18nMode:"settings.appearance.lunaDragonMode"}';

const TARGETS = [
  'theme-registry-renderer.patch',
  'theme-registry-bundle.patch',
  'theme-registry-server.patch',
];

for (const file of TARGETS) {
  const p = join(DIR, file);
  const raw = readFileSync(p, 'utf8');
  const json = JSON.parse(raw);

  if (json.insertText.includes('hana-luna')) {
    console.log(file + ': 已包含 hana-luna，跳过');
    continue;
  }
  const before = (json.insertText.match(/cssPath:/g) || []).length;
  json.insertText = json.insertText + LUNA_ITEM;
  const after = (json.insertText.match(/cssPath:/g) || []).length;

  if (typeof json.description === 'string' && !json.description.includes('hana-luna')) {
    json.description = json.description.replace('三项', '四项') + '（第四项 hana-luna 由本地追加）';
  }

  writeFileSync(p, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(file + ': insertText 项数 ' + before + ' -> ' + after);
}
