/**
 * scripts/pack-app.mjs —— 打包 skin-wardrobe 成安装 zip
 *
 * 历史版本把 ui.bak-* 备份目录也打了进去，这次不再带。
 * 结构 = zip 根直接是 index.js / manifest.json / ui/ / assets/ / sdk/。
 *
 * 用法：node scripts/pack-app.mjs <version>
 *   version 缺省读 manifest.json
 * 输出：dist/app-skin-wardrobe-<version>.zip
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'skin-wardrobe');
const DIST = join(APP, '..', 'dist');

const ver = process.argv[2] || JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8')).version;
const out = join(DIST, `app-skin-wardrobe-${ver}.zip`);

// 白名单：顶层文件 + 三个目录（ui、assets、sdk），备份目录天然进不来
const files = ['index.js', 'manifest.json', 'README.md'];

// 用 PowerShell Compress-Archive：需要先在临时目录拼出目标结构
const tmp = join(DIST, '_pack-tmp');
execSync(`powershell -NoProfile -Command "Remove-Item -LiteralPath '${tmp}' -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path '${tmp}' | Out-Null"`, { stdio: 'inherit' });

// 拷贝顶层文件
for (const f of files) {
  if (!existsSync(join(APP, f))) continue;
  execSync(`powershell -NoProfile -Command "Copy-Item -LiteralPath '${join(APP, f)}' -Destination '${tmp}'"`, { stdio: 'inherit' });
}
// 拷贝目录（ui、assets、sdk），排除 *.bak / ui.bak-*
for (const d of ['ui', 'assets', 'sdk']) {
  if (!existsSync(join(APP, d))) continue;
  execSync(
    `powershell -NoProfile -Command "New-Item -ItemType Directory -Path '${join(tmp, d)}' | Out-Null; ` +
    `Copy-Item -LiteralPath '${join(APP, d)}' -Destination '${tmp}' -Recurse -Force"`,
    { stdio: 'inherit' }
  );
}

// Compress-Archive 的路径会带 tmp 根名，改成从 tmp 内容直接压
const zipTmp = join(DIST, '_pack-out.zip');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${tmp}\\*' -DestinationPath '${zipTmp}' -Force"`, { stdio: 'inherit' });
execSync(`powershell -NoProfile -Command "Move-Item -LiteralPath '${zipTmp}' -Destination '${out}' -Force"`, { stdio: 'inherit' });
execSync(`powershell -NoProfile -Command "Remove-Item -LiteralPath '${tmp}' -Recurse -Force"`, { stdio: 'inherit' });

console.log('打包完成: ' + out);
