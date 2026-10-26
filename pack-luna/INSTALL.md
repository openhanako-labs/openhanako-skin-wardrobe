# hana-skin · 安装说明（详细版）

三个主题：**月满庭 · 夜阑**（深色）、**极光 · 夜穹**（深色）、**Deepsleep**（浅色）。
它们改在 Hana 安装目录的构建产物里 —— 夜空/极光/白昼壁纸透出、面板与卡片分级半透明、
外圈一圈细描边、五个浮层面板带取景框。

> 这不是官方主题包（`pack` / 市场那种）。因此：**有版本前提，会改安装目录，可完整回滚。**
> 版本不对时不会被硬拦：先跑全量断言，锚点失配就停下（不写盘），照 `REPAIR.md` 把锚点重新定位即可。
> 只想知道「这是啥、怎么装、怎么退」→ 读 `README.md`。这份文档是同一件事的详细版，
> 外加给 Hana agent 的技术备注。

---

## 一句话装法（把下面这句连同文件夹一起发给你的 Hana）

> 这个文件夹里是一套 Hana 皮肤，请先读 `README.md` 和 `INSTALL.md`，按里面的步骤贴到我本机的 Hana 上。
> 先跑 dry-run 把结果给我看，我说可以了再真贴。版本对不上的话按 `REPAIR.md` 自己修锚点，别手改 Hana 安装目录。

Hana 会读这两份文档然后照着做。你也可以自己手动跑，见下一节。

---

## 前置条件

| 条件 | 说明 |
|---|---|
| 平台 | Windows（win32-x64）。补丁锚点按 Windows 桌面版构建定位 |
| Hana 版本 | 已验证 **1.1.111-beta**。别的版本不拦，先跑全量断言；锚点失配就照 `REPAIR.md` 修（见「版本对不上」一节） |
| Shell | PowerShell 7（`pwsh`）。Windows 自带的 5.1 不够，脚本用了 7 的特性 |
| node | 在 PATH 里。三个注册表都用 node 做「改前 11 项 → 改后 14 项」的真求值断言，找不到就报错，不降级 |
| 前提 | Hana 桌面版已安装，并**至少启动过一次**（要生成 `artifacts/desktop-target.json`） |

自查环境：

```powershell
pwsh -v     # 期望 7.x 及以上
node -v
```

没装 PowerShell 7：`winget install --id Microsoft.PowerShell`

---

## 手动安装（三步）

在解压出来的文件夹里执行。

### 1. 先 dry-run，什么文件都不写

```powershell
pwsh -File .\scripts\install.ps1
```

依次做：定位 renderer / server 版本目录 → 看版本是否已验证（未验证只提醒，不拦）→ 跑 `apply.ps1` 的全量定位与断言
（锚点唯一性、前后文、主题数 11→14、i18n 往返无损、卡片调色板 15 键逐键核对）
→ 打印「会改哪些文件、合成后的主题 CSS 有多大」。

dry-run 通过才继续。没通过就把输出原样发出来，别硬贴。

### 2. 真贴入

```powershell
pwsh -File .\scripts\install.ps1 -Apply
```

执行顺序：

1. 定位两个版本目录（从 `desktop-target.json` 现读）；
2. 版本闸门 + 关键文件校验；
3. 备份 16 个将被修改的原文件到 `backups/<版本目录名>-<时间戳>/`（含 `manifest.json`）；
4. 先全部定位与断言、再统一落盘（两阶段，半途失配不会留下改了一半的状态）；
5. 贴三份主题 CSS（renderer 树 = 配色 + 材质档位 + 背景 + 取景框；server 树 = 只配色）；
6. 改四处注册表/配色表（renderer `lib/theme.js`、renderer `assets/theme-registry-*.js`、
   renderer 与 server 的 `SettingsModalShell-*.css`）；
7. server `bundle/index.js`：服务端主题注册表 + 卡片调色板表；
8. 补 5 个 locale（各 3 个主题 × 2 个键，只增不改，已存在则跳过）；
9. 给主题 CSS 的 URL 加 `?v=<版本串>`，并把浮层面板取景框脚本追加到 `lib/theme.js` 末尾；
10. 跑 `check.ps1` 自检，打印回滚命令。

任一步失败即中止，并打印「已完成到哪一步 / 备份在哪 / 怎么回滚」。

### 3. 重启 Hana

完全退出（不是关窗口，是从托盘/任务栏退出程序），再启动。

验证：设置 → 界面 → 主题，列表里应出现**月满庭 / 极光 / Deepsleep**。
选中任一，界面换成对应壁纸 + 半透明面板。

---

## 回滚（随时可以）

```powershell
pwsh -File .\scripts\restore.ps1 -BackupDir "backups\<刚才那个目录>" -Apply
```

`install.ps1 -Apply` 结束时会打印这条命令的完整路径。备份是原文件的逐字节副本，
回滚后与没贴过完全一致。回滚同样需要重启 Hana。

---

## 会改什么

| 位置 | 改什么 |
|---|---|
| renderer 树 `themes/` | 三份主题 CSS（月满庭约 4.0 MB、极光约 4.0 MB、Deepsleep 约 1.2 MB，壁纸以 data URI 内联） |
| renderer 树 `lib/theme.js` | 注册表加三项；主题 CSS URL 加 `?v=<版本串>`；末尾追加取景框脚本 |
| renderer 树 `assets/theme-registry-*.js` | 前端主题注册表加三项（按内容特征定位，不写死构建哈希） |
| renderer 树 `assets/SettingsModalShell-*.css` | 每个主题 3 条主题卡片预览配色 |
| renderer 树 `locales/*.json` × 5 | 三个主题的名字与模式标签（zh / zh-TW / en / ja / ko） |
| server 树 `bundle/index.js` | 主题注册表加三项 + 卡片调色板（`MGr` 表）补三项，只补表、不改上游逻辑 |
| server 树 `desktop/dist-renderer/themes/`、`.../assets/SettingsModalShell-*.css` | 同上：三份主题 CSS（只配色）+ 主题卡片配色 |

一共 16 个文件（1.1.111-beta 实测）。**不动**：`desktop-target.json`、`.verified`、`index.html`、
`defaultTheme` / `autoLightDefault` / `autoDarkDefault`（系统深浅色跟随仍指向 Hana 自带主题）。

---

## 三个主题的设计约束

它们**互相独立**，各自一套源目录，不共用文件、互不引用：

| 主题 | 配色源 | 材质源 | 背景源 | 取景框源 |
|---|---|---|---|---|
| 月满庭 | `src/hana-moonlit-court.css` | `src/material/` | `src/background/` | `src/panel-frame/` |
| 极光 | `src/hana-violet-dusk.css` | `src/material-violet/` | `src/background-violet/` | `src/panel-frame-violet/` |
| Deepsleep | `src/hana-deepsleep.css` | `src/material-deepseek/` | `src/background-deepseek/` | `src/panel-frame-deepseek/` |

改一个不会影响另一个。配色源是**纯变量表**（只有 `--xxx` 声明，包在 `[data-theme="…"]` 作用域里，
没有类名/结构规则），所以影响的是所有消费这些变量的地方；材质、背景、取景框才是结构性规则。

浅色主题（Deepsleep）的材质参数是**反向**的：白描边在白底上等于没画，故 `--mat-edge` 改墨水色；
overlay 系从「白系」改成「墨水系」；`--bg-card` 往白走而不是往亮走。这些细节写在它的源文件头。

---

## 版本对不上：自己修锚点

补丁要往压缩过的 JS 里插字符串，插入点是**按具体构建**用文本锚点描述的。Hana 升级就是换一份构建，压缩器可能重排、改名，锚点就可能对不上。所以：

* 已验证：Hana **1.1.111-beta**（win32-x64，renderer 构建 `5e32f043d3fa785f`，server 构建 `e6e1a3ba2e474a4e`）。
* 其它版本：**不会被拦。** `install.ps1` 会提示「未验证版本」，然后照样跑全量断言——上游小跳版本时锚点往往仍然成立，断言过了就能直接贴。
* 真失配：脚本在写盘前就停下（一个字节不写），并指出卡在哪一步。按 **`REPAIR.md`** 对应那一节把锚点重新定位（改的是包里的 `patches/*.patch` 或 `scripts/apply.ps1` 的 `ThemeCacheBustSites`），再跑 dry-run，直到通过。
* **Hana 升级后**：新版本装到新的 version 目录，旧贴入自然失效（不会把 Hana 改坏），但也不会自动跟随；重跑一次即可。

那条修复循环的完整作业指导在 `REPAIR.md`（失配点分四类，每类都给了“锚点长什么样、怎么重定、怎么验”）。

---

## 已知限制

* 只支持 Windows 桌面版；手机端、Web 端、托盘小窗都不适用。
* 改的是安装目录，不是官方主题包。Hana 官方升级流程不会保留它，需要重贴。
* 皮肤用**内容锚点 + 内容特征定位**，不依赖哈希类名；但上游大改结构时仍可能失配。
  失配表现为 dry-run 阶段报错中止，不会写坏文件；也不是死局 —— 按 `REPAIR.md` 把锚点重新定位即可。
* 壁纸以 data URI 内联进主题 CSS，所以两个夜色主题各约 4 MB、Deepsleep 约 1.2 MB。
* 不含任何第三方主题素材（参考过的那份中秋主题包，只借了色板，素材未随包）。

---

## 给 Hana agent 的技术备注

如果你是被要求「帮我贴这个皮肤」的 agent，读这一段就够：

1. **不要手改 Hana 安装目录里的任何文件。** 所有改动走 `scripts/install.ps1`，
   它内部调 `apply.ps1`（贴）、`check.ps1`（自检）、`restore.ps1`（回滚）、`locate.ps1`（定位）。
2. `scripts/install.ps1` 默认 dry-run，必须显式 `-Apply` 才写盘。**先跑 dry-run，把摘要给用户看，
   得到确认再 `-Apply`。** 这是改安装目录的操作，属于不可逆需确认类。
3. `desktop-target.json` 的位置：`$env:HANA_HOME\artifacts\desktop-target.json`，
   `HANA_HOME` 未设时是 `%USERPROFILE%\.hanako\artifacts\desktop-target.json`。
   四个脚本都按这个规则自适应，不要硬编码用户名或版本目录名。
4. 退出码：`apply.ps1` / `check.ps1` / `restore.ps1` 都是 0 = 成功。`check.ps1` 额外：
   1 = 版本已切换（`skin.json` 记录的版本目录与当前不同，需要重贴）、2 = 文件不符、3 = 无法判定。
5. 贴完**必须让用户重启 Hana**。渲染器与 server bundle 都是启动时加载的，不重启看不到效果。
   不要在没有重启的情况下宣称「已生效」。
6. 出问题先看 `backups/<...>/manifest.json`（每个被改文件的相对路径与改前 sha256），
   回滚命令在 `install.ps1 -Apply` 的输出末尾。
7. 想换个观感：`-Material none|subtle|bold`（材质：无 / 轻 / 重），`-Background none|dark`（背景图开关）。
   本包发布时的档位是 `bold` + `dark`；不显式传参时会**沿用 `skin.json` 里上次的档位**，
   而不是退回默认值 —— 这是为了避免「重贴时把背景静默抹掉」。
8. 三个主题的注册表项不是各插一次就完：`apply.ps1` 的 `ThemeDefs` 是唯一事实源，
   主题数变化时 patch 里的 `insertText` 与 `countBaseline` 会一起变，别只改一处。
9. **版本不对不是停工条件。** `install.ps1` 只提醒不拦人，先跑全量断言。真失配时：
   读 `REPAIR.md` → 改包里 `patches/*.patch`（或 `scripts/apply.ps1` 的 `ThemeCacheBustSites`）
   → 重跑 dry-run → 通过才 `-Apply`。修不动的就把 dry-run 输出交回用户，**不要**放宽断言、
   **不要**手改安装目录、**不要**跳过 dry-run 直接 `-Apply`。
10. 修好并且真贴成功后，把本机版本写进 `share.json` 的 `verifiedHanaVersions` / `verifiedAt`，
    下次别人少走一遍。

---

## 包内清单

```
README.md                 给人看的入口：三个主题是什么、怎么装、怎么切、怎么退、FAQ
REPAIR.md                 版本对不上时怎么自己修锚点（四类失配点的作业指导）
INSTALL.md                这份详细说明
share.json                版本与档位声明（install.ps1 的闸门读它）
scripts/install.ps1       一键入口（dry-run / -Apply / 自检 / 打印回滚命令）
scripts/apply.ps1         贴入（两阶段：先证明可改，再落盘）
scripts/check.ps1         自检（16 个文件的 sha256 与档位一致性）
scripts/restore.ps1       回滚
scripts/locate.ps1        从 desktop-target.json 定位 renderer / server 版本目录
src/                      皮肤源：三个主题各自的配色 / 材质档位 / 背景图 / 面板取景框
patches/                  注册表 / 主题卡片配色 / 卡片调色板 / locales 补丁
```
