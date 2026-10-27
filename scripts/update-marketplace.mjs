/**
 * update-marketplace.mjs —— 一次性：把市场 PR#150 的 approvals.json 指到 v0.6.8
 * fork 分支取 PR head 分支名。用法：node scripts/update-marketplace.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const VER = 'v0.6.8';
const FORK = 'Yuexiye/hana-marketplace';
const UP = 'liliMozi/hana-marketplace';

// PR#150 的 head 分支（不用 jq，拉全量 JSON 在这里解析）
const pr = JSON.parse(gh(`gh api repos/${UP}/pulls/150`));
console.log('PR state: ' + pr.state + '  head: ' + pr.head.ref);
if (pr.state !== 'open') { console.error('PR 已关闭，停止'); process.exit(1); }
const ref = pr.head.ref;
const rawB64 = gh(`gh api "repos/${FORK}/contents/approvals.json?ref=${ref}" --jq .content`);
const apr = JSON.parse(Buffer.from(rawB64.replace(/\s/g, ''), 'base64').toString('utf8'));
const curSha = gh(`gh api "repos/${FORK}/contents/approvals.json?ref=${ref}" --jq .sha`);

// zip sha256
const zipPath = join(ROOT, 'dist', `app-skin-wardrobe-${VER.slice(1)}.zip`);
const { createHash } = await import('node:crypto');
const zip = readFileSync(zipPath);
const sha256 = createHash('sha256').update(zip).digest('hex');

const hit = apr.approvals.find((a) => a.id === 'skin-wardrobe');
if (!hit) { console.error('approvals 里没有 skin-wardrobe 条目'); process.exit(1); }
console.log('当前: tag=' + hit.tag + ' sha256=' + String(hit.sha256).slice(0, 12) + '...');
hit.tag = VER;
hit.sha256 = sha256;
console.log('目标: tag=' + VER + ' sha256=' + sha256.slice(0, 12) + '...');

const bodyFile = join(tmpdir(), 'gh-put-approvals-' + Date.now() + '.json');
writeFileSync(bodyFile, JSON.stringify({
  message: 'chore: skin-wardrobe -> ' + VER + '（状态真值 + 幂等 disable）',
  content: Buffer.from(JSON.stringify(apr, null, 2) + '\n', 'utf8').toString('base64'),
  sha: curSha,
  branch: ref,
}), 'utf8');
console.log('PUT -> ' + gh(`gh api -X PUT repos/${FORK}/contents/approvals.json --input "${bodyFile}" --jq .commit.sha`).slice(0, 12));

// PR 标题与正文同步版本号
const origBody = gh(`gh api repos/${UP}/pulls/150 --jq .body`).split('\r').join('');
const newBody = origBody.split('v0.6.7').join(VER).split('app-skin-wardrobe-0.6.7').join(`app-skin-wardrobe-${VER.slice(1)}`);
const patchBody = join(tmpdir(), 'gh-patch-pr150-' + Date.now() + '.json');
writeFileSync(patchBody, JSON.stringify({
  title: 'Register app: skin-wardrobe（衣橱 · 皮肤库）' + VER,
  body: newBody,
}));
console.log('PR 标题: ' + gh(`gh api -X PATCH repos/${UP}/pulls/150 --input "${patchBody}" --jq .title`));
console.log('完成。');
