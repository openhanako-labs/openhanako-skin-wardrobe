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
import { buildThemeInventory } from './assets/lib/inventory.js';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync, statSync, appendFileSync } from 'node:fs';
import { execFileSync, execFile } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = dirname(fileURLToPath(import.meta.url));

export const name = 'skin-wardrobe';

export default defineApp(async (sdk) => {
  const dataDir = sdk.dataDir;
  const skinsDir = join(dataDir, 'skins');
  const pendingPath = join(dataDir, 'pending.json');

  mkdirSync(skinsDir, { recursive: true });

  /* ── 执行器：把待办队列真正写进宿主 ──
     App 进程受 Node Permission Model 限制，默认不能 spawn；manifest 声明
     app/process.spawn 并获用户授权后，才能运行随包内置的 assets/exec/wardrobe-exec.mjs。
     执行器是独立 node 进程，不受 App 的 fs 沙箱约束，负责写 themes/*.css 与三处注册表。 */
  function findExecutor() {
    return [
      join(APP_ROOT, 'assets', 'exec', 'wardrobe-exec.mjs'),
      process.env.HANA_SKIN_WARDROBE_EXEC,
      join(APP_ROOT, '..', 'patch', 'scripts', 'wardrobe-exec.mjs'),
    ].filter(Boolean).find((p) => existsSync(p)) || null;
  }

  async function resolveNode() {
    if (process.env.HANA_SKIN_WARDROBE_NODE) return process.env.HANA_SKIN_WARDROBE_NODE;
    try {
      if (sdk.process && typeof sdk.process.resolveExecutable === 'function') {
        const info = await sdk.process.resolveExecutable({ candidates: ['node'] });
        if (info && info.path) return info.path;
      }
    } catch { /* 未授权 / 无此 API，回落到 PATH */ }
    return 'node';
  }

  async function runExecutor() {
    const script = findExecutor();
    if (!script) {
      return { ok: false, output: '找不到衣橱执行器：assets/exec/wardrobe-exec.mjs 或 ../patch/scripts/wardrobe-exec.mjs 都不在。' };
    }
    // App 进程（及其子进程）继承 --permission；子进程必须自己再声明需要的 fs 范围。
    // 没开启权限模型时不能传 --allow-fs-*（会报 ERR_MISSING_OPTION）。
    const perm = process.permission
      ? ['--allow-fs-read=*', '--allow-fs-write=*', '--allow-child-process']
      : [];
    const node = await resolveNode();
    try {
      const out = execFileSync(node, [...perm, script, '--apply'], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      });
      return { ok: true, output: out };
    } catch (e) {
      const out = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
      return { ok: false, output: out || '执行器退出异常' };
    }
  }

  /* ── 读宿主现状（已装主题 + 当前主题）──
     App 进程被权限模型关在自己的目录里，读不了 ~/.hanako/artifacts；
     执行器是独立进程，读得到。所以这一问交给它的 report 模式代读。
     5 秒缓存：清单不差这五秒，但没必要每次都起一个子进程。 */
  let reportCache = { at: 0, value: null };
  async function runReport() {
    if (Date.now() - reportCache.at < 5000) return reportCache.value;
    const script = findExecutor();
    if (!script) return null;
    const perm = process.permission
      ? ['--allow-fs-read=*', '--allow-fs-write=*', '--allow-child-process']
      : [];
    const node = await resolveNode();
    try {
      const out = execFileSync(node, [...perm, script, 'report'], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      });
      const line = out.trim().split('\n').filter(Boolean).pop() || '';
      const parsed = JSON.parse(line);
      reportCache = { at: Date.now(), value: parsed };
      return parsed;
    } catch (e) {
      sdk.logger.warn('report 失败：' + ((e && e.message) || e));
      return null;
    }
  }

  /* ── 直接应用主题（跨 App 通道与 agent 工具共用）──
     与 runExecutor 同一条 spawn 链（权限旗子一致），但不走待办队列、
     不碰注册表，只改宿主偏好里的 appearance.theme。 */
  async function runApplyTheme(themeId) {
    const script = findExecutor();
    if (!script) return { ok: false, output: '找不到衣橱执行器。' };
    const perm = process.permission
      ? ['--allow-fs-read=*', '--allow-fs-write=*', '--allow-child-process']
      : [];
    const node = await resolveNode();
    try {
      const out = execFileSync(node, [...perm, script, 'apply', '--theme', themeId], {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
      });
      return { ok: true, output: out };
    } catch (e) {
      const out = [e.stdout, e.stderr, e.message].filter(Boolean).join('\n').trim();
      return { ok: false, output: out || '应用退出异常' };
    }
  }

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

  /* ── 宿主注册表真值 ──
     「装没装」必须问宿主，不能问待办账本：账本只记「请求过」，
     宿主注册表才记「装着」。定位法与 patch/scripts/registry-ops.mjs 相同：
     扫三处文件里带 cssPath 的主题条目。读不到（结构变了/文件缺失）返回 null，
     前端退回账本显示。bundle 有十几 MB，挂 5 秒缓存，不每次 /skins 都整读。 */
  let hostIdsCache = { at: 0, ids: null };
  function readHostThemeIds() {
    if (Date.now() - hostIdsCache.at < 5000) return hostIdsCache.ids;
    hostIdsCache = { at: Date.now(), ids: null };
    try {
      const HANA = join(process.env.USERPROFILE || process.env.HOME || '', '.hanako');
      const target = JSON.parse(readFileSync(join(HANA, 'artifacts', 'desktop-target.json'), 'utf8')).current;
      const rd = target.renderer.versionDir;
      const sd = target.server.versionDir;
      const texts = [];
      const themeJs = join(rd, 'lib', 'theme.js');
      if (existsSync(themeJs)) texts.push(readFileSync(themeJs, 'utf8'));
      const assetsDir = join(rd, 'assets');
      if (existsSync(assetsDir)) {
        for (const n of readdirSync(assetsDir)) {
          if (!n.endsWith('.js')) continue;
          try {
            const t = readFileSync(join(assetsDir, n), 'utf8');
            if (t.includes('cssPath:') && t.includes('themes/')) { texts.push(t); break; }
          } catch { /* 读不了就跳 */ }
        }
      }
      const serverBundle = join(sd, 'bundle', 'index.js');
      if (existsSync(serverBundle)) texts.push(readFileSync(serverBundle, 'utf8'));
      const re = /(?:"([a-zA-Z0-9_.-]+)"|([a-zA-Z][a-zA-Z0-9_-]*))\s*:\s*\{\s*cssPath\s*:/g;
      const ids = new Set();
      for (const t of texts) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(t)) !== null) ids.add(m[1] || m[2]);
      }
      hostIdsCache.ids = ids;
    } catch { /* 保持 null，前端走退路 */ }
    return hostIdsCache.ids;
  }

  const listSkins = () => {
    const hostIds = readHostThemeIds();
    const out = [];
    for (const name of readdirSync(skinsDir)) {
      const dir = join(skinsDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const f = join(dir, 'skin.json');
      if (!existsSync(f)) continue;
      try {
        const pack = JSON.parse(readFileSync(f, 'utf8'));
        const t = pack.theme || {};
        // v3 双套：appearance/background/material 在 theme.variants[] 里；v2 单套在 theme 顶层。
        const variants = Array.isArray(t.variants) ? t.variants : null;
        const appearance = variants
          ? ((variants.find((v) => v.appearance === 'dark') || variants[0] || {}).appearance || 'dark')
          : (t.appearance || 'dark');
        const hasBackground = variants
          ? variants.some((v) => v.background && (v.background.asset || v.background.dataUri))
          : !!(t.background && (t.background.asset || t.background.dataUri));
        const material = variants
          ? (variants[0] && variants[0].material && (variants[0].material.material || variants[0].material.tier)) || null
          : (t.material ? t.material.material || t.material.tier : null);
        out.push({
          packId: pack.packId || name,
          names: pack.names || {},
          tags: pack.tags || [],
          group: pack.group || '',
          favorite: !!pack.favorite,
          schema: pack.schema,
          appearance,
          hasBackground,
          material,
          frame: t.frame ? t.frame.kind : null,
          // 宿主真值：这个皮肤的主题现在装没装。null = 查不到宿主，前端退回账本。
          // v3 双套注册成 -dark / -light 两个 id，任一存在即视为已装。
          hostInstalled: hostIds
            ? (variants
              ? ['hana-' + (pack.packId || name) + '-dark', 'hana-' + (pack.packId || name) + '-light'].some((id) => hostIds.has(id))
              : hostIds.has('hana-' + (pack.packId || name)))
            : null,
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

    // 执行待办：读队列 -> 跑内置执行器 -> 标记完成（执行器自己写 pending.json）
    app.post('/execute', async (c) => {
      const r = await runExecutor();
      return c.json({ ok: r.ok, output: r.output });
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

    // 主题 Tokens（只读导出，给其他插件消费）——契约注释在 routes 外的 packTokens 上方
    app.get('/tokens', (c) => {
      const hostIds = readHostThemeIds();
      const wanted = c.req.query('packId');
      // ?themeId= 按宿主主题 id 反查包配置（data-theme 的值，如 hana-miku-dark）。
      // 运行时当前主题本身请读宿主根元素 data-theme 属性；这里只负责 id -> 包配置的映射。
      const wantTheme = c.req.query('themeId');
      if (wantTheme) {
        if (!/^[A-Za-z0-9_.-]+$/.test(wantTheme)) {
          return c.json({ ok: false, error: 'themeId 含非法字符' }, 400);
        }
        const m = /^hana-([A-Za-z0-9_.-]+?)(-dark|-light)?$/.exec(wantTheme);
        let resolved = null;
        if (m) {
          const variant = m[2] ? m[2].slice(1) : null;
          for (const name of readdirSync(skinsDir)) {
            const dir = join(skinsDir, name);
            if (!statSync(dir).isDirectory()) continue;
            const f = join(dir, 'skin.json');
            if (!existsSync(f)) continue;
            try {
              const pack = JSON.parse(readFileSync(f, 'utf8'));
              if (pack.packId !== m[1]) continue;
              const t = packTokens(pack, hostIds);
              const app = variant
                ? (t.appearances.find((a) => a.appearance === variant) || null)
                : (t.appearances[0] || null);
              resolved = {
                packId: t.skinId,
                variant: app ? app.appearance : variant,
                installed: t.installed,
                appearance: app,
                pack: t,
              };
              break;
            } catch { /* 下一目录 */ }
          }
        }
        return c.json({
          ok: true,
          version: 1,
          source: 'pack-config',
          themeId: wantTheme,
          resolved,
          note: '当前主题请读宿主根元素 data-theme；本接口按 themeId 反查衣橱包配置（原始配置值，非运行时快照）',
          generatedAt: new Date().toISOString(),
        });
      }
      const packs = [];
      for (const name of readdirSync(skinsDir)) {
        const dir = join(skinsDir, name);
        if (!statSync(dir).isDirectory()) continue;
        const f = join(dir, 'skin.json');
        if (!existsSync(f)) continue;
        try {
          const pack = JSON.parse(readFileSync(f, 'utf8'));
          if (wanted && pack.packId !== wanted) continue;
          packs.push(packTokens(pack, hostIds));
        } catch (e) {
          sdk.logger.warn('tokens: 包解析失败 ' + name + ' ' + e.message);
        }
      }
      return c.json({
        ok: true,
        version: 1,
        source: 'pack-config',
        note: '原始配置值（写入主题 CSS 的值），非运行时快照；字段只增不改语义，破坏性变更升 version',
        generatedAt: new Date().toISOString(),
        packs,
      });
    });

    // 视频 → 动态壁纸（本地 ffmpeg + Pillow，零网络）。body = 视频原始字节。
    // 产出入 animated WebP（data URI）+ poster；超过 5MB 硬上限时自动降档重试，仍超则拒绝。
    const resolveTool = (candidates, probeArgs) => {
      for (const p of candidates) {
        try { execFileSync(p, probeArgs, { timeout: 8000, stdio: 'ignore' }); return p; } catch { /* 下一个 */ }
      }
      return null;
    };
    let _ffmpeg = null, _ffprobe = null, _python = null;
    function ensureTools() {
      if (_ffmpeg !== null && _python !== null) return;
      const envFfmpeg = process.env.HANA_FFMPEG || null;
      _ffmpeg = resolveTool([envFfmpeg, 'ffmpeg', 'W:\\Games\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe'].filter(Boolean), ['-version']);
      _ffprobe = _ffmpeg ? _ffmpeg.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1') : null;
      // 注意：python 只认 --version，单杠 -version 是非法参数会被误判「找不到」（0.7.7 实锤）
      const envPy = process.env.HANA_PYTHON || null;
      _python = resolveTool([envPy, 'python', 'py', 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python312\\python.exe'].filter(Boolean), ['--version']);
    }

    // 任务制：POST 收视频后立刻返回 jobId，转换在后台异步跑（不阻塞后端）；
    // 前端轮询 GET /wallpaper/job?id= 拿阶段进度。execFileSync 会独占事件循环，
    // 转换期间任何请求都答不了，所以异步段全部用 execFile Promise。
    const wpJobs = new Map(); // id → { id, stage, message, result, error, at }
    const wpJobGc = () => {
      const now = Date.now();
      for (const [id, j] of wpJobs) {
        if (now - j.at > 30 * 60 * 1000) {
          if (j.tmp) { try { rmSync(j.tmp, { recursive: true, force: true }); } catch { /* 清不掉算了 */ } }
          wpJobs.delete(id);
        }
      }
    };
    const runCmd = (cmd, args, timeoutMs) => new Promise((resolve, reject) => {
      execFile(cmd, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
        (err, stdout) => { if (err) reject(err); else resolve(String(stdout || '')); });
    });

    async function runWallpaperJob(job, opts) {
      const tmp = job.tmp;
      try {
        const inputPath = join(tmp, 'input.bin');

        job.stage = 'probe';
        job.message = '读取视频信息…';
        let duration = 0;
        try {
          const out = await runCmd(_ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', inputPath], 30000);
          duration = parseFloat(out.trim()) || 0;
        } catch { duration = 0; }
        const dur = duration > 0 ? Math.min(opts.dur, duration) : opts.dur;

        const ladder = [{ w: opts.width, f: opts.fps, q: opts.quality }];
        { let w = opts.width, f = opts.fps, qq = opts.quality;
          for (let i = 0; i < 3; i++) { qq -= 8; if (qq < 28) { qq = 40; w = Math.max(560, w - 96); f = Math.max(6, f - 2); } ladder.push({ w, f, q: qq }); } }

        let result = null, lastUri = 0;
        for (let i = 0; i < ladder.length; i++) {
          const L = ladder[i];
          job.stage = 'extract';
          job.message = '抽帧中（' + L.w + ' 宽 / ' + L.f + 'fps，第 ' + (i + 1) + ' 档）…';
          const framesDir = join(tmp, 'frames');
          rmSync(framesDir, { recursive: true, force: true });
          mkdirSync(framesDir, { recursive: true });
          await runCmd(_ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error',
            '-ss', String(opts.start), '-t', String(dur), '-i', inputPath,
            '-vf', 'scale=' + L.w + ':-2,fps=' + L.f, '-q:v', '2',
            join(framesDir, 'f%03d.png')], 120000);
          const framesN = readdirSync(framesDir).length;
          if (framesN < 2) throw new Error('抽帧失败：只出 ' + framesN + ' 帧（视频太短或格式读不了）');
          job.stage = 'encode';
          job.message = '编码 WebP（q' + L.q + '，' + (framesN + opts.dissolve) + ' 帧，这一步最慢）…';
          const webpPath = join(tmp, 'out.webp');
          const posterPath = join(tmp, 'poster.jpg');
          await runCmd(_python, [join(APP_ROOT, 'assets', 'wallpaper', 'webp_loop.py'),
            framesDir, webpPath, posterPath, String(opts.dissolve), String(L.q), String(L.f)], 180000);
          const webpBuf = readFileSync(webpPath);
          lastUri = Math.ceil(webpBuf.length * 4 / 3);
          result = { webpBuf, posterPath, L, frames: framesN };
          if (lastUri <= 5 * 1024 * 1024) break;
          job.message = '第 ' + (i + 1) + ' 档超限（' + (lastUri / 1048576).toFixed(1) + ' MB），自动降档重试…';
        }
        if (!result || lastUri > 5 * 1024 * 1024) {
          throw new Error('压缩后仍超 5MB（' + (lastUri / 1048576).toFixed(2) + ' MB），请用更短的片段');
        }

        job.stage = 'meta';
        job.message = '生成预览与尺寸…';
        let w = 0, h = 0;
        try {
          // 注意：ffprobe 读 WebP 容器在部分构建下不可靠（读出 NaN → 0×0），
          // poster.jpg 与成片同尺寸且 JPEG 探测万无一失（0.7.9 实测 0×0 教训）
          const out = await runCmd(_ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', posterPath], 30000);
          const dims = out.trim().split(',').map(Number);
          w = dims[0] || 0; h = dims[1] || 0;
        } catch { /* 尺寸拿不到就算了 */ }

        const asset = 'data:image/webp;base64,' + result.webpBuf.toString('base64');
        const poster = 'data:image/jpeg;base64,' + readFileSync(result.posterPath).toString('base64');
        job.stage = 'done';
        job.message = '完成';
        job.result = { asset, poster, width: w, height: h, frames: result.frames, fps: result.L.f, uriBytes: lastUri };
      } catch (e) {
        job.stage = 'error';
        job.message = '失败';
        job.error = (e && e.message) ? e.message : String(e);
      } finally {
        if (tmp) { try { rmSync(tmp, { recursive: true, force: true }); } catch { /* 清不掉算了 */ } }
      }
    }

    // 分块三段式（实测决定）：宿主代理对大请求体会挂起不回（0.7.6：20MB 整块卡死 2 分钟）。
    // 开任务后前端按 2MB 一块 POST /wallpaper/chunk 追加，最后 finalize 开跑。
    app.post('/wallpaper/from-video', async (c) => {
      try {
        ensureTools();
        if (!_ffmpeg || !_ffprobe || !_python) {
          return c.json({ ok: false, error: '本机找不到 ffmpeg / python（视频转换需要它们装好并在 PATH 或默认位置）' }, 500);
        }
        const q = { get: (k) => c.req.query(k) }; // c.req.query 是方法不是对象，包一层兼容 q.get 写法
        const clamp = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
        const size = Number(q.get('size')) || 0;
        if (size > 256 * 1024 * 1024) return c.json({ ok: false, error: '视频超过 256MB 上限，请先裁剪' }, 413);
        wpJobGc();
        const jobId = 'wp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const tmp = join(dataDir, 'tmp', 'wp-' + jobId);
        mkdirSync(tmp, { recursive: true });
        const job = { id: jobId, stage: 'uploading', message: '传输视频中…', at: Date.now(), result: null, error: null,
          tmp, received: 0, size,
          opts: {
            width: clamp(q.get('width'), 480, 1920, 800),
            fps: clamp(q.get('fps'), 4, 24, 10),
            quality: clamp(q.get('quality'), 28, 80, 42),
            dissolve: clamp(q.get('dissolve'), 0, 16, 8),
            dur: clamp(q.get('dur'), 2, 20, 10),
            start: Math.max(0, Number(q.get('start')) || 0),
          } };
        wpJobs.set(jobId, job);
        return c.json({ ok: true, jobId });
      } catch (e) {
        return c.json({ ok: false, error: '开任务失败：' + e.message }, 500);
      }
    });

    app.post('/wallpaper/chunk', async (c) => {
      try {
        const job = wpJobs.get(c.req.query('id') || '');
        if (!job) return c.json({ ok: false, error: '任务不存在或已过期' }, 404);
        if (job.stage !== 'uploading') return c.json({ ok: false, error: '任务已不在传输阶段' }, 409);
        const offset = Number(c.req.query('offset')) || 0;
        const body = await c.req.arrayBuffer();
        if (!body || !body.byteLength) return c.json({ ok: false, error: '空块' }, 400);
        if (body.byteLength > 8 * 1024 * 1024) return c.json({ ok: false, error: '单块超 8MB' }, 413);
        if (offset !== job.received) return c.json({ ok: false, error: '块序不连续（期望 offset ' + job.received + '，收到 ' + offset + '）' }, 409);
        appendFileSync(join(job.tmp, 'input.bin'), Buffer.from(body));
        job.received += body.byteLength;
        const pct = job.size > 0 ? Math.round((job.received / job.size) * 100) : '?';
        job.message = '传输视频中 ' + pct + '%…';
        return c.json({ ok: true, received: job.received });
      } catch (e) {
        return c.json({ ok: false, error: '写块失败：' + e.message }, 500);
      }
    });

    app.post('/wallpaper/finalize', async (c) => {
      try {
        const job = wpJobs.get(c.req.query('id') || '');
        if (!job) return c.json({ ok: false, error: '任务不存在或已过期' }, 404);
        if (job.stage !== 'uploading') return c.json({ ok: false, error: '任务已不在传输阶段' }, 409);
        if (job.received < 1024) return c.json({ ok: false, error: '没收到视频数据' }, 400);
        job.stage = 'queued';
        job.message = '排队转换…';
        runWallpaperJob(job, job.opts); // 不 await：后台跑
        return c.json({ ok: true });
      } catch (e) {
        return c.json({ ok: false, error: '启动转换失败：' + e.message }, 500);
      }
    });

    app.get('/wallpaper/job', (c) => {
      const job = wpJobs.get(c.req.query('id') || '');
      if (!job) return c.json({ ok: false, error: '任务不存在或已过期' }, 404);
      return c.json({ ok: true, stage: job.stage, message: job.message,
        elapsed: Math.round((Date.now() - job.at) / 1000), result: job.result, error: job.error });
    });
  });

  /* ── 主题 Tokens（只读导出，给其他插件消费）──
     契约 v1（2026-11-13，源自群友意见书）：
     - 只读、带版本号；source: "pack-config" = 写入主题 CSS 的原始配置值，非运行时快照
     - 颜色 / 字体 / 圆角为核心字段；背景只给元数据不带位图；材质可选
     - 稳定契约：字段只增不改语义；破坏性变更升 version
     - 消费方式：GET /api/apps/skin-wardrobe/routes/tokens[?packId=xxx]
     - v1.1（2026-11-14）：新增 ?themeId= 反查（入参、响应字段均为增量）；
       运行时「当前主题」不由本接口提供——宿主已把它写在根元素 data-theme 属性上，
       同文档插件直接 documentElement.getAttribute('data-theme') 读取，再拿 id 来本接口查配置 */
  function packTokens(pack, hostIds) {
    const t = pack.theme || {};
    const variants = Array.isArray(t.variants) ? t.variants : null;
    const pick = (colors) => {
      if (!colors || typeof colors !== 'object') return null;
      const get = (k) => (typeof colors[k] === 'string' ? colors[k] : null);
      return {
        colors: { ...colors },
        fonts: { ui: get('--font-ui'), serif: get('--font-serif'), mono: get('--font-mono') },
        radius: {
          input: get('--radius-input'), card: get('--radius-card'),
          chatCard: get('--radius-chat-card'), chatSurface: get('--radius-chat-surface'),
        },
      };
    };
    const bgMeta = (bg) => (bg ? {
      hasImage: !!(bg.asset || bg.dataUri),
      motion: (bg.motion && bg.motion.mode) || 'none',
      fit: bg.fit || null,
      position: bg.position || null,
      panelAlpha: typeof bg.panelAlpha === 'number' ? bg.panelAlpha : null,
      cardAlpha: typeof bg.cardAlpha === 'number' ? bg.cardAlpha : null,
    } : null);
    const materialOf = (m) => (m ? {
      tier: m.tier || m.material || null,
      rim: typeof m.rim === 'number' ? m.rim : null,
      blur: typeof m.blur === 'number' ? m.blur : null,
      edge: typeof m.edge === 'string' ? m.edge : null,
    } : null);
    const one = (appearance, colors, background, material) => ({
      appearance,
      ...pick(colors),
      background: bgMeta(background),
      material: materialOf(material),
    });

    let appearances;
    if (variants) {
      appearances = variants
        .filter((v) => v && (v.appearance === 'light' || v.appearance === 'dark'))
        .map((v) => one(v.appearance, v.colors, v.background, v.material));
    } else {
      appearances = [one(t.appearance === 'light' ? 'light' : 'dark', t.colors, t.background, t.material)];
    }

    const pid = pack.packId;
    const ids = variants
      ? ['hana-' + pid + '-dark', 'hana-' + pid + '-light']
      : ['hana-' + pid];
    return {
      schema: pack.schema || null,
      skinId: pid,
      names: pack.names || {},
      tags: pack.tags || [],
      group: pack.group || '',
      installed: hostIds ? ids.some((id) => hostIds.has(id)) : null,
      adaptive: (t.adaptive && t.adaptive.mode) || 'manual',
      appearances,
    };
  }

  /* ── 跨 App 应用主题通道（app:skin-wardrobe/apply-theme）──
     契约 v1（2026-11-14）：
     - 调用：bus.requestService('app:skin-wardrobe/apply-theme', { themeId })
       调用方 App 需持 app/services.call capability；本 App 持 app/services.provide（manifest 已声明）
     - payload: { themeId: string }——宿主注册表里已注册的主题 id（双套带 -dark/-light 后缀，内置如 warm-paper）
     - 返回: { ok, themeId, caller, effectiveAfterRestart, output? } / { ok:false, themeId, caller, error }
     - 行为: 校验 id 已注册 → 备份 user/preferences.json → 写 appearance.theme → 立即执行（不进待办队列、不碰注册表）
     - 生效时机: 重启 Hana；callerAppId 由宿主盖章（不可伪造）并记入衣橱日志
     - 运行时当前主题读取: 宿主根元素 data-theme 属性（见 /tokens 契约注释） */
  await sdk.bus.handle('apply-theme', async (payload, ctx) => {
    const themeId = payload && typeof payload === 'object' ? String(payload.themeId || '') : '';
    if (!/^[A-Za-z0-9_.-]+$/.test(themeId)) {
      return { ok: false, error: 'themeId 非法（只允许字母数字 _ . -）' };
    }
    const r = await runApplyTheme(themeId);
    try { sdk.logger.info('apply-theme: caller=' + (ctx && ctx.callerAppId) + ' theme=' + themeId + ' ok=' + r.ok); } catch { /* 日志不可用就算了 */ }
    return r.ok
      ? { ok: true, themeId, caller: ctx && ctx.callerAppId, effectiveAfterRestart: true, output: r.output.slice(-400) }
      : { ok: false, themeId, caller: ctx && ctx.callerAppId, error: r.output.slice(-400) };
  }, { allowCrossApp: true });

  /* ── 跨 App 清单通道（app:skin-wardrobe/list-themes）──
     契约 v1（2026-11-21）：
     - 调用：bus.requestService('app:skin-wardrobe/list-themes')，payload 可省
       调用方 App 需持 app/services.call；本 App 持 app/services.provide
     - 返回: { ok, current, themes: [{ id, packId, name, appearance, accent, bg, enabled, current }] }
     - 语义: 一条一个主题 id；双套包拆成 -dark / -light 两条；
             enabled 取宿主注册表真值，读不到为 null（调用方别当成「没装」）；
             accent / bg 只是画菜单够用的两个色，全量配色仍走宿主 theme.css
     - 只读: 不写偏好、不碰注册表、不进待办
     数据源：app-data/skin-wardrobe/skins/<packId>/skin.json + 宿主注册表 + user/preferences.json */
  await sdk.bus.handle('list-themes', async () => {
    try {
      const packs = [];
      for (const dirName of readdirSync(skinsDir)) {
        const dir = join(skinsDir, dirName);
        try {
          if (!statSync(dir).isDirectory()) continue;
          const f = join(dir, 'skin.json');
          if (!existsSync(f)) continue;
          const pack = JSON.parse(readFileSync(f, 'utf8'));
          packs.push({ packId: pack.packId || dirName, pack });
        } catch (e) {
          // 一个包坏了不拖累整张清单
          sdk.logger.warn('list-themes: 跳过 ' + dirName + ' ' + e.message);
        }
      }
      const report = await runReport();
      const hostThemeIds = report && report.ok && Array.isArray(report.themes) ? new Set(report.themes) : null;
      const currentTheme = (report && report.current) || null;
      const inv = buildThemeInventory({ packs, hostThemeIds, currentTheme });
      try { sdk.logger.info('list-themes: ' + inv.themes.length + ' 条'); } catch { /* 日志不可用就算了 */ }
      return { ok: true, ...inv };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }, { allowCrossApp: true });

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
    name: 'wardrobe_apply_theme',
    description: '应用一个已注册的宿主主题（切换外观）。themeId 如 hana-miku-dark / warm-paper；双套包带 -dark/-light 后缀。重启 Hana 后生效。',
    parameters: {
      type: 'object',
      properties: { themeId: { type: 'string', description: '已注册的主题 id' } },
      required: ['themeId'],
    },
    execute: async (args) => {
      const themeId = String((args && args.themeId) || '');
      if (!/^[A-Za-z0-9_.-]+$/.test(themeId)) return { content: [{ type: 'text', text: 'themeId 非法（只允许字母数字 _ . -）' }] };
      const r = await runApplyTheme(themeId);
      return { content: [{ type: 'text', text: (r.ok ? '已应用 ' : '应用失败：') + themeId + '\n' + r.output }] };
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

  await sdk.tools.register({
    name: 'wardrobe_execute',
    description: '执行衣橱待办：读 pending 队列 → 运行内置补丁执行器写宿主注册表 → 标记完成。需要 app/process.spawn 已授权。',
    parameters: { type: 'object', properties: {} },
    execute: async () => {
      const r = await runExecutor();
      return { content: [{ type: 'text', text: r.output }] };
    },
  });

  await sdk.logger.info('skin-wardrobe v2 后端就绪，库存 ' + listSkins().length + ' 个');
});
