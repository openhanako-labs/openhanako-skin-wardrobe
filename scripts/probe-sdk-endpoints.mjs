/**
 * 探针：从随包 SDK 客户端里挖出主题快照与 palettes 的真实取用路径，
 * 再用宿主 HTTP 端点直接验一次——回答"这台 1.1.35 到底给不给 palettes"。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const sdkPath = 'W:/Games/Hanako/Work/projects/hana-skin-app/skin-wardrobe/ui/assets/sdk.js';
const src = readFileSync(sdkPath, 'utf8');

console.log('=== SDK 里 palettes 的上下文 ===');
let i = 0;
while ((i = src.indexOf('palettes', i)) >= 0) {
  console.log('  …' + src.slice(Math.max(0, i - 120), i + 120).replace(/\s+/g, ' ') + '…');
  i += 8;
}

console.log('\n=== SDK 里的端点字符串 ===');
const eps = new Set();
const re = /["'`](\/[a-z0-9/_.:-]*(?:theme|appearance|palette)[a-z0-9/_.:-]*)["'`]/gi;
let m;
while ((m = re.exec(src)) !== null) eps.add(m[1]);
for (const e of eps) console.log('  ' + e);

const info = JSON.parse(readFileSync(join(homedir(), '.hanako', 'server-info.json'), 'utf8'));
const port = info?.network?.actualPort || info?.port;
const base = `http://127.0.0.1:${port}`;
const H = { authorization: `Bearer ${info.token}` };

console.log('\n=== 直接问宿主这些端点 ===');
for (const e of eps) {
  for (const cand of [e, `/api${e}`, `/api/apps/skin-wardrobe${e}`]) {
    try {
      const r = await fetch(base + cand, { headers: H });
      const t = await r.text();
      console.log(`  ${r.status}  ${cand}  (${t.length}B)  ${t.slice(0, 220).replace(/\s+/g, ' ')}`);
      if (r.status === 200) break;
    } catch (err) {
      console.log('  ERR ' + cand + ' ' + err.message);
    }
  }
}
