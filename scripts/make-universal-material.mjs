/**
 * make-universal-material.mjs —— 阶段 0 的核心实验
 *
 * 目标：把「每主题一份材质」变成「一份通用材质」。
 *   1. 从 material-luna 复制出 material-universal
 *   2. 选择器 [data-theme="hana-luna"] → [data-theme^="hana-"]（特异性相同）
 *   3. --mat-glow 从写死值改成 var(--bg-rgb, 20,19,19)，跟随各主题底色
 *   4. 给 5 个配色源各补一行 --bg-rgb（CSS 层自由变量，不经过宿主词表）
 *   5. 把 ThemeDefs 里所有主题的 MaterialDir 指向 material-universal
 */
import { readFileSync, writeFileSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'W:/Games/Hanako/Work/projects/hana-skin-app/patch/src';
const OLD_ID = 'hana-luna';
const NEW_SEL = '[data-theme^="hana-"]';

/* ── 1+2+3 通用材质 ── */
const uniDir = join(SRC, 'material-universal');
cpSync(join(SRC, 'material-luna'), uniDir, { recursive: true });

for (const f of ['bold.css', 'subtle.css']) {
  const p = join(uniDir, f);
  let t = readFileSync(p, 'utf8');
  const selBefore = (t.match(/\[data-theme="hana-luna"\]/g) || []).length;
  t = t.split(`[data-theme="${OLD_ID}"]`).join(NEW_SEL);
  const glowBefore = (t.match(/--mat-glow:\s*20,\s*19,\s*19/g) || []).length;
  t = t.replace(/--mat-glow:\s*20,\s*19,\s*19\s*;/g, '--mat-glow: var(--bg-rgb, 20, 19, 19);');
  writeFileSync(p, t, 'utf8');
  console.log(`${f}: 选择器 ${selBefore} 处改通配；mat-glow 改 var() ${glowBefore} 处`);
}

/* ── 4 给每个配色源补 --bg-rgb ── */
const themeFiles = readdirSync(SRC).filter((n) => /^hana-.*\.css$/.test(n));
for (const f of themeFiles) {
  const p = join(SRC, f);
  let t = readFileSync(p, 'utf8');
  if (t.includes('--bg-rgb')) { console.log(`${f}: 已有 --bg-rgb，跳过`); continue; }

  const m = /--bg\s*:\s*#([0-9a-fA-F]{6})/.exec(t);
  if (!m) { console.log(`${f}: 找不到 --bg，跳过`); continue; }
  const h = m[1];
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(', ');

  // 插到 --bg 那行之后，保持在同一个声明块内
  t = t.replace(/(--bg\s*:\s*#[0-9a-fA-F]{6}[^;\r\n]*;)/, `$1\n    --bg-rgb: ${rgb};`);
  writeFileSync(p, t, 'utf8');
  console.log(`${f}: --bg-rgb = ${rgb}`);
}

/* ── 5 ThemeDefs 全部指向通用材质 ── */
const applyPath = join('W:/Games/Hanako/Work/projects/hana-skin-app/patch', 'scripts', 'apply.ps1');
let a = readFileSync(applyPath, 'utf8');
const before = (a.match(/MaterialDir\s*=\s*'[a-z-]+'/g) || []);
a = a.replace(/MaterialDir(\s*)=\s*'[a-z0-9-]+'/g, "MaterialDir$1= 'material-universal'");
writeFileSync(applyPath, a, 'utf8');
console.log('ThemeDefs MaterialDir 改动:');
for (const line of before) console.log('  旧: ' + line.trim());
console.log('  新: 全部 → material-universal');
