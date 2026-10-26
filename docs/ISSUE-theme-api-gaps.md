# ISSUE：用户主题（custom theme）能力边界与三条最小扩展建议

> 提交对象：HanaAgent 桌面端（App SDK / custom theme）
> 实测版本：`1.1.111-beta`（win32-x64）
> 提出方：一个第三方皮肤库 App（`skin-wardrobe`）
> 日期：2026-10-25

---

## 摘要

`hana.themes.custom` 的封闭词表（61 个变量）把「换配色」做得很好、很安全，我们已经跑通了
一整条链路（下文有数据）。但一个真实存在的第三方皮肤包在导入时，**必然**有相当一部分内容
无处安放。本文用一次真实转换的数据说明缺口在哪，并给出三条**受限**的扩展建议——不是
「请开放任意 CSS」，而是三个能被验证、能保持安全边界的口子。

---

## 1. 已跑通的部分（先说能做的）

我们把 `hana-skin v0.1.4` 的三个主题（月满庭 / 极光 / Deepsleep）转成自定义主题信封。
转换器对变量层做的事，与宿主自己的规则完全对齐：

| 检查 | 结果 |
|---|---|
| 每个主题的作者变量 | 58 / 61（其余 3 项为字体栈，按默认补齐） |
| 核心 8 项（bg/bg-card/bg-glass/sidebar-bg/text/text-muted/border/accent） | 3/3 主题齐全 |
| 补全后过 `validateCustomThemeDefinition` | **3/3 valid** |

`hana.themes.custom` 的读写、预览、应用、schema 拉取，全部按文档工作。
`palettes.light` / `palettes.dark` 在 1.1.111 上**确实提供**且核心项齐全
（实测读到 `host:dark:midnight`、`host:light:new-warm-paper`）。这部分没有问题，
而且比文档描述得更好用——文档说 palettes 是 optional，实测稳定给出。

**结论：配色层这条路是通的，不需要任何改动。**

---

## 2. 缺口一：词表缺 5 个在真实皮肤里被稳定使用的变量

同一批主题里，有 5 个变量属于宿主自己的 token 体系、却不在自定义主题词表里：

```
--radius-sm      --radius-md      --radius-lg
--border-width   --tab-slider-shadow
```

导入时只能丢弃，并在 UI 里报损。`--radius-sm/md/lg` 尤其值得注意：词表只给了
`--radius-input / card / chat-card / chat-surface` 四个语义槽，但宿主渲染层实际还在用
小/中/大三档几何。任何想控制"整体圆角硬度"的皮肤都会碰到这个问题。

### 建议 1（最小改动）

把这 5 个名字加进 `CUSTOM_THEME_VARIABLE_SPECS`：

- `--radius-sm|md|lg`：`type: "length"`，范围同现有 0–32
- `--border-width`：`type: "length"`，建议范围 0–4
- `--tab-slider-shadow`：`type: "color"`（或先跳过，它可由 overlay 推导）

风险评估：低。它们都是宿主已经在消费的 token，加入词表不引入新的注入面。

---

## 3. 缺口二：材质层需要「组件级样式」，而词表只能表达颜色

`hana-skin` 的材质层是 71KB CSS，本质是给一批组件加描边、改 overlay 强度、调阴影参数。
这是**结构性**需求，不是配色——任何"拟物/玻璃/厚描边"类皮肤都必须有它。

但开放任意 CSS 显然不可接受：会绕过宿主所有验证，且升级即碎（这批皮肤现在靠
`apply.ps1` 改 16 个安装目录文件来做到，每次宿主升级都要重跑锚点断言）。

### 建议 2（受控 token，而不是 CSS）

增加一组**材质 token**，由宿主自己在组件层消费，App 只能填数值：

```jsonc
{
  "material": {
    "strokeWidth": 1,          // px，所有可见描边
    "strokeColor": "#3A3A42",  // 或引用已有变量名
    "overlayStrength": 0.08,   // 0–1，卡片/面板的提亮或压深
    "blurStrength": 0.6,       // 0–1，毛玻璃强度
    "shadowSoftness": 0.4      // 0–1
  }
}
```

这样"厚描边 + 强玻璃"这类观感可以被表达，而 App 依然碰不到选择器、碰不到 `url()`、
碰不到脚本。宿主对每个 token 有自己的 clamp 和降级，升级也不会碎。

---

## 4. 缺口三：背景图完全没有入口

词表拒绝 `url()`；SDK 里也没有 `wallpaper` / `backgroundImage` 相关成员。
但宿主 `preferences.json` 里已经有 `paperTextureStyle` / `paperTextureStrength` /
`leavesOverlay` 这组内置外观项——说明**宿主本身具备背景表现能力**，只是没有对 App 开放。

### 建议 3（资产槽，不是 CSS）

给自定义主题加一个背景槽，App 只提供**图片资产**（走已有的 App 资源体系），
由宿主负责解码、裁剪、模糊与合成：

```jsonc
{
  "background": {
    "asset": "assets/moonlit-night.png",  // App 包内路径，走现有资源校验
    "fit": "cover",
    "opacity": 0.9,
    "blur": 8
  }
}
```

宿主已有的图片校验（格式白名单、解码、体积上限）可直接复用；不引入任何样式注入。

---

## 5. 明确不建议开放的部分

**取景框/面板的背景动画（canvas / JS）。** 我们自己的判断是这部分**不该**开：

- 它需要在渲染树里跑脚本，任何"安全"的沙箱化成本都远高于收益；
- 这类观感属于"宿主自己要不要做"，不适合作为第三方皮肤的扩展点；
- 现在的替代路径（打补丁改渲染树）虽然有升级成本，但至少它是**显式危险**的——
  用户知道自己在改安装目录。

如果将来要做，建议走"宿主内置若干个可选动效"而不是"允许 App 注入动效"。

---

## 6. 附：一处文档与实现不一致（低优先级）

`shared/app-custom-themes.ts` 的注释写 "Unknown keys ... are all refused"，
但实测：

```
validateCustomThemeDefinition({ ...完整61项, provenance: {...} })
→ state: "valid"
→ 返回值的键只有 ["formatVersion","name","appearance","variables"]
```

即**多余的顶层键不报错，直接被丢弃**。这个行为本身可以接受（信封模式本来就是这么设计的），
但文档措辞会让人误以为会报错。建议注释改成"未知顶层键被忽略"，以免第三方把元数据
写在定义同层而不自知。

---

## 7. 优先级建议

| 建议 | 收益 | 成本 | 优先级 |
|---|---|---|---|
| 1. 补 5 个缺失变量 | 让圆角/描边类皮肤不再报损 | 极低 | **高** |
| 2. 材质 token | 打开"玻璃/拟物"这一类皮肤 | 中（需要宿主动渲染层配合） | 中 |
| 3. 背景资产槽 | 让"带图皮肤"不必改安装目录 | 中 | 中 |
| — 取景框动画 | — | 高且不安全 | 不建议 |

---

## 8. 复现材料

本仓库内的可复核证据：

- 转换器：`scripts/build-skinpacks.mjs`
- 链路测试：`tests/completion.test.mjs`（13 项，含"补全后过宿主校验"）
- 产物：`dist/skins/hana-skin-{moonlit-court,violet-dusk,deepsleep}.skin.json`
- 格式规范：`docs/SKINPACK.md`

转换时被丢弃/压平的每一项都写进了对应 `.skin.json` 的 `losses[]`，可逐条核对。
