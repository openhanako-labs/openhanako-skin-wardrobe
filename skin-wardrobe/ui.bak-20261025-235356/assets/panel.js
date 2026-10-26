import { hana } from './sdk.js';
import {
  readPack, analyzeTheme, parsePaletteCss, exportPack,
  REQUIRED_CORE,
} from './skinpack.mjs';

/*
 * 词表走宿主：getSchema() 返回的 variables 就是 CUSTOM_THEME_VARIABLE_NAMES，
 * 不在 UI 里 import 服务端 SDK 副本（sdk/ 不暴露在 ui/ 静态根下）。
 * 统一入口：读 state.schema。
 */
function vocabulary() {
  const vars = state.schema && state.schema.variables;
  return Array.isArray(vars) ? vars.map((v) => v.name) : null;
}

await hana.ready();

/** 构建标记：写到固定位置，不被状态文字覆盖。 */
const BUILD = 'p7';
const buildTag = document.getElementById('build-tag');
if (buildTag) buildTag.textContent = BUILD;

const status = document.getElementById('startup-status');
const gridEl = document.getElementById('wall');
const detailEl = document.getElementById('detail');
const importBtnEl = document.getElementById('import-btn');
const fileEl = document.getElementById('pack-file');

/** 本机会话内的运行时状态。 */
const state = {
  schema: null,
  base: { light: null, dark: null },
  installed: [],          // 宿主已有用户主题
  packs: [],              // 导入的信封 { pack, json }
  previewHandle: null,
  // 失败关闭：底表未确认前，任何不完整主题都不允许被补全装入
  baseOk: { dark: false, light: false },
};

/* ── 宿主调色板解析：base 的唯一来源（规范 §5 铁律：不手写深色底） ── */
async function loadBasePalettes() {
  const snap = hana.theme.getSnapshot();
  const grab = async (url, label) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return { source: label, css: await res.text() };
    } catch (e) {
      return { source: label + '(failed:' + e.message + ')', css: '' };
    }
  };
  const pick = async (face) => {
    if (snap.palettes && snap.palettes[face]) {
      return grab(snap.palettes[face].cssUrl, 'host:' + face + ':' + snap.palettes[face].theme);
    }
    // 老宿主没有 palettes 字段：当前主题恰好是这一面时，用它的 cssUrl
    if (snap.appearance === face && snap.cssUrl) {
      return grab(snap.cssUrl, 'current:' + (snap.theme || '?'));
    }
    return { source: 'none', css: '' };
  };
  const [light, dark] = await Promise.all([pick('light'), pick('dark')]);
  const initial = state.schema && state.schema.initialDefinition
    ? state.schema.initialDefinition.variables : {};
  const VOCAB = vocabulary();
  const lp = parsePaletteCss(light.css, VOCAB);
  const dp = parsePaletteCss(dark.css, VOCAB);
  state.base = {
    light: { ...initial, ...lp.vars },
    dark: { ...initial, ...dp.vars },
  };
  state.baseParsed = { light: lp, dark: dp };
  state.baseSource = { light: light.source, dark: dark.source };
  /*
   * 底表可用性闸门：宿主没给对应面的调色板时，上面会用**浅色** initialDefinition
   * 去填深色皮肤——那正是规范 §5 警告的静默污染。这里把这种情况判为底表不可用，
   * 由调用方拒绝对不完整主题做补全，而不是交出一个浅色残留的深色皮肤。
   */
  const usable = (parsed) => REQUIRED_CORE.every((name) => name in parsed);
  state.baseOk = {
    dark: dark.source.startsWith('host:') || dark.source.startsWith('current:') ? usable(dp.vars) : false,
    light: light.source.startsWith('host:') || light.source.startsWith('current:') ? usable(lp.vars) : false,
  };
}

/*
 * 自绘按钮：不再用官方 App UI 控件。
 * 原因：官方控件的配色由 app-ui.css 控制，不跟随宿主主题变量，
 * 在浅底面板上渲成浅灰字，看不清。自绘可以明确掌控对比度。
 */
function makeButton(label, onClick, kind) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn' + (kind ? ' btn-' + kind : '');
  b.textContent = label;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

/** 把一组按钮放进容器（替代原来的 mountAppUi(actions, 'Inline', …)）。 */
function fillActions(container, buttons) {
  container.innerHTML = '';
  for (const b of buttons) if (b) container.appendChild(b);
}

/* ── 渲染 ── */
function render() {
  gridEl.innerHTML = '';
  const entries = collectEntries();
  if (!entries.length) {
    gridEl.appendChild(emptyNode());
    return;
  }
  for (const entry of entries) gridEl.appendChild(card(entry));
}

function collectEntries() {
  const out = [];
  for (const item of state.packs) {
    for (const theme of item.pack.themes) {
      out.push({ kind: theme.kind, pack: item.pack, theme, from: 'pack' });
    }
  }
  for (const rec of state.installed) {
    out.push({ kind: 'installed', summary: rec, from: 'host' });
  }
  return out;
}

function emptyNode() {
  const div = document.createElement('div');
  div.className = 'wall-empty';
  div.textContent = '衣橱是空的。导入一个 .skin.json / .skinpack，或先在别处建一个用户主题。';
  return div;
}

function card(entry) {
  const el = document.createElement('article');
  el.className = 'skin-card' + (entry.kind === 'patch' ? ' is-patch' : '');

  const name = entry.from === 'host'
    ? entry.summary.name
    : (entry.pack.names && (entry.pack.names.zh || entry.pack.names.en))
      || (entry.theme.theme && entry.theme.theme.name)
      || entry.theme.key;

  const head = document.createElement('header');
  head.innerHTML = '<span class="skin-name"></span><span class="badge badge-' +
    (entry.kind === 'patch' ? 'patch' : entry.kind === 'installed' ? 'host' : 'vars') + '">' +
    (entry.kind === 'patch' ? '针线房' : entry.kind === 'installed' ? '已装' : '衣橱') + '</span>';
  head.querySelector('.skin-name').textContent = name;
  el.appendChild(head);

  // 预览：只用局部作用域的 style 节点，绝不写 :root
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  el.appendChild(swatch);

  const meta = document.createElement('div');
  meta.className = 'meta';
  el.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'actions';
  el.appendChild(actions);

  if (entry.kind === 'vars') {
    const analysis = analyzeTheme(entry.theme, baseFor(entry.theme.appearance), vocabulary());
    const missing = analysis.missingCore;
    const partial = analysis.authoredCount < Object.keys(analysis.definition.variables).length;
    const baseReady = state.baseOk[entry.theme.appearance] !== false;
    const blocked = partial && !baseReady;
    paintSwatch(swatch, analysis.definition.variables, entry.theme.appearance);
    meta.innerHTML = completenessHtml(analysis) +
      (blocked ? '<br><span class="warn">宿主未提供 ' + escapeHtml(entry.theme.appearance) +
        ' 调色板，而本皮肤变量不完整——拒绝用另一面的底补全</span>' : '');
    fillActions(actions, [
      makeButton('装入', () => onInstall(entry, analysis, missing), blocked ? 'quiet' : 'primary', missing.length || blocked),
    ]);
    if (blocked) actions.firstChild.disabled = true;
  } else if (entry.kind === 'patch') {
    const ps = entry.pack.patchSets[entry.theme.patchRef];
    paintSwatch(swatch, paletteToVars(entry.theme.palette), entry.theme.appearance);
    meta.innerHTML = '<span class="warn">官方词表无法表达：' +
      escapeHtml((entry.theme.losses || []).join('；') || '未声明') + '</span>';
    fillActions(actions, [
      makeButton('针线房（未启用）', null, 'quiet'),
    ]);
    actions.firstChild.disabled = true;
    const note = document.createElement('p');
    note.className = 'patch-note';
    note.textContent = '补丁集 ' + entry.theme.patchRef + '：' + (ps.engine || '?') +
      '，验证版本 ' + ((ps.verifiedVersions || []).join('/') || '未声明') +
      ' · 应用后需重启 Hana 才生效（不是 Ctrl+R）';
    el.appendChild(note);
  } else {
    fetchInstalledAndPaint(entry, swatch, meta, actions);
  }
  return el;
}

async function fetchInstalledAndPaint(entry, swatch, meta, actions) {
  meta.textContent = '读取中…';
  try {
    const rec = await hana.themes.custom.get(entry.summary.id);
    paintSwatch(swatch, rec.variables, rec.appearance);
    meta.textContent = rec.appearance + ' · revision ' + rec.revision;
    fillActions(actions, [
      makeButton('应用', () => onApply(rec.id), 'primary'),
      (() => {
        const b = makeButton('删除', null, 'quiet');
        b.addEventListener('click', () => onDelete(rec, b));
        return b;
      })(),
    ]);
  } catch (e) {
    meta.textContent = '读取失败：' + e.message;
  }
}

function baseFor(appearance) {
  return appearance === 'dark' ? state.base.dark : state.base.light;
}

function completenessHtml(a) {
  const parts = ['作者 ' + a.authoredCount + ' 项', '继承 ' + a.inheritedCount + ' 项'];
  if (a.defaultedCount) parts.push('默认 ' + a.defaultedCount + ' 项');
  let html = parts.join(' · ');
  if (a.missingCore.length) {
    html += '<br><span class="warn">缺核心 ' + a.missingCore.length +
      ' 项：' + escapeHtml(a.missingCore.join(' ')) + '</span>';
  }
  if (a.missingRecommended.length) {
    html += '<br><span class="hint">建议补：' + escapeHtml(a.missingRecommended.join(' ')) + '</span>';
  }
  // 规范 §4.4：词表外的作者变量不静默丢，必须报损。
  if (a.outsideVocabulary && a.outsideVocabulary.length) {
    html += '<br><span class="warn">已剔除词表外 ' + a.outsideVocabulary.length +
      ' 项：' + escapeHtml(a.outsideVocabulary.join(' ')) + '</span>';
  }
  return html;
}

function paletteToVars(p) {
  return {
    '--bg': (p && p.bg) || '#202024',
    '--bg-card': (p && p.panel) || '#2A2A30',
    '--accent': (p && p.accent) || '#8A8A96',
    '--text': (p && p.text) || '#EDEDEF',
  };
}

/* 预览墙的唯一渲染路径：作用域限定在这个节点，不污染宿主文档 */
function paintSwatch(host, vars, appearance) {
  host.innerHTML = '';
  /*
   * 只接受真正的变量表（键以 -- 开头）。传错对象时不静默失败：
   * 之前传了整个 definition，Object.keys 拿到 formatVersion/name/…，
   * 拼出一堆无效声明，变量一个没进去，三张卡全部回退成宿主底色。
   */
  const names = Object.keys(vars || {}).filter((k) => k.startsWith('--'));
  if (!names.length) {
    host.textContent = '预览不可用：没有可用变量';
    return;
  }
  const scope = 'data-sw-' + Math.random().toString(36).slice(2, 8);
  host.setAttribute(scope, '');
  const val = (k) => {
    const v = vars[k];
    return v === undefined ? '' : (Array.isArray(v) ? v.join(', ') : String(v));
  };
  const decls = names.map((k) => k + ': ' + val(k)).join(';');

  const style = document.createElement('style');
  style.textContent = '[' + scope + ']{' + decls + ';color:var(--text);background:var(--bg)}';
  host.appendChild(style);

  host.insertAdjacentHTML('beforeend',
    '<div class="sw-ui">' +
    '<div class="sw-side"></div>' +
    '<div class="sw-body">' +
    '<div class="sw-bubble sw-user"></div>' +
    '<div class="sw-bubble sw-agent"></div>' +
    '<div class="sw-row"><span class="sw-chip"></span><span class="sw-btn"></span></div>' +
    '</div></div>');

  /*
   * 保险层：不依赖 <style> 是否被放行。直接写内联样式，
   * 两套同时存在，哪一路通都能出颜色。
   */
  const set = (el, prop, key) => {
    const v = val(key);
    if (el && v) el.style.setProperty(prop, v);
  };
  set(host, 'background', '--bg');
  set(host, 'color', '--text');
  const side = host.querySelector('.sw-side');
  set(side, 'background', '--sidebar-bg');
  const agentBubble = host.querySelector('.sw-bubble.sw-agent');
  set(agentBubble, 'background', '--bg-card');
  set(agentBubble, 'border-color', '--border');
  const userBubble = host.querySelector('.sw-bubble.sw-user');
  const userBg = val('--user-bg') || val('--accent');
  if (userBubble && userBg) userBubble.style.setProperty('background', userBg);
  const btn = host.querySelector('.sw-btn');
  set(btn, 'background', '--accent');
  const chip = host.querySelector('.sw-chip');
  const chipBg = val('--tool-bg') || val('--overlay-subtle');
  if (chip && chipBg) chip.style.setProperty('background', chipBg);

  if (appearance === 'light') host.classList.add('is-light');
}

/* ── 动作 ── */
async function onPreview(definition, missing) {
  if (missing.length) return;
  clearPreview();
  try {
    state.previewHandle = await hana.themes.custom.preview({ definition });
    status.textContent = '预览中，约一分钟后自动结束。要停可以说一声。';
    setTimeout(clearPreview, 55000);
  } catch (e) {
    status.textContent = '预览失败：' + e.message;
  }
}

async function clearPreview() {
  if (!state.previewHandle) return;
  try { await hana.themes.custom.endPreview(state.previewHandle.previewId); } catch (_) {}
  state.previewHandle = null;
}

async function onInstall(entry, analysis, missing) {
  // 不用 window.confirm（iframe 沙箱会拦掉，返回 false 等于静默失败）
  if (missing.length) {
    status.textContent = '缺 ' + missing.length + ' 项核心变量，先补齐再装。';
    return;
  }
  /*
   * 名字加后缀：补丁版的主题 id 是 hana-luna，名字叫「Luna 龙娘 · 玫瑰月影」；
   * 这里装的用户主题如果不加后缀，两个在设置→外观里完全同名，无法区分。
   */
  const finalName = analysis.definition.name + '（配色）';
  const def = { ...analysis.definition, name: finalName };
  try {
    const existing = state.installed.find((s) => s.name === finalName);
    let rec;
    if (existing) {
      const full = await hana.themes.custom.get(existing.id);
      rec = await hana.themes.custom.update(full.id, {
        expectedRevision: full.revision,
        patch: { appearance: def.appearance, variables: def.variables },
      });
      status.textContent = '已更新：' + rec.name + '（revision ' + rec.revision + '）';
    } else {
      rec = await hana.themes.custom.create(def);
      status.textContent = '已装入衣橱：' + rec.name + '。到设置 → 外观里可选。';
    }
    await refreshInstalled();
  } catch (e) {
    status.textContent = '装入失败：' + (e && e.message ? e.message : JSON.stringify(e));
  }
}

async function onApply(id) {
  try {
    const rec = await hana.themes.custom.apply(id);
    status.textContent = '已应用：' + rec.name + '（用户主题即时生效，无需重启）';
  } catch (e) {
    status.textContent = '应用失败：' + (e && e.message ? e.message : e);
  }
}

/**
 * 删除：不用 window.confirm —— App 卡片在受限 iframe 里，
 * confirm() 会被沙箱拦掉并返回 false，表现就是“点了没反应”。
 * 改成二次点击确认：第一次把按钮变成“确认删除？”，再点才执行。
 */
async function onDelete(rec, btn) {
  if (!btn) return;
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.textContent = '确认删除？';
    btn.classList.add('btn-danger');
    setTimeout(() => {
      if (btn.isConnected && btn.dataset.armed === '1') {
        btn.dataset.armed = '';
        btn.textContent = '删除';
        btn.classList.remove('btn-danger');
      }
    }, 5000);
    return;
  }
  btn.disabled = true;
  btn.textContent = '删除中…';
  try {
    const full = await hana.themes.custom.get(rec.id);
    await hana.themes.custom.remove(full.id, { expectedRevision: full.revision });
    status.textContent = '已删除：' + full.name;
    await refreshInstalled();
    render();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (/IN_USE/.test(msg)) {
      status.textContent = '删不了：' + rec.name + ' 正在使用中。先在外观里切到别的主题，再来删。';
    } else {
      status.textContent = '删除失败：' + msg;
    }
    btn.disabled = false;
    btn.textContent = '删除';
    btn.dataset.armed = '';
    btn.classList.remove('btn-danger');
  }
}

/* ── 导入 ── */
fileEl.addEventListener('change', async () => {
  const file = fileEl.files && fileEl.files[0];
  if (file) await handleFile(file);
  fileEl.value = '';
});

/** 统一处理一个皮肤包文件（按钮选择与拖拽共用）。 */
async function handleFile(file) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const result = readPack(json);
    renderImportResult(result, file.name);
    if (result.ok) {
      const pid = result.pack.packId;
      // 同一个 packId 重复导入时替换而非叠加（避免预览墙出现同名重复卡）
      state.packs = state.packs.filter((p) => p.pack.packId !== pid);
      state.packs.unshift({ pack: result.pack, json, fileName: file.name });
      render();
    }
  } catch (e) {
    detailEl.textContent = '读不进 ' + file.name + '：' + e.message;
  }
}

/* 拖拽导入：整个页面接住，不许浏览器直接打开文件 */
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
  for (const file of e.dataTransfer.files) {
    if (!/\.json$/i.test(file.name)) {
      detailEl.textContent = '只收 .skin.json / .skinpack.json，收到：' + file.name;
      continue;
    }
    await handleFile(file);
  }
});

function renderImportResult(result, fileName) {
  const lines = [];
  const head = fileName ? '<b>' + escapeHtml(fileName) + '</b> — ' : '';
  if (result.errors.length) lines.push(head + '<b class="warn">拒绝导入</b>');
  else lines.push(head + '<b>信封校验通过</b>');
  for (const e of result.errors) lines.push('✗ ' + escapeHtml(e));
  for (const w of result.warnings) lines.push('! ' + escapeHtml(w));
  detailEl.innerHTML = lines.join('<br>');
}

fillActions(importBtnEl, [
  makeButton('导入皮肤包', () => fileEl.click(), 'primary'),
]);

/* ── 启动 ── */
async function refreshInstalled() {
  try {
    state.installed = await hana.themes.custom.list();
  } catch (e) {
    status.textContent = '读不到已装主题（权限可能未开）：' + e.message;
    state.installed = [];
  }
}

/**
 * 把运行时快照写进 App 自己的存储，供 Agent 侧工具回读。
 * 目的：拿到"这台宿主到底给不给 palettes"的一手证据，
 * 而不是靠搜服务端 bundle 猜。不需额外 capability。
 */
async function writeDiag(snapshot, error) {
  const diag = {
    at: new Date().toISOString(),
    themeSnapshot: snapshot || null,
    hasPalettesField: !!(snapshot && snapshot.palettes),
    paletteThemes: snapshot && snapshot.palettes
      ? { light: snapshot.palettes.light.theme, dark: snapshot.palettes.dark.theme }
      : null,
    baseSource: state.baseSource || null,
    baseOk: state.baseOk || null,
    baseCounts: {
      light: Object.keys((state.baseParsed && state.baseParsed.light && state.baseParsed.light.vars) || {}).length,
      dark: Object.keys((state.baseParsed && state.baseParsed.dark && state.baseParsed.dark.vars) || {}).length,
    },
    baseSkipped: {
      light: (state.baseParsed && state.baseParsed.light && state.baseParsed.light.skipped) || [],
      dark: (state.baseParsed && state.baseParsed.dark && state.baseParsed.dark.skipped) || [],
    },
    vocabularyCount: (vocabulary() || []).length,
    installedCount: state.installed.length,
    error: error ? String(error && error.message ? error.message : error) : null,
  };
  try { await hana.storage.global.set('wardrobe.diag', diag); } catch (_) { /* 回写失败不影响面板 */ }
  return diag;
}

try {
  state.schema = await hana.themes.custom.getSchema();
  const snap0 = hana.theme.getSnapshot();
  await loadBasePalettes();
  await refreshInstalled();
  render();
  const diag = await writeDiag(snap0, null);
  status.textContent = '衣橱就绪 · 词表 ' + diag.vocabularyCount + ' 项 · 底表 dark=' +
    diag.baseCounts.dark + ' light=' + diag.baseCounts.light +
    '（' + (diag.hasPalettesField ? '宿主提供 palettes' : '宿主未给 palettes，走回退') + '）· 已装 ' +
    diag.installedCount + ' · ' + BUILD;
} catch (e) {
  await writeDiag(hana.theme.getSnapshot(), e);
  status.textContent = '启动失败：' + (e && e.message ? e.message : String(e));
}

hana.themes.custom.subscribe(() => { refreshInstalled().then(render); });

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ════════════════════════════════════════════════════════════
 * 工作台：从零做一个皮肤，导出成 .skin.json
 * 不依赖宿主写权限，纯前端；导出的文件拖回衣橱即可装入。
 * ════════════════════════════════════════════════════════════ */
const editorEl = document.getElementById('editor');
const newBtnEl = document.getElementById('new-btn');

const GROUP_LABEL = {
  background: '背景', accent: '强调', text: '文字', structural: '结构',
  note: '便签', chat: '会话', overlay: '覆盖层', terminal: '终端',
  shape: '圆角', typography: '字体',
};

const editor = { open: false, name: '', appearance: 'dark', vars: {}, dirty: false };

function openEditor() {
  const schema = state.schema;
  if (!schema || !Array.isArray(schema.variables)) {
    status.textContent = '词表未加载，无法新建。请先重载 App。';
    return;
  }
  editor.open = true;
  editor.name = '我的皮肤';
  editor.appearance = 'dark';
  // 初始值：宿主的中性底 + 几何默认，保证 61 项都有值
  editor.vars = { ...GEOMETRY_DEFAULTS, ...(baseFor('dark').vars ? baseFor('dark').vars : state.base.dark || {}) };
  if (state.schema.initialDefinition) {
    editor.vars = { ...state.schema.initialDefinition.variables, ...editor.vars };
  }
  renderEditor();
}

function closeEditor() {
  editor.open = false;
  editorEl.hidden = true;
  editorEl.innerHTML = '';
}

function renderEditor() {
  const schema = state.schema;
  editorEl.hidden = false;
  editorEl.innerHTML = '';

  const head = document.createElement('header');
  head.className = 'ed-head';
  const title = document.createElement('strong');
  title.textContent = '工作台 · 新建皮肤';
  const close = makeButton('关闭', () => { closeEditor(); render(); }, 'quiet');
  head.append(title, close);
  editorEl.appendChild(head);

  const grid = document.createElement('div');
  grid.className = 'ed-grid';

  /* 左：字段 */
  const left = document.createElement('div');
  left.className = 'ed-fields';

  const meta = document.createElement('div');
  meta.className = 'ed-meta';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = editor.name;
  nameInput.maxLength = 60;
  nameInput.addEventListener('input', () => { editor.name = nameInput.value; });
  const nameLabel = document.createElement('label');
  nameLabel.textContent = '名称';
  nameLabel.appendChild(nameInput);

  const appSel = document.createElement('select');
  for (const a of ['dark', 'light']) {
    const o = document.createElement('option');
    o.value = a; o.textContent = a === 'dark' ? '深色' : '浅色';
    if (a === editor.appearance) o.selected = true;
    appSel.appendChild(o);
  }
  appSel.addEventListener('change', () => { editor.appearance = appSel.value; refreshPreview(); });
  const appLabel = document.createElement('label');
  appLabel.textContent = '外观';
  appLabel.appendChild(appSel);
  meta.append(nameLabel, appLabel);
  left.appendChild(meta);

  const byGroup = new Map();
  for (const v of schema.variables) {
    if (!byGroup.has(v.group)) byGroup.set(v.group, []);
    byGroup.get(v.group).push(v);
  }

  for (const [group, vars] of byGroup) {
    const sec = document.createElement('details');
    sec.className = 'ed-group';
    sec.open = group === 'background' || group === 'accent' || group === 'text';
    const sum = document.createElement('summary');
    sum.textContent = (GROUP_LABEL[group] || group) + ' · ' + vars.length + ' 项';
    sec.appendChild(sum);

    for (const v of vars) {
      const row = document.createElement('div');
      row.className = 'ed-row';
      const lab = document.createElement('span');
      lab.className = 'ed-key';
      lab.textContent = v.name;
      lab.title = v.label || v.name;

      let input;
      if (v.type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        const hex = String(editor.vars[v.name] || '#000000');
        input.value = /^#[0-9a-f]{6}/i.test(hex) ? hex.slice(0, 7) : '#000000';
        input.addEventListener('input', () => {
          editor.vars[v.name] = input.value.toUpperCase();
          refreshPreview();
        });
      } else if (v.type === 'length') {
        input = document.createElement('input');
        input.type = 'number';
        input.min = String(v.min ?? 0);
        input.max = String(v.max ?? 32);
        input.value = String(editor.vars[v.name] ?? 8);
        input.addEventListener('input', () => {
          const n = Number(input.value);
          if (Number.isFinite(n)) { editor.vars[v.name] = n; refreshPreview(); }
        });
      } else {
        input = document.createElement('input');
        input.type = 'text';
        const cur = editor.vars[v.name];
        input.value = Array.isArray(cur) ? cur.join(', ') : String(cur ?? '');
        input.addEventListener('input', () => {
          editor.vars[v.name] = input.value.split(',').map((s) => s.trim()).filter(Boolean);
          refreshPreview();
        });
      }
      row.append(lab, input);
      sec.appendChild(row);
    }
    left.appendChild(sec);
  }
  grid.appendChild(left);

  /* 右：预览 + 导出 */
  const right = document.createElement('aside');
  right.className = 'ed-preview';
  const sw = document.createElement('div');
  sw.className = 'swatch';
  sw.id = 'ed-swatch';
  const note = document.createElement('p');
  note.className = 'meta';
  note.id = 'ed-note';
  const actions = document.createElement('div');
  actions.className = 'actions';
  const saveBtn = makeButton('导出 .skin.json', () => exportEditorPack(), 'primary');
  actions.appendChild(saveBtn);
  right.append(sw, note, actions);
  grid.appendChild(right);

  editorEl.appendChild(grid);
  refreshPreview();
}

function refreshPreview() {
  const sw = document.getElementById('ed-swatch');
  const note = document.getElementById('ed-note');
  if (!sw) return;
  paintSwatch(sw, editor.vars, editor.appearance);
  const core = REQUIRED_CORE.filter((n) => !(n in editor.vars));
  if (note) {
    note.textContent = core.length
      ? '缺 ' + core.length + ' 项核心：' + core.join(' ')
      : '61 项齐全，可以导出';
    note.className = 'meta' + (core.length ? ' warn' : '');
  }
}

function exportEditorPack() {
  const core = REQUIRED_CORE.filter((n) => !(n in editor.vars));
  if (core.length) { status.textContent = '还缺 ' + core.length + ' 项核心变量，导出会被宿主拒绝。'; return; }
  const name = (editor.name || '未命名皮肤').trim();
  const pack = {
    schema: 'hana-skinpack/1',
    packId: 'local-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-' + Date.now().toString(36),
    packVersion: '1.0.0',
    names: { zh: name },
    description: '衣橱工作台导出',
    source: { kind: 'original', publisher: 'local', license: 'unspecified' },
    themes: [{
      key: 'default',
      kind: 'vars',
      appearance: editor.appearance,
      palette: {
        bg: editor.vars['--bg'],
        panel: editor.vars['--bg-card'],
        accent: editor.vars['--accent'],
        text: editor.vars['--text'],
      },
      theme: {
        formatVersion: 1,
        name,
        appearance: editor.appearance,
        variables: editor.vars,
      },
      losses: [],
    }],
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = pack.packId + '.skin.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  status.textContent = '已导出 ' + a.download + '。再把它拖回衣橱即可装入（或分享给别人）';
}

if (newBtnEl) {
  fillActions(newBtnEl, [makeButton('新建皮肤', openEditor, 'quiet')]);
}
