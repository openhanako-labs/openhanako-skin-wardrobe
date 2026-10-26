/**
 * 分析 hana-skin v0.1.4 的三个主题 CSS：有多少变量落在官方 61 词表内，
 * 有多少是词表外/组件级 CSS（无法用 vars 类还原）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { fileURLToPath, pathToFileURL } from 'node:url';

const appSdk = 'W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/sdk/app-custom-themes.js';
const host = await import(pathToFileURL(appSdk).href);
const VOCAB = new Set(host.CUSTOM_THEME_VARIABLE_NAMES);

const tmpRoot = 'W:/Games/Hanako/Work/临时/skin-v014';
if (!existsSync(tmpRoot)) {
  console.log('先解压 v0.1.4 …');
  execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath 'W:/Games/Hanako/.hanako/session-files/7e5bf9a9ac5060d756c110dd/hana-skin-皮肤包-v0.1.4 based on Hana v1.1.111_mvn71f94_85798848.zip' -DestinationPath '${tmpRoot}' -Force"`, { stdio: 'inherit' });
}
const srcDir = join(tmpRoot, 'hana-skin-皮肤包', 'src');

const themes = ['hana-moonlit-court.css', 'hana-violet-dusk.css', 'hana-deepsleep.css'];

for (const f of themes) {
  const p = join(srcDir, f);
  if (!existsSync(p)) { console.log('缺失: ' + f); continue; }
  const css = readFileSync(p, 'utf8');

  // 变量声明（去掉注释）
  const noComment = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const names = [...noComment.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]);
  const uniq = [...new Set(names)];
  const inVocab = uniq.filter((n) => VOCAB.has(n));
  const outside = uniq.filter((n) => !VOCAB.has(n));

  // 组件级 CSS 规则：含选择器且不是纯变量声明块
  const ruleBlocks = [...noComment.matchAll(/([^{}]+)\{/g)]
    .map((m) => m[1].trim())
    .filter((sel) => sel && !sel.startsWith('@') && !sel.includes('--') && sel.length < 160);

  console.log('=== ' + f + ' ===');
  console.log('  变量 ' + uniq.length + ' 项：词表内 ' + inVocab.length + ' / 词表外 ' + outside.length);
  if (outside.length) console.log('  词表外: ' + outside.join(' '));
  console.log('  规则块 ' + ruleBlocks.length + ' 个' + (ruleBlocks.length ? '：' + ruleBlocks.slice(0, 6).join(' | ') : '（纯变量）'));
  const core = ['--bg', '--bg-card', '--bg-glass', '--sidebar-bg', '--text', '--text-muted', '--border', '--accent'];
  console.log('  核心 8 项: ' + core.filter((c) => uniq.includes(c)).length + '/8');
  console.log('');
}
