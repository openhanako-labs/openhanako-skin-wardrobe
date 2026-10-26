/**
 * check-theme-colors.mjs —— 全量色值检查器
 *
 * 起因：给 Luna 加主题时，只替换了主题 id，没替换源文件里硬编码的月满庭色值。
 * 连续三次在不同层发现同一类问题（配色源 / 背景源 / 取景框源），
 * 所以做成可复用的检查 + 可选修复。
 *
 * 用法：
 *   node scripts/check-theme-colors.mjs           只检查，非零退出码表示有残留
 *   node scripts/check-theme-colors.mjs --fix     顺便修掉
 *
 * 判据：目标主题的目录里，不该出现 OTHER 组的色值。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'W:/Games/Hanako/Work/projects/hana-skin-app/patch/src';
const FIX = process.argv.includes('--fix');

/** 每个主题的"外来色值"：这些颜色属于别的主题，出现在本主题目录里就是残留。 */
const FOREIGN = {
  luna: {
    // Luna 是 #141313 炭黑；以下都是月满庭的墨绿系
    patterns: [/#172725/gi, /23,\s*39,\s*37/g, /34,\s*52,\s*48/g],
    replace: ['#141313', '20, 19, 19', '20, 19, 19'],
  },
};

/** 只扫该主题自己的目录（配色源 + 三个层目录）。 */
function themePaths(key) {
  const out = [];
  for (const name of readdirSync(SRC)) {
    if (name === `hana-${key}.css`) out.push(join(SRC, name));
    else if (name.endsWith(`-${key}`) && statSync(join(SRC, name)).isDirectory()) {
      for (const f of readdirSync(join(SRC, name))) {
        if (f.endsWith('.css') || f.endsWith('.js')) out.push(join(SRC, name, f));
      }
    }
  }
  return out;
}

let total = 0;
for (const [key, rule] of Object.entries(FOREIGN)) {
  const files = themePaths(key);
  if (!files.length) { console.log(`[${key}] 找不到主题文件`); continue; }
  console.log(`[${key}] 扫描 ${files.length} 个文件`);

  for (const f of files) {
    let t = readFileSync(f, 'utf8');
    let hits = 0;
    rule.patterns.forEach((re) => { hits += (t.match(re) || []).length; });
    if (!hits) continue;

    total += hits;
    const rel = f.substring(SRC.length + 1);
    if (FIX) {
      rule.patterns.forEach((re, i) => { t = t.replace(re, rule.replace[i]); });
      writeFileSync(f, t, 'utf8');
      console.log(`  修 ${rel}: ${hits} 处`);
    } else {
      console.log(`  残留 ${rel}: ${hits} 处`);
    }
  }
}

if (total === 0) console.log('\nOK：无外来色值残留');
else if (FIX) console.log('\n已全部修复，共 ' + total + ' 处');
else { console.log('\n共 ' + total + ' 处残留（加 --fix 修复）'); process.exit(1); }
