# SKINPACK v2 —— 四层皮肤包格式

> 取代 `SKINPACK.md`（v1，只有配色层）。
> v2 面向「一包一主题、四层齐全」的补丁类皮肤。
> 状态：草案，阶段 1 产出。

---

## 0. 为什么改

v1 只能表达配色（61 个变量），因为它服务的是官方 `hana.themes.custom`。
v2 要表达四层，而其中三层的落地方式完全不同：

| 层 | 落点 | 包里存什么 |
|---|---|---|
| 配色 | 合成 CSS 的配色源 | 61 个变量值 |
| 背景 | 合成 CSS 的背景源 | 图片 + 视觉参数 |
| 材质 | **一份通用材质源** | **只存参数覆盖，不存 CSS** |
| 取景框 | `lib/theme.js` 末尾追加的 JS | 内置名 或 动画文件 |

**关键决定：材质不进包。** 材质全局只有一份，包只写"我这一档要什么参数"。
这样改一次毛玻璃，所有皮肤一起变——正是需求里要的形态。

---

## 1. 结构

```jsonc
{
  "schema": "hana-skinpack/2",
  "packId": "luna-dragongirl",          // 稳定标识，去重靠它
  "packVersion": "1.0.0",
  "names": { "zh": "Luna 龙娘 · 玫瑰月影", "en": "Luna Dragon Girl" },

  "tags": ["暗色", "粉色", "动漫"],       // 搜索用
  "group": "anime",                     // 分组
  "favorite": false,                    // 收藏置顶

  "source": {
    "kind": "original",                 // original | derived
    "publisher": "local",
    "license": "unspecified"
  },

  "theme": { /* 见 §2 —— 一包一主题，不是数组 */ }
}
```

---

## 2. theme 对象（四层）

```jsonc
{
  "key": "default",
  "appearance": "dark",

  /* 层一：配色 —— 61 项，宿主词表内，不可增减 */
  "colors": {
    "--bg": "#141313",
    "--bg-card": "#1E1D1E",
    /* … 共 61 项 … */
  },

  /* 层二：背景 —— 可选。没有就是纯色皮肤 */
  "background": {
    "asset": "data:image/png;base64,…",   // data URI，包自包含
    "fit": "cover",
    "position": "71% 26%",
    "panelAlpha": 0.55,      // 侧栏/面板遮罩不透明度 0–1
    "cardAlpha": 0.45,       // 卡片遮罩
    "tint": null             // 遮罩色；null = 取 colors["--bg"]
  },

  /* 层三：材质 —— 只写参数，CSS 由通用层提供 */
  "material": {
    "tier": "bold",                    // bold | subtle | none
    "edge": "rgba(255,255,255,0.22)",  // 描边色
    "rim": 0.26,                       // 顶边内侧高光 0–1
    "blur": 26,                        // 弹窗毛玻璃半径 px（0 关闭）
    "glowFromBg": true                 // 文字柔光跟随 --bg
  },

  /* 层四：取景框 —— 可选 */
  "frame": {
    "kind": "builtin",                 // builtin | asset | none
    "builtin": "petals",               // petals | particles | scanline | rain
    "asset": null,                     // kind=asset 时指向 fx/*.js
    "params": { "density": 0.5, "speed": 1.0 }
  },

  /* 列表用：真实效果截图（data URI） */
  "shot": "data:image/jpeg;base64,…"
}
```

### 关于图片：一律 data URI

包里不引用外部文件，图片全部内联成 `data:image/…;base64,…`。

理由：导入只传一个 JSON，不需要额外的文件上传通道；整个包拖进面板就能用，
不存在"图丢了"的可能。代价是包体积变大（1 MB 图 → 约 1.37 MB base64），
对自用场景可以接受。

列表接口不返回图片本体（太大），只回 `hasShot: true`；
前端按需请求 `/skins/:packId/shot`，后端解码后下发。

---

## 3. 参数 → CSS 的映射

补丁管线按下面规则把 v2 字段编译成 CSS：

| v2 字段 | 生成 |
|---|---|
| `colors` | 配色源：`[data-theme="<id>"] { …61 项…; --bg-rgb: r,g,b; }` |
| `background.asset` | 背景源：内联 data URI 到 `background-image` |
| `background.panelAlpha` | `--bg` / `--sidebar-bg` 的 alpha |
| `background.cardAlpha` | `--bg-card` / `--panel-card-bg` 的 alpha |
| `background.tint` | 遮罩基色（默认 `colors["--bg"]`） |
| `material.tier` | 选 `material-universal/{bold,subtle}.css` |
| `material.edge` | 覆盖 `--mat-edge` |
| `material.rim` | 覆盖 `--mat-rim` |
| `material.blur` | 覆盖 `--mat-blur`（弹窗毛玻璃 px） |
| `material.glowFromBg` | 控制 `--mat-glow: var(--bg-rgb)` |
| `frame.builtin/asset` | 追加到 `lib/theme.js` 末尾 |

`--bg-rgb` 由配色源自动派生（从 `--bg` 的 hex 拆出 r,g,b），供材质层柔光使用。

---

## 4. 校验（装前必须全过）

| # | 检查 |
|---|---|
| 1 | 信封字段完整；`schema === "hana-skinpack/2"` |
| 2 | `theme.colors` 的值类型正确（不限制项数，见下方说明） |
| 3 | 核心 8 项齐全（`--bg` `--bg-card` `--bg-glass` `--sidebar-bg` `--text` `--text-muted` `--border` `--accent`） |
| 4 | 不透明项是 6 位 hex |
| 5 | **配色源 CSS 每条声明都有冒号**（阶段 0 的教训） |
| 6 | 背景资源存在且在包内（data URI） |
| 7 | `material.tier` 在允许集合内 |
| 8 | `frame.kind=asset` 时，JS 需经 agent 审查通过 |

### 关于「多少项」：没有固定数

早先写的「恰好 61 项」是错的。实测宿主里五个主题的变量数并不一致：

```
Luna      62 项（含 --bg-rgb）
月满庭    70 项
差 8 项：月满庭多 --accent-rgb/--coral-rgb/--danger-rgb/--green-rgb/--link-rgb
                   --border-width/--radius-lg/--radius-md/--radius-sm
                   --select-arrow/--tab-slider-shadow
         Luna 多 --font-ui/--font-serif/--font-mono
```

所以正确的规则是：**核心 8 项必须齐，其余自由**。缺的项会落到宿主默认值，这是可接受的
（Luna 就是靠这个沿用默认圆角的）。

第 5 条是这次踩坑后加的：漏冒号不会报错，只会让整条声明静默失效。

---

## 5. 与 v1 的关系

v1（`schema: "hana-skinpack/1"`）继续被衣橱读取，用于纯配色包。
v2 是超集，但结构不同（`theme` 从数组变对象），不做自动兼容——**转换是显式的**（`scripts/upgrade-pack-v2.mjs`）。

---

## 6. 已知遗留

- `material.universal` 的特异性是否足够压过官方样式，**尚未目视验证**（阶段 0 待确认项）
- 背景源里仍有 `rgba(34, 52, 48, ·)` 残留（月满庭墨绿变体），待清
- `frame.builtin` 的四种内置动画尚未实现
