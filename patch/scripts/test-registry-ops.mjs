/**
 * test-registry-ops.mjs —— 注册表增删的单元测试（不碰真实文件）
 *
 * 核心判据：对同一主题「删掉再加回来」，三处文件必须**逐字节还原**。
 * 能还原 = 增删是精确的、对称的、没留下多余逗号或空白。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HANA = join(homedir(), '.hanako');
const target = JSON.parse(readFileSync(join(HANA, 'artifacts', 'desktop-target.json'), 'utf8')).current;
const rd = target.renderer.versionDir;
const sd = target.server.versionDir;

let bundleName = null;
for (const n of readdirSync(join(rd, 'assets'))) {
  if (!n.endsWith('.js')) continue;
  const t = readFileSync(join(rd, 'assets', n), 'utf8');
  if (t.includes('cssPath:') && t.includes('themes/')) { bundleName = n; break; }
}

const TARGETS = [
  { label: 'renderer/lib/theme.js', path: join(rd, 'lib', 'theme.js') },
  ...(bundleName ? [{ label: 'assets/' + bundleName, path: join(rd, 'assets', bundleName) }] : []),
  { label: 'server/bundle/index.js', path: join(sd, 'bundle', 'index.js') },
];

/* ── 与 registry-ops 相同的原语 ── */
function matchBrace(text, openIdx) {
  let depth = 0, inStr = false, esc = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
    else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function scanEntries(text) {
  const re = /(?:"([a-zA-Z0-9_.-]+)"|([a-zA-Z][a-zA-Z0-9_-]*))\s*:\s*\{\s*cssPath\s*:/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const id = m[1] || m[2];
    const openIdx = text.indexOf('{', m.index + m[0].length - 1);
    const end = matchBrace(text, openIdx);
    if (end < 0) continue;
    out.push({ id, keyStart: m.index, valStart: openIdx, valEnd: end + 1 });
  }
  return out;
}

function removalRange(text, r) {
  let p = r.keyStart - 1;
  while (p >= 0 && /\s/.test(text[p])) p--;
  if (p >= 0 && text[p] === ',') return { start: p, end: r.valEnd };
  let q = r.valEnd;
  while (q < text.length && /\s/.test(text[q])) q++;
  if (q < text.length && text[q] === ',') return { start: r.keyStart, end: q + 1 };
  return { start: r.keyStart, end: r.valEnd };
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
};

const ID = 'hana-luna';

for (const t of TARGETS) {
  console.log('\n=== ' + t.label + ' ===');
  const original = readFileSync(t.path, 'utf8');
  const entries = scanEntries(original);
  console.log('  条目数: ' + entries.length);

  const e = entries.find((x) => x.id === ID);
  if (!e) { check('找到 ' + ID, false); continue; }

  // 1. 删除
  const r = removalRange(original, e);
  const removedText = original.slice(0, r.start) + original.slice(r.end);
  const afterRemove = scanEntries(removedText);
  check('删除后条目数 -1', afterRemove.length === entries.length - 1,
    entries.length + ' -> ' + afterRemove.length);
  check('删除后不再含 ' + ID, !afterRemove.some((x) => x.id === ID));
  check('删除后其他 id 顺序不变',
    JSON.stringify(afterRemove.map((x) => x.id)) ===
    JSON.stringify(entries.filter((x) => x.id !== ID).map((x) => x.id)));

  // 2. 加回来（用原条目文本，保证逐字节对称）
  const entryText = original.slice(e.keyStart, e.valEnd);
  // 删除范围可能含前导逗号，加回时补上同样的分隔符
  const leadingComma = original[r.start] === ',';
  const restore = leadingComma ? ',' + entryText : entryText + ',';
  const restoredText = leadingComma
    ? removedText.slice(0, r.start) + restore + removedText.slice(r.start)
    : removedText.slice(0, r.start) + restore + removedText.slice(r.start);

  const afterRestore = scanEntries(restoredText);
  check('加回后条目数复原', afterRestore.length === entries.length,
    afterRestore.length + ' vs ' + entries.length);
  check('加回后逐字节还原', restoredText === original,
    restoredText === original ? '' : '长度 ' + restoredText.length + ' vs ' + original.length);

  // 3. 结构完整性：删掉一个后仍能被 node 求值
  const objStart = original.lastIndexOf('{', e.keyStart);
  check('删除未破坏相邻条目', afterRemove.length > 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
