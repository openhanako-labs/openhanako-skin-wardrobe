import { hana } from './sdk.js';

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
const BUILD = 'lib-14';

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
};

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
  let res;
  try {
    res = await hana.api.fetch(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
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
    throw new Error('HTTP ' + res.status);
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
    el.pending.textContent = `${open.length} 条待办：对 agent 说「执行衣橱待办」`;
    el.pending.classList.add('has-pending');
  } else if (state.pending.length) {
    el.pending.textContent = '上次操作已执行 · 重启 Hana 后生效';
    el.pending.classList.remove('has-pending');
  } else {
    el.pending.textContent = '';
    el.pending.classList.remove('has-pending');
  }
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
    setStatus(
      op === 'enable'
        ? `已提交「启用 ${displayName(s)}」· 对 agent 说「执行衣橱待办」`
        : `已提交「停用 ${displayName(s)}」· 对 agent 说「执行衣橱待办」`
    );
    render();
  } catch (e) {
    setStatus('提交失败：' + e.message);
    btn.disabled = false;
    btn.textContent = op === 'enable' ? '启用' : '停用';
  } finally {
    state.inflight.delete(s.packId);
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

/* ── 导入 ── */
function validatePack(json) {
  const errs = [];
  const warns = [];
  if (!json || typeof json !== 'object') { errs.push('不是 JSON 对象'); return { errs, warns }; }
  if (!json.packId) errs.push('缺 packId');
  if (!json.schema) warns.push('缺 schema 字段');
  else if (!/^hana-skinpack\//.test(json.schema)) errs.push('schema 不认识：' + json.schema);

  // v2 是 theme 单对象，v1 是 themes 数组
  if (json.theme) {
    if (!json.theme.colors || typeof json.theme.colors !== 'object') errs.push('theme.colors 缺失');
  } else if (Array.isArray(json.themes)) {
    if (!json.themes.length) errs.push('themes 为空');
    else warns.push('这是 v1 包（配色层），导入后只保留配色');
  } else {
    errs.push('既没有 theme 也没有 themes');
  }
  return { errs, warns };
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

const BASE_COLORS = {
  '--bg': '#141313',
  '--bg-card': '#1E1D1E',
  '--bg-glass': '#1E1D1EEB',
  '--sidebar-bg': '#191719',
  '--accent': '#CD5B85',
  '--accent-hover': '#DA84A4',
  '--accent-light': '#CD5B8526',
  '--link': '#E4A3C3',
  '--link-hover': '#F0C1D7',
  '--text': '#F0EFF0',
  '--text-light': '#D0CAD1',
  '--text-muted': '#AAA2AD',
  '--hana-text': '#F0EFF0',
  '--border': '#B896C138',
  '--shadow': '#00000070',
  '--green': '#9DCCAC',
  '--coral': '#DFB0A1',
  '--danger': '#F09AAB',
  '--jian-note-bg': '#262127',
  '--jian-note-border': '#B896C140',
  '--mood-bg': '#B896C112',
  '--mood-text': '#C8ACD1',
  '--mood-border': '#B896C133',
  '--tool-bg': '#B896C10D',
  '--tool-text': '#C5BDC9',
  '--user-bg': '#CD5B851F',
  '--drop-overlay-bg': '#141313E8',
  '--attach-bg': '#FFFFFF0D',
  '--overlay-subtle': '#FFFFFF06',
  '--overlay-light': '#FFFFFF0D',
  '--overlay-medium': '#FFFFFF17',
  '--overlay-strong': '#B896C133',
  '--tab-slider-bg': '#B896C125',
  '--term-bg': '#191719',
  '--term-fg': '#E5DFE7',
  '--term-cursor': '#DA84A4',
  '--term-cursor-accent': '#141313',
  '--term-selection-bg': '#CD5B8540',
  '--term-ansi-black': '#353039',
  '--term-ansi-red': '#E78FA4',
  '--term-ansi-green': '#9DCCAC',
  '--term-ansi-yellow': '#DBC295',
  '--term-ansi-blue': '#A6B9E2',
  '--term-ansi-magenta': '#C1A0D4',
  '--term-ansi-cyan': '#9CCAD0',
  '--term-ansi-white': '#D0CAD1',
  '--term-ansi-bright-black': '#AAA2AD',
  '--term-ansi-bright-red': '#F7B0C0',
  '--term-ansi-bright-green': '#BAE2C8',
  '--term-ansi-bright-yellow': '#EED9B2',
  '--term-ansi-bright-blue': '#C2D0F2',
  '--term-ansi-bright-magenta': '#DAC0EA',
  '--term-ansi-bright-cyan': '#BCE4E9',
  '--term-ansi-bright-white': '#F5F0F6',
  '--radius-input': '18px',
  '--radius-card': '18px',
  '--radius-chat-card': '16px',
  '--radius-chat-surface': '20px',
  '--font-ui': 'Segoe UI, Microsoft YaHei UI, Microsoft YaHei, sans-serif',
  '--font-serif': 'Noto Serif SC, Source Han Serif SC, serif',
  '--font-mono': 'Cascadia Code, Consolas, monospace',
};

/* ── 颜色工具 ── */
const hex2rgb = (h) => {
  const m = /^#([0-9a-f]{6})$/i.exec(h || '');
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [20, 19, 19];
};
const rgbStr = (h) => hex2rgb(h).join(', ');
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (h, amt) => toHex(hex2rgb(h).map((v) => v + (amt > 0 ? (255 - v) * amt : v * amt)));
const luminance = (h) => {
  const [r, g, b] = hex2rgb(h).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/* ── 派生：方向跟着底色明暗翻 ── */
function deriveColors({ bg, card, accent, text }) {
  const isLight = luminance(bg) > 0.5;
  const out = { ...BASE_COLORS };

  out['--bg'] = bg;
  out['--sidebar-bg'] = bg;
  out['--term-bg'] = bg;
  out['--drop-overlay-bg'] = bg.toUpperCase() + 'E8';
  out['--bg-card'] = card;
  out['--bg-glass'] = card.toUpperCase() + (isLight ? 'F2' : 'EB');

  out['--accent'] = accent;
  // 亮色下强调色要往深压，否则在白底上看不清
  out['--accent-hover'] = isLight ? shade(accent, -0.15) : shade(accent, 0.18);
  out['--accent-light'] = accent.toUpperCase() + (isLight ? '1A' : '26');
  out['--link'] = isLight ? shade(accent, -0.12) : shade(accent, 0.28);
  out['--link-hover'] = isLight ? shade(accent, -0.24) : shade(accent, 0.42);
  out['--user-bg'] = accent.toUpperCase() + (isLight ? '14' : '1F');
  out['--tab-slider-bg'] = accent.toUpperCase() + (isLight ? '1A' : '25');
  out['--term-cursor'] = out['--accent-hover'];
  out['--term-selection-bg'] = accent.toUpperCase() + (isLight ? '30' : '40');

  out['--text'] = text;
  out['--hana-text'] = text;
  // 亮色下「次要文字」应该更浅（靠近背景），不是更深
  out['--text-light'] = isLight ? shade(text, 0.28) : shade(text, -0.12);
  out['--text-muted'] = isLight ? shade(text, 0.46) : shade(text, -0.32);
  out['--term-fg'] = isLight ? shade(text, 0.12) : shade(text, -0.08);
  out['--term-cursor-accent'] = isLight ? card : bg;
  out['--term-ansi-white'] = out['--text-light'];
  out['--term-ansi-bright-black'] = out['--text-muted'];

  // 结构性透明层：亮色用黑色低透明度，暗色用白色
  out['--border'] = isLight ? 'rgba(0,0,0,0.12)' : '#B896C138';
  out['--overlay-subtle'] = isLight ? '#00000004' : '#FFFFFF06';
  out['--overlay-light'] = isLight ? '#00000008' : '#FFFFFF0D';
  out['--overlay-medium'] = isLight ? '#00000010' : '#FFFFFF17';
  out['--overlay-strong'] = isLight ? '#00000018' : '#B896C133';
  out['--shadow'] = isLight ? '#0000001F' : '#00000070';
  out['--attach-bg'] = isLight ? '#00000006' : '#FFFFFF0D';
  out['--jian-note-bg'] = isLight ? '#F1EDE8' : '#262127';
  out['--jian-note-border'] = isLight ? 'rgba(0,0,0,0.10)' : '#B896C140';
  out['--tool-bg'] = isLight ? '#00000005' : '#B896C10D';
  out['--mood-bg'] = isLight ? '#00000006' : '#B896C112';
  out['--mood-border'] = isLight ? 'rgba(0,0,0,0.10)' : '#B896C133';

  return out;
}

/* ── 预设：一键填一套四个关键色 ── */
const PRESETS = {
  dark:  { bg: '#141313', card: '#1E1D1E', accent: '#CD5B85', text: '#F0EFF0' },
  light: { bg: '#F6F7FB', card: '#FFFFFF', accent: '#3B6FD4', text: '#1C2026' },
  paper: { bg: '#F8F4ED', card: '#FFFFFF', accent: '#A8763E', text: '#2A2622' },
  ink:   { bg: '#0F1418', card: '#161C21', accent: '#4FA3C7', text: '#E6EDF3' },
  blush: { bg: '#FBF2F4', card: '#FFFFFF', accent: '#C2567A', text: '#2E2228' },
};

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
  bg: null,        // { data, w, h, bytes }
  shot: null,      // data URI，封面
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
};

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

    const c = pack.theme.colors || {};
    cn.bgColor.value = toHex(hex2rgb(c['--bg'] || '#141313'));
    cn.card.value = toHex(hex2rgb(c['--bg-card'] || '#1E1D1E'));
    cn.accent.value = toHex(hex2rgb(c['--accent'] || '#CD5B85'));
    cn.text.value = toHex(hex2rgb(c['--text'] || '#F0EFF0'));

    const radiusNum = parseInt(String(c['--radius-card'] || '18').replace(/[^\d]/g, ''), 10);
    cn.radius.value = Number.isFinite(radiusNum) ? Math.max(0, Math.min(28, radiusNum)) : 18;
    cn.radiusVal.textContent = cn.radius.value;
    const rim = pack.theme.material && typeof pack.theme.material.rim === 'number' ? pack.theme.material.rim : 0.26;
    cn.rim.value = Math.max(0, Math.min(0.8, rim));
    cn.rimVal.textContent = Number(cn.rim.value).toFixed(2);
    const blur = pack.theme.material && typeof pack.theme.material.blur === 'number' ? pack.theme.material.blur : 26;
    cn.blur.value = Math.max(0, Math.min(60, blur));
    cn.blurVal.textContent = cn.blur.value;
    readFontsFrom(c);
    readAnsiFrom(c);

    comp.shot = (pack.theme && pack.theme.shot) || pack.shot || null;
    if (comp.shot) {
      cn.shotPreview.innerHTML = '';
      const img = document.createElement('img');
      img.src = comp.shot;
      cn.shotPreview.appendChild(img);
      cn.shotPreview.hidden = false;
    } else {
      cn.shotPreview.hidden = true;
    }

    const bgl = pack.theme.background;
    if (bgl && bgl.asset) {
      comp.bg = { data: bgl.asset, w: 0, h: 0, bytes: Math.round(bgl.asset.length * 0.75) };
      cn.alpha.value = typeof bgl.panelAlpha === 'number' ? bgl.panelAlpha : 0.6;
      cn.alphaVal.textContent = Number(cn.alpha.value).toFixed(2);
      cn.pos.value = bgl.position || '50% 50%';
      applyBgPreview();
    } else {
      comp.bg = null;
      cn.bgPreview.style.backgroundImage = '';
      cn.bgPreview.innerHTML = '<span>点击选一张背景图<br><small>会自动压缩到 1920px 宽</small></span>';
    }

    cn.save.textContent = '保存修改';
    cn.status.textContent = '正在编辑：' + ((pack.names && pack.names.zh) || pack.packId) +
      (bgl && bgl.asset ? ' · 已有背景图' : ' · 纯色');
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
  cn.bgPreview.style.backgroundImage = '';
  cn.bgPreview.innerHTML = '<span>点击选一张背景图<br><small>会自动压缩到 1920px 宽</small></span>';
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

function applyBgPreview() {
  const a = Number(cn.alpha.value);
  const [r, g, b] = hex2rgb(cn.bgColor.value);
  cn.bgPreview.style.backgroundImage =
    `linear-gradient(rgba(${r},${g},${b},${a}), rgba(${r},${g},${b},${a})), url("${comp.bg.data}")`;
  cn.bgPreview.style.backgroundSize = 'cover';
  cn.bgPreview.style.backgroundPosition = cn.pos.value;
  cn.bgPreview.innerHTML = '';
}

cn.bgInput.addEventListener('change', async () => {
  const f = cn.bgInput.files && cn.bgInput.files[0];
  cn.bgInput.value = '';
  if (!f) return;
  cn.status.textContent = '压缩中…';
  try {
    comp.bg = await shrinkImage(f);
    applyBgPreview();
    cn.status.textContent =
      `已载入 ${comp.bg.w}×${comp.bg.h} · 约 ${Math.round(comp.bg.bytes / 1024)} KB`;
  } catch (e) {
    cn.status.textContent = '读图失败：' + e.message;
    comp.bg = null;
  }
});

cn.bgClear.addEventListener('click', () => {
  comp.bg = null;
  cn.bgPreview.style.backgroundImage = '';
  cn.bgPreview.innerHTML = '<span>点击选一张背景图<br><small>会自动压缩到 1920px 宽</small></span>';
  cn.status.textContent = '已清除背景图（将生成纯色皮肤）';
});

cn.bgColor.addEventListener('input', () => { if (comp.bg) applyBgPreview(); });
cn.radius.addEventListener('input', () => { cn.radiusVal.textContent = cn.radius.value; });
cn.rim.addEventListener('input', () => { cn.rimVal.textContent = Number(cn.rim.value).toFixed(2); });
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
  const theme = {
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

  const prev = state.skins.find((x) => x.packId === packId);
  const pack = {
    schema: 'hana-skinpack/2',
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
