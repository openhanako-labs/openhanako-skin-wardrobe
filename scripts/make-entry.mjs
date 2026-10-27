/**
 * scripts/make-entry.mjs —— 从安装包生成市场 entry.json
 *
 * entry.json 结构对照 v0.6.7 release 附件：manifest 的字段 + 图标转 base64 data URI
 * + archive 块（url 用 {{BASE_URL}} 占位，宿主安装时替换为 release 下载地址）。
 * 用法：node scripts/make-entry.mjs <version>   （缺省读 manifest.json）
 * 输出：dist/app-skin-wardrobe-<version>.entry.json
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'skin-wardrobe');
const DIST = join(APP, '..', 'dist');
const manifest = JSON.parse(readFileSync(join(APP, 'manifest.json'), 'utf8'));

const ver = process.argv[2] || manifest.version;
const icon = readFileSync(join(APP, manifest.icon)).toString('base64');

const entry = {
  kind: 'app',
  id: manifest.id,
  name: manifest.name,
  publisher: 'Yuexiye',
  description: manifest.description,
  version: ver,
  permissions: manifest.capabilities.map((c) => ({ capability: c })),
  compatibility: { minAppVersion: manifest.minAppVersion },
  icon: 'data:image/png;base64,' + icon,
};

// archive 块：sha256/size 指向同版本 zip
const zipPath = join(DIST, `app-skin-wardrobe-${ver}.zip`);
const zipBuf = readFileSync(zipPath);
entry.archive = {
  url: `{{BASE_URL}}/app-skin-wardrobe-${ver}.zip`,
  sha256: createHash('sha256').update(zipBuf).digest('hex'),
  size: zipBuf.length,
  format: 'zip',
};

const out = join(DIST, `app-skin-wardrobe-${ver}.entry.json`);
writeFileSync(out, JSON.stringify(entry, null, 2), 'utf8');
console.log('entry 生成: ' + out);
