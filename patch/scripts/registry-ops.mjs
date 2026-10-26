/**
 * registry-ops.mjs —— 主题注册表的增 / 删 / 查
 *
 * 为什么不用 JSON 解析再序列化：注册表嵌在压缩后的 JS 里，属性名有的带引号有的不带
 * （`coral:{...}` 与 `"hana-luna":{...}` 并存），重新序列化必然改变原文件字节。
 *
 * 为什么不靠 `themes:{` 定位：三处注册表的对象变量名各不相同
 * （theme.js 是 `themes:`，renderer bundle 是 `w=`，server bundle 又是另一个）。
 * 所以统一改用「扫描所有带 cssPath 的条目」来定位。
 *
 * 用法：
 *   node registry-ops.mjs list
 *   node registry-ops.mjs remove --id hana-luna [--apply]
 *   node registry-ops.mjs add --id hana-luna --spec '{"cssPath":"themes/x.css",...}' [--apply]
 */
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const HANA = join(homedir(), '.hanako');

function versionDirs() {
  const target = JSON.parse(readFileSync(join(HANA, 'artifacts', 'desktop-target.json'), 'utf8')).current;
  return { renderer: target.renderer.versionDir, server: target.server.versionDir };
}

function registryTargets() {
  const { renderer: rd, server: sd } = versionDirs();
  let bundleName = null;
  for (const name of readdirSync(join(rd, 'assets'))) {
    if (!name.endsWith('.js')) continue;
    const t = readFileSync(join(rd, 'assets', name), 'utf8');
    if (t.includes('cssPath:') && t.includes('themes/')) { bundleName = name; break; }
  }
  return [
    { label: 'renderer/lib/theme.js', path: join(rd, 'lib', 'theme.js') },
    ...(bundleName ? [{ label: 'renderer/assets/' + bundleName, path: join(rd, 'assets', bundleName) }] : []),
    { label: 'server/bundle/index.js', path: join(sd, 'bundle', 'index.js') },
  ];
}

/** 写前语法闸：把待写入的文本交给 node --check，解析不了就不落盘。
 *  这是补「逐字节还原」测试的盲区：自洽不等于正确。
 *  历史上就是因为插入点算错、只数了条目数，把压缩 bundle 写坏导致宿主起不来。 */
function syntaxOk(text) {
  const tmp = join(tmpdir(), 'reg-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.mjs');
  try {
    writeFileSync(tmp, text, 'utf8');
    const r = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
    return { ok: r.status === 0, err: (r.stderr || '').split('\n').slice(0, 5).join('\n') };
  } catch (e) {
    return { ok: false, err: e.message };
  } finally {
    try { unlinkSync(tmp); } catch { /* 清理失败不阻塞 */ }
  }
}

/** 从 `{` 开始做花括号配对（跳过字符串与转义），返回结束下标（含）。 */
function matchBrace(text, openIdx) {
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/** 扫描全部主题条目：{ id, keyStart, valStart, valEnd } */
function scanEntries(text) {
  const re = /(?:"([a-zA-Z0-9_.-]+)"|([a-zA-Z][a-zA-Z0-9_-]*))\s*:\s*\{\s*cssPath\s*:/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1] || m[2];
    // 匹配串自身已包含那个左花括号（`name:{cssPath:`），
    // 所以必须从 m.index 往后找，不能从 m[0] 末尾找——否则会跳到下一个对象。
    const braceAt = m.index + m[0].lastIndexOf('{');
    if (text[braceAt] !== '{') continue;
    const end = matchBrace(text, braceAt);
    if (end < 0) continue;
    out.push({ id, keyStart: m.index, valStart: braceAt, valEnd: end + 1 });
  }
  return out;
}

function findEntry(text, id) {
  return scanEntries(text).find((e) => e.id === id) || null;
}

/** 删除范围：连带一侧逗号，避免留下悬空分隔符 */
function removalRange(text, r) {
  let p = r.keyStart - 1;
  while (p >= 0 && /\s/.test(text[p])) p--;
  if (p >= 0 && text[p] === ',') return { start: p, end: r.valEnd };
  let q = r.valEnd;
  while (q < text.length && /\s/.test(text[q])) q++;
  if (q < text.length && text[q] === ',') return { start: r.keyStart, end: q + 1 };
  return { start: r.keyStart, end: r.valEnd };
}

const argv = process.argv.slice(2);
const action = argv[0] || 'list';
const getArg = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
const APPLY = argv.includes('--apply');
const id = getArg('id');
const targets = registryTargets();

if (action === 'list') {
  for (const t of targets) {
    const entries = scanEntries(readFileSync(t.path, 'utf8'));
    console.log(`${t.label}: ${entries.length} 项`);
    console.log('   ' + entries.map((e) => e.id).join(', '));
  }
  process.exit(0);
}

if (action === 'remove') {
  if (!id) { console.error('缺少 --id'); process.exit(2); }
  let ok = 0;
  for (const t of targets) {
    const text = readFileSync(t.path, 'utf8');
    const e = findEntry(text, id);
    if (!e) { console.log(`${t.label}: 无 ${id}`); continue; }
    const r = removalRange(text, e);
    const after = text.slice(0, r.start) + text.slice(r.end);
    const nBefore = scanEntries(text).length;
    const nAfter = scanEntries(after).length;
    if (nAfter !== nBefore - 1) { console.log(`${t.label}: 计数异常 ${nBefore} -> ${nAfter}，放弃`); continue; }
    const gate = syntaxOk(after);
    if (!gate.ok) { console.log(`${t.label}: 删除后语法不合格，拒绝写入\n${gate.err}`); continue; }
    console.log(`${t.label}: 移除 ${id}（${nBefore} -> ${nAfter}）${APPLY ? ' 已写入' : ' [干跑]'}`);
    if (APPLY) { writeFileSync(t.path, after, 'utf8'); ok++; }
  }
  process.exit(APPLY && ok !== targets.length ? 1 : 0);
}

if (action === 'add') {
  if (!id) { console.error('缺少 --id'); process.exit(2); }
  const specRaw = getArg('spec');
  if (!specRaw) { console.error('缺少 --spec'); process.exit(2); }
  const spec = JSON.parse(specRaw);

  for (const t of targets) {
    const text = readFileSync(t.path, 'utf8');
    if (findEntry(text, id)) { console.log(`${t.label}: 已存在 ${id}`); continue; }
    const entries = scanEntries(text);
    if (!entries.length) { console.log(`${t.label}: 找不到任何主题条目，跳过`); continue; }

    const compact = /cssPath:"/.test(text);
    const entry = compact
      ? `,"${id}":{` + Object.entries(spec).map(([k, v]) => `${k}:"${v}"`).join(',') + '}'
      : `, "${id}": { ` + Object.entries(spec).map(([k, v]) => `${k}: "${v}"`).join(', ') + ' }';

    // 插到最后一条之后（而不是对象闭合前）——不依赖对象边界
    const last = entries[entries.length - 1];
    const at = last.valEnd;
    const after = text.slice(0, at) + entry + text.slice(at);
    const nAfter = scanEntries(after).length;
    if (nAfter !== entries.length + 1) { console.log(`${t.label}: 计数异常 ${entries.length} -> ${nAfter}，放弃`); continue; }
    const gate = syntaxOk(after);
    if (!gate.ok) { console.log(`${t.label}: 插入后语法不合格，拒绝写入\n${gate.err}`); continue; }
    // 新条目必须真的落在注册表对象里：它的结束位置要早于原 themes 对象的闭合
    console.log(`${t.label}: 插入 ${id}（${entries.length} -> ${nAfter}）${APPLY ? ' 已写入' : ' [干跑]'}`);
    if (APPLY) writeFileSync(t.path, after, 'utf8');
  }
  process.exit(0);
}

console.error('未知动作：' + action);
process.exit(2);
