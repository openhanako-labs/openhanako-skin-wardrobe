/**
 * scripts/test-routes.mjs —— 直连 HTTP 测试衣橱后端路由
 *
 * 不经过 UI，直接打 /api/apps/skin-wardrobe/routes/*，验证数据层闭环：
 *   空库存 → 入库 → 列表 → 待办 → 清理 → 复原
 *
 * 用法：node scripts/test-routes.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const info = JSON.parse(readFileSync(join(homedir(), '.hanako', 'server-info.json'), 'utf8'));
const port = info?.network?.actualPort || info?.port;
const proto = info?.tlsActive ? 'https' : 'http';
const host = info?.advertisedHost || '127.0.0.1';
const BASE = `${proto}://${host}:${port}/api/apps/skin-wardrobe/routes`;

const call = async (method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      authorization: `Bearer ${info.token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text: json ? null : text.slice(0, 300) };
};

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const TEST_ID = 'zz-test-pack';

console.log('目标: ' + BASE + '\n');

/* 1. 空/现有库存 */
let r = await call('GET', '/skins');
if (r.status !== 200) {
  console.log('路由不可达（HTTP ' + r.status + '）。App 可能还没确认安装或没重启。');
  if (r.text) console.log('   ' + r.text);
  process.exit(1);
}
check('GET /skins 返回 200', true);
const before = (r.json?.skins || []).length;
console.log('   现有库存: ' + before + ' 个');

/* 2. 入库一个测试包 */
const testPack = {
  schema: 'hana-skinpack/2',
  packId: TEST_ID,
  packVersion: '0.0.1',
  names: { zh: '测试包' },
  tags: ['测试'],
  group: 'test',
  favorite: false,
  theme: {
    key: 'default',
    appearance: 'dark',
    colors: { '--bg': '#101010' },
    background: { asset: 'assets/bg.png', panelAlpha: 0.5 },
    material: { tier: 'bold', edge: 'rgba(255,255,255,0.2)', rim: 0.25 },
    frame: { kind: 'builtin', builtin: 'petals' },
  },
};
r = await call('POST', '/skins', { pack: testPack });
check('POST /skins 入库', r.status === 200 && r.json?.ok === true, JSON.stringify(r.json || r.text));

/* 3. 列表应 +1 */
r = await call('GET', '/skins');
const after = (r.json?.skins || []).length;
check('列表数量 +1', after === before + 1, before + ' -> ' + after);
const found = (r.json?.skins || []).find((s) => s.packId === TEST_ID);
check('列表含新包', !!found);
check('元数据正确', found?.appearance === 'dark' && found?.material === 'bold');
check('背景标记正确', found?.hasBackground === true);

/* 4. 待办 */
r = await call('POST', '/pending', { op: 'enable', packId: TEST_ID, themeId: 'hana-' + TEST_ID });
check('POST /pending 入队', r.status === 200 && r.json?.ok === true);
const opId = r.json?.item?.id;

r = await call('GET', '/pending');
const pend = r.json?.pending || [];
check('待办列表含该项', pend.some((x) => x.id === opId));
check('待办未标记完成', pend.find((x) => x.id === opId)?.done === false);

/* 5. 清待办 */
r = await call('DELETE', '/pending/' + opId);
check('DELETE /pending 清掉', r.status === 200);
r = await call('GET', '/pending');
check('待办已移除', !(r.json?.pending || []).some((x) => x.id === opId));

/* 6. 删除测试包，复原 */
r = await call('DELETE', '/skins/' + TEST_ID);
check('DELETE /skins 移除', r.status === 200);
r = await call('GET', '/skins');
check('库存复原', (r.json?.skins || []).length === before);

/* 7. state */
// 注：host 字段由 App 尝试读 desktop-target.json，受保护数据根通常读不到，允许为 null
r = await call('GET', '/state');
check('GET /state 返回 200', r.status === 200, r.status + ' ' + (r.text || ''));
check('构含 skins/pending 计数',
  typeof r.json?.skins === 'number' && typeof r.json?.pending === 'number',
  JSON.stringify(r.json));
if (r.json?.host) console.log('   宿主: renderer ' + r.json.host.renderer + ' / server ' + r.json.host.server);
else console.log('   宿主版本: App 无权读 artifacts（预期），由 agent 侧提供');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
