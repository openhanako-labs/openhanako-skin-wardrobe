/**
 * fix-server-format.mjs —— 把 server 注册表补丁里 Luna 项的写法
 * 从紧凑格式改成与既有条目一致的带空格格式（check.ps1 按精确字符串比对）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/patches/theme-registry-server.patch';
const j = JSON.parse(readFileSync(p, 'utf8'));

const compact = '"hana-luna":{cssPath:"themes/hana-luna.css",backgroundColor:"#141313",appearance:"dark",i18nName:"settings.appearance.lunaDragon",i18nMode:"settings.appearance.lunaDragonMode"}';
const spaced = '"hana-luna": { cssPath: "themes/hana-luna.css", backgroundColor: "#141313", appearance: "dark", i18nName: "settings.appearance.lunaDragon", i18nMode: "settings.appearance.lunaDragonMode" }';

if (j.insertText.includes(compact)) {
  j.insertText = j.insertText.split(compact).join(spaced);
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n', 'utf8');
  console.log('OK：已改为带空格格式');
} else if (j.insertText.includes('"hana-luna": {')) {
  console.log('已包含带空格格式，无需改动');
} else {
  console.log('未匹配。insertText 末尾：');
  console.log(JSON.stringify(j.insertText.slice(-200)));
}
