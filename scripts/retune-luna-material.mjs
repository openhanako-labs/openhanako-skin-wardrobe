/**
 * retune-luna-material.mjs
 * 材质源里残留的月满庭色值（#172725 / rgba(23,39,37,·)）换成 Luna 的炭黑。
 * 背景源里剩下的 1 处也顺手清掉。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/src/material-luna/bold.css',
  'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/src/material-luna/subtle.css',
  'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/src/background-luna/dark.css',
];

for (const f of files) {
  let t = readFileSync(f, 'utf8');
  const b1 = (t.match(/#172725/gi) || []).length;
  const b2 = (t.match(/23,\s*39,\s*37/g) || []).length;

  t = t.replace(/#172725/gi, '#141313');
  t = t.replace(/rgba\(23,\s*39,\s*37,/g, 'rgba(20, 19, 19,');

  const a1 = (t.match(/#172725/gi) || []).length;
  const a2 = (t.match(/23,\s*39,\s*37/g) || []).length;

  writeFileSync(f, t, 'utf8');
  const name = f.split('/').slice(-2).join('/');
  console.log(`${name}: #172725 ${b1}->${a1}，墨绿 ${b2}->${a2}`);
}
