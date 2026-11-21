import { hana } from './sdk.js';
import {
  BASE_COLORS, PRESETS, hex2rgb, toHex, shade, luminance, deriveColors,
  SCHEMA_V3, IMG_MAX_BYTES, PACK_MAX_BYTES, ANIMATED_EXT, VIDEO_EXT,
  checkImageFile, checkPackBudget, validateSkinPack,
  deriveKeyColors, buildVariant, buildBgPreviewDescriptor, fmtMB,
} from './skinpack.mjs';

/**
 * 衣橱 · 皮肤库 —— 前端
 *
 * 数据来自 App 自己的后端路由（/api/apps/skin-wardrobe/routes/*），
 * 库存落在 app-data，宿主注册表的改动由 agent 执行（App 无权写 artifacts）。
 *
 * 踩坑备忘：
 *   - window.confirm 在 App iframe 里被沙箱拦掉、静默返回 false，所以删除用二次点击
 *   - 不写 :root，样式作用域留在面板内
 */

const API = '/api/apps/skin-wardrobe/routes';
const BUILD = 'lib-23';

/** 纯衣架（品牌符号）：横杆铜色固定，线条取当前文字色 */
function hangerSVG(size, strokeColor, barColor) {
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 64 64" fill="none">'
    + '<g stroke="' + (strokeColor || 'currentColor') + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">'
    + '<circle cx="32" cy="12" r="3.2"/><path d="M32 15 L32 17"/>'
    + '<path d="M32 17 L32 32"/>'
    + '<path d="M32 32 C20 32 14 40 14 48 L50 48 C50 40 44 32 32 32 Z"/>'
    + '</g>'
    + '<line x1="14" y1="48" x2="50" y2="48" stroke="' + (barColor || '#9C6B3F') + '" stroke-width="3" stroke-linecap="round"/>'
    + '</svg>';
}

const el = {
  status: document.getElementById('status'),
  search: document.getElementById('search'),
  importBtn: document.getElementById('import'),
  file: document.getElementById('file'),
  groups: document.getElementById('groups'),
  onlyFav: document.getElementById('only-fav'),
  wall: document.getElementById('wall'),
  counts: document.getElementById('counts'),
  pending: document.getElementById('pending'),
  execute: document.getElementById('execute'),
};

/* ── 界面主题（卡片自身，独立于皮肤包）──────────────────────────
   auto = 不设 data-ui，沿用宿主主题变量（原来的行为）
   light / dark = 在 <body> 上挂 data-ui，覆盖宿主 token（见 panel.css 尾部）
   选择存 localStorage，不写宿主设置、不影响皮肤包。 */
const UI_THEME_KEY = 'wardrobe-ui-theme';
const UI_MODES = ['auto', 'light', 'dark'];
const UI_LABEL = { auto: '跟随宿主', light: '亮色', dark: '暗色' };
const uiThemeBtn = document.getElementById('ui-theme');
// 沙箱 iframe 里 localStorage 可能直接抛 SecurityError；一旦抛出会拖垮整个面板，所以包一层
function uiReadStored() {
  try { return localStorage.getItem(UI_THEME_KEY); } catch { return null; }
}
function uiWriteStored(mode) {
  try { localStorage.setItem(UI_THEME_KEY, mode); } catch { /* 存不了就只在本会话生效 */ }
}
let uiMode = uiReadStored() || 'auto';
if (!UI_MODES.includes(uiMode)) uiMode = 'auto';
// 调试/截图用：?ui=light / ?ui=dark / ?ui=auto 临时覆盖，不写回 localStorage
const uiOverride = new URLSearchParams(location.search).get('ui');
const uiPinned = UI_MODES.includes(uiOverride || '') ? uiOverride : null;
if (uiPinned) uiMode = uiPinned;

function applyUiMode(mode) {
  const host = document.body;
  if (mode === 'auto') host.removeAttribute('data-ui');
  else host.setAttribute('data-ui', mode);
  if (!uiPinned) uiWriteStored(mode);
  if (uiThemeBtn) {
    const label = '界面主题：' + UI_LABEL[mode];
    uiThemeBtn.title = label;
    uiThemeBtn.setAttribute('aria-label', label);
  }
  uiMode = mode;
}

applyUiMode(uiMode);
if (uiThemeBtn) {
  uiThemeBtn.addEventListener('click', () => {
    const next = UI_MODES[(UI_MODES.indexOf(uiMode) + 1) % UI_MODES.length];
    applyUiMode(next);
  });
}

/* ── 跟随宿主主题 ──
   颜色来自宿主下发的那张 CSS（panel.html 的 head 脚本先把首帧挂上了）。
   宿主动态换主题时，把 <link> 的地址换掉就行；手动选了 light/dark 时，
   body[data-ui] 那套覆盖依旧盖在上面，这里不影响。 */
function applyHostThemeUrl(snapshot) {
  const link = document.getElementById('host-theme');
  if (!link || !snapshot) return;
  const ap = snapshot.appearance === 'light' || snapshot.appearance === 'dark' ? snapshot.appearance : '';
  const palette = ap && snapshot.palettes && snapshot.palettes[ap] ? snapshot.palettes[ap].cssUrl : '';
  const url = palette || snapshot.cssUrl;
  if (!url) return;
  if (link.getAttribute('href') !== url) link.setAttribute('href', url);
}
try {
  hana.ready?.();
  hana.theme?.subscribe?.(applyHostThemeUrl);
} catch { /* 没有主题通道就只用首帧那张表 */ }

const state = {
  skins: [],
  pending: [],
  query: '',
  group: '',
  onlyFav: false,
  /** 待提交的待办：packId -> op，避免连点产生一堆重复 */
  inflight: new Set(),
};

/* ── HTTP ──
   必须走 hana.api.fetch：它会带上宿主给这个 surface 的凭证。
   用原生 fetch 打 /api/apps/... 会被判 forbidden（实测踩过）。 */
async function api(method, path, body) {
  const qs = new URLSearchParams(window.location.search);
  const hasSess = qs.has('appSurfaceSession');
  const isRaw = body instanceof ArrayBuffer || body instanceof Uint8Array;
  let res;
  try {
    res = await hana.api.fetch(path, {
      method,
      headers: body ? { 'content-type': isRaw ? 'application/octet-stream' : 'application/json' } : undefined,
      body: body ? (isRaw ? body : JSON.stringify(body)) : undefined,
    });
  } catch (e) {
    // 诊断：把 surface 凭证的有无直接摊在状态栏上
    setStatus(`fetch 抛错：${e.message} · session=${hasSess ? '有' : '无'} · path=${location.pathname}`);
    throw e;
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 90); } catch (_) { /* 无正文 */ }
    setStatus(`HTTP ${res.status} ${detail} · session=${hasSess ? '有' : '无'} · ${method} ${path}`);
    throw new Error('HTTP ' + res.status + (detail ? ' · ' + detail : ''));
  }
  let json = null;
  try { json = await res.json(); } catch (_) { /* 空响应 */ }
  return json;
}

/** 图片等直接用 URL 的地方，也要带凭证。 */
function apiUrl(path) {
  return hana.api.url(path);
}

/* ── 工具 ── */
const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function displayName(s) {
  return (s.names && (s.names.zh || s.names.en)) || s.packId;
}

function setStatus(text) {
  el.status.textContent = text;
}

/* ── 渲染 ── */
function visibleSkins() {
  const q = state.query.trim().toLowerCase();
  return state.skins.filter((s) => {
    if (state.onlyFav && !s.favorite) return false;
    if (state.group && (s.group || '') !== state.group) return false;
    if (!q) return true;
    const hay = [s.packId, displayName(s), (s.tags || []).join(' '), s.group || ''].join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function renderGroups() {
  const groups = [...new Set(state.skins.map((s) => s.group).filter(Boolean))].sort();
  el.groups.innerHTML = '';
  const all = document.createElement('button');
  all.className = 'chip' + (state.group === '' ? ' is-on' : '');
  all.textContent = '全部';
  all.addEventListener('click', () => { state.group = ''; render(); });
  el.groups.appendChild(all);

  for (const g of groups) {
    const b = document.createElement('button');
    b.className = 'chip' + (state.group === g ? ' is-on' : '');
    b.textContent = g;
    b.addEventListener('click', () => { state.group = g; render(); });
    el.groups.appendChild(b);
  }
}

function layerDots(s) {
  const L = [
    ['配色', true],
    ['背景', !!s.hasBackground],
    ['材质', !!s.material && s.material !== 'none'],
    ['取景框', !!s.frame && s.frame !== 'none'],
  ];
  return L.map(([label, on]) =>
    `<span class="layer-dot${on ? ' is-on' : ''}"></span>${label}`
  ).join(' &nbsp;');
}

/* ── 卡片状态：优先问宿主注册表（真相），查不到才退回待办账本（猜测）── */
function skinState(s) {
  // 宿主说装着就是装着（regardless 有没有过期的 disable 待办），
  // 说没装就是没装 —— 只有宿主不可读（hostInstalled == null）时才用账本猜。
  if (s.hostInstalled === true) return { kind: 'on', label: '停用' };
  if (s.hostInstalled === false) return { kind: 'off', label: '启用' };

  const recs = state.pending
    .filter((p) => p.packId === s.packId)
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!recs.length) return { kind: 'off', label: '启用' };
  const last = recs[0];
  if (!last.done) return { kind: 'pending', label: '已请求' };
  return last.op === 'enable'
    ? { kind: 'on', label: '停用' }
    : { kind: 'off', label: '启用' };
}

function card(s) {
  const art = document.createElement('article');
  art.className = 'skin-card' + (s.favorite ? ' is-fav' : '');
  art.dataset.packId = s.packId;

  /* 封面 */
  const cover = document.createElement('div');
  cover.className = 'cover';
  if (s.shotData) {
    const img = document.createElement('img');
    img.src = s.shotData;
    img.alt = displayName(s);
    img.addEventListener('error', () => { img.remove(); cover.appendChild(mono()); });
    cover.appendChild(img);
  } else if (s.hasShot) {
    const img = document.createElement('img');
    img.src = apiUrl(`/skins/${encodeURIComponent(s.packId)}/shot`);
    img.alt = displayName(s);
    img.addEventListener('error', () => { img.remove(); cover.appendChild(mono()); });
    cover.appendChild(img);
  } else {
    cover.appendChild(mono());
  }

  const star = document.createElement('button');
  star.className = 'star' + (s.favorite ? ' is-on' : '');
  star.title = s.favorite ? '取消收藏' : '收藏置顶';
  star.textContent = s.favorite ? '★' : '☆';
  star.addEventListener('click', () => toggleFavorite(s, star));
  cover.appendChild(star);

  const badge = document.createElement('span');
  badge.className = 'badge-appearance';
  badge.textContent = s.appearance === 'light' ? '亮色' : '暗色';
  cover.appendChild(badge);
  art.appendChild(cover);

  /* 正文 */
  const body = document.createElement('div');
  body.className = 'body';

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = displayName(s);
  name.title = s.packId;
  body.appendChild(name);

  const tags = document.createElement('div');
  tags.className = 'tags';
  for (const t of (s.tags || []).slice(0, 4)) {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = t;
    tags.appendChild(span);
  }
  body.appendChild(tags);

  const layers = document.createElement('div');
  layers.className = 'layers';
  layers.innerHTML = layerDots(s);
  body.appendChild(layers);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const st = skinState(s);
  const opBtn = document.createElement('button');
  opBtn.className = 'btn ' + (st.kind === 'on' ? 'btn-quiet' : 'btn-primary');
  opBtn.textContent = st.label;
  // 宿主真值优先：只要不是从账本猜出来的 pending，都可点。
  opBtn.disabled = (st.kind === 'pending' && s.hostInstalled == null) || state.inflight.has(s.packId);
  opBtn.title = st.kind === 'on' ? '从宿主移除这个主题' : '提交启用请求，等 agent 执行';
  opBtn.addEventListener('click', () => requestOp(s, st.kind === 'on' ? 'disable' : 'enable', opBtn));
  actions.appendChild(opBtn);

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-quiet';
  editBtn.textContent = '编辑';
  editBtn.addEventListener('click', () => editSkin(s));
  actions.appendChild(editBtn);

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-quiet';
  delBtn.textContent = '删除';
  let armed = false;
  delBtn.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      delBtn.textContent = '确认？';
      delBtn.classList.add('btn-danger');
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        delBtn.textContent = '删除';
        delBtn.classList.remove('btn-danger');
      }, 3000);
      return;
    }
    armed = false;
    await removeSkin(s);
  });
  actions.appendChild(delBtn);

  body.appendChild(actions);
  art.appendChild(body);
  return art;
}

function mono() {
  const d = document.createElement('div');
  d.className = 'mono';
  d.innerHTML = hangerSVG(44);
  return d;
}

function render() {
  renderGroups();
  const list = visibleSkins();
  el.wall.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'wall-empty';
    const t1 = document.createElement('div'); t1.className = 't1';
    const t2 = document.createElement('div'); t2.className = 't2';
    if (state.skins.length) {
      t1.textContent = '没有匹配的皮肤';
      t2.textContent = '换个关键词，或清掉筛选';
    } else {
      const h = document.createElement('div'); h.className = 'hanger';
      h.innerHTML = hangerSVG(64);
      empty.appendChild(h);
      t1.textContent = '衣橱是空的';
      t2.innerHTML = '点右上角「新建」从一张图开始，或者把 <b>.skinpack.json</b> 拖进来';
    }
    empty.appendChild(t1); empty.appendChild(t2);
    el.wall.appendChild(empty);
  } else {
    for (const s of list) el.wall.appendChild(card(s));
  }

  el.counts.textContent = `${list.length} / ${state.skins.length} 个皮肤 · ${BUILD}`;

  const open = state.pending.filter((p) => !p.done);
  if (open.length) {
    el.pending.textContent = `${open.length} 条待办 · 点「执行待办」写入宿主`;
    el.pending.classList.add('has-pending');
  } else if (state.pending.length) {
    el.pending.textContent = '上次操作已执行 · 重启 Hana 后生效';
    el.pending.classList.remove('has-pending');
  } else {
    el.pending.textContent = '';
    el.pending.classList.remove('has-pending');
  }
  if (el.execute) el.execute.hidden = !open.length;
}

/* ── 动作 ── */
async function toggleFavorite(s, btn) {
  const next = !s.favorite;
  btn.disabled = true;
  try {
    await api('POST', `/skins/${encodeURIComponent(s.packId)}/favorite`, { favorite: next });
    s.favorite = next;
    render();
  } catch (e) {
    setStatus('收藏失败：' + e.message);
    btn.disabled = false;
  }
}

async function requestOp(s, op, btn) {
  btn.disabled = true;
  btn.textContent = '提交中…';
  state.inflight.add(s.packId);
  try {
    const themeId = 'hana-' + s.packId;
    await api('POST', '/pending', { op, packId: s.packId, themeId });
    state.pending = (await api('GET', '/pending')).pending || [];
    render();
    await applyPending(null);
  } catch (e) {
    setStatus('提交失败：' + e.message);
    btn.disabled = false;
    btn.textContent = op === 'enable' ? '启用' : '停用';
  } finally {
    state.inflight.delete(s.packId);
  }
}

/** 执行待办：让 App 后端跑内置执行器，把队列写进宿主。 */
async function applyPending(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '应用中…'; }
  setStatus('正在写入宿主（生成 CSS + 改注册表）…');
  try {
    const r = await api('POST', '/execute');
    state.pending = (await api('GET', '/pending')).pending || [];
    if (r && r.ok) {
      setStatus('已应用 · 重启 Hana 后生效');
    } else {
      setStatus('执行未完成：' + String((r && r.output) || '').slice(0, 240));
    }
    render();
    return r;
  } catch (e) {
    setStatus('执行失败：' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '执行待办'; }
  }
}

async function removeSkin(s) {
  try {
    await api('DELETE', `/skins/${encodeURIComponent(s.packId)}`);
    state.skins = state.skins.filter((x) => x.packId !== s.packId);
    setStatus(`已从衣橱移除 ${displayName(s)}（宿主里的主题不受影响）`);
    render();
  } catch (e) {
    setStatus('删除失败：' + e.message);
  }
}

/* ── 导入 ──
   校验委托给 skinpack.mjs 的统一校验（v1/v2/v3 都覆盖，含动图体积与单包体积门禁）。 */
function validatePack(json) {
  const r = validateSkinPack(json);
  return { errs: r.errors, warns: r.warnings };
}

async function importFile(file) {
  setStatus(`读取 ${file.name}…`);
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const { errs, warns } = validatePack(json);
    if (errs.length) {
      setStatus(`${file.name} 校验失败：` + errs.join('；'));
      return;
    }
    const r = await api('POST', '/skins', { pack: json });
    setStatus(`${file.name} 已入库${warns.length ? '（' + warns.join('；') + '）' : ''} · 共 ${r.total} 个`);
    await loadLibrary();
  } catch (e) {
    setStatus(`导入 ${file.name} 失败：` + e.message);
  }
}

el.importBtn.addEventListener('click', () => el.file.click());
el.file.addEventListener('change', async () => {
  const f = el.file.files && el.file.files[0];
  el.file.value = '';
  if (f) await importFile(f);
});

el.search.addEventListener('input', () => {
  state.query = el.search.value;
  render();
});

el.onlyFav.addEventListener('change', () => {
  state.onlyFav = el.onlyFav.checked;
  render();
});

if (el.execute) el.execute.addEventListener('click', () => applyPending(el.execute));

/* 拖拽 */
let dragDepth = 0;
document.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
  dragDepth++;
  document.body.classList.add('is-dragover');
});
document.addEventListener('dragover', (e) => {
  if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
});
document.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('is-dragover');
});
document.addEventListener('drop', async (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('is-dragover');
  for (const f of e.dataTransfer.files) {
    if (!/\.json$/i.test(f.name)) { setStatus('只收 .json 皮肤包，收到：' + f.name); continue; }
    await importFile(f);
  }
});

/* ── 启动 ── */
async function loadLibrary() {
  const [skinsRes, pendingRes] = await Promise.all([
    api('GET', '/skins'),
    api('GET', '/pending'),
  ]);
  state.skins = skinsRes.skins || [];
  state.pending = pendingRes.pending || [];
  render();
}

  document.getElementById('c-ansi-reset').addEventListener('click', () => {
    for (const n of ANSI_NAMES) ansiValues[n] = String(BASE_COLORS['--term-ansi-' + n]).slice(0, 7);
    buildAnsiGrid();
    cn.status.textContent = '终端配色已还原基线';
  });

try {
  // 品牌衣架（标题旁）：线条用 currentColor，横杆铜
  const bh = document.getElementById('brand-hanger');
  if (bh) bh.innerHTML = hangerSVG(22);
  await loadLibrary();
  setStatus(`衣橱就绪 · ${state.skins.length} 个皮肤`);
} catch (e) {
  setStatus('启动失败：' + e.message + '（后端路由未就绪？）');
}

/* ══════════════════════════════════════════
   工作台：从零做一个新皮肤
   基座是 61 个宿主变量，用户只改四个关键色 +
   一张背景图，派生的二十来项按规则自动跟随。
   ══════════════════════════════════════════ */

/* 颜色基座 / 工具 / 派生 / 预设 已迁到 skinpack.mjs（纯函数，可单测）；此处改为 import 复用。
   下方只保留 DOM 相关的 shrinkImage / 预览 / 渲染。 */

/* ── 图片压缩：统一成 1920px 宽的 JPEG ── */
async function shrinkImage(file, maxW = 1920, quality = 0.85) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  const data = canvas.toDataURL('image/jpeg', quality);
  if (bmp.close) bmp.close();
  return { data, w, h, bytes: Math.round(data.length * 0.75) };
}

/* ── 工作台状态 ── */
const comp = {
  bg: null,        // 暗套背景 { data, w, h, bytes, mime, motion, poster }
  bgLight: null,   // 亮套背景（同上）
  shot: null,      // data URI，封面
  dual: false,     // 是否双套（暗 + 亮）
  linked: true,    // 双套联动：改一栏自动派生另一栏
  linkMode: 'same-hue', // same-hue | inverse | complement
  rimTouched: false,    // 用户手动调过 rim 否（未调则亮套用默认 0.12）
  editingIsDual: false, // 正在编辑的是否 v3 双套包
};

const cn = {
  section: document.getElementById('composer'),
  newBtn: document.getElementById('new'),
  name: document.getElementById('c-name'),
  id: document.getElementById('c-id'),
  tags: document.getElementById('c-tags'),
  group: document.getElementById('c-group'),
  bgBox: document.getElementById('c-bg-box'),
  bgInput: document.getElementById('c-bg'),
  bgPreview: document.getElementById('c-bg-preview'),
  bgClear: document.getElementById('c-bg-clear'),
  alpha: document.getElementById('c-alpha'),
  alphaVal: document.getElementById('c-alpha-val'),
  pos: document.getElementById('c-pos'),
  bgColor: document.getElementById('c-bg-color'),
  card: document.getElementById('c-card'),
  accent: document.getElementById('c-accent'),
  text: document.getElementById('c-text'),
  radius: document.getElementById('c-radius'),
  radiusVal: document.getElementById('c-radius-val'),
  rim: document.getElementById('c-rim'),
  rimVal: document.getElementById('c-rim-val'),
  blur: document.getElementById('c-blur'),
  blurVal: document.getElementById('c-blur-val'),
  fontUi: document.getElementById('c-font-ui'),
  fontSerif: document.getElementById('c-font-serif'),
  fontMono: document.getElementById('c-font-mono'),
  shot: document.getElementById('c-shot'),
  shotCanvas: document.getElementById('c-shot-canvas'),
  shotPreview: document.getElementById('c-shot-preview'),
  status: document.getElementById('c-status'),
  cancel: document.getElementById('c-cancel'),
  save: document.getElementById('c-save'),
  // ── 双套 / 亮色套 ──
  dual: document.getElementById('c-dual'),
  linked: document.getElementById('c-linked'),
  linkWrap: document.getElementById('c-link-wrap'),
  linkMode: document.getElementById('c-linkmode'),
  adaptive: document.getElementById('c-adaptive'),
  lightWrap: document.getElementById('c-light-wrap'),
  bgBoxL: document.getElementById('c-bg-box-l'),
  bgInputL: document.getElementById('c-bg-l'),
  bgPreviewL: document.getElementById('c-bg-preview-l'),
  bgClearL: document.getElementById('c-bg-clear-l'),
  alphaL: document.getElementById('c-alpha-l'),
  alphaValL: document.getElementById('c-alpha-l-val'),
  posL: document.getElementById('c-pos-l'),
  bgColorL: document.getElementById('c-bg-color-l'),
  cardL: document.getElementById('c-card-l'),
  accentL: document.getElementById('c-accent-l'),
  textL: document.getElementById('c-text-l'),
};

/* ════════════════════════════════════════════════════════════════
   v3 工作台线：双套（暗+亮）编辑 / 动图上传与预览 / 预算门禁
   ════════════════════════════════════════════════════════════════ */

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('读取失败'));
    r.readAsDataURL(file);
  });
}

async function firstFramePoster(file) {
  const bmp = await createImageBitmap(file);
  const maxW = 1920;
  const scale = Math.min(1, maxW / bmp.width);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return cv.toDataURL('image/jpeg', 0.85);
}

/** 上传背景：动图保持原格式（不重编码，否则丢动画）；静态走 shrinkImage → JPEG。 */
async function loadBackground(file, which) {
  const isLightCol = which === 'light';
  const statusPrefix = isLightCol ? '亮色套 ' : '';
  const name = (file.name || '').toLowerCase();
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot) : '';
  const mime = file.type || '';
  const isVideo = VIDEO_EXT.has(ext) || /^video\//.test(mime);
  if (isVideo) {
    cn.status.textContent = statusPrefix + '开任务…';
    try {
      const buf = await file.arrayBuffer();
      const r0 = await api('POST', '/wallpaper/from-video?size=' + buf.byteLength
        + '&dur=10&width=800&fps=10&quality=42&dissolve=8');
      if (!r0 || !r0.ok || !r0.jobId) {
        setStatus(statusPrefix + '视频转换失败：' + ((r0 && r0.error) || '未知错误'));
        return;
      }
      // 分块传输：宿主代理对大 body 会挂起（0.7.6 实测 20MB 整块卡死），2MB 一块走
      const CHUNK = 2 * 1024 * 1024;
      const total = Math.max(1, Math.ceil(buf.byteLength / CHUNK));
      for (let i = 0; i < total; i++) {
        const off = i * CHUNK;
        const piece = buf.slice(off, Math.min(buf.byteLength, off + CHUNK));
        await api('POST', '/wallpaper/chunk?id=' + encodeURIComponent(r0.jobId) + '&offset=' + off, piece);
        cn.status.textContent = statusPrefix + '传输视频 ' + Math.round(((i + 1) / total) * 100) + '%…';
      }
      await api('POST', '/wallpaper/finalize?id=' + encodeURIComponent(r0.jobId));
      // 任务制：每 0.9s 轮询进度，阶段由后端报（抽帧/编码/降档），前端补已等秒数
      const t0 = Date.now();
      let r = null;
      for (;;) {
        if (Date.now() - t0 > 6 * 60 * 1000) throw new Error('超时（6 分钟无结果）');
        await new Promise((res) => setTimeout(res, 900));
        r = await api('GET', '/wallpaper/job?id=' + encodeURIComponent(r0.jobId));
        if (!r || !r.ok) throw new Error((r && r.error) || '进度查询失败');
        const sec = Math.round((Date.now() - t0) / 1000);
        cn.status.textContent = statusPrefix + (r.message || r.stage) + '（已等 ' + sec + 's）';
        if (r.stage === 'done') break;
        if (r.stage === 'error') throw new Error(r.error || '转换失败');
      }
      const res = r.result;
      const obj = {
        data: res.asset, mime: 'image/webp', w: res.width, h: res.height,
        bytes: Math.round(res.uriBytes * 0.75), motion: 'animated-image', poster: res.poster || null,
      };
      if (isLightCol) comp.bgLight = obj; else comp.bg = obj;
      renderBgPreview(isLightCol);
      setStatus(statusPrefix + '视频已转动态壁纸：' + res.width + '×' + res.height + ' · '
        + res.frames + ' 帧 · URI ' + fmtMB(res.uriBytes) + ' · 用时 ' + Math.round((Date.now() - t0) / 1000) + 's');
    } catch (e) {
      setStatus(statusPrefix + '视频转换失败：' + e.message);
    }
    return;
  }
  const isAnimated = ANIMATED_EXT.has(ext) || mime === 'image/webp' || mime === 'image/gif' || mime === 'image/apng';
  cn.status.textContent = statusPrefix + '处理中…';
  try {
    if (isAnimated) {
      const dataUri = await readFileAsDataURL(file);
      let w = 0, h = 0;
      try { const bmp = await createImageBitmap(file); w = bmp.width; h = bmp.height; if (bmp.close) bmp.close(); } catch (_) {}
      const chk = checkImageFile({ bytes: file.size, width: w, height: h });
      if (!chk.ok) {
        setStatus(statusPrefix + '动图被拒：' + chk.errors.join('；') + '（实际 ' + fmtMB(chk.actualBytes || file.size) + ' / ' + (w || '?') + '×' + (h || '?') + '）');
        return;
      }
      let poster = null;
      try { poster = await firstFramePoster(file); } catch (_) {}
      const obj = { data: dataUri, mime: mime || 'image/webp', w, h, bytes: file.size, motion: 'animated-image', poster };
      if (isLightCol) comp.bgLight = obj; else comp.bg = obj;
      renderBgPreview(isLightCol);
      setStatus(statusPrefix + '已载入动图 ' + w + '×' + h + ' · ' + fmtMB(file.size) + '（预览会动' + (poster ? '，已生成静态 poster' : '，poster 留空') + '）');
    } else {
      const shr = await shrinkImage(file);
      const obj = { data: shr.data, mime: 'image/jpeg', w: shr.w, h: shr.h, bytes: shr.bytes, motion: 'none', poster: null };
      if (isLightCol) comp.bgLight = obj; else comp.bg = obj;
      renderBgPreview(isLightCol);
      setStatus(statusPrefix + '已载入 ' + shr.w + '×' + shr.h + ' · 约 ' + Math.round(shr.bytes / 1024) + ' KB');
    }
  } catch (e) {
    setStatus(statusPrefix + '读图失败：' + e.message);
  }
}

/** 背景预览：动图用 <img src=dataURI>（真会动），静态用 CSS 背景（验收 7）。 */
function renderBgPreview(isLightCol) {
  const obj = isLightCol ? comp.bgLight : comp.bg;
  const previewEl = isLightCol ? cn.bgPreviewL : cn.bgPreview;
  const alphaEl = isLightCol ? cn.alphaL : cn.alpha;
  const posEl = isLightCol ? cn.posL : cn.pos;
  const colorEl = isLightCol ? cn.bgColorL : cn.bgColor;
  const emptyHtml = isLightCol
    ? '<span>亮色套背景图<br><small>支持动图 webp/gif/apng（≤5MB）</small></span>'
    : '<span>点击选一张背景图<br><small>会自动压缩到 1920px 宽</small></span>';
  if (!obj || !obj.data) {
    if (previewEl) { previewEl.style.backgroundImage = ''; previewEl.innerHTML = emptyHtml; }
    return;
  }
  const alpha = Number(alphaEl ? alphaEl.value : 0.6);
  const color = colorEl ? colorEl.value : '#141313';
  const pos = posEl ? posEl.value : '50% 50%';
  const desc = buildBgPreviewDescriptor({ data: obj.data, motion: obj.motion, alpha, color, pos });
  if (previewEl) {
    if (desc.tag === 'img') {
      previewEl.style.backgroundImage = '';
      previewEl.innerHTML = '';
      const img = document.createElement('img');
      img.src = desc.src; img.className = 'anim-img'; img.alt = 'animated background preview';
      previewEl.appendChild(img);
    } else {
      previewEl.innerHTML = '';
      previewEl.style.backgroundImage = desc.style.backgroundImage;
      previewEl.style.backgroundSize = desc.style.backgroundSize;
      previewEl.style.backgroundPosition = desc.style.backgroundPosition;
    }
  }
}

function showLight() {
  if (cn.lightWrap) cn.lightWrap.hidden = false;
  if (cn.linkWrap) cn.linkWrap.hidden = false;
}
function hideLight() {
  if (cn.lightWrap) cn.lightWrap.hidden = true;
  if (cn.linkWrap) cn.linkWrap.hidden = true;
}

/** 联动：改一栏，按 mode 自动派生另一栏（规格 §4.1）。 */
function applyLinkage(source) {
  if (!comp.dual || !comp.linked) return;
  const mode = comp.linkMode;
  if (source === 'dark') {
    const d = { bg: cn.bgColor.value, card: cn.card.value, accent: cn.accent.value, text: cn.text.value };
    const l = deriveKeyColors(d, 'dark', mode);
    if (cn.bgColorL) cn.bgColorL.value = l.bg;
    if (cn.cardL) cn.cardL.value = l.card;
    if (cn.accentL) cn.accentL.value = l.accent;
    if (cn.textL) cn.textL.value = l.text;
  } else {
    const l = { bg: cn.bgColorL.value, card: cn.cardL.value, accent: cn.accentL.value, text: cn.textL.value };
    const d = deriveKeyColors(l, 'light', mode);
    cn.bgColor.value = d.bg;
    cn.card.value = d.card;
    cn.accent.value = d.accent;
    cn.text.value = d.text;
  }
  renderBgPreview(false);
  renderBgPreview(true);
}

/* ── 双套开关 / 联动 / 亮色套控件 接线 ── */
if (cn.dual) {
  cn.dual.addEventListener('change', () => {
    comp.dual = cn.dual.checked;
    if (comp.dual) {
      showLight();
      comp.linked = !!(cn.linked && cn.linked.checked);
      applyLinkage('dark');
      cn.status.textContent = '已开启双套：暗/亮各一套，可分别编辑或用联动自动派生';
    } else {
      hideLight();
      comp.editingIsDual = false;
      cn.status.textContent = '已切回单套（暗色），导出为 v2 单包';
    }
  });
}
if (cn.linked) {
  cn.linked.addEventListener('change', () => { comp.linked = cn.linked.checked; if (comp.linked) applyLinkage('dark'); });
}
if (cn.linkMode) {
  cn.linkMode.addEventListener('change', () => { comp.linkMode = cn.linkMode.value; if (comp.linked) applyLinkage('dark'); });
}
['bgColor', 'card', 'accent', 'text'].forEach((k) => { if (cn[k]) cn[k].addEventListener('input', () => applyLinkage('dark')); });
['bgColorL', 'cardL', 'accentL', 'textL'].forEach((k) => { if (cn[k]) cn[k].addEventListener('input', () => applyLinkage('light')); });
if (cn.bgInputL) cn.bgInputL.addEventListener('change', async () => {
  const f = cn.bgInputL.files && cn.bgInputL.files[0];
  cn.bgInputL.value = '';
  if (f) await loadBackground(f, 'light');
});
if (cn.bgClearL) cn.bgClearL.addEventListener('click', () => {
  comp.bgLight = null;
  renderBgPreview(true);
  cn.status.textContent = '已清除亮色套背景';
});
if (cn.alphaL) cn.alphaL.addEventListener('input', () => {
  if (cn.alphaValL) cn.alphaValL.textContent = Number(cn.alphaL.value).toFixed(2);
  renderBgPreview(true);
});
if (cn.posL) cn.posL.addEventListener('change', () => renderBgPreview(true));
if (cn.bgColorL) cn.bgColorL.addEventListener('input', () => renderBgPreview(true));

/* ── 内置背景 ── */
/* ── 预设 ── */
let usingPresets = [];

document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    if (!p) return;
    cn.bgColor.value = p.bg;
    cn.card.value = p.card;
    cn.accent.value = p.accent;
    cn.text.value = p.text;
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('is-on', b === btn));
    if (comp.bg) applyBgPreview();
    cn.status.textContent = '已套用预设：' + btn.textContent + '（可直接改单个颜色微调）';
    applyLinkage('dark');
  });
});

/* ── 编辑已有皮肤 ── */
let editingPackId = null;

async function editSkin(s) {
  cn.status.textContent = '读取中…';
  try {
    const r = await api('GET', `/skins/${encodeURIComponent(s.packId)}`);
    const pack = r.pack;
    if (!pack || !pack.theme) throw new Error('包结构不完整');

    editingPackId = pack.packId;
    openComposer();

    cn.name.value = (pack.names && (pack.names.zh || pack.names.en)) || pack.packId;
    cn.id.value = pack.packId;
    cn.id.dataset.touched = '1';
    cn.tags.value = (pack.tags || []).join(', ');
    cn.group.value = pack.group || '';

    const theme = pack.theme;
    const variants = Array.isArray(theme.variants) ? theme.variants : null;
    const darkV = variants ? (variants.find((v) => v.appearance === 'dark') || variants[0]) : theme;
    const lightV = variants ? (variants.find((v) => v.appearance === 'light') || variants[1] || darkV) : null;

    const c = darkV.colors || {};
    cn.bgColor.value = toHex(hex2rgb(c['--bg'] || '#141313'));
    cn.card.value = toHex(hex2rgb(c['--bg-card'] || '#1E1D1E'));
    cn.accent.value = toHex(hex2rgb(c['--accent'] || '#CD5B85'));
    cn.text.value = toHex(hex2rgb(c['--text'] || '#F0EFF0'));

    const radiusNum = parseInt(String(c['--radius-card'] || '18').replace(/[^\d]/g, ''), 10);
    cn.radius.value = Number.isFinite(radiusNum) ? Math.max(0, Math.min(28, radiusNum)) : 18;
    cn.radiusVal.textContent = cn.radius.value;
    const rim = darkV.material && typeof darkV.material.rim === 'number' ? darkV.material.rim : 0.26;
    cn.rim.value = Math.max(0, Math.min(0.8, rim));
    cn.rimVal.textContent = Number(cn.rim.value).toFixed(2);
    comp.rimTouched = false;
    const blur = darkV.material && typeof darkV.material.blur === 'number' ? darkV.material.blur : 26;
    cn.blur.value = Math.max(0, Math.min(60, blur));
    cn.blurVal.textContent = cn.blur.value;
    readFontsFrom(c);
    readAnsiFrom(c);

    comp.shot = (theme && theme.shot) || pack.shot || null;
    if (comp.shot) {
      cn.shotPreview.innerHTML = '';
      const img = document.createElement('img');
      img.src = comp.shot;
      cn.shotPreview.appendChild(img);
      cn.shotPreview.hidden = false;
    } else {
      cn.shotPreview.hidden = true;
    }

    // 双套开关状态
    comp.dual = !!variants && variants.length > 0;
    comp.editingIsDual = comp.dual;
    if (cn.dual) cn.dual.checked = comp.dual;
    if (comp.dual) showLight(); else hideLight();

    // 暗套背景
    const bgl = darkV.background;
    if (bgl && bgl.asset) {
      comp.bg = {
        data: bgl.asset, w: 0, h: 0, bytes: Math.round(bgl.asset.length * 0.75),
        mime: (bgl.motion && bgl.motion.mode === 'animated-image') ? 'image/webp' : 'image/jpeg',
        motion: (bgl.motion && bgl.motion.mode === 'animated-image') ? 'animated-image' : 'none',
        poster: bgl.poster || null,
      };
      cn.alpha.value = typeof bgl.panelAlpha === 'number' ? bgl.panelAlpha : 0.6;
      cn.alphaVal.textContent = Number(cn.alpha.value).toFixed(2);
      cn.pos.value = bgl.position || '50% 50%';
      renderBgPreview(false);
    } else {
      comp.bg = null;
      renderBgPreview(false);
    }

    // 亮色套列
    if (lightV && lightV !== darkV) {
      const lc = lightV.colors || {};
      cn.bgColorL.value = toHex(hex2rgb(lc['--bg'] || '#F6F7FB'));
      cn.cardL.value = toHex(hex2rgb(lc['--bg-card'] || '#FFFFFF'));
      cn.accentL.value = toHex(hex2rgb(lc['--accent'] || '#3B6FD4'));
      cn.textL.value = toHex(hex2rgb(lc['--text'] || '#1C2026'));
      const lbg = lightV.background;
      if (lbg && lbg.asset) {
        comp.bgLight = {
          data: lbg.asset, w: 0, h: 0, bytes: Math.round(lbg.asset.length * 0.75),
          mime: (lbg.motion && lbg.motion.mode === 'animated-image') ? 'image/webp' : 'image/jpeg',
          motion: (lbg.motion && lbg.motion.mode === 'animated-image') ? 'animated-image' : 'none',
          poster: lbg.poster || null,
        };
        cn.alphaL.value = typeof lbg.panelAlpha === 'number' ? lbg.panelAlpha : 0.6;
        if (cn.alphaValL) cn.alphaValL.textContent = Number(cn.alphaL.value).toFixed(2);
        cn.posL.value = lbg.position || '50% 50%';
        renderBgPreview(true);
      } else {
        comp.bgLight = null;
        renderBgPreview(true);
      }
    } else {
      comp.bgLight = null;
    }

    cn.save.textContent = '保存修改';
    cn.status.textContent = '正在编辑：' + ((pack.names && pack.names.zh) || pack.packId) +
      (comp.dual ? ' · 双套（暗+亮）' : (bgl && bgl.asset ? ' · 已有背景图' : ' · 纯色'));
  } catch (e) {
    cn.status.textContent = '读取失败：' + e.message;
    closeComposer();
  }
}

function resetComposer() {
  editingPackId = null;
  cn.name.value = '';
  cn.id.value = '';
  cn.id.dataset.touched = '';
  cn.tags.value = '';
  cn.save.textContent = '生成并入库';
  comp.shot = null;
  cn.shotPreview.hidden = true;
  cn.shotPreview.innerHTML = '';
  cn.radius.value = 18; cn.radiusVal.textContent = '18';
  cn.rim.value = 0.26; cn.rimVal.textContent = '0.26';
  cn.blur.value = 26; cn.blurVal.textContent = '26';
  comp.bg = null;
  comp.bgLight = null;
  comp.dual = false;
  comp.linked = true;
  comp.linkMode = 'same-hue';
  comp.rimTouched = false;
  comp.editingIsDual = false;
  if (cn.dual) cn.dual.checked = false;
  if (cn.linked) cn.linked.checked = true;
  if (cn.linkMode) cn.linkMode.value = 'same-hue';
  if (cn.adaptive) cn.adaptive.value = 'manual';
  hideLight();
  renderBgPreview(false);
  renderBgPreview(true);
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('is-on'));
  cn.status.textContent = '';
}

cn.cancel.addEventListener('click', () => { resetComposer(); closeComposer(); });

const ANSI_NAMES = ['black','red','green','yellow','blue','magenta','cyan','white',
  'bright-black','bright-red','bright-green','bright-yellow','bright-blue','bright-magenta','bright-cyan','bright-white'];
let ansiValues = {};

function buildAnsiGrid() {
  const grid = document.getElementById('c-ansi');
  if (!grid) return;
  grid.innerHTML = '';
  ansiValues = {};
  for (const n of ANSI_NAMES) {
    ansiValues[n] = String(BASE_COLORS['--term-ansi-' + n] || '#888888').slice(0, 7);
    const wrap = document.createElement('label');
    wrap.className = 'ansi-cell';
    wrap.title = '--term-ansi-' + n;
    const input = document.createElement('input');
    input.type = 'color';
    input.value = ansiValues[n];
    input.addEventListener('input', () => { ansiValues[n] = input.value; });
    wrap.appendChild(input);
    const lab = document.createElement('span');
    lab.textContent = n.replace('bright-', 'b.');
    wrap.appendChild(lab);
    grid.appendChild(wrap);
  }
}

function readAnsiFrom(colors) {
  for (const n of ANSI_NAMES) {
    const v = colors['--term-ansi-' + n];
    if (v) ansiValues[n] = String(v).slice(0, 7);
  }
}

function writeAnsiInto(colors) {
  for (const n of ANSI_NAMES) {
    colors['--term-ansi-' + n] = ansiValues[n] || String(BASE_COLORS['--term-ansi-' + n]).slice(0, 7);
  }
}

function readFontsFrom(colors) {
  cn.fontUi.value = colors['--font-ui'] || BASE_COLORS['--font-ui'] || '';
  cn.fontSerif.value = colors['--font-serif'] || BASE_COLORS['--font-serif'] || '';
  cn.fontMono.value = colors['--font-mono'] || BASE_COLORS['--font-mono'] || '';
}

function writeFontsInto(colors) {
  colors['--font-ui'] = cn.fontUi.value.trim() || BASE_COLORS['--font-ui'];
  colors['--font-serif'] = cn.fontSerif.value.trim() || BASE_COLORS['--font-serif'];
  colors['--font-mono'] = cn.fontMono.value.trim() || BASE_COLORS['--font-mono'];
}

/* ── 封面渲染：在 canvas 上画一个缩小版界面骨架 ── */
function renderShot() {
  return new Promise((resolve) => {
    const W = 480, H = 300;
    const cv = cn.shotCanvas;
    const ctx = cv.getContext('2d');

    const paint = (bgImg) => {
      const bg = cn.bgColor.value;
      const card = cn.card.value;
      const accent = cn.accent.value;
      const text = cn.text.value;
      const isLight = luminance(bg) > 0.5;
      const alpha = Number(cn.alpha.value);
      const rad = Number(cn.radius.value);

      // 1. 背景（图或纯色）
      if (bgImg) {
        // cover 式铺满
        const s = Math.max(W / bgImg.width, H / bgImg.height);
        const w = bgImg.width * s, h = bgImg.height * s;
        const pos = (cn.pos.value || '50% 50%').split(/\s+/);
        const px = pos[0].includes('%') ? (W - w) * parseFloat(pos[0]) / 100 : 0;
        const py = (pos[1] || '50%').includes('%') ? (H - h) * parseFloat(pos[1]) / 100 : 0;
        ctx.drawImage(bgImg, px, py, w, h);
        // 遮罩（同底色）
        const [r, g, b] = hex2rgb(bg);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
      }

      // 2. 侧栏
      const sbW = W * 0.24;
      const [br, bgr, bb] = hex2rgb(bg);
      ctx.fillStyle = `rgba(${br},${bgr},${bb},${Math.min(0.95, alpha + 0.25)})`;
      ctx.fillRect(0, 0, sbW, H);
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath(); ctx.moveTo(sbW + 0.5, 0); ctx.lineTo(sbW + 0.5, H); ctx.stroke();

      // 侧栏内容：圆头像 + 三条导航
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(sbW * 0.5, 34, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = text;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = i === 0 ? 0.85 : 0.4;
        roundRect(ctx, 14, 68 + i * 26, sbW - 28, 12, Math.min(6, rad / 3));
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 3. 主区：两张聊天气泡（对方 + 自己）
      const mx = sbW + 18;
      const mw = W - mx - 18;
      ctx.fillStyle = card;
      roundRect(ctx, mx, 26, mw * 0.62, 52, Math.min(rad, 14)); ctx.fill();
      ctx.fillStyle = text; ctx.globalAlpha = 0.75;
      roundRect(ctx, mx + 12, 40, mw * 0.62 - 24, 7, 3); ctx.fill();
      roundRect(ctx, mx + 12, 54, (mw * 0.62 - 24) * 0.62, 7, 3); ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = accent;
      roundRect(ctx, W - 18 - mw * 0.52, 92, mw * 0.52, 40, Math.min(rad, 14)); ctx.fill();
      ctx.fillStyle = isLight ? '#FFFFFF' : '#141313'; ctx.globalAlpha = 0.82;
      roundRect(ctx, W - 18 - mw * 0.52 + 12, 104, mw * 0.52 - 24, 7, 3); ctx.fill();
      roundRect(ctx, W - 18 - mw * 0.52 + 12, 117, (mw * 0.52 - 24) * 0.5, 7, 3); ctx.fill();
      ctx.globalAlpha = 1;

      // 4. 输入框
      const iy = H - 54;
      ctx.fillStyle = card;
      roundRect(ctx, mx, iy, mw, 38, Math.min(rad, 12)); ctx.fill();
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
      roundRect(ctx, mx + 0.5, iy + 0.5, mw - 1, 38 - 1, Math.min(rad, 12)); ctx.stroke();
      ctx.fillStyle = text; ctx.globalAlpha = 0.32;
      roundRect(ctx, mx + 14, iy + 15, mw * 0.5, 7, 3); ctx.fill();
      ctx.globalAlpha = 1;
      // 发送按钮
      ctx.fillStyle = accent;
      roundRect(ctx, W - 18 - 54, iy + 7, 54, 24, Math.min(rad / 2, 8)); ctx.fill();

      // 5. 标题字（皮肤名）
      const name = cn.name.value.trim();
      if (name) {
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.fillStyle = text;
        ctx.globalAlpha = 0.55;
        ctx.fillText(name, mx, 20);
        ctx.globalAlpha = 1;
      }

      resolve(cv.toDataURL('image/jpeg', 0.82));
    };

    // 有背景图先加载图
    if (comp.bg && comp.bg.data) {
      const img = new Image();
      img.onload = () => paint(img);
      img.onerror = () => paint(null);
      img.src = comp.bg.data;
    } else {
      paint(null);
    }
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function openComposer() {
  buildAnsiGrid();
  cn.section.hidden = false;
  el.wall.parentElement.hidden = true;
  document.querySelector('.filters').hidden = true;
  cn.name.focus();
}

function closeComposer() {
  cn.section.hidden = true;
  el.wall.parentElement.hidden = false;
  document.querySelector('.filters').hidden = false;
}

cn.newBtn.addEventListener('click', () => { resetComposer(); openComposer(); });

cn.alpha.addEventListener('input', () => {
  cn.alphaVal.textContent = Number(cn.alpha.value).toFixed(2);
  if (comp.bg) applyBgPreview();
});

function applyBgPreview() { renderBgPreview(false); }

cn.bgInput.addEventListener('change', async () => {
  const f = cn.bgInput.files && cn.bgInput.files[0];
  cn.bgInput.value = '';
  if (f) await loadBackground(f, 'dark');
});

cn.bgClear.addEventListener('click', () => {
  comp.bg = null;
  renderBgPreview(false);
  cn.status.textContent = '已清除背景图（将生成纯色皮肤）';
});

cn.bgColor.addEventListener('input', () => { if (comp.bg) applyBgPreview(); });
cn.radius.addEventListener('input', () => { cn.radiusVal.textContent = cn.radius.value; });
cn.rim.addEventListener('input', () => { cn.rimVal.textContent = Number(cn.rim.value).toFixed(2); comp.rimTouched = true; });
cn.blur.addEventListener('input', () => { cn.blurVal.textContent = cn.blur.value; });

cn.shot.addEventListener('click', async () => {
  if (!cn.name.value.trim()) { cn.status.textContent = '先起个名字，封面上要写。'; cn.name.focus(); return; }
  cn.shot.disabled = true;
  cn.status.textContent = '渲染中…';
  try {
    const data = await renderShot();
    comp.shot = data;
    cn.shotPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = data;
    cn.shotPreview.appendChild(img);
    cn.shotPreview.hidden = false;
    cn.status.textContent = '封面已生成，保存时随包入库。';
  } catch (e) {
    cn.status.textContent = '渲染失败：' + e.message;
  }
  cn.shot.disabled = false;
});

function slugify(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

cn.name.addEventListener('input', () => {
  if (!cn.id.dataset.touched) {
    // 中文名转不了 slug，用 mine-<时间戳后四位> 兜底
    const s = slugify(cn.name.value);
    cn.id.value = /[a-z0-9]/.test(s) && s !== '-' ? s : '';
  }
});
cn.id.addEventListener('input', () => { cn.id.dataset.touched = '1'; });

cn.save.addEventListener('click', async () => {
  const name = cn.name.value.trim();
  const isEdit = !!editingPackId;
  const packId = isEdit ? editingPackId : (slugify(cn.id.value) || ('mine-' + Date.now().toString(36).slice(-5)));

  if (!name) { cn.status.textContent = '先给皮肤起个名字。'; cn.name.focus(); return; }

  const bg = cn.bgColor.value;
  const isLight = luminance(bg) > 0.5;
  const colors = deriveColors({
    bg,
    card: cn.card.value,
    accent: cn.accent.value,
    text: cn.text.value,
  });

  // 圆角：一个滑杆管四个变量，比例保持不变
  const radius = Number(cn.radius.value);
  colors['--radius-input'] = radius + 'px';
  colors['--radius-card'] = radius + 'px';
  colors['--radius-chat-card'] = Math.max(0, radius - 2) + 'px';
  colors['--radius-chat-surface'] = radius + 'px';
  writeFontsInto(colors);
  writeAnsiInto(colors);

  const alpha = Number(cn.alpha.value);
  let theme = {
    key: 'default',
    appearance: isLight ? 'light' : 'dark',
    colors,
    material: {
      tier: 'bold',
      edge: isLight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.22)',
      rim: Number(cn.rim.value),
      blur: Number(cn.blur.value),
      glowFromBg: true,
    },
    frame: { kind: 'none' },
  };

  if (comp.bg) {
    theme.background = {
      asset: comp.bg.data,
      fit: 'cover',
      position: cn.pos.value,
      panelAlpha: alpha,
      cardAlpha: Math.max(0.2, Number((alpha - 0.1).toFixed(2))),
      tint: null,
    };
  }

  let packSchema = 'hana-skinpack/2';
  if (comp.dual) {
    const darkKeys = { bg: cn.bgColor.value, card: cn.card.value, accent: cn.accent.value, text: cn.text.value };
    const lightKeys = { bg: cn.bgColorL.value, card: cn.cardL.value, accent: cn.accentL.value, text: cn.textL.value };
    const radius = Number(cn.radius.value);
    const rim = comp.rimTouched ? Number(cn.rim.value) : undefined;
    const blur = Number(cn.blur.value);
    const vDark = buildVariant({ ...darkKeys, appearance: 'dark', bgImage: comp.bg, alpha: Number(cn.alpha.value), pos: cn.pos.value, radius, rim, blur });
    const vLight = buildVariant({ ...lightKeys, appearance: 'light', bgImage: comp.bgLight, alpha: Number(cn.alphaL.value), pos: cn.posL.value, radius, rim, blur });
    theme = { key: 'default', adaptive: { mode: (cn.adaptive && cn.adaptive.value) || 'manual' }, variants: [vDark, vLight] };
    packSchema = SCHEMA_V3;
  }
  const prev = state.skins.find((x) => x.packId === packId);
  const pack = {
    schema: packSchema,
    packId,
    packVersion: '1.0.0',
    names: { zh: name },
    description: `${isEdit ? '修改于' : '在'}衣橱工作台${isEdit ? '' : '里做'}的皮肤（底色 ${bg}${comp.bg ? '，带背景图' : ''}）`,
    tags: cn.tags.value.split(/[,，\s]+/).filter(Boolean).slice(0, 6),
    group: cn.group.value.trim() || 'mine',
    favorite: prev ? prev.favorite : true,
    source: { kind: 'original', publisher: 'local', license: 'unspecified' },
    theme,
    meta: { madeIn: 'wardrobe-composer', at: new Date().toISOString() },
  };
  // 封面统一存 theme.shot（后端两处都认，但只有一个真源）
  if (comp.shot) theme.shot = comp.shot;

  // 单包体积门禁（规格 §2.3）：越过 12MB 直接拒绝并报告实际数字
  const budget = checkPackBudget(pack);
  if (!budget.ok) {
    cn.save.disabled = false;
    cn.status.textContent = '导出被拒：' + budget.errors[0] + `（实际 ${fmtMB(budget.bytes)}）`;
    return;
  }

  cn.save.disabled = true;
  cn.status.textContent = '入库中…';
  try {
    await api('POST', '/skins', { pack });
    await loadLibrary();
    resetComposer();
    closeComposer();
    setStatus(isEdit
      ? `「${name}」已更新${comp.shot ? '（含新封面）' : ''} · 如果已经启用，请对 agent 说：执行衣橱待办`
      : `「${name}」已入库 · 共 ${state.skins.length} 个。点「启用」后对 agent 说：执行衣橱待办`);
    cn.save.disabled = false;
  } catch (e) {
    cn.status.textContent = '入库失败：' + e.message;
    cn.save.disabled = false;
  }
});
