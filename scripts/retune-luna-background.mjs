/**
 * retune-luna-background.mjs
 * 1) 把 Luna 背景源里残留的月满庭墨绿 rgba(23,39,37,·) 换成 Luna 炭黑 rgba(20,19,19,·)
 * 2) 加厚侧栏 / 聊天区遮罩，改善文字可读性
 * 只动 background-luna，不碰其它主题的源。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'W:/Games/Hanako/Work/projects/hana-skin-app/pack-luna5/hana-skin-v0.1.5/src/background-luna/dark.css';
let t = readFileSync(p, 'utf8');

const before = (t.match(/23,\s*39,\s*37/g) || []).length;

// 先整体换色（保留原 alpha）
t = t.split(/rgba\(23,\s*39,\s*37,\s*/).join('rgba(20, 19, 19, ');

// 再加厚关键遮罩：侧栏 0.28 -> 0.55；聊天区 / 卡片 0.35 -> 0.62
t = t.split('rgba(20, 19, 19, 0.28)').join('rgba(20, 19, 19, 0.55)');
t = t.split('rgba(20, 19, 19, 0.35)').join('rgba(20, 19, 19, 0.62)');
// 卡片底 0.25 -> 0.45（保证卡片上的字也清楚）
t = t.split('rgba(34, 52, 48, 0.25)').join('rgba(20, 19, 19, 0.45)');

writeFileSync(p, t, 'utf8');

const after = (t.match(/23,\s*39,\s*37/g) || []).length;
console.log('月满庭墨绿残留: ' + before + ' -> ' + after);
console.log('新遮罩值: 侧栏 0.55 / 聊天区 0.62 / 卡片 0.45');
