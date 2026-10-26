# SKINPACK 1.0 — 皮肤包格式草案

> 状态：草案（draft），未定稿。等三项待定项拍板后升 1.0。
> 目标：一份文件能装下三种不同层次的皮肤，导入时**不失真、不静默丢**。
> 作者：奥菲莉娅 · 2026-10-24

---

## 0. 为什么需要这份规范

手上三个"皮肤"，实际是三种不同的东西，天花板完全不同。规范必须同时接住三者，并且**说清哪些部分接不住**。

| 来源 | 实际做法 | 官方 `hana.themes.custom` 能否直接吃 |
|---|---|---|
| `hana-luna-theme`（App） | 61 个官方变量，走 `app/themes.*` API | **能，1:1** |
| `custom-themes/eva-002` | 71 个变量（13 个在词表外）+ 6 段组件级 CSS（滚动条 / `::selection` / overlay 模糊 / 哈希类名选择器） | **不能**。约 7 个变量 + 全部组件 CSS 无处安放 |
| `hana-skin`（三个主题一套补丁） | 改安装目录 16 个文件：背景图 PNG、材质 CSS 70KB、取景框 canvas JS | **不能**，且触及安装目录 |

所以这不是"一个格式装三种东西"，而是**一个信封，里面装两种性质的主题，并如实记录第三种失真的部分**。

---

## 1. 结构总览

```
skinpack（信封）
├── schema / packId / packVersion / names / description
├── source        ← 出处与许可（不落地的来源不许发）
├── patchSets     ← 包级补丁集，供多个主题引用（见 §4.3）
├── themes[]      ← 1..N 个主题
│   ├── key / names / appearance / palette / notes
│   ├── kind: "vars"     →  theme（官方定义，可直接喂 SDK）
│   ├── kind: "patch"    →  patch（补丁描述，App 只调度不解释）
│   └── losses[]         →  超出官方词表、本包无法还原的部分（必须列，不许略）
└── assets/       ← 仅 .skinpack 容器有
```

**最关键的一条结构性决定**：皮肤定义必须**嵌在信封里**，不能把元数据和官方定义写在同一层。

理由有实测依据：

```
validateCustomThemeDefinition({ ...完整 61 变量, provenance: {...} })
→ state: "valid"        （校验通过）
→ returned value keys:  ["formatVersion","name","appearance","variables"]
                        （provenance 被静默丢弃）
```

宿主对**多余的顶层键不报错，直接丢掉**；对**未知变量名报错拒绝**。所以任何写在定义同层的元数据都会在存档时蒸发——不是报错，是无声消失。这比报错更危险。

---

## 2. 校验原则：变量层不自己造规则

| 层 | 谁校验 |
|---|---|
| 信封（schema / id / kind / 引用完整性） | 本规范 |
| 主题变量（类型、范围、词表、必填） | **一律调用 SDK 的 `validateCustomThemeDefinition`** |

不复制那份 61 项规则。宿主是唯一事实源，SDK 随宿主升级，我们跟着走。

已知的宿主硬约束（供参考，不重复实现）：

- `formatVersion` 必须**恰好等于** `1`（传 2 直接拒）
- 61 个变量**全部必填**，缺一个就 `CUSTOM_THEME_INVALID`（实测：只给 `--bg` → `Missing required variable "--bg-card"`）
- 变量名必须在词表内（`--bg-image` → `Unknown variable`）
- 颜色：部分变量要求 6 位不透明 hex（`--bg` / `--bg-card` / `--sidebar-bg` 等），其余允许 8 位带 alpha
- `--*-rgb` 三元组与 `--select-arrow` 由宿主**推导**，不要写进定义
- 圆角 0–32px；字体栈 1–8 项、每项 ≤80 字符；主题名 1–80 字符

词表分布：颜色 54（背景 4 / 强调 5 / 文字 4 / 结构 5 / 便签 2 / 聊天 8 / 覆盖层 5 / 终端 21）、圆角 4、字体栈 3。

---

## 3. 信封字段

```jsonc
{
  "schema": "hana-skinpack/1",
  "packId": "eva-002",              // 反域名或 slug，全局唯一，作者负责
  "packVersion": "1.0.0",           // 语义化；import 时用于判断新旧
  "names": {                        // 多语言显示名；缺省回退 zh → en
    "zh": "Eva 002 · 二号机",
    "en": "Eva 002 · Unit-02"
  },
  "description": "亮色驾驶舱面板 …",
  "source": { "…": "见 §7" },
  "requires": {
    "hana": ">=1.1.35-beta",        // 可选；patch 类必填
    "platform": "win32-x64"         // 可选；patch 类必填
  },
  "patchSets": { "…": "见 §4.3，包级补丁集" },
  "themes": [ /* 见 §4 */ ]
}
```

`packId` + `themes[].key` 是**作者域**的身份。宿主 ID 不在包里（见 §6）。

---

## 4. 主题对象

### 4.1 `kind: "vars"` — 走官方 API

```jsonc
{
  "key": "dragon-girl",
  "kind": "vars",
  "appearance": "dark",
  "palette": {                       // 卡片缩略用的摘要色，不进定义
    "bg": "#141313", "panel": "#1E1D1E",
    "accent": "#CD5B85", "text": "#F0EFF0"
  },
  "theme": {                         // ← 原样喂给 hana.themes.custom
    "formatVersion": 1,
    "name": "Luna 龙娘 · 玫瑰月影",
    "appearance": "dark",
    "variables": { "--bg": "#141313", "…": "…" }
  },
  "losses": []
}
```

`theme` 可以是**完整**定义，也可以是**部分**变量（见 §5）。App 负责补全后再交给宿主。

`palette` 是刻意和 `variables` 分开的：缩略图只需要 4–10 个颜色，61 个变量里大多数（终端 ANSI、圆角、字体）对"一眼看长相"没贡献。Luna 的源文件也是这么做的，这不是我的发明。

### 4.2 `kind: "patch"` — 需要落盘补丁

主题只**引用**补丁集，不内联脚本描述（决定：包级）。理由见 §4.3。

```jsonc
{
  "key": "moonlit-court",
  "kind": "patch",
  "appearance": "dark",
  "palette": { "bg": "#172725", "accent": "#D9B77C" },
  "patchRef": "hana-skin",          // 指向信封的 patchSets 键
  "theme": null,
  "losses": [
    "背景图 moonlit-night.png（官方词表无 url()）",
    "材质 bold 层全部描边与 overlay 参数",
    "取景框 canvas 动画（bg.js）"
  ]
}
```

`kind: "patch"` 的主题**不提供** `theme`。它无法经由 `hana.themes.custom` 落地，只能整包交给补丁执行器——这一点必须在 UI 上说清，不能让用户以为"应用"和 L1 是同一件事。

### 4.3 包级补丁集 `patchSets`

```jsonc
"patchSets": {
  "hana-skin": {
    "engine": "hana-skin-ps1",      // 受支持的执行器标识；App 白名单制
    "entry": "scripts/apply.ps1",   // 相对包根
    "check": "scripts/check.ps1",   // 只读断言，装前必跑
    "restore": "scripts/restore.ps1",
    "verifiedVersions": ["1.1.35-beta"],
    "versionPolicy": "verified-or-assert",
    "touchesHanaInstall": true,
    "changedFiles": 16,
    "assets": [
      { "path": "assets/moonlit-night.png", "sha256": "…" }
    ]
  }
}
```

为什么是包级而不是主题级：hana-skin 的 `apply.ps1` 是 270KB 单体，一次调用同时铺三个主题的源（三者共用同一套脚本与备份策略）。写进主题级会重复三遍，且三份描述一旦不一致，回滚语义就崩了——**一个补丁集只能有一条回滚链**。

`assets` 每项带 sha256，装前校验；同包里被多个主题引用的资源只存一份。

### 4.4 为什么必须有 `losses`

`losses` 是这份规范里唯一**不能为空就默认通过**的字段。规则：

> 如果导入方只能还原包的一部分，其余部分**必须**写进 `losses[]`，并在 UI 上显示。

反例就是 eva-002：71 个变量里 13 个在词表外（其中 6 个是宿主推导的：5 个 `-rgb` + `--select-arrow`），实际丢的是 7 个变量（`--bg-texture` / `--border-width` / `--radius-sm|md|lg` / `--sidebar-bridge-card-text` / `--tab-slider-shadow`）加 6 段组件 CSS（滚动条、`::selection`、overlay `blur(8px)`、`.overlay_652af` 这类**哈希类名**选择器）。

一个"聪明"的装载器会静默丢掉这些，导出的主题看起来还是差不多的炭黑配红——用户不会发现滚动条变回了官方灰。这就是有损导入必须报损的理由：**失真不可怕，无声失真才可怕。**

---

## 5. 补全规则：部分变量怎么办

宿主要求 61 项齐全；作者通常只关心 6–10 项。格式提供两个锚点作为底色：

| base | 含义 |
|---|---|
| `"host-light"` | 从宿主浅色调色板解析 (`palettes.light.cssUrl`)；宿主不提供时 fallback 到 `CUSTOM_THEME_INITIAL_DEFINITION` |
| `"host-dark"` | 从宿主深色调色板解析 (`palettes.dark.cssUrl`)；实证 `midnight.css` 覆盖 54/61，缺失的 7 项（4 圆角 +3 字体）为固定默认 |
| `"pack:<key>"` | 继承同包另一主题，用于“同一皮肤的明暗两版” |

```jsonc
{
  "key": "my-skin",
  "kind": "vars",
  "appearance": "dark",
  "base": "host-dark",
  "theme": { 
    "formatVersion": 1, 
    "name": "我的皮肤", 
    "appearance": "dark",
    "variables": { 
      // 8 项核心必须给垒（硬门槛），其余可留白由 base 继承
      "--bg": "#101014", "--bg-card": "#18181C",
      "--bg-glass": "#18181CE8", "--sidebar-bg": "#141418",
      "--text": "#EDEDEF", "--text-muted": "#9A9AA2",
      "--border": "#3A3A42", "--accent": "#C0504D"
      // 剩下的终端 ANSI / 圆角 / 字体 … 全部不必写
    } 
  }
}
```

### 必须明示的 8 项硬门槛

深色底可以继承，但以下 8 项决定【长相】与【可读性】，**不允许空着由宿主补齐**：

- **背景**：`--bg`, `--bg-card`, `--bg-glass`, `--sidebar-bg`
- **文字**：`--text`, `--text-muted`
- **结构**：`--border`, `--accent`

这 8 项缺一不可。App 导入时应拒绝（或至少强警告）：未定义任意一项就说“这是皮肤还差得远”。

### 底表不可用时的行为（失败关闭）

`base: host-dark` 依赖宿主提供 `palettes.dark`。如果宿主不提供（老版本），或解析出的调色板**本身就不含那 8 项核心**，App **不得**用另一面（浅色）的底来补全——那会静默交出一个浅色残留的深色皮肤。

正确行为：变量完整的主题照装；不完整的主题置灰按钮并明说原因。这条在 `panel.js` 里是 `state.baseOk` 闸门，默认全关。

### 建议明示的 6 项

不强拒，但继承会导致语义色偏掉：`--accent-hover`（悬停变别人家的紫）、`--green/coral/danger`（success/alert 变成别人的绿红）。

- `--accent-hover` / `--accent-light` （强调衍生色）
- `--link` / `--link-hover` （链接色）
- `--green` / `--coral` / `--danger` （语义色，三选一即可）

App 应显示“建议补全 N 项”，但不拦下。

### 可继承的 47 项

这些从 host-dark 继承完全没问题：终端 ANSI (21)、圆角 (4)、字体栈 (3)、各类 overlay/chat 微调 (19)。它们不决定“这个皮肤是什么”，而是“皮肤里那些次要细节怎么显”。

### 完整性徽标

App 必须显示「作者定义 N 项 / 继承 61−N 项」，不可伪装成完整皮肤。

---

⚠️ **一条铁律：不手写深色中性底。** `palettes.dark.cssUrl` 存在时就用它；不存在时 fallback 到内置 `midnight.css` 路径解析。原因很简单：手写必然错，而且会随宿主升级失效。

---

## 6. 身份：包里为什么没有宿主 ID

宿主 ID 形如 `custom:<uuid>`，由宿主**现场生成**，只在本机有效。包里写宿主 ID 会导致：换台机器导入后 ID 悬空，或者两台机器各有一套同名主题。

所以：

- 包里只有 `packId` + `themes[].key`（作者域）
- App 在自己的存储里维护映射：`(packId, key) → custom:<uuid>`，附带导入时的 `revision`
- 再次导入同一 `(packId, key)` → **update，不 create**
- 宿主返回 `CUSTOM_THEME_IN_USE` / `CONFLICT` 时以宿主为准，App 不改宿主 ID

`revision` 是宿主的乐观锁：`update` 必须带 `expectedRevision`，冲突就重新 `get` 再改，**不重试原请求**。

---

## 7. 出处与许可

Luna 的源文件已经带 `publisher: 'ilrs'` / `license: 'CC BY 4.0'` / `imageSha256`；hana-skin 带 `verifiedAt` / `platform` / `changedFiles`。这不是洁癖，是**已经存在的行业惯例**，格式必须接住。

```jsonc
"source": {
  "kind": "original" | "derived" | "unknown",
  "publisher": "ilrs",
  "license": "CC BY 4.0",
  "url": "https://…",
  "derivedFrom": "gpt-luna-dragongirl",   // kind=derived 时填
  "imageSha256": "6858b48…",
  "notes": "…"
}
```

硬规则：

1. `kind: "original"` 且无 `license` → 导入时警告，导出时要求填写
2. 导入**不得剥离**出处；导出的包保留原出处，并追加 `derivedFrom`
3. 用户自制的主题导出 → `kind: "original"`, `publisher: "<本机用户名>"`, `license: "unspecified"`

---

## 8. 装前门禁（App 必须跑的检查）

按顺序，任一门失败就不许说"可装"：

| # | 检查 | 失败后果 |
|---|---|---|
| 1 | 信封 schema / 字段完整性 | 拒绝导入 |
| 2 | `kind=vars`：调用 SDK 校验（补全后） | 拒绝，报具体变量名 |
| 3 | `kind=patch`：`hana` 版本在 `verifiedVersions` 内 | **降级为"未验证"**，需用户明示才继续 |
| 4 | `kind=patch`：先跑 `check`，锚点断言全中 | 中途中止，**不写盘** |
| 5 | `assets` 的 sha256 | 拒绝导入 |
| 6 | `losses` 非空 | 允许，但必须在应用前显示损失清单 |

第 3、4 条是 hana-skin 作者定的规矩（`versionPolicy: "verified-or-assert"`），我们照搬：**宁可让用户看见"这个版本我没验证过"，也不赌。**

---

## 9. 三个现有包的映射

### 9.1 Luna → 纯 L1，无损

```jsonc
{
  "schema": "hana-skinpack/1",
  "packId": "luna-dragongirl",
  "packVersion": "0.2.3",
  "names": { "zh": "Luna 龙娘 · 玫瑰月影" },
  "source": {
    "kind": "original", "publisher": "ilrs", "license": "CC BY 4.0",
    "imageSha256": "6858b484e2de89a2f10f793dfe01d44171396be983bf835a71be4e26fae4ff9c"
  },
  "themes": [{
    "key": "default", "kind": "vars", "appearance": "dark",
    "palette": { "bg": "#141313", "panel": "#1E1D1E", "accent": "#CD5B85", "text": "#F0EFF0" },
    "theme": { "formatVersion": 1, "name": "Luna 龙娘 · 玫瑰月影", "appearance": "dark",
               "variables": { "…61 项，原样…" } },
    "losses": []
  }]
}
```

`SOURCE.colors` 映射到 `palette`（10 个键里取 4–6 个）。

### 9.2 eva-002 → 有损 L1，或整包降级

```jsonc
{
  "schema": "hana-skinpack/1",
  "packId": "eva-002",
  "packVersion": "1.0.0",
  "names": { "zh": "Eva 002 · 二号机" },
  "source": { "kind": "original", "publisher": "月曦夜", "license": "unspecified" },
  "themes": [{
    "key": "cockpit", "kind": "vars", "appearance": "light",
    "base": "neutral-light",
    "palette": { "bg": "#F6F2E7", "panel": "#FDFBF6", "accent": "#D64541", "text": "#1A1A1F" },
    "theme": { "formatVersion": 1, "name": "Eva 002", "appearance": "light",
               "variables": { "…58 项词表内变量…" } },
    "losses": [
      "--bg-texture（纸纹，词表外）",
      "--border-width: 1px（词表外）",
      "--radius-sm/md/lg（词表外，仅 --radius-input/card/chat-* 可表达）",
      "--sidebar-bridge-card-text（词表外）",
      "--tab-slider-shadow（词表外）",
      "滚动条配色微调（组件 CSS）",
      "::selection 荧光绿（组件 CSS）",
      "设置面板遮罩 blur(8px) + 机甲红心渐变（组件 CSS + 哈希类名）",
      "3 个字体栈未定义 → 由 base 补全"
    ]
  }]
}
```

**这一条就是"要不要给它做 L2 通道"的判据**：如果损失清单里超过 3 条是"用户一眼能看出差别"的，L1 版本就只是近似品，得同时保留 patch 路径。

### 9.3 hana-skin → 一个包，三个 patch 主题

```jsonc
{
  "schema": "hana-skinpack/1",
  "packId": "hana-skin",
  "packVersion": "1.0.0",
  "names": { "zh": "hana-skin（月满庭 · 极光 · Deepsleep）" },
  "source": { "kind": "original", "license": "unspecified", "notes": "改 Hana 安装目录，非官方主题包格式" },
  "requires": { "hana": "1.1.35-beta", "platform": "win32-x64" },
  "patchSets": {
    "hana-skin": {
      "engine": "hana-skin-ps1",
      "entry": "scripts/apply.ps1",
      "check": "scripts/check.ps1",
      "restore": "scripts/restore.ps1",
      "verifiedVersions": ["1.1.35-beta"],
      "versionPolicy": "verified-or-assert",
      "touchesHanaInstall": true,
      "changedFiles": 16,
      "assets": [
        { "path": "assets/moonlit-night.png", "sha256": "…" },
        { "path": "assets/violet-aurora.png", "sha256": "…" }
      ]
    }
  },
  "themes": [
    { "key": "moonlit-court", "kind": "patch", "appearance": "dark",
      "palette": { "bg": "#172725", "accent": "#D9B77C" },
      "patchRef": "hana-skin",
      "losses": ["背景图 / 材质层 / 取景框 canvas 动画（官方词表完全无法表达）"] },
    { "key": "violet-dusk", "kind": "patch", "appearance": "dark",
      "palette": { "bg": "#3C354A", "accent": "#7662BA" },
      "patchRef": "hana-skin",
      "losses": ["同上"] },
    { "key": "deepsleep", "kind": "patch", "appearance": "light",
      "palette": { "bg": "#f6f7fb", "accent": "#5D79FF" },
      "patchRef": "hana-skin",
      "losses": ["同上"] }
  ]
}
```

三主题共用一套 patch 脚本（hana-skin 的 `apply.ps1` 是 270KB 单体，内含三套源），所以 patch 描述在**主题级**会重复三次。规范化时允许提到包级 `patchSets` 供引用——这一条列为待定项。

---

## 10. 明确不做

| 不做 | 理由 |
|---|---|
| 传任意 CSS 字符串 / `url()` / 表达式 | 官方词表故意不开。开了就等于绕过宿主的验证层 |
| 传宿主 ID（`custom:<uuid>`） | 宿主现场铸，机内有效，写进包必失效 |
| 传可执行脚本内容 | 只传**描述**（引擎标识 + 路径 + 校验）。脚本随包走，App 白名单执行 |
| 自动猜锚点 / 自动修补丁 | 一旦开始猜，失败代价是 Hana 打不开 |
| 用变量名表达布局 | 61 项里没有布局。想调布局就是 L2，别硬凑 |

---

## 11. 已定与待定

**已拍板**（2026-10-24）：

1. ✅ **容器**：单文件 `.skin.json`（纯 L1）和 `zip .skinpack`（带资产/patch）**都支持**。理由：单文件好分享，zip 能装大资源。两条路径并存。
2. ✅ **patch 描述**：**包级**。理由：一个补丁集只能有一条回滚链；hana-skin 三个主题共用一套脚本，写主题级会重复三遍且语义崩。
3. ❓ **深色中性底谁来定？** —— 不需要手写。从 `palettes.dark.cssUrl` 解析，缺的 7 项用固定默认。这是宿主的事，不是格式的。这条不列为待定。

**剩余待定**：

- 是否允许 `losses[]` 全部为空就导入？我倾向：只要非空就必须报损，但如果是空列表呢？Luna 这种无损的可以直装吗？答案是肯定的，但 App 应显示“无损”。
- `patchSets` 的白名单机制：哪些 `engine` 值受信任？这个要单独做一个 App-level 的权限文档。

---

## 附：容器布局（`.skinpack`）

```
skinpack.json            ← 就是上面那个信封
assets/…                 ← 图片等，按信封里声明的相对路径
patches/…                ← 仅 patch 类
scripts/…                ← 仅 patch 类
```

单文件 `.skin.json` 只允许全部主题 `kind: "vars"`，且包内不能有 `patchSets` 或任何相对文件引用（资源只能用 data URI，建议控制在 512 KiB 内）。
