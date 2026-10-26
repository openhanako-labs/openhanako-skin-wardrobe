# hana-skin 皮肤包 · 月满庭 / 极光 / Deepsleep

> 包版本 **v0.1.5**（`share.json` 的 `version` 字段与仓库根 `VERSION` 一致）。

一套给 **Windows 桌面版 Hana** 用的外观皮肤，含四个主题：两套深色、两套浅色。

装上之后，Hana 的「设置 → 界面 → 主题」里会多出这三个名字。选中即整套换肤：
壁纸从界面里透出来、面板与卡片分级半透明、外圈一圈极细描边、五个浮层面板自带「取景框」。
四个主题各自独立（各自一套配色 / 材质 / 背景 / 取景框源），互相不影响，可随时切换。

---

## 装之前先看清三条

| | |
|---|---|
| 改哪里 | Hana 的**安装目录**（当前版本下 18 个文件）。这不是官方主题包那种「导入一个 zip」的东西 |
| 版本 | 已验证 Hana **1.1.111-beta / 1.2.1-beta**（win32-x64）+ PowerShell 7（`pwsh`）+ `node`。版本不同也先跑断言，必要时由 Hana 自己修锚点 |
| 能不能恢复 | 能。写入前逐个文件备份，一条命令回滚到没贴过的状态 |

也就是说：它需要动安装目录里的构建产物，所以**对版本敏感** —— 但不是死卡：版本不对不会拦你，先跑完全部断言，锚点对得上就照贴；对不上就停下（不写盘），照 `REPAIR.md` 重新定位锚点再来一遍，一般只是上游小跳一版的事。

---

## 四个主题

| 主题名（界面里显示） | 主题 id | 明暗 | 底色 | 强调色 |
|---|---|---|---|---|
| 月满庭 · 夜阑 | `hana-moonlit-court` | 深色 | `#172725` | `#D9B77C` |
| 极光 · 夜穹 | `hana-violet-dusk` | 深色 | `#3C354A` | `#7662BA` |
| Deepsleep · Zzz饭..Zzz大白饭..Zzz | `hana-deepsleep` | 浅色 | `#f6f7fb` | `#5D79FF` |
| 陶土 · 暖纸 | `hana-claude-clay` | 浅色 | `#FAF9F5` | `#D97757` |

- **月满庭**：深青绿底 + 赭金强调，夜色壁纸，最安静的一套，长时间看不累。
- **极光**：紫灰底 + violet 强调，配极光壁纸，比月满庭冷、比它亮一点。
- **Deepsleep**：唯一的浅色主题，冷白底 + DeepSeek 蓝。深色主题里那些看不见的手段
  （投影、半透明填充的明暗、玻璃厚度）在它上面全部显形，所以它也是四套里观感最「轻」的一套。
- **陶土**：暖象牙纸底 + 陶土橙强调，取自 Claude 的品牌六色；壁纸是一张几乎看不见的暖纸纹。
  思考中那颗指示器在本主题下是「呼吸星芒」（十道不等长的星芒，只缩放不旋转）。

四套共用同一套圆角与间距，切换时控件不会跳尺寸。

---

## 装法一：交给你的 Hana（推荐）

把整个文件夹（或 zip）发给你的 Hana，附上这一句：

> 这个文件夹里是一套 Hana 皮肤，请先读 `README.md` 和 `INSTALL.md`，
> 按里面的步骤贴到我本机的 Hana 上。先跑 dry-run 把计划给我看，我确认了再真贴。

Hana 会自己定位你的安装目录、校验版本、跑一遍 dry-run，然后把「会改哪些文件」给你看。
你点头之后它才落盘，最后自动自检一遍并打印回滚命令。

## 装法二：自己动手（三步）

在解压出来的文件夹里执行。

**1. dry-run（一个字节都不写）**

```powershell
pwsh -File .\scripts\install.ps1
```

它会打印：你的 Hana 装在哪个版本目录、版本是否匹配、会改哪些文件、合成后的主题 CSS 大概多大。
看到「dry-run 通过」再往下走；报错就把输出原样发给会看的人，别硬贴。

**2. 真贴入**

```powershell
pwsh -File .\scripts\install.ps1 -Apply
```

贴之前先把 16 个原文件备份到 `backups\<版本目录名>-<时间戳>\`，然后写补丁，最后自动跑
`check.ps1` 核对每个文件的 sha256。命令末尾会打印回滚命令的完整路径。

**3. 重启 Hana**

完全退出（窗口关掉不算，要从托盘/任务栏退出程序），再启动。
渲染器和 server bundle 都是启动时加载的，不重启看不到效果。

---

## 装完怎么用

设置 → 界面（外观）→ 主题，列表里会多出上面三个名字，选一个即可。

想验证有没有贴对：在 Hana 的开发者工具控制台里跑

```js
document.documentElement.dataset.theme
```

应得到 `hana-moonlit-court` / `hana-violet-dusk` / `hana-deepsleep` 之一。

四个主题都贴进去了，你可以随时来回切，不需要重贴。

---

## 回滚（随时可以）

```powershell
pwsh -File .\scripts\restore.ps1 -BackupDir "backups\<刚才那个目录>" -Apply
```

备份是原文件的逐字节副本，回滚后与「从没贴过」完全一致。回滚同样需要重启 Hana。
`install.ps1 -Apply` 结束时会把这条命令的完整路径打出来，直接复制即可。

---

## 环境要求

| 项 | 要求 |
|---|---|
| 平台 | Windows x64（win32-x64）桌面版。手机端 / Web 端 / 托盘小窗都不适用 |
| Hana | 已验证 **1.1.111-beta / 1.2.1-beta**；其它版本不拦，先跑全量断言，失配时按 `REPAIR.md` 自己修 |
| Shell | PowerShell 7+（`pwsh`）。Windows 自带的 5.1 不够，脚本用了 7 的语法特性 |
| node | 在 PATH 里。脚本用 node 对注册表做「改前 11 项 → 改后 14 项」的真求值断言 |
| 前提 | Hana 已安装，并**至少启动过一次**（要生成 `artifacts/desktop-target.json`） |

自查环境：

```powershell
pwsh -v     # 期望 7.x
node -v
```

没装 PowerShell 7：`winget install --id Microsoft.PowerShell`

---

## 会改什么

| 位置 | 改什么 |
|---|---|
| renderer 树 `themes/` | 新增四份主题 CSS（各自 1~4 MB，壁纸以 data URI 内联其中） |
| renderer 树 `lib/theme.js` | 主题注册表加三项、给主题 CSS 的 URL 加 `?v=<版本串>`（绕缓存）、末尾追加浮层面板取景框脚本 |
| renderer 树 `assets/theme-registry-*.js` | 前端主题注册表加三项 |
| renderer 树 `assets/SettingsModalShell-*.css` | 设置页主题卡片的预览配色（每个主题 3 条规则） |
| renderer 树 `locales/*.json` × 5 | 补四个主题的名字与模式标签（zh / zh-TW / en / ja / ko） |
| server 树 `bundle/index.js` | 服务端主题注册表加三项 + 卡片调色板表补三项 |
| server 树 `desktop/dist-renderer/` | 四份主题 CSS + 设置页主题卡片配色 |

一共 18 个文件（1.2.1-beta 实测；上游构建换了以后文件数可能变）。
全部**先定位与断言、再统一落盘**：半途失配会直接中止，不会留下改了一半的状态。
`defaultTheme` / `autoLightDefault` / `autoDarkDefault` 一个字不动 —— 系统深浅色跟随仍指向 Hana 自带主题。

---

## 常见问题

**1. 我的 Hana 不是上面列的两个版本**

不拦你。脚本会提示「未验证版本」，然后照样跑完全部定位与断言：上游小跳一版时锚点往往仍然成立，断言过了就能直接贴。真失配也没事 —— 断言全在写盘前跑完，锚点没中就停下，一个字节不写。

失配时让它自己修：把 dry-run 的输出连同文件夹交给你的 Hana，说「按 `REPAIR.md` 修锚点，修完再跑 dry-run 给我看」。
它改的是包里 `patches/*.patch` 里的锚点描述，不碰 Hana 安装目录，一般也就一两处、抄一段文本的事。
修到 dry-run 通过，再 `-Apply`。

**2. 贴完重启，主题列表里没有这三个名字**

先看 `install.ps1 -Apply` 末尾 `check.ps1` 的结论：

- 全绿 → 多半是没真正退出 Hana（它可能还在托盘里），彻底退出再启动一次；
- 有文件 sha256 不符 → 把 `check.ps1` 的输出原样发出来，或者直接回滚重贴。

**3. Hana 升级之后皮肤消失了**

正常。Hana 每次升级都装进一个**全新的版本目录**，旧目录里的改动留在旧目录，不会跟过去，
也不会把 Hana 改坏。参考第1点让Hana修就行。

**4. 想少一点、淡一点**

```powershell
pwsh -File .\scripts\install.ps1 -Apply -Material subtle    # 材质：none / subtle / bold（默认 bold）
pwsh -File .\scripts\install.ps1 -Apply -Background none    # 不要壁纸背景
```

**5. 卡片里的 folio 幻灯片能不能用这几个主题色**

要分两层看，缺一层都不成立。**宿主这一层**已经随包补好：四个主题都写进了 server bundle 的卡片调色板表，`show_card` 铸卡时传 `theme: "hana-moonlit-court"` 这种 id，宿主能把它烧进卡片。**模板这一层**不在包里：folio 的幻灯片模板自带一张主题白名单（`<HANA_HOME>\recipes\hana-folio\assets\slides.card.html` 里的 `THEME_IDS`），官方原版只列了 11 个内建 id，我们的三个不在里面，卡片会拒收，报 `theme must be one of …`。要用就把它加进那份白名单（白名单本身和它下面那句报错文案，各一处），然后**彻底退出 Hana 再启动** —— recipe 有安装收据校验，改了文件不重启会报 `Recipe template changed after validation`。

两种错别混：`no card palette for theme "<id>"` 是宿主这一层缺项，说明包没贴好；`theme must be one of …` 是模板那一层不认识这个 id，说明白名单没加。

**6. 会不会被 Hana 的完整性校验挡住**

不会。安装包校验的是下载归档的哈希，启动时不重算树内文件。代价是升级不会保留皮肤（见第 3 条）。

---

## 包内清单

```
README.md                 这份说明（人看：是什么、怎么装、怎么退）
REPAIR.md                 版本对不上时怎么自己修锚点（给 Hana 的作业指导）
INSTALL.md                同一件事的详细版（给 Hana agent 看的步骤与技术备注）
share.json                版本与档位声明，install.ps1 的版本闸门读它
scripts/install.ps1       一键入口：定位 → 版本闸门 → dry-run → 贴入 → 自检 → 打印回滚命令
scripts/apply.ps1         真正贴入的实现（两阶段：先证明可改，再落盘）
scripts/check.ps1         自检：逐个文件比 sha256，并核对档位与文件内容是否自相矛盾
scripts/restore.ps1       回滚
scripts/locate.ps1        从 desktop-target.json 定位 renderer / server 两个版本目录
src/                      皮肤源：四个主题各自的配色 / 材质 / 背景图 / 面板取景框
patches/                  注册表、设置页主题卡片、卡片调色板、五种语言文案的补丁
```

---

## 给 Hana agent 的技术备注

如果你是被要求「帮我贴这个皮肤」的 agent：

1. **不要手改安装目录里的任何文件。** 一切走 `scripts/install.ps1`；它内部调 `apply.ps1`（贴）、
   `check.ps1`（自检）、`restore.ps1`（回滚）、`locate.ps1`（定位）。
2. `install.ps1` **默认 dry-run**，必须显式 `-Apply` 才写盘。这是改安装目录的操作，
   先把 dry-run 摘要给用户看，得到明确同意再 `-Apply`。
3. `desktop-target.json` 位置：`$env:HANA_HOME\artifacts\desktop-target.json`，
   `HANA_HOME` 未设时是 `%USERPROFILE%\.hanako\artifacts\desktop-target.json`。
   四个脚本都按这个规则自适应，不要硬编码用户名或版本目录名。
4. 退出码：0 = 成功；`check.ps1` 额外 1 = 版本目录已切换（要重贴）、2 = 文件不符、3 = 无法判定。
5. 贴完**必须让用户重启 Hana**，不要在没有重启的情况下宣称「已生效」。
6. 出错先看 `backups/<...>/manifest.json`（每个被改文件的原路径与改前 sha256），
   回滚命令在 `install.ps1 -Apply` 的输出末尾。
7. 更细的定位原理、锚点脆度、上游构建变化时的处置方式，见 `INSTALL.md`。

---

皮肤只在本机改外观，不发任何数据出去。玩得开心~
