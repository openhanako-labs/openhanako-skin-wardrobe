# CHANGELOG

版本号规则：`MAJOR.MINOR.PATCH`，只管**仓库这份皮肤包**的版本，跟 Hana 自己的版本号无关。

- **MAJOR**：需要重做贴入方式的改动（例如从「改安装目录」改成官方主题包格式）。
- **MINOR**：新增主题 / 新增覆盖层 / 分享包结构变化，但要贴的还是同一套流程。
- **PATCH**：锚点跟版、配色微调、bug 修复。

`share.json` 里的 `skinVersion`（12 位哈希）是另一件东西：它是**合成后主题 CSS 的内容指纹**，用来给 `?v=` 绕缓存。两者别混。

---

## 0.1.5 — 2026-10-25

**第四套主题「陶土」+ 跟版 1.2.1-beta + 思考指示器换成呼吸星芒**

- **新增 hana-claude-clay（陶土 · 暖纸，浅色）**：配色取 Anthropic 官方品牌六色
  （Clay `#D97757` / Slate Dark `#141413` / Ivory Light `#FAF9F5`），与 Deepsleep 刻意做成
  同一明暗档位下的两个色温极端。四份补丁同步扩容：三份注册表 11 → 15、卡片预览配色
  36 → 48 条、卡片调色板 +1 项（15 键）、五个语言各 +2 键（`claudeClay` / `claudeClayMode`）。
- **跟版 Hana 1.2.1-beta**：16 → 18 个文件，四处注册表锚点未变，dry-run 与 check 全绿；
  `share.json` 的 `verifiedHanaVersions` 记上 1.2.1-beta。
- **思考指示器**：用户认为原先的「思考态鲸鱼」不对（2026-10-20 那版按 `data-hana-think`
  档位切 sway / wag / twist 四套轮廓），改为十道不等长的星芒呼吸（`scale 1.06 ⇄ 1.22`、
  `opacity .78 ⇄ 1`、2.2s），只作用于陶土主题；鲸鱼那套 APNG 与四组矢量轮廓整段撤掉，
  陶土主题 CSS 从 904 KB 降到 715 KB。Deepsleep 的鲸鱼保持原样。

---

## 0.1.4 — 2026-10-24

**圆角基线 + Code 页圆角恢复 + 推理浮窗玻璃**

- **圆角基线**（三主题 × 两档材质）：聊天四件（头像 / 用户气泡 / 思考框 / 输入卡）
  用与上游完全相同的表达式（token × `--corner-radius-scale`）显式声明，观感零变化，
  只防上游改默认值后被动漂移。
- **Code 页（`card:code-chat`）圆角恢复**：官方在该卡片作用域里把
  `--corner-radius-scale` 与八个 `--radius-*` 全清零（真机：card 上 scale=0、radius-*=0），
  所以 Code 页原本全是直角。改为把主页那套 token 与 scale 按**字面值**搬回该作用域，
  并对头像 / 气泡 / 思考框 / 代码块 `pre` / 输入卡**逐元素复述**
  （官方在 `._input-wrapper_` 等元素自身又清了一次，继承传不进去）。
  真机读数：气泡 22.09 / 思考框 14.73 / 输入卡 44.18 / 发送按钮 18.41 / 头像 92.04%（clamp 后仍正圆）。
- **推理浮窗玻璃**：`div[class*="_thinkingPopup_"]` 并入与模型浮窗同一条规则
  （0.60 白 + blur 30 / saturate 140%），真机逐值一致。

---

## 0.1.3 — 2026-10-24

**跟版 1.1.111-beta：脚本侧两处硬伤修掉，皮肤内容本身一字未改**

这次是纯重贴（Hana 从 1.1.35-beta 跳到 1.1.111-beta，旧改动留在旧版本目录），
但 `apply.ps1` 在新构建上连撞两道墙。两处都改在**脚本**里，`src/` 未动，
所以合成后的主题 CSS 与 `skinVersion`（`?v=ff9145937b2cad62`）跟 0.1.2 完全一致。

1. **i18n 写入从「整份重序列化」改成「文本级局部插入」**（根因在上游，不在我们）
   - 旧写法依赖一条前置断言：`ConvertTo-Json(ConvertFrom-Json(文件))` 必须与原文件逐字节
     相同。这条断言在 1.1.111 的**五个 locale 文件上全部失败** —— 上游自己在
     `locales/*.json` 里留下了不规整的格式：
     - `"thinkingLevelHint"` 在同一个对象里出现**两次**（重复键会在往返里被合并掉）
     - 还有缩进错位的行（`input` 对象里 `newSessionChoicesLoadFailed` 写成 4 空格，该是 6）
   - 于是改成**只碰目标成员那几个字符**：扫 `settings.appearance` 对象的字符区间，
     把新键插在最后一个成员之后（缩进取该成员行首空白），其余字节原样保留。
     对上游格式的规整度不再有任何依赖 —— 上下游再手改 locale 也不会炸。
   - 新增四个文本级原语：`Get-JsonClosingBracketIndex`（括号配对，跳过字符串与转义）/
     `Find-JsonValueEnd` / `Get-JsonDirectMembers`（只认深度 1 的键，嵌套同名键不会误伤）/
     `ConvertTo-JsonStringLiteral`（不转义非 ASCII，与上游写法一致）。
   - 判据（字节级，不是 JSON 语义等价）：对五个文件各做「最长公共前缀 + 最长公共后缀」，
     要求 `前缀 + 后缀 = 原文件全长`，插入段恰好「一个逗号 + 6 个键行」、键序与片段一致、
     值逐字一致、插入行缩进 = 原最后一项缩进、插入点之后与原文件逐字节相同。
     证据：`.scratch/t51-locale-textedit/`（`test-locale-primitives.ps1` + `judge-locale-insert.ps1`，全绿）。

2. **`lib/theme.js` 的「新建 `<link>`」锚点跟版：`s` → `r`**
   - 1.1.111 把主题切换函数重写了：新建的 `link` 变量从 `s` 变成 `r`，
     其余三个角色（主题对象 `o`、主题表 link `E`）没变。
   - 顺带注意：快路径的**判据**也换了 —— 旧版比 `(<link>.href===<obj>.cssPath)`（相对路径），
     新版比 `E.href===s`，其中 `s = new URL(cssPath, baseURI).href`（绝对 URL）。
     结论不变：只要 `new URL` 那一处与三处「设 href」一起加版本串，`E.href` 解析后自然等于 `s`，
     快路径仍命中；只给其中一处加就会永远走慢路径。
   - 贴入后断言：`HANA_SKIN_CSS_V` 共 5 处（1 声明 + 4 处 URL），四处都带 `+HANA_SKIN_CSS_V`。

贴入结果（1.1.111-beta）：19 个文件、四处注册表主题数 11 → 14、卡片调色板 11 → 14、
五个 locale 各 +6 键、`check.ps1` 16/16 文件 OK + 17/17 档位自洽。
备份：`E:\OH-WorkSpace\_hana-backups\1.1.111-beta-…-20261024-225321`。

⚠️ 本版改了 **server bundle**（注册表 + 卡片调色板），必须重启 Hana 才生效（不是 Ctrl+R）。

---

## 0.1.2 — 2026-10-24

**通用确认框（alertdialog）从毛玻璃改成取景框**（用户要求「改成设置页面那种底」）

- 做法与设置模态同构：面（`[role="alertdialog"] > [class*="_dialog_"]`）的 `::before`
  铺当前主题壁纸、按屏幕坐标对齐，再在 `::before` 上叠一层与 `.settings-panel` 同档的纱：
  - `hana-moonlit-court` `rgba(23,39,37,0.70)` / `hana-violet-dusk` `rgba(60,53,74,0.70)` /
    `hana-deepsleep` `rgba(255,255,255,0.20)`（浅色比设置的 0.15 厚一档，弹窗小、文字密）
- 修了两个真机坑：
  1. **纱必须挂在 `::before` 上**。先写在元素上，元素 inset 阴影属于「背景与边框」那一步，
     被 `z-index:-1` 的壁纸整个盖掉 —— 元素 shadow 有值、画面上一点纱都没有。
  2. 就绪门照旧：壁纸与纱都挂在 `[data-hana-frame-ready]`，未就绪时退回 0.1.1 那层毛玻璃，
     不会出现「图已贴、坐标还是 0px」的错位窗口。
- 入场是 `hana-scale-in`（`scale(.96) translateY(8px)`），反相动画照抄市场那套
  （函数顺序 scale 在前，无 fill-mode 所以面要显式 `position:relative; z-index:0`）。
- `bg.js` 的 `TARGETS` 新增 `{ kind: 'confirm' }`（findFace / beforeSelector 各加一支）。
  ⚠️ **这一条改在 `lib/theme.js`，属于启动时加载，必须重启 Hana**（纯 CSS 改动才只需 Ctrl+R）。
- 真机复核（月满庭）：`ready = true`、`::before` 背景图长 3 925 288、逐层 size `1920px 1032px, 1920px 1080px`、
  逐层 pos `-750px -410.98px, -750px -434.98px`、`::before` shadow = `rgba(23,39,37,0.7) 0 0 0 9999px inset`。
  入场采样 60ms 后坐标已就位（0ms 那帧 ready 未打、不显图）。截图 `.scratch/crop/confirm-frame-final.png`。

---

## 0.1.1 — 2026-10-23

**市场「确认安装」对话框改成毛玻璃**（用户报「背景的字太透了」）

- 现场：这个 dialog 只吃 `--bg-card`（= `rgba(255,255,255,0.76)`），`backdrop-filter` 为 `none`。
  0.76 只提亮不遮挡，背后市场卡片的标题 / 描述 / 蓝色「安装」按钮原样穿进面板，
  与面板自己的「描述 / 安装来源 / 能力」逐行叠字。
- 锚点：`[class*="_overlayContent_"] > [role="dialog"]`。`_overlayContent_` 全构建只属于
  `InstallReviewDialog` 一个组件；用 `[role="dialog"]` 会连带命中设置弹窗、市场模态、项目名弹窗。
- 三档配色（2026-10-23 用户要求「三个主题数值统一」）：
  - `hana-deepsleep`：`rgba(255,255,255,.80)` + `blur(26px) saturate(140%)`
  - `hana-moonlit-court`：`rgba(34,52,48,.80)` + `blur(26px) saturate(125%)`
  - `hana-violet-dusk`：`rgba(61,57,74,.80)` + `blur(26px) saturate(125%)`
  填充与模糊半径三主题逐值一致；saturate 保留各自的 140 / 125（它不是厚度参数，
  是按底色色相调的：深色 140% 会把背后的冷绿拉艳）。
- 调值过程：深色初版 `.88` / `blur24` 一看就像实心板（字糊没了，但「后面有东西」那层
  信息也没了），降到 `.80` 配 `blur(26px)`；浅色原来 `.82` / `blur24`，实测降到 `.80`
  每像素平均只差 1.88/255（0.7%），改与不改看不出区别，为以后只改一个数而归一。
- 取值依据：真机四档同框对照（`.scratch/crop/glass-compare.png`）。0.78/blur18 仍能读出
  「Hana Downloader」的字形轮廓；0.82/blur24 只剩柔光；0.88/blur30 已是死白，玻璃感消失。
  深色四档：`.scratch/crop/moonlit-4tiers.png`（0.85 无模糊 / 0.88 / 0.84 / 0.78）。
  浅色三档：`.scratch/crop/light-3tiers.png`（0.82/24 与 0.80/26 与 0.78/26）。
- 三个主题均在真机复核过实际 CSS 计算值（均 `.80` / `blur26`；saturate 各自 1.4 / 1.25 / 1.25），
  截图见 `.scratch/crop/unified-deepsleep.png`、`moonlit-080.png`、`dark-hana-violet-dusk.png`。

**同一套毛玻璃扩到通用确认框（alertdialog）**（用户报「切换模型弹窗字有点看不清」）

- 现场：`div._popup_ba84f [role="alertdialog"]` → `div._container_7cf03 _container-animated_705b6 _dialog_ecdc0`
  （420×210，`bg = rgba(255,255,255,0.76)`、`bf = none`）。外层全屏且 transparent，
  真正可见的面是它的直接子元素；背后是聊天正文，只压 24% 白时正文逐行穿过面板。
- 锚点：`[role="alertdialog"] > [class*="_dialog_"]`。`alertdialog` 是 base-ui 的 AlertDialog 类型，
  全构建只由 `preview-session-tabs` 里 `e === "alert-dialog"` 一处产出，对应 `Us.confirm(...)`：
  模型切换以及其他所有「问一下再做」的确认框都是它，一次覆盖到位。
- 数值与「确认安装」完全一致（`.80` + `blur26`）：两个弹窗同源同底色，不同档位会在同一会话里
  来回切时看出厚度。对比图 `.scratch/crop/confirm-before-after.png`。

---

## 0.1.0 — 2026-10-23

第一个定版。此前四期迭代一直在滚动开发，没有版本号；这一版把当时仓库的状态收成一个可指认的点。

**包含什么**

- 三个主题，各自独立一套源（配色 / 材质 / 背景 / 取景框），互不引用：
  - `hana-moonlit-court` 月满庭 · 夜阑（深色）
  - `hana-violet-dusk` 极光 · 夜穹（深色）
  - `hana-deepsleep` Deepsleep（浅色，材质参数反向：描边用墨水色、overlay 压深而非提亮）
- 四层覆盖：配色变量表 → 背景图（data URI 内联）→ 材质（半透明填充 + 1px 边线 + 高光，不用 `backdrop-filter`）→ 浮层面板取景框（卡片中心 / 能力 / 自动化 / 扩展（市场）/ 设置）。
- 贴入方式：外部 PowerShell 脚本改 Hana 安装目录的构建产物（renderer 树 + server 树，16 个文件），写入前逐文件备份，`restore.ps1` 可整体回滚。
- 版本闸门是**提醒不是拦截**：未验证的 Hana 版本照跑全量断言（锚点 + 计数 + node 真求值），全中就贴，失配则在写盘前中止，照 `REPAIR.md` 重定锚点。
- 卡片调色板：server bundle 的 `MGr` 表为三个主题各补一项，folio 幻灯片可直接传 `theme=<主题 id>`；同表既有 11 项逐键逐值未变。
- 分享包：`scripts/pack-share.ps1` 打出可给别人用的 zip，内含 `README.md` / `REPAIR.md` / `INSTALL.md` / `share.json` / 五个脚本 / `src` / `patches`。

**已验证环境**

- Hana `1.1.35-beta`（win32-x64，renderer 构建 `078ca969122e698c`，server 构建 `5bc0635ad404daea`）
- PowerShell 7（`pwsh`）、Node 18+
