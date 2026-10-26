# 版本对不上怎么办：自己修锚点

这份文档写给「正在帮用户贴皮肤的 Hana」。它讲一件事：Hana 升级了、皮肤说锚点找不到时，
该改什么、改哪里、怎么验。

先说清楚性质：**皮肤不改 Hana 的逻辑，它只是往构建产物里按文本插入几段东西。**
插入点用「锚点」（目标文件里一段唯一文本）描述。Hana 每次升级都是新的一份构建，压缩器可能重排、改名、加字段，锚点就可能对不上。于是：

- 失配 ≠ 坏掉。dry-run 的断言全在写盘前跑完，锚点没中就中止，一个字节都不写。
- 要修的是**皮肤侧的描述**（`patches/*.patch` 与 `scripts/apply.ps1` 里的一张表），不是 Hana。
- 上游小跳版本时，锚点往往仍然成立 —— 先直接跑 dry-run，别预设它坏了。

---

## 循环三步

```powershell
pwsh -File .\scripts\install.ps1        # 1. 跑 dry-run，看卡在哪一步
# 2. 按下面「按步骤查」对应那一节改锚点
pwsh -File .\scripts\install.ps1        # 3. 再跑，直到「dry-run 通过」
pwsh -File .\scripts\install.ps1 -Apply # 4. 通过了才真贴
```

先拿到两个版本目录，后面所有文件都在它们里面（只读，不要改）：

```powershell
pwsh -File .\scripts\locate.ps1 -AsJson
# -> rendererVersionDir / serverVersionDir
```

---

## 按步骤查

dry-run 的输出分步骤（`[步骤 7-9]`、`[步骤 9b]`、`[步骤 10]`、`[4b]` 等），
报错行会带 patch 名或组件名。对着下表找。

### ① 步骤 7-9：三处主题注册表

- **patch**：`patches/theme-registry-renderer.patch`（renderer `lib/theme.js`）、
  `theme-registry-bundle.patch`（renderer `assets/*.js`）、`theme-registry-server.patch`（server `bundle/index.js`）
- **锚点是什么**：内建主题表里**最后一项**（`coral`）的完整文本。压缩风格形如
  `coral:{cssPath:"themes/coral.css",backgroundColor:"#f4a582",...}`，
  server 那份是带空格的 `coral: { cssPath: "themes/coral.css", ... }`。
- **为什么要求「最后一项」**：patch 声明 `followedByStructure: closing-braces`，插完必须紧跟对象闭合 `}`。
- **怎么重定**：在目标文件里搜 `themes/coral.css`，把它所在那一项的**完整文本**抄下来当 `anchor`。
  目标文件是压缩产物，抄的时候别自己加空格 —— 三份 patch 的风格必须与各自文件一致。
- **insertText**：四个主题项，字段与顺序同 `scripts/apply.ps1` 的 `ThemeDefs`
  （月满庭 → 极光 → Deepsleep），`i18nName` / `i18nMode` 指向 `settings.appearance.*`。
- **计数**：报错会打印「改前主题数为 N」。把这个 patch 的 `countBaseline` 设成 N、
  `expectedCountAfter` 设成 N+4（我们的四个主题）。

### ② 步骤 10：设置页主题卡片配色

- **patch**：`patches/theme-card-preview.patch`，一个文件两个 target（renderer / server 各一份）
- **难点**：规则里的类名带构建哈希 ——`._theme-card_<hash>`、`._theme-card-name_<hash>`、
  `._theme-card-mode_<hash>`，**两棵树的哈希不同，每次构建都会变**。
- **怎么重定**：在 `assets/SettingsModalShell-*.css` 里搜 `_theme-card_`，抄这一版构建的类名；
  `anchor` 取该文件里卡片规则的最后一条（原来取的是 coral 那三条）；
  `insertText` 用同一串类名生成「3 主题 × 3 条」（卡片底色=`--bg`、主题名=`--text`、模式标签=`--accent`）。
- `contentFeatures` 是在通配命中的多个候选文件里挑对的那个，一般不用改。

### ③ 步骤 9b：卡片调色板

- **patch**：`patches/card-palette-server.patch`；锚点是 server `bundle/index.js` 里 `MGr` 表最后一项（coral）。
- **insertText 不用手写**：脚本会用 `paletteKeys` + `byThemeId` 重建它并逐字比对，
  所以你只需要改 `anchor` 与 `countBaseline` / `expectedCountAfter`（同样 N 与 N+3）。
- 每个主题 15 个键，键集必须与内建项一致；值取自 `src/<主题>.css`。
- 为什么必须有这张表：folio 幻灯片烧主题走 `nYr()` 查它，缺项会抛 `no card palette for theme`。

### ④ 步骤 4b：主题 CSS 的版本参数（最常坏的一处）

- **不吃 patch**，吃 `scripts/apply.ps1` 里的 `$script:ThemeCacheBustSites`（4 条）与常量声明锚点
  `(function(){"use strict";`。
- 那 4 条里带的是**压缩器分配的局部变量名**（单字母），上游重新构建就会变。按**角色**认，不要按名字：
  - (B) 主题对象：`new URL(<x>.cssPath,document.baseURI).href` 里的 `<x>`
  - (C) 主题表 link：`(<link>.href=<主题对象>.cssPath)` 这个快路径分支里的第一个
  - (D) 新建 link：`<new>.href=<主题对象>.cssPath;`（紧跟 `rel="stylesheet"`）
  - (E) 主题表 link：load 回调里 `<link>.href=<主题对象>.cssPath}`
- **怎么重定**：读新构建的 `lib/theme.js`，认出这四个角色，把 4 条 `Before` / `After` 换成新变量名。
  每处的改前锚点在文件里必须恰好命中 1 次（这是脚本的断言）。
- **不想修也能装**：`-ThemeCacheBust none`。代价是主题 CSS 的 URL 不随内容变化，
  升级皮肤后可能要吃一次浏览器缓存（旧样式不刷新）。只在「其它都通、就差这一处」时用。

### ⑤ 不需要修的地方

- `locales/*.json`：只按「键是否已存在」增键，没有锚点。
- 浮层面板取景框 JS：靠标记行 `/* hana-panel-frame */` 幂等，没有锚点。
- 主题 CSS：整份覆盖写，内容全来自 `src/`，与构建无关。

---

## 修完必须这样验

1. `install.ps1` 的 dry-run 通过（全部锚点命中、计数吻合、node 真求值无异常）。
2. `install.ps1 -Apply`，末尾会自动跑 `check.ps1`。要 17 项全绿，
   其中一项专门查「三份注册表里四个主题条目真的在文件里」—— 这一项红了说明某处被覆盖了。
3. **让用户重启 Hana**（完全退出再启动），然后肉眼确认：主题列表里有这三个名字、切换后
   背景壁纸透出、面板半透明、外圈有细描边。不重启不发话。
4. 如果你在长期维护这个包：把这次贴成功的版本写进 `share.json` 的 `verifiedHanaVersions`
   与 `verifiedAt`，下次别人就不用再修一遍。

---

## 红线

- **不要手改 Hana 安装目录里的任何文件。** 所有写盘都走 `apply.ps1`（它会备份、会两阶段执行）。
- **不要为了让 dry-run 变绿而放宽断言**（`onAnchorMissing` / `onAnchorNotUnique` / 计数 / 结构校验）。
  那些断言是唯一保证「贴进去的东西位置对」的东西，放水等于把错误写进用户的 Hana。
- **不要跳过 dry-run 直接 `-Apply`。**
- **修不动就停。** 把 dry-run 的输出原样交回用户 / 会看的人，一句「我来硬贴」都不要说。
