/**
 * skin-wardrobe/index.js —— 衣橱 v2 后端
 *
 * 职责边界（实测决定）：
 *   App 运行在独立 Node 子进程，可写 app-data，但 **~/.hanako/artifacts 属受保护数据根，无权写入**。
 *   所以：App 管「皮肤库存 + 待办队列」，agent 管「改宿主注册表」。
 *
 * 路由（前端 hana.api.fetch 调用）：
 *   GET    /skins              列出已入库皮肤
 *   POST   /skins              入库一个皮肤包（{ pack }）
 *   DELETE /skins/:packId      从库存移除
 *   GET    /pending            待办队列
 *   POST   /pending            追加待办（{ op, packId, themeId }）
 *   DELETE /pending/:id        清掉一条待办
 *   GET    /state              宿主版本 + 注册表现状（只读）
 *
 * 工具（agent 用）：
 *   wardrobe_pending           读待办
 *   wardrobe_mark_done         标记某条待办已完成
 */
import { defineApp } from './sdk/app-contract/server-client.js';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'skin-wardrobe';

export default defineApp(async (sdk) => {
  const dataDir = sdk.dataDir;
  const skinsDir = join(dataDir, 'skins');
  const pendingPath = join(dataDir, 'pending.json');

  mkdirSync(skinsDir, { recursive: true });

  /* ── 预装内置主题（幂等：已入库则跳过）── */
  try {
    const APP_ROOT = dirname(fileURLToPath(import.meta.url));
    const packsDir = join(APP_ROOT, 'assets', 'prebuilt', 'packs');
    if (existsSync(packsDir)) {
      for (const f of readdirSync(packsDir)) {
        if (!f.endsWith('.skinpack.json')) continue;
        const pack = JSON.parse(readFileSync(join(packsDir, f), 'utf8'));
        const dir = join(skinsDir, pack.packId);
        if (!existsSync(join(dir, 'skin.json'))) {
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, 'skin.json'), JSON.stringify(pack), 'utf8');
          sdk.logger.info('预装内置主题：' + pack.packId);
        }
      }
    }
  } catch (e) {
    sdk.logger.warn('预装内置主题失败：' + (e && e.message));
  }

  const readPending = () => {
    try { return JSON.parse(readFileSync(pendingPath, 'utf8')); } catch { return []; }
  };
  const writePending = (list) => writeFileSync(pendingPath, JSON.stringify(list, null, 2), 'utf8');

  const listSkins = () => {
    const out = [];
    for (const name of readdirSync(skinsDir)) {
      const dir = join(skinsDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const f = join(dir, 'skin.json');
      if (!existsSync(f)) continue;
      try {
        const pack = JSON.parse(readFileSync(f, 'utf8'));
        const t = pack.theme || {};
        out.push({
          packId: pack.packId || name,
          names: pack.names || {},
          tags: pack.tags || [],
          group: pack.group || '',
          favorite: !!pack.favorite,
          schema: pack.schema,
          appearance: t.appearance || 'dark',
          hasBackground: !!(t.background && (t.background.asset || t.background.dataUri)),
          material: t.material ? t.material.material || t.material.tier : null,
          frame: t.frame ? t.frame.kind : null,
          // 封面 data URI 直接随列表下发（不走 /shot 端点：零请求、零认证问题）
          hasShot: !!(t.shot || pack.shot),
          shotData: t.shot || pack.shot || null,
          dir,
        });
      } catch (e) {
        sdk.logger.warn('皮肤包解析失败：' + name + ' ' + e.message);
      }
    }
    return out.sort((a, b) => (b.favorite - a.favorite) || a.packId.localeCompare(b.packId));
  };

  /* ── 路由 ── */
  await sdk.routes.register((app) => {
    app.get('/skins', (c) => c.json({ ok: true, skins: listSkins() }));

    // 读单个包的完整内容（工作台要用配色表）
    app.get('/skins/:packId', (c) => {
      const id = c.req.param('packId');
      const f = join(skinsDir, id, 'skin.json');
      if (!existsSync(f)) return c.json({ ok: false, error: '不存在' }, 404);
      try { return c.json({ ok: true, pack: JSON.parse(readFileSync(f, 'utf8')) }); }
      catch (e) { return c.json({ ok: false, error: '解析失败：' + e.message }, 500); }
    });

    // 封面图：包里存的是 data URI，这里解码后按需下发
    app.get('/skins/:packId/shot', (c) => {
      const id = c.req.param('packId');
      const f = join(skinsDir, id, 'skin.json');
      if (!existsSync(f)) return c.text('not found', 404);
      let shot;
      try { shot = JSON.parse(readFileSync(f, 'utf8'))?.theme?.shot || JSON.parse(readFileSync(f, 'utf8'))?.shot; } catch { return c.text('bad pack', 500); }
      if (!shot) return c.text('no shot', 404);
      const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(shot);
      if (!m) return c.text('unsupported shot format', 415);
      const buf = Buffer.from(m[2], 'base64');
      return c.body(buf, 200, { 'content-type': m[1], 'cache-control': 'max-age=60' });
    });

    // 只改收藏位（前端不改整包）
    app.post('/skins/:packId/favorite', async (c) => {
      const id = c.req.param('packId');
      const f = join(skinsDir, id, 'skin.json');
      if (!existsSync(f)) return c.json({ ok: false, error: '不存在' }, 404);
      const body = await c.req.json().catch(() => ({}));
      const pack = JSON.parse(readFileSync(f, 'utf8'));
      pack.favorite = !!body.favorite;
      writeFileSync(f, JSON.stringify(pack, null, 2), 'utf8');
      return c.json({ ok: true, packId: id, favorite: pack.favorite });
    });

    app.post('/skins', async (c) => {
      const body = await c.req.json();
      const pack = body && body.pack;
      if (!pack || !pack.packId) return c.json({ ok: false, error: 'pack.packId 缺失' }, 400);
      const dir = join(skinsDir, pack.packId);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'skin.json'), JSON.stringify(pack, null, 2), 'utf8');
      return c.json({ ok: true, packId: pack.packId, total: listSkins().length });
    });

    app.delete('/skins/:packId', (c) => {
      const id = c.req.param('packId');
      const dir = join(skinsDir, id);
      if (!existsSync(dir)) return c.json({ ok: false, error: '不存在' }, 404);
      rmSync(dir, { recursive: true, force: true });
      return c.json({ ok: true, packId: id });
    });

    app.get('/pending', (c) => c.json({ ok: true, pending: readPending() }));

    app.post('/pending', async (c) => {
      const body = await c.req.json();
      if (!body || !body.op) return c.json({ ok: false, error: 'op 缺失' }, 400);
      const list = readPending();
      const item = {
        id: 'op_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        op: body.op,
        packId: body.packId || null,
        themeId: body.themeId || null,
        at: new Date().toISOString(),
        done: false,
      };
      list.push(item);
      writePending(list);
      return c.json({ ok: true, item, total: list.length });
    });

    app.delete('/pending/:id', (c) => {
      const id = c.req.param('id');
      const list = readPending().filter((x) => x.id !== id);
      writePending(list);
      return c.json({ ok: true, total: list.length });
    });

    app.get('/state', (c) => {
      // 只读：宿主版本 + 有多少皮肤包已入库
      let host = null;
      try {
        const p = join(process.env.USERPROFILE || process.env.HOME || '', '.hanako', 'artifacts', 'desktop-target.json');
        const t = JSON.parse(readFileSync(p, 'utf8')).current;
        host = { renderer: t.renderer.version, server: t.server.version };
      } catch { host = null; }
      const pending = readPending();
      return c.json({ ok: true, host, skins: listSkins().length, pending: pending.filter((x) => !x.done).length });
    });
  });

  /* ── 工具：给 agent 读待办 ── */
  await sdk.tools.register({
    name: 'wardrobe_pending',
    description: '读衣橱的待办队列（用户在 App 里点了启用/停用，需要 agent 改宿主注册表）。',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const list = readPending().filter((x) => !x.done);
      if (!list.length) return { content: [{ type: 'text', text: '衣橱没有待办。' }] };
      const lines = list.map((x) => `- [${x.id}] ${x.op}  ${x.themeId || x.packId || ''}  (${x.at})`);
      return {
        content: [{ type: 'text', text: '待办 ' + list.length + ' 条：\n' + lines.join('\n') }],
      };
    },
  });

  await sdk.tools.register({
    name: 'wardrobe_mark_done',
    description: '把衣橱里某条待办标记为完成（改完注册表后调用）。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '待办 id，形如 op_xxx' } },
      required: ['id'],
    },
    execute: async (args) => {
      const id = args && args.id;
      const list = readPending();
      const hit = list.find((x) => x.id === id);
      if (!hit) return { content: [{ type: 'text', text: '找不到待办 ' + id }] };
      hit.done = true;
      hit.doneAt = new Date().toISOString();
      writePending(list);
      return { content: [{ type: 'text', text: '已标记完成：' + id }] };
    },
  });

  await sdk.logger.info('skin-wardrobe v2 后端就绪，库存 ' + listSkins().length + ' 个');
});
