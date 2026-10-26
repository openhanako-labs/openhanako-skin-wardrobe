/*
 * 浮层面板 · 取景框 —— 给面板的 ::before 提供几何与背景图。
 *
 * 由 scripts/apply.ps1 追加到 renderer 树 lib/theme.js 的末尾（幂等，见该脚本的
 * 「步骤 10c」）。视觉在 src/panel-frame/dark.css 里。
 *
 * ── 本文件只做三件事 ─────────────────────────────────────────────────────
 *   1. 从 [data-chalkboard-root] 的计算样式反推「背景图那一层」的显示尺寸与原点；
 *   2. 把两个 scrim 层与图片层的局部几何写成 CSS 变量（::before 继承）；
 *   3. 把背景图（3.9 MB 的 data URI）注入一条只设 background-image 的样式表。
 *
 * ── 为什么不再逐帧补偿动画 ───────────────────────────────────────────────
 *   曾经的实现：JS 每帧读 getComputedStyle(el).transform，算补偿值写进 CSS 变量。
 *   两个问题，第二个致命：
 *     1) 写变量会改 background-position → 主线程必须重绘那张 3.9 MB 的图；
 *     2) 入场动画跑在**合成器**线程，主线程一边重绘大图一边追，必然落后，
 *        于是背景按「上一帧的面板位置」补偿 → 真机表现为**朝反方向漂移**
 *        （用户反馈：「还是有抖动，这次是从右向左移了」）。
 *   现在改成：面板的入场动画与 ::before 的**反相动画**同时间轴、同样跑在合成器上
 *   （见 dark.css），合成后恒等，背景钉在屏幕上。JS 只在面板出现 / 视口变化时
 *   写一次**静态**几何，之后完全不参与 —— 没有「追」这回事，也就不会失步。
 *
 * ── 四个实测结论（决定了本文件与 dark.css 的形状）────────────────────────
 *   (1) 不能用 background-attachment: fixed
 *       元素带 transform 时 fixed 背景会被锚到**元素自己**而不是视口。
 *       （探针 probe/bg-attach-test.mjs：坐标编码图 + 像素解码。）
 *   (2) 图不能走 CSS 变量
 *       Chromium 对自定义属性的**值**有长度上限（1.5~2 MB），3.9 MB 的 data URI
 *       会被**静默丢弃**。故由本文件注入样式表提供。
 *       （探针 probe/len-limit.mjs / len-limit-js.mjs。）
 *   (3) 面板的图必须复现**主背景自己的渲染几何**，不能另立一套
 *       主背景是 `cover` + `center` + 视口坐标；第一版按「1:1 不缩放 + 屏幕坐标」
 *       定位，差三处（缩放 / 原点 / 基准），真机错位。
 *       （探针 probe/panel-bg-align.mjs。）
 *   (4) 主背景那串 background-image **不能每次重读**（工单 45）
 *       `getComputedStyle(root).backgroundImage` 读一次 ≈ 19 ms（4 MB 串序列化进 JS），
 *       对它跑一遍 splitBgList ≈ 190~206 ms。而 apply() 原本每帧都做这两件事 ——
 *       设置页/浮层面板一打开，滚动就变成每帧 0.25 s 主线程阻塞。故缓存，见 rootCache。
 *       （真机读数 .scratch/t45-jank/probe1.mjs；本机 Node 交叉验证 bench-split.mjs。）
 *
 * ── 变量（写在**可见圆角面**上，::before 继承）────────────────────────────
 *   --hana-scrim-w / -h / -x / -y   两个 scrim 层：铺满主背景容器
 *   --hana-img-w / -h / -x / -y     图片层：主背景的显示尺寸与原点
 *   四组都是**元素局部**值（相对 ::before 的盒子 = 面板的 padding box）。
 *   后者的语义是「图的 n% 点对齐容器的 n% 点」，与我们要的「绝对对齐」不是一回事。
 *
 * ── 主背景几何怎么算（与 [data-chalkboard-root] 的声明一一对应）──────────
 *   background-size: cover    -> scale = max(rw/W, rh/H)，显示 = (W*scale, H*scale)
 *                   contain  -> scale = min(rw/W, rh/H)
 *                   具体值    -> 直接用（% 按容器换算）
 *   background-position: center / 50%  -> 偏移 = (容器 - 显示) / 2
 *                        left/top    -> 0；right/bottom -> 容器 - 显示
 *                        n%          -> (容器 - 显示) * n%
 *
 * PoC 阶段做「卡片中心」#chalkboardCardCenterPanel；工单 31 扩到
 * 能力 #capabilitiesPanel / 自动化 #automationHubPanel 两个同组件面板，
 * 以及扩展（市场）模态与设置模态两张卡（面不是 floatingPanelInner）。
 * 每个目标的「面选择器」必须与 src/panel-frame/dark.css 的规则**保持一致**。
 */
(function () {
  // ⚠️ 守卫键**必须按主题区分**（2026-10-19 修）：apply.ps1 步骤 10c 把每个主题那段
  //    **链式追加**到同一个 lib/theme.js 末尾，各段若共用同一个 window 标记，
  //    **后追加的那段一进门就 return、整段永不执行** —— 本主题（紫夜）就踩了这个：
  //    月满庭那段先跑并把标记置 true，于是这整段从未执行，五个面板一点图都没有。
  var GUARD = '__hanaPanelFrame:hana-violet-dusk';
  if (window[GUARD]) { return; }
  window[GUARD] = true;

  // 目标表：kind 决定怎么找「可见圆角面」。面 = 背景 ::before 的宿主元素，
  // 也是几何变量的写入点（::before 继承）。
  //   panel    —— 浮层面板：外壳 id + 直接子 [class*="floatingPanelInner"]
  //   market   —— 扩展/市场模态：popup 壳（data-testid）+ 直接子 [class*="container"]
  //   settings —— 设置模态：data-input-ctx-zone="settings" 那张 zone 的**父**卡
  var TARGETS = [
    { kind: 'panel', id: 'chalkboardCardCenterPanel' },
    { kind: 'panel', id: 'capabilitiesPanel' },
    { kind: 'panel', id: 'automationHubPanel' },
    { kind: 'market' },
    { kind: 'settings' },
    { kind: 'confirm' }
  ];
  // 本段只服务这一个主题（另一个主题那段同驻同一个文件，靠 THEME_ID 与上面的 GUARD 区分）。
  var THEME_ID = 'hana-violet-dusk';
  var THEME = ':is([data-theme="' + THEME_ID + '"]) ';
  // 背景图的自然像素尺寸（本主题自己的底图：src/background-violet/assets/violet-aurora.png，
  // 1920×1080）。⚠️ 换底图必须同步改这两个数：面板取景框要靠它反推 cover 几何，
  // 尺寸不对会让浮层面板里的背景错位。
  var IMG_W = 1920;
  var IMG_H = 1080;
  // ⚠️ 必须与月满庭那份 bg.js 用**不同的** STYLE_ID：两份 JS 都是独立 IIFE、都跑在
  //    同一个文档里，而 injectBgImage 是 `el.textContent = css`（整体替换）。
  //    若共用同一个 id，后跑的那份会把先跑那份的规则抹掉（只剩一个主题的面板有背景图）。
  //    2026-10-18 双主题化时发现并修掉。
  var STYLE_ID = 'hana-panel-frame-bg-violet';

  var raf = 0;
  // 已 observe 的面元素（避免重复 observe）。WeakSet：节点卸载后自动回收。
  var observedFaces = (typeof WeakSet === 'function') ? new WeakSet() : null;
  // 每个面元素「上一帧看到的尺寸」（工单 33）。只用于判定**第一次**就绪时尺寸是否已定型。
  var faceSize = (typeof WeakMap === 'function') ? new WeakMap() : null;
  // ResizeObserver：尺寸一变就重算。
  // ⚠️ 这里为什么**排 rAF**（`schedule()`）而不是同步 `apply()`（工单 34 实测过两版）：
  //   同步重算会让「连续两次 apply 尺寸相同」提前在**面板长大之前**的尺寸上满足，
  //   于是第一次就绪落早了 —— 图会带着中间态几何（imgX=-384px）被贴上。
  //   探针 t33-render 的「有图帧位置恒为终值」判据从 0/20 变成 **20/20 失败**。
  //   同步重算确实能在「布局之后、绘制之前」修正变量（按渲染步骤规范），
  //   但这一层节流下的采样粒度**证明不了**（rAF 与 setTimeout 双采样都分辨不出），
  //   而本项目不接受「按规范应该没问题」。故退回 rAF。
  var resizeObs = (typeof ResizeObserver === 'function') ? new ResizeObserver(function () { schedule(); }) : null;

  // 取直接子元素里的目标面（用 children 遍历，不用 querySelector ——
  // 后者可能返回后代，与 CSS 规则的直接子选择器选到不同节点）。
  function directChildMatching(shell, needle) {
    var kids = shell.children;
    for (var i = 0; i < kids.length; i++) {
      if (String(kids[i].className).indexOf(needle) >= 0) { return kids[i]; }
    }
    return null;
  }

  // 按目标类型找「面」。找不到返回 null。
  function findFace(t) {
    if (t.kind === 'panel') {
      var shell = document.getElementById(t.id);
      return shell ? directChildMatching(shell, 'floatingPanelInner') : null;
    }
    if (t.kind === 'market') {
      var popup = document.querySelector('[data-testid="market-modal-overlay"]');
      return popup ? directChildMatching(popup, 'container') : null;
    }
    if (t.kind === 'settings') {
      var zone = document.querySelector('[data-input-ctx-zone="settings"]');
      return zone ? zone.parentElement : null;
    }
    if (t.kind === 'confirm') {
      // 通用确认框（Us.confirm / base-ui AlertDialog）：面是 popup 壳的直接子元素。
      // 2026-10-24：用户要求这个弹窗也走取景框（「改成设置页面那种底」）。
      var ad = document.querySelector('[role="alertdialog"]');
      return ad ? directChildMatching(ad, '_dialog_') : null;
    }
    return null;
  }

  // 该目标面的 ::before 选择器（与 dark.css 里写的一致）。
  // ⚠️ 带 `[data-hana-frame-ready]`（工单 33）：图只对**已经写好几何变量**的面生效，
  // 保证「图出现」与「位置变量就绪」同一时刻，不会出现「图已贴、位置还是兜底 0px」的错位窗口。
  var READY = '[data-hana-frame-ready]';
  function beforeSelector(t) {
    if (t.kind === 'panel') {
      return THEME + '#' + t.id + ' > [class*="floatingPanelInner"]' + READY + '::before';
    }
    if (t.kind === 'market') {
      return THEME + '[data-testid="market-modal-overlay"] > [class*="container"]' + READY + '::before';
    }
    if (t.kind === 'confirm') {
      return THEME + '[role="alertdialog"] > [class*="_dialog_"]' + READY + '::before';
    }
    return THEME + ':has(> [data-input-ctx-zone="settings"])' + READY + '::before';
  }

  // 解析 background-size / background-position 的单个分量，返回 CSS px。
  function sizeOf(token, container, natural) {
    var t = String(token || '').trim();
    if (t === 'cover' || t === 'contain') { return null; }   // 交给调用方按两轴一起算
    if (t === 'auto') { return natural; }
    if (t.charAt(t.length - 1) === '%') { return container * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? natural : n;
  }

  function posOffsetOf(token, container, disp) {
    var t = String(token || 'center').trim();
    if (t === 'center' || t === '50%') { return (container - disp) / 2; }
    if (t === 'left' || t === 'top') { return 0; }
    if (t === 'right' || t === 'bottom') { return container - disp; }
    if (t.charAt(t.length - 1) === '%') { return (container - disp) * (parseFloat(t) / 100); }
    var n = parseFloat(t);
    return isNaN(n) ? (container - disp) / 2 : n;
  }

  // 拆分 background-image / -size / -position 的**顶层**逗号列表。
  // 括号与引号内的逗号不算分隔符：gradient 里的 rgba()、url("data:...") 都带逗号。
  // 【工单 44】以前这里不用拆，全靠「主背景第 2 层是照片」这个硬编码假设 —— 层数一变
  //   就错位（见 dark.css 里那段关于「层下标」的注释）。现在改成逐层映射，不再数下标。
  function splitBgList(v) {
    var out = [], depth = 0, quote = null, cur = '';
    var s = String(v || '');
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (quote) {
        cur += ch;
        if (ch === quote && s.charAt(i - 1) !== '\\') { quote = null; }
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(') { depth++; cur += ch; continue; }
      if (ch === ')') { depth--; cur += ch; continue; }
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) { out.push(cur.trim()); }
    return out;
  }

  // 列表项按下标取，不足时按 CSS 规则循环（值比层数少就重复）。
  function pick(list, i) {
    if (!list || list.length === 0) { return ''; }
    return list[i % list.length];
  }

  // ── 主背景数据缓存（工单 45）─────────────────────────────────────────────
  // 【为什么必须有】主背景的 background-image 里内联着 3.9 MB 的壁纸 data URI。实测两笔账：
  //   * `getComputedStyle(root).backgroundImage` 读一次 ≈ **19 ms**（把 4 MB 串序列化进 JS）；
  //   * 对它跑一遍 `splitBgList` ≈ **206 ms**（真机读数；本机 Node 跑同一份实现 190 ms）。
  //   而 apply() 原本**每次**都做这两件事。设置模态本身就是本文件的 5 个目标之一 ——
  //   它一打开「面」就存在，于是**任何** scroll（`scroll` 不冒泡，但窗口的**捕获**监听
  //   照样收得到内层滚动）或 DOM 变更都会触发 rAF 里的 apply()，每帧最多 0.25 s 主线程阻塞。
  //   用户 2026-10-18 报的「设置页滑动卡顿、自带皮肤不卡」就是这一条。
  //
  // 【失效判据】背景图只在**主题切换**时变，而主题切换必然至少改其中一项：
  //   documentElement 的 data-theme / data-appearance / data-appearance-mode，
  //   或 #themeSheet 的 href（apply.ps1 每次贴入都会换 ?v=）。故拿这三项 + 注入样式表
  //   是否还在做 key；key 变了才重读那 4 MB。
  //
  // 【为什么不加「签名不变就跳过整个 apply」的闸门】缓存在手后，一次 apply() 的剩余成本
  //   只有几次 getBoundingClientRect + 每面十来个 CSS 变量写入（亚毫秒），远低于一帧预算；
  //   再加一道签名闸门只会多一处「漏判则整块背景不更新」的风险。能证明够用了就停在这里。
  var rootCache = { el: null, key: '', image: '', kinds: null, sizeTok: null, posTok: null };

  function rootCacheKey() {
    var de = document.documentElement;
    var link = document.getElementById('themeSheet');
    return [
      de.getAttribute('data-theme') || '',
      de.getAttribute('data-appearance') || '',
      de.getAttribute('data-appearance-mode') || '',
      link ? (link.getAttribute('href') || '') : '',
      document.getElementById(STYLE_ID) ? 'sty' : 'nosty'
    ].join('|');
  }

  // 读一次重活（那 4 MB）并缓存。只有首次 / 主题或注入态变化时才真的读。
  function ensureRootBgCache(root) {
    var key = rootCacheKey();
    if (rootCache.el === root && rootCache.key === key && rootCache.kinds) { return rootCache; }

    var cs = null;
    try { cs = getComputedStyle(root); } catch (e) { return rootCache; }
    var raw = cs.backgroundImage || '';

    // 逐层分类：带 url( 的那层是照片，其余（渐变）是 scrim。
    // 照片层的下标必须**现找**，不能假设它总在固定位置。
    var layers = (raw && raw !== 'none') ? splitBgList(raw) : [];
    var kinds = [];
    var photoIdx = -1;
    for (var li = 0; li < layers.length; li++) {
      var isPhoto = layers[li].indexOf('url(') >= 0;
      kinds.push(isPhoto);
      if (isPhoto && photoIdx < 0) { photoIdx = li; }
    }
    if (layers.length === 0) { kinds = [true]; photoIdx = 0; }
    else if (photoIdx < 0) { photoIdx = 0; }

    rootCache.el = root;
    rootCache.key = key;
    rootCache.image = (raw !== 'none' && raw.indexOf('url(') >= 0) ? raw : '';
    rootCache.kinds = kinds;
    rootCache.sizeTok = String(pick(splitBgList(cs.backgroundSize), photoIdx) || 'cover').trim().split(/\s+/);
    rootCache.posTok = String(pick(splitBgList(cs.backgroundPosition), photoIdx) || 'center').trim().split(/\s+/);
    return rootCache;
  }

  // 从缓存的主背景数据 + root 当前矩形，算「图片那一层」的显示尺寸与原点（视口坐标）。
  // 原 readRootBgImage() 已删除：它唯一的用途是把那串 4 MB 交给注入样式表，
  // 现在那份串由 rootCache.image 提供（同一个字符串对象，`!==` 比较是常数时间）。
  function readRootGeom(root, c) {
    var r = root.getBoundingClientRect();
    var sizeTok = c.sizeTok;
    var posTok = c.posTok;
    var dw, dh;

    var s0 = sizeTok[0], s1 = sizeTok[1] || sizeTok[0];
    if (s0 === 'cover' || s1 === 'cover') {
      var sc = Math.max(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc; dh = IMG_H * sc;
    }
    else if (s0 === 'contain' || s1 === 'contain') {
      var sc2 = Math.min(r.width / IMG_W, r.height / IMG_H);
      dw = IMG_W * sc2; dh = IMG_H * sc2;
    }
    else {
      dw = sizeOf(s0, r.width, IMG_W);
      dh = sizeOf(s1, r.height, IMG_H);
    }

    var ox = r.left + posOffsetOf(posTok[0], r.width, dw);
    var oy = r.top + posOffsetOf(posTok[1] || posTok[0], r.height, dh);

    return { rootRect: r, dw: dw, dh: dh, ox: ox, oy: oy, kinds: c.kinds };
  }

  // 解析 transform-origin（返回布局坐标下的 px 偏移）。
  function readOrigin(el, layoutW, layoutH) {
    var raw = '';
    try { raw = getComputedStyle(el).transformOrigin || ''; } catch (e) { return { x: layoutW / 2, y: layoutH / 2 }; }
    var parts = raw.trim().split(/\s+/);
    function one(tok, dim) {
      if (!tok) { return dim / 2; }
      if (tok.charAt(tok.length - 1) === '%') { return dim * (parseFloat(tok) / 100); }
      var n = parseFloat(tok);
      return isNaN(n) ? dim / 2 : n;
    }
    return { x: one(parts[0], layoutW), y: one(parts[1] || parts[0], layoutH) };
  }

  // 从计算样式的 transform 矩阵里取出 translate 与缩放分量。
  function readTransform(el) {
    var t = '';
    try { t = getComputedStyle(el).transform || ''; } catch (e) { return null; }
    if (!t || t === 'none') { return { tx: 0, ty: 0, s: 1 }; }
    var m = t.match(/^matrix\(([^)]+)\)$/);
    if (m) {
      var p = m[1].split(',').map(function (v) { return parseFloat(v); });
      if (p.length < 6 || p.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: p[4], ty: p[5], s: Math.abs(p[0]) || 1 };
    }
    var m3 = t.match(/^matrix3d\(([^)]+)\)$/);
    if (m3) {
      var q = m3[1].split(',').map(function (v) { return parseFloat(v); });
      if (q.length < 16 || q.some(function (v) { return isNaN(v); })) { return null; }
      return { tx: q[12], ty: q[13], s: Math.abs(q[0]) || 1 };
    }
    return null;
  }

  // 取**布局**矩形（去掉入场动画的 transform）。
  // 为什么必须是布局矩形而不是视觉矩形：背景由 ::before 的**反相动画**补偿，
  // 合成后等价于「面板处在布局位置、没有 transform」—— 所以几何要按布局位置算。
  // 推导（origin 为 O，缩放 S，平移 T）：visualTopLeft = layoutTopLeft + T + O*(1-S)。
  function layoutRectOf(el) {
    var vr = el.getBoundingClientRect();
    var lw = el.offsetWidth || vr.width;
    var lh = el.offsetHeight || vr.height;
    var tf = readTransform(el);
    if (!tf) { return { left: vr.left, top: vr.top, width: vr.width, height: vr.height }; }
    var o = readOrigin(el, lw, lh);
    var k = 1 - tf.s;
    return {
      left: vr.left - tf.tx - o.x * k,
      top: vr.top - tf.ty - o.y * k,
      width: lw,
      height: lh,
    };
  }

  // 把背景图注入一条只设 background-image 的样式表（::before 无法设内联样式）。
  // 为什么不写进主题 CSS：那是 3.9 MB 的 data URI，写两份会让主题文件翻倍。
  function injectBgImage(bgImage) {
    var el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      if (document.head) { document.head.appendChild(el); }
      else { return; }
    }
    var sel = TARGETS.map(beforeSelector).join(', ');
    var css = sel + ' { background-image: ' + bgImage + '; }';
    if (el.textContent !== css) { el.textContent = css; }
  }

  function apply() {
    // 主题门（2026-10-19）：本段只在自己主题下动手。
    // 为什么不能「两段都跑」：每段注入的图取自**当前 root 的背景图**，
    // 主题不匹配的那段会把别人的图写进自己的选择器里，切回自己主题时就是错图；
    // 两段的几何变量还同名（--hana-img-*），底图尺寸不同时会互相打架。
    if (document.documentElement.getAttribute('data-theme') !== THEME_ID) { return false; }
    var open = false;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // 只在真有目标面要贴时才去读根节点的计算样式（getComputedStyle 不便宜）。
    var faces = [];
    for (var k = 0; k < TARGETS.length; k++) {
      var f = findFace(TARGETS[k]);
      if (f) { faces.push(f); }
    }
    if (faces.length === 0) { return false; }

    var root = document.querySelector('[data-chalkboard-root]');
    var c = root ? ensureRootBgCache(root) : null;
    if (c && c.image) { injectBgImage(c.image); }

    // c.kinds 为 null = 缓存没建起来（getComputedStyle 抛错 / 还没读到背景），
    // 这时和原实现一样返回 g = null，绝不让 sizeTok=null 漏进 readRootGeom。
    var g = (root && c && c.kinds) ? readRootGeom(root, c) : null;

    for (var i = 0; i < faces.length; i++) {
      var el = faces[i];
      // 尺寸一变就重算（自动化面板插入时尺寸会从中间态长到终态）。
      if (resizeObs && observedFaces && !observedFaces.has(el)) {
        observedFaces.add(el);
        resizeObs.observe(el);
      }

      var r = layoutRectOf(el);
      if (r.width === 0 || r.height === 0) {
        el.removeAttribute('data-hana-frame-ready');
        continue;
      }
      open = true;

      // 尺寸是否已定型（与上一帧相同）。**只用于第一次就绪的闸门**，见下方的就绪门。
      var sizeKey = el.offsetWidth + 'x' + el.offsetHeight;
      var settled = faceSize ? (faceSize.get(el) === sizeKey) : true;
      if (faceSize) { faceSize.set(el, sizeKey); }

      // ⚠️ ::before 的包含块是** padding box**（border 之内），而 layoutRectOf 给的是
      // border box（getBoundingClientRect）。面板外壳带 1px border 时（实测：自动化面板、
      // 设置卡、市场卡都有），变量必须再减掉 border 宽度，否则整张图偏 1px
      // （在照片底部渐变陡处会放大成 20+ 色阶的可见错位）。
      var bl = el.clientLeft || 0;   // = borderLeftWidth（clientLeft 就是 border 宽度）
      var bt = el.clientTop || 0;
      var originLeft = r.left + bl;
      var originTop = r.top + bt;

      // 量化到 0.01px，抹掉浮点噪声。
      function q(v) { return Math.round(v * 100) / 100; }

      if (g) {
        // 下面四个仍是「单层」语义的值，留着**仅供诊断**（CSS 已不再直接读它们，
        // 改由 --hana-before-size / --hana-before-pos 整体下发，见下）。
        el.style.setProperty('--hana-scrim-w', q(g.rootRect.width) + 'px');
        el.style.setProperty('--hana-scrim-h', q(g.rootRect.height) + 'px');
        el.style.setProperty('--hana-scrim-x', q(g.rootRect.left - originLeft) + 'px');
        el.style.setProperty('--hana-scrim-y', q(g.rootRect.top - originTop) + 'px');
        el.style.setProperty('--hana-img-w', q(g.dw) + 'px');
        el.style.setProperty('--hana-img-h', q(g.dh) + 'px');
        el.style.setProperty('--hana-img-x', q(g.ox - originLeft) + 'px');
        el.style.setProperty('--hana-img-y', q(g.oy - originTop) + 'px');

        // ── 逐层下发 background-size / -position（工单 44）──────────────────
        // 为什么不再写成 CSS 里那串固定 3 项的声明：
        //   原先 dark.css 写死「[scrim][scrim][图]」三组值去对主背景的
        //   「[左列 scrim][照片]」两层 —— 值是**按位置**对应的。2026-10-14 删掉主背景
        //   的底部 scrim 后层数从 3 降到 2，::before 却还是三项，于是第 2 个图（照片）
        //   取到第 2 项几何（= 视口 1920×1032），而照片自己的显示尺寸是 1920×1080：
        //   同一张图在面板里被纵向放大 4.65%，月亮跨面板边缘就错位一戟。
        //   实测：::before 算出 1920px 1032px / -481px -97px，变量里却是 1080px / -121px。
        //   现在直接按**主背景真实层数与类型**逐层生成，面板与主背景永远同构，
        //   以后增删背景层不需要再回来改这里（这是本坑第二次复发，不再靠“记得改第三处”）。
        var sizeParts = [], posParts = [];
        for (var gi = 0; gi < g.kinds.length; gi++) {
          if (g.kinds[gi]) {
            // 照片层：主背景的显示尺寸与原点
            sizeParts.push(q(g.dw) + 'px ' + q(g.dh) + 'px');
            posParts.push(q(g.ox - originLeft) + 'px ' + q(g.oy - originTop) + 'px');
          }
          else {
            // scrim（渐变）层：铺满主背景容器
            sizeParts.push(q(g.rootRect.width) + 'px ' + q(g.rootRect.height) + 'px');
            posParts.push(q(g.rootRect.left - originLeft) + 'px ' + q(g.rootRect.top - originTop) + 'px');
          }
        }
        el.style.setProperty('--hana-before-size', sizeParts.join(', '));
        el.style.setProperty('--hana-before-pos', posParts.join(', '));
      }

      // ── 原子就绪（工单 33 / 工单 34）─────────────────────────────────
      // 【工单 33 要解决的问题】图由 injectBgImage 注入的样式表提供，选择器是**全局**的 ——
      //   面一被找到就会被贴上；而几何变量要等 `g`（根几何）拿得到才写得出来。
      //   两者不同步时会出现「图已贴、位置变量还没写」的窗口，那一瞬 `::before` 用 CSS 兜底值
      //   `0px 0px` 定位 → 背景先错位、再跳到正确位置。
      //   解法：图只对带 `data-hana-frame-ready` 的面生效，该属性只在**本次已写好几何变量**时打上。
      //   于是「看得见图」⟺「变量是对的」，错位窗口不存在。
      //
      // 【工单 34】原实现错在两个字：**双向**。
      //   自动化是 `_stagePanelFramed` 变体，内层面插入后尺寸从 1120x960 长到 1318x996，
      //   而每一次「不就绪」的分支都会 `removeAttribute` —— 实测一次开面摘两次。
      //   更要紧的是**就绪之后**：真机上自动化面板的异步内容晚到，会再触发一次尺寸变化，
      //   于是标记被摘 → 图消失 → 下一帧又贴上 = **有图 → 空白 → 有图**。
      //   用户 2026-10-12 截的三张图就是这一幕（序列由他标定，上一张有图、中间一张整片平色、
      //   第三张又有图，且三张里壁纸位置逐像素重合）。
      //   复现与修复：探针 probe/t34-late.mjs（就绪后改尺寸）。
      //     旧：4/4 轮摘掉标记（`remove[有]`）+ 1 个无图帧；新：**0/4**。
      //   就绪应当是**单向闩锁**：原子性只在「图第一次生效」那一瞬需要；图已贴上之后，
      //   变量重写与图本来就在同一帧的样式重算里生效，摘图只会白造一次闪断。
      //
      //   而「尺寸已定型」这个闸门**保留**（只用于第一次就绪）—— 它管的是另一件事：
      //   面板成长中的几何算的是 1120x960 那一版（实测 imgX=-384px，终值 -361px，差 23px，
      //   因为尺寸变化时布局左边缘同时挪了 24px）。
      //   工单 34 试过「不等定型、先贴图」（同步 RO 让就绪落早），结果 t33-render 从 0/20
      //   变成 20/20 失败（有图帧带着中间态几何）—— 否决，见 resizeObs 处注释。
      if (g && (settled || el.hasAttribute('data-hana-frame-ready'))) {
        // 只写一次（闩锁语义写清楚，也免掉每次重算都发一条同值属性变更）。
        if (!el.hasAttribute('data-hana-frame-ready')) {
          el.setAttribute('data-hana-frame-ready', '');
        }
      }
      else {
        el.removeAttribute('data-hana-frame-ready');
        schedule();
      }
    }
    return open;
  }

  function tick() {
    raf = 0;
    apply();
  }

  // 面板出现 / 消失是 DOM 变化；视口变化要重算几何。
  // 注意：这里**没有**逐帧循环 —— 动画完全由 CSS 负责（见 dark.css），JS 不参与。
  function schedule() {
    if (raf) { return; }
    raf = window.requestAnimationFrame(tick);
  }

  // 重算时机（工单 31 / 32 反复踩出来的，顺序即优先级）：
  //   1) ResizeObserver（**最关键**，工单 32 新增）：面元素尺寸变化就重算。
  //      自动化面板插入时尺寸从 0 长到满，而 transform-origin 随尺寸变 —— 用旧 origin 反解
  //      会算出错的 layoutLeft，且之后无人重算（framed 变体外壳 `transition:none`，
  //      `transitionend` 不触发；`animationend` 要等 375ms）→ 背景偏 24px 并**跳变**一次，
  //      就是用户看到的「背景从左上往右下移动」。这一条直接对准根因。
  //   2) transitionend / animationend：兜底（另两个面板尺寸写死，第一帧就正确，用不上）。
  //   3) resize / scroll（视口）与 MutationObserver（面板出现 / 消失）。
  // 全部只重算、不逐帧，不会退回「追合成器」那条老路。
  function onSettle() { schedule(); }
  window.addEventListener('transitionend', onSettle, true);
  window.addEventListener('animationend', onSettle, true);

  window.addEventListener('resize', schedule);
  window.addEventListener('scroll', schedule, true);

  if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  // 切主题只是改 <html data-theme>（上游 applyTheme 走 setAttribute，**不发事件**），
  // 属性变化不进上面那条 childList/subtree 观察 —— 必须单独盯属性，否则切到本主题后
  // 要等下一次滚动 / 开面板才重算，那期间面板上贴的还是上一个主题的图。
  if (typeof MutationObserver === 'function') {
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  schedule();
})();
