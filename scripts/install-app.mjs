/**
 * scripts/install-app.mjs — 把打包好的 App 暂存进宿主的安装队列。
 *
 * 只做「暂存」（staging），不调 confirm。审阅卡要确认的是"这台机器上
 * 要多一段可执行内容"，那是用户的决定，agent 自行确认等于绕开审查。
 *
 * 用法：node scripts/install-app.mjs <zip 绝对路径>
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';

const zip = process.argv[2];
if (!zip) {
  console.error('用法: node scripts/install-app.mjs <zip 绝对路径>');
  process.exit(2);
}

const info = JSON.parse(readFileSync(join(homedir(), '.hanako', 'server-info.json'), 'utf8'));
const port = info?.network?.actualPort || info?.port;
const proto = info?.tlsActive ? 'https' : 'http';
const host = info?.advertisedHost || '127.0.0.1';
const base = `${proto}://${host}:${port}`;

const res = await fetch(`${base}/api/extensions/install`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${info.token}`,
  },
  body: JSON.stringify({
    kind: 'app',
    source: { type: 'local', path: zip },
  }),
});

const text = await res.text();
let body;
try { body = JSON.parse(text); } catch (_) { body = { raw: text.slice(0, 800) }; }

console.log('HTTP ' + res.status);
if (body.status === 'awaiting_confirmation' && body.staged) {
  const s = body.staged;
  console.log('已暂存，等待你在安装卡上确认。');
  console.log('  stagedId : ' + s.stagedId);
  console.log('  kind/id  : ' + s.kind + ' / ' + s.id);
  console.log('  version  : ' + s.version);
  console.log('  warnings : ' + JSON.stringify(s.warnings || []));
  // 句柄写进临时文件，供后续查询；不落项目目录，避免被当成产物提交
  const handlePath = join(tmpdir(), 'hana-skin-wardrobe-staged.json');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(handlePath, JSON.stringify({ stagedId: s.stagedId, zip }, null, 2));
  console.log('  句柄已存 : ' + handlePath);
} else {
  console.log(JSON.stringify(body, null, 2).slice(0, 2000));
}
