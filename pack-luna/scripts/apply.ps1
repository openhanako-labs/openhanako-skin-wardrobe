<#
.SYNOPSIS
    apply.ps1 —— 把「中秋 · 月满庭」深色主题一键贴入 Hana 安装目录（单主题：工单 21 起只剩深色）。

.DESCRIPTION
    流程依 docs/PLAN.md 3.2「重贴流程」（工单 05）：
      1. 调 locate.ps1 取 renderer / server 两个 versionDir
      2. 校验目录与关键文件就位
      3. 若已备份同版本 → 提示已贴过，询问是否覆盖
      4. 备份将被修改的原文件到 backups/<version>-<timestamp>/
      5. 贴入一份 CSS 到 renderer 树 themes/（合成顺序：配色源 -> 材质源（若 -Material 非
         none）-> 背景源（若 -Background 非 none））
      6. 贴入 CSS 到 server 树 desktop/dist-renderer/themes/（配色源 + src/app-surface/*.css，
         即 App 面材质；不含材质档位源 / 背景源，见工单 41）
      7. 改 renderer lib/theme.js 注册表
      8. 改 renderer assets/index-*.js 注册表（通配 + 内容特征定位）
      9. 改 server bundle/index.js 注册表
     10. 改两棵树 assets/SettingsModalShell-*.css 的主题卡片预览配色（通配 + 内容特征定位）
     10b. 改 renderer lib/theme.js：给主题 CSS 的 href 加版本参数（-ThemeCacheBust on，默认）
     10c. 追加浮层面板取景框 JS 到 renderer lib/theme.js 末尾（-Background 非 none 时）
     10d. 改两个独立文档的主题 <link>（工单 36-B）：browser-viewer.html / viewer-window.html
     11. 补 i18n 到 renderer locales/*.json（五个）
     12. 写 skin.json（两个版本目录、每个被改文件的 sha256、时间戳）
     13. 提示：需重启 Hana 生效

    步骤 10 说明：设置页主题卡片的预览配色**不来自主题注册表**，而是硬编码在
    assets/SettingsModalShell-<hash>.css 里，每个主题三条规则（卡片底色 = 主题 --bg、
    主题名文字色 = 主题 --text、模式标签色 = 主题 --accent）。两棵树的 CSS 是两个独立构建
    产物、类名哈希不同，故 patches/theme-card-preview.patch 对两棵树各写一个 target，
    各自带自己的 classNames / anchor / followedBy / insertText。

    步骤 10b 说明（工单 16）：主题 CSS 的加载 URL 由 renderer 的 lib/theme.js 设定，
    若设的是**固定路径**（themes/hana-moonlit-court.css），就会被 Chromium 的 HTTP 缓存
    长期命中——实测"贴入新 CSS + 重启"后界面仍是旧样式。故在 theme.js 里注入一个版本常量，
    并让它参与 4 处 URL 拼接（这 4 处就是注册表之外、该文件里全部的主题 CSS URL 使用点）：
      * URL 比较基准：`new URL(<主题对象>.cssPath,document.baseURI).href`（不给它加版本号，
        它会永远不等于带版本号的 link.href，主题每次应用都会走"新建 link"的慢路径）；
      * 快路径分支：`(<主题表 link>.href=<主题对象>.cssPath)`；
      * 新建 <link>：`<新建 link>.href=<主题对象>.cssPath;`；
      * load 回调里换回主表：`<主题表 link>.href=<主题对象>.cssPath}`。
    （这 4 处带的是压缩器分配的局部变量名，上游重新构建就会变；写成角色而不是具体名字。）
    **注册表的 cssPath 一律不动**：assets/CardShell-*.js 的打印功能会把 cssPath 插进
    打印文档的 <link href="${cssPath}">，加 ?v= 会影响打印。

    版本串（工单 21 起）取「renderer 树**合成后**主题 CSS 的 sha256 前 16 位」（16 位十六进制）。
    为什么这样选：
      * 合成后 = 配色源 + [材质源] + [背景源]，故配色 / 材质 / 背景任一内容变化，串必变；
      * theme.js 里只有一个 href 模板，所以用一个"皮肤整体版本串"；
      * 单主题下只有一份主题 CSS，故直接取这一份合成后哈希的前 16 位
        （工单 21 之前是「两份各前 8 位拼接 = light8 + dark8」；浅色主题删除后该算法失效）。
    theme.js 是单行 minified 文件，改动一律"精确字符串替换 + 命中数断言"，绝不做正则全局替换；
    任一处命中数不等于预期即显式报错中止。-ThemeCacheBust none 时本步骤整体跳过，
    theme.js 与不加本开关时逐字节一致。

    步骤 10d 说明（工单 36-B）：renderer 树里有 9 个 html，其中 7 个自带
    <link ... href="themes/warm-paper.css" id="themeSheet">；只有 browser-viewer.html 与
    viewer-window.html 没有，它们加载的是构建产物里写死的
    <link rel="stylesheet" crossorigin href="./assets/warm-paper-<hash>.css">。
    那份 CSS 的作用域是 [data-theme=warm-paper],:root:not([data-theme])，而这两个文档的
    <html> 是 theme.js 设的 data-theme="hana-moonlit-court" —— 两边不匹配，于是主题变量全空
    （真机实测 --bg / --bg-card / --panel-card-bg 都读到空串，body 文字色 rgb(0,0,0)）。
    更根本的原因：theme.js 的 L(e) 只做 `const s=document.getElementById("themeSheet")`，
    s 为 null 时它**只设 data-theme、不创建 link**（见 "if(!O||!s||s.href===a)"），
    所以那个写死的 warm-paper link 永远不会被换成当前主题 —— 加 id="themeSheet" 才能让
    theme.js 接管（与其它 7 个 html 同构）。

    patch 形态：把**整段** warm-paper <link>（用通配匹配 assets/warm-paper-*.css，
    **不写死构建哈希**）替换为
        <link rel="stylesheet" crossorigin href="themes/<主题>.css?v=<版本串>" id="themeSheet">
    其中主题路径取自 $script:ThemeDefs，版本串**复用步骤 10b 现算的同一个版本串**
    （$script:ThemeCacheBustVersion = renderer 树合成后主题 CSS 的 sha256 前 16 位），
    不再另算一份 —— 否则皮肤一升级，html 里的 ?v= 会与 theme.js 里的常量对不上。
    -ThemeCacheBust none 时版本串为空，写成不带 ?v= 的 href（与 theme.js 不加版本参数时一致）。

    安全设计（工单 05「安全边界」）：
      * 默认 dry-run：不传 -Apply 时只打印"将要做什么"，不写入任何文件。
      * 两阶段执行：先在内存中完成全部定位与断言（锚点唯一性、anchorContext.before 前文、
        锚点后文结构校验、主题数 11 → 12、i18n 往返无损），证明"可以成功"之后才落盘，
        避免写到一半失败留下半改状态。
      * 写入前强制备份；备份目录含 manifest.json（每个条目的 tree / 相对路径 / 改动前 sha256 /
        是否存在），可被 restore.ps1（工单 06）逐文件还原。
      * 任一步失败即停止，报告已完成到哪一步、已备份什么、回滚指引，不继续。
      * 不改 desktop-target.json，不改 .verified，不触碰 defaultTheme / autoLightDefault / autoDarkDefault。

.PARAMETER RendererDir
    renderer 版本目录。不传时用 locate.ps1 的结果。
    传了即可把目标指向副本，便于在**不碰真实安装目录**的前提下完整验证。

.PARAMETER ServerDir
    server 版本目录。同上。

.PARAMETER TargetJson
    desktop-target.json 路径，原样透传给 locate.ps1。仅当 -RendererDir / -ServerDir 有缺省时才用到。
    默认取 $env:HANA_HOME\artifacts\desktop-target.json，HANA_HOME 未设时退到
    %USERPROFILE%\.hanako\artifacts\desktop-target.json（分享给别人的机器也能直接跑）。

.PARAMETER RepoRoot
    本仓库根目录（src/ 与 patches/ 所在）。默认取脚本所在目录的父目录。

.PARAMETER BackupRoot
    备份根目录。优先级：显式传参 > 环境变量 `HANA_SKIN_BACKUP_ROOT` > 默认 `<RepoRoot>/backups`。
    备份（含回滚所需的原始副本）不该住在代码树里：一换工作树/分支就要跟着搬家，
    而 skin.json 记的是绝对路径。把环境变量设成一个代码树外的目录即可让备份长期分家。

.PARAMETER SkinJson
    skin.json 输出路径。默认 <RepoRoot>/skin.json。

.PARAMETER Material
    材质档位：none（默认）/ subtle / bold。
      * none   —— 行为与第一期逐字节等价：只把配色源贴进两棵树。
      * subtle —— renderer 树 themes/*.css = 配色源 + 换行 + src/material/subtle.css；
                  server 树 themes/*.css 不含 **材质档位源**（App 面的材质是另一套：
                  src/app-surface/*.css，只贴 server 树，见工单 41 与 appSurfaceSource）。
      * bold   —— 同上，材质源换成 src/material/bold.css（工单 11 产出，本票尚未交付）。
    档位非法、或所选档位的材质源文件缺失时，脚本显式报错并以非零退出码结束，**不静默降级**
    （不允许"要 subtle 却贴了纯配色"）。
    未显式传本参数、且 skin.json 已存在时，**沿用上次贴入登记的档位**（工单 18）——
    避免重贴时把上次的材质静默丢掉；要真的去掉需显式传 -Material none。

.PARAMETER Background
    背景档位：none（默认）/ dark（工单 14）。
      * none —— 行为与现状逐字节等价：主题文件里不含任何背景内容。
      * dark —— 给 renderer 树的深色主题文件贴背景：
                  renderer themes/hana-moonlit-court.css = 配色源 + [材质源] + 背景源
                  server   同名 themes/hana-moonlit-court.css = 配色源 + App 面材质源（不含背景）
                背景源是 src/background/dark.css，其中的占位符 __BG_DARK_DATA_URI__
                在贴入时被替换为 src/background/assets/moonlit-night.png 的
                data:image/png;base64,<b64>。占位符必须**恰好命中 1 次**，否则报错中止。
    合成顺序：配色源 -> 材质源（若 -Material 非 none）-> 背景源（若 -Background 非 none）。
    背景源缺失 / 图片缺失 / 档位非法时，脚本显式报错并以非零退出码结束，**不静默降级**。
    未显式传本参数、且 skin.json 已存在时，**沿用上次贴入登记的档位**（工单 18）——
    1.0.16 重贴时就是因为没带这个参数，深色背景图与右侧工作区透明规则被静默抹掉；
    要真的去掉需显式传 -Background none。

.PARAMETER ThemeCacheBust
    主题 CSS 版本参数（工单 16）：none / on，默认 on。
      * on   —— 给 renderer lib/theme.js 注入版本常量（HANA_SKIN_CSS_V），并让 4 处
                主题 CSS 的 URL 拼接它：themes/x.css -> themes/x.css?v=<版本串>。
                版本串 = renderer 树合成后主题 CSS 的 sha256 前 16 位（单主题，工单 21 起）。
                幂等：已加过则不重复加；版本串变化时替换为新值；文件里没有该常量时先插入。
                命中数不等于预期、或出现半改状态，一律显式报错中止（不猜、不静默跳过）。
      * none —— 完全不改 lib/theme.js 的这部分，产出与不加本开关时**逐字节一致**。
    无论 on / none，注册表三处 cssPath 都保持 themes/xxx.css 原样（CardShell 打印依赖）。
    未显式传本参数、且 skin.json 已存在时，沿用上次的开关状态（工单 18）。
.PARAMETER Apply
    显式确认参数：只有传了它才真正写盘。不传即 dry-run。

.PARAMETER Force
    跳过"已贴过，是否覆盖？"的交互询问（用于重跑 / 无人值守）。

.EXAMPLE
    # 只看计划，不写盘
    pwsh -File scripts/apply.ps1

.EXAMPLE
    # 真正贴入
    pwsh -File scripts/apply.ps1 -Apply

.EXAMPLE
    # 在副本上验证（不碰真实安装）
    pwsh -File scripts/apply.ps1 -RendererDir $r -ServerDir $s -Apply `
        -BackupRoot $tmp\backups -SkinJson $tmp\skin.json

.NOTES
    PowerShell 7+。需要 node 在 PATH 中——三处注册表的主题数断言用 node 真求值（不是数 id 字符串）。
#>
[CmdletBinding()]
param(
    [string]$RendererDir,
    [string]$ServerDir,
    [string]$TargetJson = $(if ($env:HANA_HOME) { Join-Path $env:HANA_HOME 'artifacts\desktop-target.json' } else { Join-Path $env:USERPROFILE '.hanako\artifacts\desktop-target.json' }),
    [string]$RepoRoot,
    [string]$BackupRoot,
    [string]$SkinJson,
    [ValidateSet('none', 'subtle', 'bold')]
    [string]$Material = 'none',
    [ValidateSet('none', 'dark')]
    [string]$Background = 'none',
    [ValidateSet('none', 'on')]
    [string]$ThemeCacheBust = 'on',
    [switch]$Apply,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ============================================================================
# 常量
# ============================================================================

$script:Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

# 失配时的自查入口（随包分发）。报错带上它，接手的人 / 那个 Hana 才知道下一步该读哪里。
$script:RepairDoc = 'REPAIR.md'

# 主题：id 与源 CSS 文件名（目标文件名与源文件名一致）。
# 工单 21：皮肤改单主题（只剩深色），浅色项与其源文件一并删除。
# 工单 21 补正：命名全面统一 —— 主题 id 去掉 -dark 后缀，改为 hana-moonlit-court。
#
# 2026-10-18 · 第二个主题「极光」：用户要求**独立于月满庭**，不共用、不改造。
# 故每个主题自带一套源目录（配色 / 材质 / 背景 / 取景框），互不引用：
#   MaterialDir / BackgroundDir / PanelFrameDir 不再走全局单值，而是挂在主题项上。
# 月满庭的三项仍指回它原来的目录，所以它合成出的 CSS 应**逐字节不变**
# （sha256 仍为 bca483a055d14bf1e1788749e3dde2f38a172d4fbf401800c02041e29e91a43b）。
#
# HasBackground: 该主题是否参与背景层与取景框层（取代原来的单值 $BackgroundDarkThemeId）。
# 两个主题都做背景（同一张夜色图各自的副本），但各读各的源。
$script:ThemeDefs = @(
    [pscustomobject]@{
        Id             = 'hana-moonlit-court'
        File           = 'hana-moonlit-court.css'
        MaterialDir    = 'material'
        BackgroundDir  = 'background'
        PanelFrameDir  = 'panel-frame'
        BackgroundAsset = 'assets/moonlit-night.png'
        HasBackground  = $true
    }
    [pscustomobject]@{
        Id             = 'hana-violet-dusk'
        File           = 'hana-violet-dusk.css'
        MaterialDir    = 'material-violet'
        BackgroundDir  = 'background-violet'
        PanelFrameDir  = 'panel-frame-violet'
        BackgroundAsset = 'assets/violet-aurora.png'
        HasBackground  = $true
    }
    # 第三个主题：DeepSeek 蓝（**浅色**，2026-10-20 起）。
    # 它是项目第一个浅色主题，材质/背景/取景框各自独立一份源（同紫夜的做法）。
    # 浅色主题的材质参数是**反向**的：白描边在浅底上等于没画，故 material-deepseek
    # 里 --mat-edge 已改为墨水色（详见 src/hana-deepsleep.css 文件头）。
    [pscustomobject]@{
        Id             = 'hana-deepsleep'
        File           = 'hana-deepsleep.css'
        MaterialDir    = 'material-deepseek'
        BackgroundDir  = 'background-deepseek'
        PanelFrameDir  = 'panel-frame-deepseek'
        BackgroundAsset = 'assets/daybreak.png'
        HasBackground  = $true
        # 显示名（2026-10-20，用户点名要的叫法）：叶名 -> 文案。
        # 卡片上拼成「<名字> · <副标题>」，与月满庭 / 紫夜的读法一致。
        # locale 那一步默认**只增键**，改值要显式走 Overrides 通道（见 Resolve-LocalePlan）。
        Labels         = @{
            deepseekBlue     = 'Deepsleep'
            deepseekBlueMode = 'Zzz饭..Zzz大白饭..Zzz'
        }
    }
    # 第四主题：Luna 龙娘（深色）。配色取自 hana-luna-theme 的完整 61 变量定义，
    # 材质 / 背景 / 取景框各自独立一份源（同前三个主题的做法）。
    [pscustomobject]@{
        Id             = 'hana-luna'
        File           = 'hana-luna.css'
        MaterialDir    = 'material-luna'
        BackgroundDir  = 'background-luna'
        PanelFrameDir  = 'panel-frame-luna'
        BackgroundAsset = 'assets/luna-art.png'
        HasBackground  = $true
        Labels         = @{
            lunaDragon     = 'Luna 龙娘'
            lunaDragonMode = '玫瑰月影'
        }
    }
)

# 三份注册表 patch 与其所在树（文件路径按 patch 的 target 字段解析）
$script:RegistryPatchFiles = @(
    [pscustomobject]@{ Patch = 'theme-registry-renderer.patch'; Tree = 'renderer'; Label = 'renderer lib/theme.js' }
    [pscustomobject]@{ Patch = 'theme-registry-bundle.patch';   Tree = 'renderer'; Label = 'renderer assets/index-*.js' }
    [pscustomobject]@{ Patch = 'theme-registry-server.patch';   Tree = 'server';   Label = 'server bundle/index.js' }
)

# 主题卡片预览配色 patch（步骤 10）。与上面三份注册表 patch 不同：
# 它一个文件里含两个 target（renderer / server 各一），且目标文件名带构建哈希，
# 必须用 targetGlob 通配 + contentFeatures 定位，不能用固定相对路径。
$script:CardPreviewPatchFile = 'theme-card-preview.patch'

# 卡片调色板 patch（工单 73）：server 树 bundle/index.js 的 MGr 表，为三个主题各补一项调色板。
# 不补则 folio 幻灯片传 theme:"<本皮肤 id>" 时抛 no card palette for theme。
$script:CardPalettePatchFile = 'card-palette-server.patch'

$script:Locales = @('zh', 'zh-TW', 'en', 'ja', 'ko')

# 材质源（第二期）：一档一份文件，位于 <RepoRoot>/src/material/<档位>.css。
# 只有 renderer 树会贴「配色源 + 材质源」的合成文本；server 树不贴材质档位源
# （server 树的成分 = 配色源 + src/app-surface/*.css，见下面的 AppSurfaceDir）。
$script:MaterialDir = 'material'
# 配色源与材质源之间的分隔：一个换行（配色源本身以 '\n' 结尾，故追加后是两个换行，
# 保证两份来源之间有空行，且合成结果与 src/*.css 一样是「UTF-8 无 BOM + LF」）。
$script:MaterialSeparator = "`n"

# App 面材质源（工单 41）：src/app-surface/<任意名>.css，目录内**全部** *.css 按文件名字典序拼进
# **server 树**那份主题文件（App 面唯一的样式表入口 = server bundle 的 /apps/theme.css 路由，
# 它原样读取 server 树的 desktop/dist-renderer/themes/<id>.css）。
# 与材质源 / 背景源不同：它不受档位控制（目录里有几份就贴几份；目录为空 = 不合成，行为与今天逐字节相同）。
$script:AppSurfaceDir = 'app-surface'
# 与配色源之间的分隔：一个换行（配色源以 '\n' 结尾，故追加后是两个换行）。
$script:AppSurfaceSeparator = "`n"
# 每份 app-surface 源的内容里必须出现的特征串，用于落盘后的**正向**回读断言
# （背景那条断言只能证明 server 树「没有」图，证明不了「新源确实贴进去了」）。
$script:AppSurfaceFeature = 'data-dshana-face'

# 背景源（工单 14）：src/<主题的 BackgroundDir>/<档位>.css，内含占位符 __BG_DARK_DATA_URI__。
# 2026-10-18 起目录**按主题**取（ThemeDefs[].BackgroundDir），不再用全局 $BackgroundDir：
# 两套主题各自的背景源互相独立，删掉一个不牵连另一个。
$script:BackgroundDir = 'background'          # 仅作默认值/兼容，实际以主题项为准
$script:BackgroundDarkPlaceholder = '__BG_DARK_DATA_URI__'
$script:BackgroundDarkAsset = 'assets/moonlit-night.png'
$script:BackgroundSeparator = "`n"

# 主题注册表里"不许动"的三项（D10 / 工单 03 untouched）。
# 值可能是字符串字面量（theme.js: defaultTheme:"warm-paper"）或压缩后的标识符绑定
# （bundle: defaultTheme:JU / server: defaultTheme: Jmr），故两种形态都要捕获。
$script:UntouchedDefaultsPattern = 'defaultTheme\s*:\s*[^,}\r\n]+|autoLightDefault\s*:\s*[^,}\r\n]+|autoDarkDefault\s*:\s*[^,}\r\n]+'

# 主题 CSS 版本参数（工单 16）：给 lib/theme.js 的主题 CSS URL 加 ?v=<版本串>，
# 让 URL 随内容变化，从而绕过 Chromium 的 HTTP 缓存（工单 16 实测：固定路径 → 旧 CSS 永久命中）。
#
# theme.js 里共 5 处主题 CSS URL 使用点，只有 4 处是"设 href / 比较 href"的地方：
#   (A) 注册表字段校验里的那处            —— 不动
#   (B) new URL(<主题对象>.cssPath,...).href —— URL 比较基准
#   (C) (<主题表 link>.href=<主题对象>.cssPath)   —— 快路径分支
#   (D) <新建 link>.href=<主题对象>.cssPath;      —— 新建 <link>
#   (E) <主题表 link>.href=<主题对象>.cssPath}    —— load 回调
# 注册表数据（themes/xxx.css）一律不动：assets/CardShell-*.js 的打印功能会把 cssPath 插进
# 打印文档的 <link href="${cssPath}">，加 ?v= 会影响打印。
$script:ThemeCacheBustModes = @('none', 'on')

# 版本常量名：带 HANA_SKIN_ 前缀，避开压缩器可能占用的短标识符（单字母 / 双字母）。
$script:ThemeCacheBustConstName = 'HANA_SKIN_CSS_V'

# 注入点：IIFE 第一条语句（'use strict'）之后。断言唯一，且落在注册表对象之前——
# 这样"注册表 cssPath 一字未动"的核对才真正说明问题。
$script:ThemeCacheBustDeclAnchor = '(function(){"use strict";'

# 4 处 URL 的精确锚点（改前 -> 改后）。逐处断言"改前恰好命中 1 次"，绝不做正则全局替换。
# 注意 (B) 必须一并加版本号：否则带版本号的 href 永远不等于不带版本号的那个基准 URL，
# 主题每次应用都会走"新建 <link>"的慢路径（多一次请求 + 闪烁）。
#
# ⚠️ 这 4 个锚点里带的是**压缩器分配的局部变量名**，上游每次重新构建都可能变：
#   1.1.0 -> 1.1.7 那一跳换过一次；1.1.24 -> 1.1.35 又换过一次（快路径 c→E、新建 link i→s、
#   load 回调 c→E；主题对象变量始终是 o，URL 基准那条没变）。换名后的实测命中数：
#   4 条各自 1 次、旧的 3 条各 0 次，且常量声明锚点 '(function(){"use strict";' 唯一。
#   1.1.0-beta：主题对象 = t、主题表 link = s、新建 link = o
#   1.1.7-beta：主题对象 = o、主题表 link = c、新建 link = i（本版重贴时按实际构建改的）
#   1.1.111-beta（2026-10-24）：主题对象 = o、主题表 link = E、新建 link = r；
#     同时快路径的**判据**被上游重写了：旧版是 `(<link>.href===<obj>.cssPath)`（直接比相对路径），
#     新版是 `E.href===s`，s 即 `new URL(cssPath, baseURI).href` 算出的绝对 URL。
#     结论不变：只要 (B) 与三处设 href 一起加版本串，E.href 解析后自然等于 s，快路径仍命中。
#     若只给 (B) 加、不给设 href 加，就会永远走慢路径（多一次请求 + 闪烁）—— 这条约束照旧。
#   上游一变，这 4 处就集体未命中（报错见下面的 Stop-Fail）。修法：读新构建的
#   renderer/lib/theme.js，在主题应用函数里认出这四个角色，把 Before/After 换成新名字。
#   角色判据（与变量名无关）：
#     (B) 主题对象 —— `new URL(<主题对象>.cssPath,document.baseURI).href` 里的那个；
#     (C) 主题表 link —— `(<link>.href=<主题对象>.cssPath)` 这个快路径分支里的第一个；
#     (D) 新建 link —— `<新建link>.href=<主题对象>.cssPath;`（紧跟 `rel="stylesheet"`）；
#     (E) 主题表 link —— load 回调里 `<link>.href=<主题对象>.cssPath}`。
$script:ThemeCacheBustSites = @(
    [pscustomobject]@{
        Name   = 'URL 比较基准（new URL）'
        Before = 'new URL(o.cssPath,document.baseURI).href'
        After  = 'new URL(o.cssPath+HANA_SKIN_CSS_V,document.baseURI).href'
    }
    [pscustomobject]@{
        Name   = '快路径分支（E.href=o.cssPath）'
        Before = '(E.href=o.cssPath)'
        After  = '(E.href=o.cssPath+HANA_SKIN_CSS_V)'
    }
    [pscustomobject]@{
        Name   = '新建 <link>（r.href=o.cssPath）'
        Before = 'r.href=o.cssPath;'
        After  = 'r.href=o.cssPath+HANA_SKIN_CSS_V;'
    }
    [pscustomobject]@{
        Name   = 'load 回调（E.href=o.cssPath）'
        Before = 'E.href=o.cssPath}'
        After  = 'E.href=o.cssPath+HANA_SKIN_CSS_V}'
    }
)

# 注册表"不许动"的 cssPath 断言探针：整份文件里带 ?v= 的 cssPath 值必须恒为 0 处，
# 且 'cssPath:"' 的总处数改前改后必须相等（证明注册表结构一字未动）。
# 注意**不能**断言"hana-moonlit-court.css 这个 cssPath 已存在"：本步骤（4b）的预演发生在
# 步骤 7 注册表 patch 之前，全新安装（pristine）时这两个条目还没插进去。
$script:ThemeCacheBustCssPathProbe = 'cssPath:"'
$script:ThemeCacheBustRegistryCssPathNote = 'themes/*.css（注册表三处 cssPath 保持不带 ?v=）'

# 浮层面板取景框（工单 30）：把「面板在窗口/屏幕上的位置」写成 CSS 变量的小 JS，
# 由 apply.ps1 追加到 renderer 树 lib/theme.js 末尾。
# 为什么必须走 JS（而不是 background-attachment: fixed）：实测（t30-evidence/probe/bg-attach-test.mjs）
#   元素带 transform 时 fixed 背景会被锚到**元素自己**；真机面板的可见圆角面挂着
#   animation: hana-slide-in-left ... both，收尾帧 transform: translate(0) scale(1) 被保留。
# 图为什么由 JS 直接设 background-image（不走 CSS 变量）：实测（len-limit.mjs）
#   Chromium 对自定义属性的**值**有 1.5~2 MB 上限，3.9 MB 的 data URI 会被**静默丢弃**。
$script:PanelFrameDir = 'panel-frame'
$script:PanelFrameSourceFile = 'bg.js'
$script:PanelFrameCssFile = 'dark.css'
# 追加进 theme.js 的标记行：幂等定位与重写都用它（下次贴入先裁掉标记之后的旧内容）。
$script:PanelFrameMarker = '/* hana-panel-frame */'
# 追加内容里必须出现的特征串（证明追加的是本仓源文件，不是别的东西）。
$script:PanelFrameFeature = '__hanaPanelFrame'

# 独立文档的主题 <link>（工单 36-B）：renderer 树里没有 #themeSheet 的两个 html。
#
# ⚠️ 2026-10-20（1.1.24 -> 1.1.35）本步骤**整体作废**，清单留空：
#   * viewer-window.html 在 1.1.35 里已被上游删除（文件本身不存在了）；
#   * browser-viewer.html 不再引 assets/warm-paper-<hash>.css，而是直接
#     `<script src="lib/theme.js"></script>` —— 它现在自己用 theme.js 引导主题
#     （同目录还有 theme-registry / user-theme-bootstrap / appearance-sync 等 modulepreload）。
#     当年这票手工模拟的效果（加 id="themeSheet" 让 theme.js 接管），上游已原生实现，
#     故锚点自然不存在：dry-run 实测 warm-paper 引用 0、id="themeSheet" 0。
#   将来若上游又冒出「不加载 theme.js 的独立文档」，把它的相对路径加回下面的清单即可，
#   其余判定逻辑（plain / posted / 半改报错）原样可用。
$script:ThemeLinkTargets = @(
)
# 为什么锚点必须通配、不能写死：warm-paper 的 CSS 文件名是 Vite 构建哈希
# （实测 1.1.0-beta 为 ./assets/warm-paper-DkSOn8Rd.css），**跨构建即变**。
# 所以锚点用正则匹配「整段 link 标签」，要求该标签里同时含:
#   * 字面量 rel="stylesheet"      —— 属性顺序由构建器决定，故分三条 lookahead，不假设顺序
#   * assets/warm-paper-<hash>.css —— 只认这一族的引用（连续两段 .css 时用 [^>]*? 吃掉前一段）
#   * ./assets/ 前缀               —— 防止误伤别的目录下的同名文件
#
# 为什么断言「恰好 1 次」：这是"引用唯一"的硬证据。命中 0 次说明上游构建变了或已贴过，
# 命中 >1 次说明文档里有第二处 warm-paper 引用 —— 两种都显式报错中止，不猜。
$script:ThemeLinkPattern = '<link\b[^>]*\brel="stylesheet"[^>]*href="\./assets/warm-paper-[^"]*\.css"[^>]*>'
$script:ThemeLinkId = 'themeSheet'
# 贴过之后的形态探针：**整段** <link ... id="themeSheet" ...>。
# 为什么不用 'href="themes/' 这种前缀做探针（实测踩过）：
#   browser-viewer.html 里本来就有一行 `<link rel="stylesheet" href="themes/continuous-corners.css">`
#   （连续圆角，官方自有），前缀会把它一起数进来 -> 命中数 2 -> 幂等判定失效、
#   第二次 apply 会误报「半改状态」。故探针必须锚在 **id="themeSheet"** 上（这是本票新加的、
#   官方原文里不存在的唯一锚点），且整段匹配，这样主题改名 / 版本串变化都仍能识别为 posted。
$script:ThemeLinkPostedPattern = '<link\b[^>]*\bid="themeSheet"[^>]*>'

# App 面材质回读基线（工单 41）：配色源里 'data:image' 的处数；$null = 本次不贴 App 面材质。
$script:AppSurfaceDataImageBaseline = $null

# 状态（供失败报告使用）
$script:Completed = [System.Collections.Generic.List[string]]::new()
$script:BackupDir = '(尚未创建)'
$script:SkinJsonPath = '(尚未确定)'

# ============================================================================
# 通用工具
# ============================================================================

function Write-Log {
    param([string]$Message = '')
    Write-Host $Message
}

function Write-Head {
    param([string]$Title)
    Write-Log ''
    Write-Log ('=' * 72)
    Write-Log $Title
    Write-Log ('=' * 72)
}

function Stop-Fail {
    param([Parameter(Mandatory)][string]$Message)
    throw $Message
}

# StrictMode 下安全取属性：字段不存在返回 $null 而不抛异常
function Get-Prop {
    param($Object, [Parameter(Mandatory)][string]$Name)
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function Get-RequiredProp {
    param($Object, [Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][string]$What)
    $v = Get-Prop $Object $Name
    if ($null -eq $v) { Stop-Fail "$What 缺少必需字段 '$Name'" }
    return $v
}

function Get-BytesSha256 {
    param([Parameter(Mandatory)][byte[]]$Bytes)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $h = $sha.ComputeHash($Bytes)
    }
    finally {
        $sha.Dispose()
    }
    return (-join ($h | ForEach-Object { $_.ToString('x2') }))
}

function Get-FileSha256 {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

# 逐字（Ordinal）计数，不用正则，避免 12 MB 文件上的正则开销
function Get-OccurrenceCount {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][string]$Needle)
    if ($Needle.Length -eq 0) { Stop-Fail 'Get-OccurrenceCount：Needle 不能为空' }
    $n = 0
    $i = 0
    while ($true) {
        $i = $Text.IndexOf($Needle, $i, [StringComparison]::Ordinal)
        if ($i -lt 0) { break }
        $n++
        $i += $Needle.Length
    }
    return $n
}

<#
    读取文本文件并要求"UTF-8 无 BOM + 可逐字节往返"。
    往返校验是关键：后续所有改动都是「读成字符串 → 改字符串 → 用 UTF-8 无 BOM 写回」，
    只有确认编码往返无损，才能保证插入以外的内容逐字节不变。
#>
function Read-Utf8File {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Stop-Fail "文件不存在：'$Path'" }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        Stop-Fail "文件带 UTF-8 BOM，本脚本按无 BOM 处理会破坏字节：'$Path'"
    }
    $text = $script:Utf8NoBom.GetString($bytes)
    $reEncoded = $script:Utf8NoBom.GetBytes($text)
    if ((Get-BytesSha256 $reEncoded) -cne (Get-BytesSha256 $bytes)) {
        Stop-Fail "文件不是合法 UTF-8（往返编码不一致），拒绝改写：'$Path'"
    }
    return [pscustomobject]@{ Path = $Path; Text = $text; Bytes = $bytes; Sha256 = (Get-BytesSha256 $bytes) }
}

<#
    统计 cssPath 值里带版本参数（'?v='）的处数。纯字符串扫描，不用正则。
    "不改注册表 cssPath" 这条硬约束就靠它断言：注册表三处必须始终是 themes/xxx.css，
    不带 ?v=（assets/CardShell-*.js 的打印功能会把 cssPath 插进打印文档的 <link href>）。
#>
function Get-VersionedCssPathCount {
    param([Parameter(Mandatory)][string]$Text)
    $needle = 'cssPath:"'
    $n = 0
    $i = 0
    while ($true) {
        $i = $Text.IndexOf($needle, $i, [StringComparison]::Ordinal)
        if ($i -lt 0) { break }
        $vStart = $i + $needle.Length
        $vEnd = $Text.IndexOf('"', $vStart)
        if ($vEnd -lt 0) { break }
        $val = $Text.Substring($vStart, $vEnd - $vStart)
        if ($val.Contains('?v=')) { $n++ }
        $i = $vEnd + 1
    }
    return $n
}

function Write-Utf8NoBomFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Text)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrEmpty($dir) -and -not (Test-Path -LiteralPath $dir -PathType Container)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllBytes($Path, $script:Utf8NoBom.GetBytes($Text))
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$What)
    $f = Read-Utf8File -Path $Path
    try {
        $obj = $f.Text | ConvertFrom-Json
    }
    catch {
        Stop-Fail "$What JSON 解析失败：'$Path' —— $($_.Exception.Message)"
    }
    if ($null -eq $obj) { Stop-Fail "$What 解析结果为空：'$Path'" }
    return $obj
}

<#
    读取上一次贴入登记的档位（skin.json），仅供「未显式传参时沿用上次档位」使用。

    首次贴入时文件不存在，所以读不到是**常态**：一律返回 $null，绝不因此报错。
    但调用方必须把"读到了什么"如实打出来 —— 曾经的坑就是重贴时默认档位是 none，
    于是上次挂着的背景与工作区透明被静默抹掉（见工单 18）。
#>
function Get-PreviousTierRecord {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    try {
        $text = [System.IO.File]::ReadAllText($Path, $script:Utf8NoBom)
        if ([string]::IsNullOrWhiteSpace($text)) { return $null }
        $obj = $text | ConvertFrom-Json
        if ($null -eq $obj) { return $null }
        return [pscustomobject]@{
            Material       = [string](Get-Prop $obj 'material')
            Background     = [string](Get-Prop $obj 'background')
            ThemeCacheBust = (Get-Prop $obj 'themeCacheBust')
            AppliedAtLocal = [string](Get-Prop $obj 'appliedAtLocal')
            VersionLabel   = [string](Get-Prop $obj 'versionLabel')
        }
    }
    catch { return $null }
}

# ============================================================================
# 材质合成（配色源 + 材质源）
# ============================================================================

<#
    读取一份 CSS 源并要求「UTF-8 无 BOM + LF 换行 + 可逐字节往返」。

    为什么比 Read-Utf8File 多一条换行断言：
    合成结果按「配色源 + 换行 + 材质源」拼接后整段写入，若源文件里混进 CRLF，
    拼接出来的文件就会一半 LF 一半 CRLF，与第一期产出的 themes/*.css 风格不一致。
    源是纯文本、由本仓库维护，出现 CRLF 就是编辑事故，直接报错比静默产出混排文件好。
#>
function Read-CssSourceFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$What)
    $f = Read-Utf8File -Path $Path
    if ($f.Text.Contains("`r")) {
        Stop-Fail "$What：'$Path' 含 CR（CRLF 换行）—— 仓库内 CSS 源一律 LF，拒绝拼接以免产出混排换行"
    }
    return $f
}

<#
    合成「配色源 + 换行 + 材质源」的文本。Material = none 时直接返回配色源文本本身，
    调用方据此走原来的 Copy-Item 路径，保证 -Material none 与第一期逐字节等价。
    返回 $null 表示「不需要合成」（none）。
#>
function Join-ComposedCss {
    param(
        [Parameter(Mandatory)]$Theme,
        [Parameter(Mandatory)][string]$MaterialTier
    )
    if ($MaterialTier -eq 'none') { return $null }
    if ($null -eq $Theme.MaterialSource) { return $null }
    return ($Theme.SourceText + $script:MaterialSeparator + $Theme.MaterialSource.Text)
}

# ============================================================================
# App 面材质合成（配色源 + App 面材质源，只贴 server 树 · 工单 41）
# ============================================================================

<#
    读取 src/app-surface/ 目录下**全部** *.css（按文件名字典序），作为 App 面材质源。

    为什么是"整个目录全拼"而不是"按档位选一份"：
      App 面只有**一个**样式表入口 —— server 树那份 themes/<id>.css（server bundle 的
      /apps/theme.css 路由原样读它）。而每个 App 的类名体系与渲染层不同源，必须逐个 App
      各写一份（本票先做 dshana.css）。按"目录内全拼"的规则，将来新增一个 App 只需新增
      一个源文件，不必改脚本、不必加档位参数。

    目录不存在 / 目录为空 → 返回 $null：调用方据此走原来的 Copy-Item 路径，
    保证 server 树的行为与今天**逐字节相同**（验收标准第 1 条）。
#>
function Read-AppSurfaceSources {
    param([Parameter(Mandatory)][string]$SrcDir)

    $dir = Join-Path $SrcDir $script:AppSurfaceDir
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) { return $null }

    $files = @(Get-ChildItem -LiteralPath $dir -Filter '*.css' -File | Sort-Object Name)
    if ($files.Count -eq 0) { return $null }

    $items = [System.Collections.Generic.List[object]]::new()
    foreach ($f in $files) {
        # 沿用 Read-CssSourceFile：UTF-8 无 BOM + LF 换行 + 可逐字节往返，缺一即报错中止。
        $src = Read-CssSourceFile -Path $f.FullName -What "App 面材质源 '$($f.Name)'"
        $rel = "src/$($script:AppSurfaceDir)/$($f.Name)"

        if (-not $src.Text.Contains($script:AppSurfaceFeature)) {
            Stop-Fail ("App 面材质源 '$($f.FullName)' 不含特征串 '$($script:AppSurfaceFeature)' —— " +
                '文件与脚本约定不符（落盘后的正向回读断言依赖这个串）')
        }

        # 硬约束（工单 41 §4.1）：源里**不许**出现 [data-theme="<主题 id>"] 这个字面量。
        # server 的 /apps/theme.css 路由会把 [data-theme="…"](, :root:not([data-theme])) 整体
        # 替换成 :root —— 作用域会从"该主题作用域"失控放大到**整个 App 文档**，
        # 连 html[data-theme="…"] body 都会被改成 html:root body。要用就用 :root /
        # [data-theme]（不带等号）/ html[data-dshana-face] 这类写法。这里显式断言，防手滑。
        foreach ($t in $script:ThemeDefs) {
            $bad = '[data-theme="' + $t.Id + '"]'
            $hits = Get-OccurrenceCount -Text $src.Text -Needle $bad
            if ($hits -ne 0) {
                Stop-Fail ("App 面材质源 '$($f.FullName)' 出现 $hits 处 '$bad' —— 该字面量会被 " +
                    'server 的 /apps/theme.css 路由替换成 :root，作用域当场失控，禁止（工单 41 §4.1）')
            }
        }

        # App 面不吃背景（工单 41 §6）：源里出现 data:image 直接拒绝，
        # 从源头保证 server 树不会混进 3.9 MB 的壁纸（背景只贴 renderer 树）。
        if ($src.Text.Contains('data:image')) {
            Stop-Fail "App 面材质源 '$($f.FullName)' 含 'data:image' —— App 面不吃背景（工单 41 §6），拒绝贴入"
        }

        $items.Add([pscustomobject]@{
                Name   = $f.Name
                Path   = $f.FullName
                Rel    = $rel
                Sha256 = $src.Sha256
                Bytes  = $src.Bytes.Length
                Text   = $src.Text
            })
    }

    return [pscustomobject]@{
        Dir   = $dir
        Count = $items.Count
        Items = @($items)
    }
}

<#
    合成 server 树的「配色源 + 换行 + src/app-surface/*.css（字典序，每份之间一个换行）」。

    返回 $null 表示「不需要合成」（app-surface 目录不存在 / 为空）—— 调用方据此走原来的
    Copy-Item 路径，保证与今天逐字节相同。
#>
function Join-AppSurfaceCss {
    param([Parameter(Mandatory)]$Theme)

    if ($null -eq $script:AppSurfaceSources) { return $null }

    $parts = [System.Collections.Generic.List[string]]::new()
    $parts.Add($Theme.SourceText)
    foreach ($item in $script:AppSurfaceSources.Items) {
        $parts.Add($script:AppSurfaceSeparator)
        $parts.Add($item.Text)
    }
    return ($parts -join '')
}

# ============================================================================
# 背景合成（配色源 + [材质源] + 背景源）
# ============================================================================

<#
    把背景源模板里的占位符替换成图片的 data URI。

    为什么用「逐字命中数」而不是正则替换：
      data URI 自身可能含 '$' 等字符，用 -replace 会被当替换模式解释；且 -replace
      在替换串里对 '$' 有特殊含义，容易产出损坏的 CSS。IndexOf + Substring 逐字
      拼接没有这个问题，也便于精确断言「恰好命中 1 次」。

    命中数必须**恰好 1**：0 次说明模板与脚本约定不符（改了占位符名？）；>=2 次说明
    模板里多处写了同一个占位符（例如注释里也写了一遍），替换后会把 data URI 灌进
    注释或产生第二份 3.9 MB 副本 —— 两种都必须显式报错中止，不猜。
#>
function Expand-BackgroundTemplate {
    param(
        [Parameter(Mandatory)][string]$TemplateText,
        [Parameter(Mandatory)][string]$DataUri,
        [Parameter(Mandatory)][string]$What
    )

    $needle = $script:BackgroundDarkPlaceholder
    $hits = Get-OccurrenceCount -Text $TemplateText -Needle $needle
    if ($hits -eq 0) {
        Stop-Fail "$What：占位符 '$needle' 未命中（要求恰好 1 次）—— 背景源模板与脚本约定不符，已中止"
    }
    if ($hits -ne 1) {
        Stop-Fail ("$What：占位符 '$needle' 命中 $hits 次（要求恰好 1 次）—— 已中止。" +
            "模板里只应出现一次（注意：注释里也不要写这个占位符，否则会被一并替换）。")
    }

    $idx = $TemplateText.IndexOf($needle, [StringComparison]::Ordinal)
    return ($TemplateText.Substring(0, $idx) + $DataUri + $TemplateText.Substring($idx + $needle.Length))
}

<#
    合成「配色源 + [换行 + 材质源] + [换行 + 背景源]」。
    顺序是硬要求：背景源排在最后，其 background-image 才能覆盖材质源的 --mat-bg-image 渐变。

    返回 $null 表示「本主题不需要合成」——即既无材质、也无背景适用于它，
    调用方据此走原来的 Copy-Item 路径，保证与现状逐字节等价。
#>
function Join-ThemeCss {
    param(
        [Parameter(Mandatory)]$Theme,
        [Parameter(Mandatory)][string]$MaterialTier,
        [Parameter(Mandatory)][string]$BackgroundTier
    )

    $parts = [System.Collections.Generic.List[string]]::new()
    $parts.Add($Theme.SourceText)

    # 2026-10-18：材质 / 背景 / 取景框一律取**该主题自己的**源。
    $matSource = $Theme.MaterialSource
    if ($MaterialTier -ne 'none' -and $null -ne $matSource) {
        $parts.Add($script:MaterialSeparator)
        $parts.Add($matSource.Text)
    }

    # 背景只进带背景的主题文件（每个主题有自己的背景源）。
    $bgSource = $Theme.BackgroundSource
    if ($BackgroundTier -eq 'dark' -and $null -ne $bgSource) {
        $parts.Add($script:BackgroundSeparator)
        $parts.Add($bgSource.Text)

        # 浮层面板取景框（工单 30）：排在背景源之后（后写的赢，语义最清楚）。
        if ($null -ne $Theme.PanelFrameSources) {
            $parts.Add($script:BackgroundSeparator)
            $parts.Add($Theme.PanelFrameSources.CssText)
        }
    }

    if ($parts.Count -eq 1) { return $null }
    return ($parts -join '')
}

# ============================================================================
# 注册表（minified JS 对象字面量）定位与求值
# ============================================================================

<#
    从位置 $Pos（在对象内部）出发，反向按花括号计数找到最近的未闭合 '{'，
    再正向配对校验闭合位置一致，返回该对象字面量。
    只按花括号计数——压缩产物里对象字面量只含字符串字面量与花括号，
    不含正则字面量 / 模板字符串 / 注释（已对三份目标逐一确认）。
#>
function Get-EnclosingObjectLiteral {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][int]$Pos)
    if ($Pos -lt 0 -or $Pos -ge $Text.Length) { Stop-Fail "Get-EnclosingObjectLiteral：位置越界 $Pos" }

    $depth = 0
    $q = $Pos - 1
    $openIdx = -1
    while ($q -ge 0) {
        $ch = $Text[$q]
        if ($ch -eq '}') { $depth++ }
        elseif ($ch -eq '{') {
            if ($depth -eq 0) { $openIdx = $q; break }
            $depth--
        }
        $q--
    }
    if ($openIdx -lt 0) { Stop-Fail "在位置 $Pos 之前找不到包裹的 '{'：目标结构与预期不符" }

    $d = 0
    $i = $openIdx
    $end = -1
    while ($i -lt $Text.Length) {
        $ch = $Text[$i]
        if ($ch -eq '{') { $d++ }
        elseif ($ch -eq '}') {
            $d--
            if ($d -eq 0) { $end = $i; break }
        }
        $i++
    }
    if ($end -lt 0) { Stop-Fail "从位置 $openIdx 起的对象字面量未闭合" }

    return [pscustomobject]@{
        Open    = $openIdx
        Close   = $end
        Literal = $Text.Substring($openIdx, $end - $openIdx + 1)
    }
}

# node 求值脚本：把 stdin 当作 JS 对象字面量真求值，输出 {ok,count,ids}
# 用 base64 包裹以避免 PowerShell ↔ node 之间的引号地狱。
$script:NodeEvalJs = 'let s="";process.stdin.setEncoding("utf8");' +
    'process.stdin.on("data",d=>{s+=d});' +
    'process.stdin.on("end",()=>{' +
    'let o;try{o=new Function("return ("+s+")")()}catch(e){' +
    'process.stdout.write(JSON.stringify({ok:false,error:String(e&&e.message)}));return}' +
    'process.stdout.write(JSON.stringify({ok:true,count:Object.keys(o).length,ids:Object.keys(o)}))});'
$script:NodeEvalArg = "eval(Buffer.from('" +
    [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($script:NodeEvalJs)) +
    "','base64').toString('utf8'))"

<#
    用 node **真求值** 主题注册表对象字面量（不是数 id 字符串），
    返回 @{ ok; count; ids }。这是工单要求的"枚举主题数 == 12"的判定方式。
#>
function Invoke-NodeLiteralEval {
    param([Parameter(Mandatory)][string]$Literal, [Parameter(Mandatory)][string]$What)
    $out = $Literal | & node -e $script:NodeEvalArg
    $code = $LASTEXITCODE
    if ($code -ne 0) { Stop-Fail "$What：node 求值进程退出码 $code" }
    if ($null -eq $out) { Stop-Fail "$What：node 求值无输出" }
    $parsed = $null
    try {
        $parsed = ([string]$out).Trim() | ConvertFrom-Json
    }
    catch {
        Stop-Fail "$What：node 输出不是合法 JSON —— $($_.Exception.Message)"
    }
    if (-not (Get-Prop $parsed 'ok')) {
        Stop-Fail "$What：注册表字面量不是合法 JS 对象 —— $(Get-Prop $parsed 'error')"
    }
    return $parsed
}

<#
    按 anchor 定位注册表对象字面量。
    返回 @{ AnchorIdx; LiteralOpen; LiteralClose; Literal; AnchorCount }
#>
function Get-RegistryLiteralByAnchor {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][string]$Anchor, [Parameter(Mandatory)][string]$What)

    $anchorCount = Get-OccurrenceCount -Text $Text -Needle $Anchor
    if ($anchorCount -eq 0) {
        Stop-Fail ("$What：锚点未命中（onAnchorMissing=error）—— 目标文件与 patches/ 描述不符，已中止。" +
            "$([Environment]::NewLine)  新版 Hana 构建？按 $($script:RepairDoc) 重新定位锚点（别手改安装目录）。")
    }
    if ($anchorCount -ne 1) {
        Stop-Fail ("$What：锚点命中 $anchorCount 次（要求恰好 1 次，onAnchorNotUnique=error）—— 已中止。" +
            "$([Environment]::NewLine)  锚点在新构建里不唯一：按 $($script:RepairDoc) 把它加长到只命中 1 次。")
    }
    $idx = $Text.IndexOf($Anchor, [StringComparison]::Ordinal)
    $enc = Get-EnclosingObjectLiteral -Text $Text -Pos $idx
    return [pscustomobject]@{
        AnchorIdx    = $idx
        LiteralOpen  = $enc.Open
        LiteralClose = $enc.Close
        Literal      = $enc.Literal
        AnchorCount  = $anchorCount
    }
}

# ============================================================================
# followedBy 断言：字符串相等 或 结构校验
# ============================================================================

<#
    为什么需要结构校验（工单 07）：

    注册表对象的闭合括号结构（'}}' / '}' / ' }'）是**稳定**的——它由 JS 语法决定；
    而锚点之后的变量名（p / Ci / Xgr / ngr / u …）是**压缩器分配的**，每次构建都可能变。
    旧 patch 把变量名写进了 followedBy（如 '}},u=Object.freeze('），于是 1.0.6 -> 1.0.11
    变量名 u -> p 一变就整条断言失败。

    所以注册表 patch 改用 followedByStructure = "closing-braces"：
    只断言「锚点末尾之后，在遇到第一个非空白、非 '}' 的字符之前，全是空白与 '}'，
    且其中至少有一个 '}'，并且注册表对象自己的闭合括号恰好是这段里第一个非空白字符」。
    这既确认了「锚点后紧跟注册表对象的闭合括号」（即锚点确实是最后一项），
    又完全不依赖任何变量名。

    返回 @{ Ok; StopIndex; Run; Reason }
#>
function Test-FollowedByClosingBraces {
    param(
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][int]$AnchorEnd,
        [Parameter(Mandatory)][int]$LiteralClose
    )

    # 1) 从锚点末尾起，收集一段「只含空白与 '}'」的连续区间
    $p = $AnchorEnd
    $braceCount = 0
    while ($p -lt $Text.Length) {
        $ch = $Text[$p]
        if ($ch -eq '}') { $braceCount++; $p++; continue }
        if ([char]::IsWhiteSpace($ch)) { $p++; continue }
        break
    }
    $run = $Text.Substring($AnchorEnd, $p - $AnchorEnd)

    if ($braceCount -eq 0) {
        return [pscustomobject]@{
            Ok = $false; StopIndex = $p; Run = $run
            Reason = "锚点末尾之后（位置 $AnchorEnd）没有出现任何 '}'，先遇到了 '$($Text.Substring($p, [Math]::Min(40, $Text.Length - $p)))' —— 锚点不再是注册表最后一项"
        }
    }

    # 2) 注册表对象自己的闭合括号必须是这段里的第一个非空白字符
    $q = $AnchorEnd
    while ($q -lt $Text.Length -and [char]::IsWhiteSpace($Text[$q])) { $q++ }
    if ($q -ne $LiteralClose -or $Text[$q] -ne '}') {
        return [pscustomobject]@{
            Ok = $false; StopIndex = $p; Run = $run
            Reason = "锚点与注册表对象闭合 '}' 之间还有其它内容（锚点末尾 $AnchorEnd，第一个非空白字符在 $q，注册表闭合在 $LiteralClose）"
        }
    }

    return [pscustomobject]@{ Ok = $true; StopIndex = $p; Run = $run; Reason = $null }
}

<#
    统一入口：按 patch 声明的字段做 followedBy 断言。
      * followedByStructure = 'closing-braces'  -> 结构校验（注册表三处用这个）
      * followedBy = '<确切串>'                  -> 逐字相等（卡片配色 patch 用这个，其串是 CSS 选择器，稳定）
    两者都不声明 -> 显式报错（不允许"没有校验"）。
#>
function Assert-FollowedBy {
    param(
        [Parameter(Mandatory)]$Patch,
        [Parameter(Mandatory)][string]$Text,
        [Parameter(Mandatory)][int]$AnchorEnd,
        [Parameter(Mandatory)][int]$LiteralClose,
        [Parameter(Mandatory)][string]$Label
    )

    $structure = [string](Get-Prop $Patch 'followedByStructure')
    $followedBy = Get-Prop $Patch 'followedBy'

    if (-not [string]::IsNullOrWhiteSpace($structure)) {
        if ($structure -cne 'closing-braces') {
            Stop-Fail "$Label：patch 的 followedByStructure '$structure' 不是受支持的值（只支持 'closing-braces'）"
        }
        if ($LiteralClose -lt 0) {
            Stop-Fail "$Label：followedByStructure=closing-braces 需要调用方提供注册表对象闭合位置，但未提供 —— 该结构校验只适用于注册表 patch"
        }
        $r = Test-FollowedByClosingBraces -Text $Text -AnchorEnd $AnchorEnd -LiteralClose $LiteralClose
        if (-not $r.Ok) {
            Stop-Fail "$Label：followedByStructure=closing-braces 结构校验失败 —— $($r.Reason)。目标文件已变，已中止"
        }
        return [pscustomobject]@{
            Ok          = $true
            Kind        = 'closing-braces'
            Description = "锚点之后紧跟注册表对象闭合 '}'（紧随文本：$($r.Run)）"
        }
    }

    if ($null -eq $followedBy) {
        Stop-Fail "$Label：patch 既没有 followedBy 也没有 followedByStructure —— 无法确认锚点后文，拒绝在无校验的情况下改写"
    }
    $followedBy = [string]$followedBy
    if ($followedBy.Length -eq 0) {
        Stop-Fail "$Label：patch 的 followedBy 为空串 —— 空串断言没有校验意义，拒绝执行"
    }

    $ok = $false
    if ($AnchorEnd + $followedBy.Length -le $Text.Length) {
        $ok = ([string]::CompareOrdinal($Text, $AnchorEnd, $followedBy, 0, $followedBy.Length) -eq 0)
    }
    if (-not $ok) {
        $got = if ($AnchorEnd -lt $Text.Length) { $Text.Substring($AnchorEnd, [Math]::Min(80, $Text.Length - $AnchorEnd)) } else { '<EOF>' }
        Stop-Fail "$Label：锚点之后的文本与 patch 的 followedBy 不符 —— 目标文件已变，已中止。$([Environment]::NewLine)  期望：$followedBy$([Environment]::NewLine)  实际：$got"
    }
    return [pscustomobject]@{ Ok = $true; Kind = 'exact'; Description = "锚点之后逐字等于 followedBy" }
}

# ============================================================================
# 注册表 patch 预演（纯内存，不写盘）
# ============================================================================

function Resolve-RegistryPlan {
    param(
        [Parameter(Mandatory)][string]$PatchPath,
        [Parameter(Mandatory)][string]$Tree,
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][string]$Label
    )

    $patch = Read-JsonFile -Path $PatchPath -What "patch '$Label'"

    # --- patch 自身的契约校验（与 patches/README.md 一致）---
    if ((Get-Prop $patch 'locateStrategy') -ne 'content-anchor') {
        Stop-Fail "patch '$Label'：locateStrategy 不是 'content-anchor'（实际：$(Get-Prop $patch 'locateStrategy')）"
    }
    if ((Get-Prop $patch 'insertionPoint') -ne 'after-anchor') {
        Stop-Fail "patch '$Label'：insertionPoint 不是 'after-anchor'（实际：$(Get-Prop $patch 'insertionPoint')）"
    }
    if ([int](Get-RequiredProp $patch 'anchorOccurrencesExpected' "patch '$Label'") -ne 1) {
        Stop-Fail "patch '$Label'：anchorOccurrencesExpected 不是 1"
    }
    foreach ($flag in @('onAnchorMissing', 'onAnchorNotUnique')) {
        if ((Get-Prop $patch $flag) -ne 'error') {
            Stop-Fail "patch '$Label'：$flag 不是 'error'（不允许静默跳过）"
        }
    }

    $anchor = [string](Get-RequiredProp $patch 'anchor' "patch '$Label'")
    $insertText = [string](Get-RequiredProp $patch 'insertText' "patch '$Label'")
    $beforeCtx = [string](Get-Prop (Get-Prop $patch 'anchorContext') 'before')
    $countBaseline = [int](Get-RequiredProp $patch 'countBaseline' "patch '$Label'")
    $expectedAfter = [int](Get-RequiredProp $patch 'expectedCountAfter' "patch '$Label'")
    $newIds = @(Get-Prop $patch 'newThemeIds')
    $features = @(Get-Prop $patch 'contentFeatures')

    if ($newIds.Count -eq 0) { Stop-Fail "patch '$Label'：newThemeIds 为空" }

    $file = Read-Utf8File -Path $TargetPath

    # --- 内容特征校验（防止认错文件 / 目标结构已变）---
    foreach ($feat in $features) {
        if (-not $file.Text.Contains([string]$feat)) {
            Stop-Fail "$Label：内容特征缺失 '$feat' —— 目标文件与 patches/ 描述不符，已中止"
        }
    }

    # --- 2026-10-18：旧版单项已贴 → 升级为双项（必须在算 insertCount 之前）---
    # 单主题时期贴入的是「…coral 项 ,"hana-moonlit-court":{...}」；现在 patch 的 insertText
    # 变成了「月满庭 + 极光 两项」。此时锚点后面紧跟的是**旧**插入文本，结构校验会报
    # "锚点不再是注册表最后一项"——那不是错误，而是待升级状态。
    # 做法：把旧插入文本当作已存在的公共前缀，只把增量（新文本去掉旧前缀）接在后面。
    $legacyUpgraded = $false
    $legacyStr = $null
    $legacyThemeCount = 0
    if (-not $file.Text.Contains($anchor + $insertText)) {
        # 2026-10-20（加入第三个主题时修）：legacy 是**多级**的（单主题 → 双主题 → 三主题），
        # 必须按长度**降序**试，优先命中最长的那个前缀。
        # 否则「双主题文件」会先命中「单主题」前缀（单主题串是双主题串的前缀，Contains 成立），
        # 于是 $legacyThemeCount 少算一个 → 改前主题数断言误报。
        # 同时主题数改为从 legacy 串自身数 'cssPath:'（原来是写死的 +1，只支持一级 legacy）。
        $legacyCandidates = @(Get-Prop $patch 'legacyInsertTexts') |
            ForEach-Object { [string]$_ } |
            Where-Object { -not [string]::IsNullOrEmpty($_) } |
            Sort-Object -Property Length -Descending
        foreach ($legacyCand in $legacyCandidates) {
            if ($file.Text.Contains($anchor + $legacyCand)) {
                if ($insertText.StartsWith($legacyCand, [StringComparison]::Ordinal)) {
                    $legacyStr = $legacyCand
                    $legacyThemeCount = ([regex]::Matches($legacyCand, 'cssPath:')).Count
                    $insertText = $insertText.Substring($legacyCand.Length)
                    $legacyUpgraded = $true
                }
                else {
                    Stop-Fail "$Label：legacyInsertTexts 与当前 insertText 不是前缀关系，无法安全升级 —— 请手工处理"
                }
                break
            }
        }
    }

    # --- 幂等判定：anchor 之后紧跟 insertText 说明这一处已经贴过 ---
    $insertCount = Get-OccurrenceCount -Text $file.Text -Needle $insertText
    if ($file.Text.Contains($anchor + $insertText)) {
        if ($insertCount -ne 1) {
            Stop-Fail "$Label：insertText 出现 $insertCount 次，状态不一致，请先跑 restore.ps1"
        }
        $state = Get-RegistryLiteralByAnchor -Text $file.Text -Anchor $anchor -What $Label
        $eval = Invoke-NodeLiteralEval -Literal $state.Literal -What $Label
        if ([int]$eval.count -ne $expectedAfter) {
            Stop-Fail "$Label：已贴过但主题数为 $($eval.count)，期望 $expectedAfter —— 状态不一致，请先跑 restore.ps1"
        }
        return [pscustomobject]@{
            Label            = $Label
            Tree             = $Tree
            Path             = $TargetPath
            Rel              = $null
            Action           = 'skip-already-patched'
            Anchor           = $anchor
            InsertText       = $insertText
            OldText          = $file.Text
            NewText          = $file.Text
            Sha256Before     = $file.Sha256
            BytesBefore      = $file.Bytes.Length
            CountBefore      = [int]$eval.count
            CountAfter       = [int]$eval.count
            IdsBefore        = @($eval.ids)
            IdsAfter         = @($eval.ids)
            NewIds           = $newIds
            AnchorCount      = $state.AnchorCount
            InsertIndex      = -1
            FollowedByOk     = $true
            BeforeContextOk  = $true
        }
    }
    # --- 2026-10-18：旧版单项已贴 → 升级为双项 ---
    # （已提到 insertCount 计算之前，见上）

    if ($insertCount -gt 0) {
        # insertText 已在文件里，但不紧跟在锚点之后：要么是半改状态，要么是上游构建变了
        # 导致锚点文本与 patch 不再逐字一致。两种都必须显式报错、交人处理。
        $anchorCountNow = Get-OccurrenceCount -Text $file.Text -Needle $anchor
        $hint = if ($anchorCountNow -eq 0) {
            '锚点已完全不匹配（上游构建可能改了 coral 项文本）—— patches/ 需要重新生成，不要手工硬改'
        }
        elseif ($anchorCountNow -gt 1) {
            "锚点现在命中 $anchorCountNow 次（不再唯一）—— patches/ 需要重新生成"
        }
        else {
            '锚点仍在，但新主题项的位置不在锚点之后 —— 可能是半改状态，请先跑 restore.ps1'
        }
        Stop-Fail "$Label：insertText 已在文件中出现 $insertCount 次，但无法确认是本次可安全跳过的已贴状态。$hint"
    }

    # --- 锚点定位 ---
    $state = Get-RegistryLiteralByAnchor -Text $file.Text -Anchor $anchor -What $Label

    # --- anchorContext.before 二次确认 ---
    $beforeOk = $false
    if ([string]::IsNullOrEmpty($beforeCtx)) {
        $beforeOk = $true
    }
    elseif ($state.AnchorIdx -ge $beforeCtx.Length) {
        $beforeOk = ([string]::CompareOrdinal($file.Text, $state.AnchorIdx - $beforeCtx.Length, $beforeCtx, 0, $beforeCtx.Length) -eq 0)
    }
    if (-not $beforeOk) { Stop-Fail "$Label：anchorContext.before 与锚点前文不符 —— 目标文件已变，已中止" }

    # --- followedBy 断言 ---
    # 注册表三处用 followedByStructure=closing-braces 做结构校验（不含压缩器变量名）；
    # 该断言同时蕴含「锚点之后紧跟注册表对象闭合 '}'」= 锚点确实是最后一项。
    #
    # 2026-10-18（legacy 升级）：若锚点之后紧跟的是**旧插入文本**，则真正待插入的位置
    # 在旧文本之后而不是锚点之后。此时把校验基准向后推过旧文本（旧文本本身已含月满庭项，
    # 其未尾也应紧跟对象闭合 '}'）。
    $anchorEnd = $state.AnchorIdx + $anchor.Length
    $legacyPrefixLen = 0
    if ($legacyUpgraded) {
        $legacyPrefixLen = $legacyStr.Length
    }
    $followedResult = Assert-FollowedBy -Patch $patch -Text $file.Text -AnchorEnd ($anchorEnd + $legacyPrefixLen) `
        -LiteralClose $state.LiteralClose -Label $Label
    $followedOk = $followedResult.Ok

    # --- 改前主题数 ---
    # legacy 升级时，文件里的主题数已经是 12（已含月满庭），而 patch 的 countBaseline 是 11
    # （续净状态）。两者的差额恰好等于旧插入文本里的主题数（1），据此校正。
    $evalBefore = Invoke-NodeLiteralEval -Literal $state.Literal -What "$Label（改前）"
    $effectiveBaseline = $countBaseline + $legacyThemeCount
    if ([int]$evalBefore.count -ne $effectiveBaseline) {
        Stop-Fail ("$Label：改前主题数为 $($evalBefore.count)，期望 $effectiveBaseline（patch countBaseline $countBaseline$(if ($legacyUpgraded) { ' + legacy 1' } else { '' })）—— 安装版本与 patch 不匹配，已中止。" +
            "$([Environment]::NewLine)  若这是新版构建：按 $($script:RepairDoc) 把这个 patch 的 countBaseline 改成 $($evalBefore.count)、expectedCountAfter 改成 $($evalBefore.count + 3)。")
    }

    # --- 在内存里算出改后文本与改后字面量 ---
    $insertIndex = $anchorEnd + $legacyPrefixLen
    $newText = $file.Text.Substring(0, $insertIndex) + $insertText + $file.Text.Substring($insertIndex)
    $offsetInLiteral = $insertIndex - $state.LiteralOpen
    $newLiteral = $state.Literal.Substring(0, $offsetInLiteral) + $insertText + $state.Literal.Substring($offsetInLiteral)

    $evalAfter = Invoke-NodeLiteralEval -Literal $newLiteral -What "$Label（改后预演）"
    if ([int]$evalAfter.count -ne $expectedAfter) {
        Stop-Fail "$Label：改后主题数为 $($evalAfter.count)，期望 $expectedAfter"
    }
    foreach ($id in $newIds) {
        if (@($evalAfter.ids) -notcontains [string]$id) { Stop-Fail "$Label：改后注册表里没有新主题 '$id'" }
    }
    foreach ($id in @($evalBefore.ids)) {
        if (@($evalAfter.ids) -notcontains [string]$id) { Stop-Fail "$Label：改后注册表丢失了原有主题 '$id'" }
    }
    # 三处 default* 绑定必须一字未动（D10）
    $defBefore = ([regex]::Matches($file.Text, $script:UntouchedDefaultsPattern) | ForEach-Object { $_.Value }) -join '|'
    $defAfter = ([regex]::Matches($newText, $script:UntouchedDefaultsPattern) | ForEach-Object { $_.Value }) -join '|'
    if ($defBefore -cne $defAfter) {
        Stop-Fail "$Label：defaultTheme / autoLightDefault / autoDarkDefault 发生了变化，已中止"
    }
    $assertBefore = Get-OccurrenceCount -Text $file.Text -Needle 'assertThemeEntry'
    $assertAfter = Get-OccurrenceCount -Text $newText -Needle 'assertThemeEntry'
    if ($assertBefore -ne $assertAfter) { Stop-Fail "$Label：assertThemeEntry 出现次数发生变化，已中止" }

    return [pscustomobject]@{
        Label           = $Label
        Tree            = $Tree
        Path            = $TargetPath
        Rel             = $null
        Action          = 'modify'
        Anchor          = $anchor
        InsertText      = $insertText
        OldText         = $file.Text
        NewText         = $newText
        Sha256Before    = $file.Sha256
        BytesBefore     = $file.Bytes.Length
        CountBefore     = [int]$evalBefore.count
        CountAfter      = [int]$evalAfter.count
        IdsBefore       = @($evalBefore.ids)
        IdsAfter        = @($evalAfter.ids)
        NewIds          = $newIds
        AnchorCount     = $state.AnchorCount
        InsertIndex     = $insertIndex
        FollowedByOk    = $followedOk
        BeforeContextOk = $beforeOk
    }
}

# ============================================================================
# 主题 CSS 版本参数（工单 16）预演（纯内存，不写盘）
# ============================================================================

<#
    主题 CSS 版本参数（工单 16）预演（纯内存，不写盘）。

    目标：renderer 树 lib/theme.js。把该文件里 4 处「主题 CSS 的 URL」从固定路径改成带版本
    参数的路径，使 URL 随 CSS 内容变化 —— 这是绕过 Chromium HTTP 缓存的标准做法
    （工单 16 实测：URL 不变时，贴入新 CSS + 重启也只命中旧缓存，界面仍是旧样式）。

    为什么是 4 处、而不是文件里全部的 cssPath 使用点：
      * 注册表字段校验 _(e,t){if(!t.cssPath||...)} 里的那处是**字段校验**，不是 URL 设置；
      * 注册表数据里的 cssPath 一律不动 —— assets/CardShell-*.js 的打印功能会把 cssPath
        插进打印文档的 <link href="${cssPath}">，加 ?v= 会影响打印。
    所以只改"设 href / 比较 href"的 4 处（见 $script:ThemeCacheBustSites）。

    版本串（工单 21 起）：renderer 树**合成后**主题 CSS 的 sha256 **前 16 位**。
    为什么取整份哈希的前 16 位而不是前 8 位：前 8 位碰撞空间太小；而单主题下没有第二个
    哈希可以拼接（工单 21 之前是「两份各前 8 位拼接 = light8 + dark8」，浅色主题已整体删除）。

    干净状态只有两种，其余一律报错中止（不猜、不静默跳过）：
      * plain  —— 文件里没有版本常量，且 4 处的改前锚点各命中 1 次：
                  在 IIFE 首条语句之后插入常量声明，再把 4 处替换为带 +常量 的形式。
      * busted —— 文件里有常量，且 4 处都已带 +常量：
                  版本串相同 -> skip-no-change（幂等，不重写文件）；
                  版本串不同 -> 只替换常量声明里的值（4 处不动）。
      半改状态（有常量但替换数不符、或 4 处只改了一部分、或常量格式被手改坏）
      显式报错，提示先跑 restore.ps1。
#>
function Resolve-ThemeCacheBustPlan {
    param(
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][string]$VersionString,
        [Parameter(Mandatory)][string]$BaseText
    )

    $label = 'renderer lib/theme.js（主题 CSS 版本参数）'
    if ([string]::IsNullOrWhiteSpace($VersionString)) { Stop-Fail "$label：版本串为空" }
    if ($VersionString -notmatch '^[0-9a-f]{16}$') {
        Stop-Fail "$label：版本串 '$VersionString' 不是 16 位小写十六进制（应为合成后主题 CSS 的 sha256 前 16 位）—— 内部错误"
    }

    # 改写的**基准文本**由调用方给出，而不是就地读盘：
    # theme.js 同时被步骤 7 的注册表 patch 与步骤 10b 改。步骤 4b 的预演发生在落盘之前，
    # 故基准必须是"注册表 patch 应用后的内存文本"，否则
    #   (1) 全新安装（pristine）时注册表还没贴，基准文本里没有新主题条目；
    #   (2) 落盘时若用基于旧文本算出的 NewText 覆盖，会把步骤 7 刚贴好的注册表**整段抹掉**。
    # 读盘只用于取备份所需的"改动前 sha256 / 字节数"（备份发生在任何写入之前）。
    $disk = Read-Utf8File -Path $TargetPath
    $file = [pscustomobject]@{ Text = $BaseText; Sha256 = $disk.Sha256; Bytes = $disk.Bytes }
    $constName = $script:ThemeCacheBustConstName
    $constDeclNeedle = "const $constName="
    $constValue = "?v=$VersionString"
    $newDecl = "const $constName=`"$constValue`";"

    # 改前 / 改后锚点逐处计数（改前后各 4 处，绝不做正则全局替换）
    $plainHits = [System.Collections.Generic.List[int]]::new()
    $bustedHits = [System.Collections.Generic.List[int]]::new()
    foreach ($site in $script:ThemeCacheBustSites) {
        $plainHits.Add((Get-OccurrenceCount -Text $file.Text -Needle $site.Before))
        $bustedHits.Add((Get-OccurrenceCount -Text $file.Text -Needle $site.After))
    }
    $nPlain = 0; foreach ($h in $plainHits) { $nPlain += $h }
    $nBusted = 0; foreach ($h in $bustedHits) { $nBusted += $h }
    $declCount = Get-OccurrenceCount -Text $file.Text -Needle $constDeclNeedle

    # 注册表 cssPath 必须仍是「不带版本参数」的原样（CardShell 打印依赖 + D10）。
    # 只在**预演阶段**断言，且断言的是「值里没有 ?v=」+「'cssPath:"' 总处数不变」：
    # 这样无论注册表 patch 已贴（12 个主题）还是未贴（pristine，11 个主题）都成立。
    # 改后的第二重断言（在下面）再把「总处数一字未变」钉死。
    $versionedBefore = Get-VersionedCssPathCount -Text $file.Text
    if ($versionedBefore -ne 0) {
        Stop-Fail "$label：文件里已有 $versionedBefore 处带 '?v=' 的 cssPath —— 预期不该有（版本参数只加在 URL 拼接处，不写进注册表），已中止"
    }
    $cssPathProbeBefore = Get-OccurrenceCount -Text $file.Text -Needle $script:ThemeCacheBustCssPathProbe

    $state = $null
    if ($declCount -eq 0 -and $nPlain -eq 4 -and $nBusted -eq 0) { $state = 'plain' }
    elseif ($declCount -eq 1 -and $nPlain -eq 0 -and $nBusted -eq 4) { $state = 'busted' }

    if ($null -eq $state) {
        $detail = [System.Collections.Generic.List[string]]::new()
        $detail.Add("常量声明 'const $constName=' 命中 $declCount 次（期望 0 或 1）")
        for ($i = 0; $i -lt $script:ThemeCacheBustSites.Count; $i++) {
            $detail.Add(("  4 处锚点『{0}』：改前命中 {1} 次，改后命中 {2} 次" -f `
                        $script:ThemeCacheBustSites[$i].Name, $plainHits[$i], $bustedHits[$i]))
        }
        # 两种成因要分开提示（2026-10-16：1.1.0-beta -> 1.1.7-beta 那一跳就撞过第二种）。
        #   ① 半改状态：锚点/常量各命中一部分 —— 多半是上次写盘被打断，回滚重贴即可。
        #   ② 上游重新构建、压缩器换了局部变量名：**四个改前锚点全部 0 次**、常量也没写过。
        #      这时文件本身没被改坏，不要去 restore（会把注册表 patch 一起白滚掉），
        #      要做的是按新构建重新认角色、改 $script:ThemeCacheBustSites。
        $hint = if ($declCount -eq 0 -and $nPlain -eq 0 -and $nBusted -eq 0) {
            '4 处改前锚点全部未命中、常量也没写过 —— 很可能是上游构建重新压缩、换了局部变量名（本次未改动任何文件）；' +
            "请看本文件 `$script:ThemeCacheBustSites 上方的角色判据，把 4 处 Before/After 换成新构建里的变量名，然后重跑（步骤见 $($script:RepairDoc)）。"
        }
        else {
            '可能是半改状态：请先跑 scripts/restore.ps1 回到原样，再重新 -Apply；不要手工硬改 minified 文件。'
        }
        Stop-Fail ("$label：无法判定为 plain 或 busted 这两种干净状态（$hint）$([Environment]::NewLine)" +
            '    ' + ($detail -join [Environment]::NewLine + '    '))
    }

    if ($state -eq 'busted') {
        # 抠出当前常量值：const NAME="<value>";
        $declIdx = $file.Text.IndexOf($constDeclNeedle, [StringComparison]::Ordinal)
        $valueStart = $declIdx + $constDeclNeedle.Length
        if ($valueStart -ge $file.Text.Length -or $file.Text[$valueStart] -ne '"') {
            Stop-Fail "$label：常量声明 '$constDeclNeedle' 之后不是字符串字面量 —— 半改状态，已中止"
        }
        $valueEnd = $file.Text.IndexOf('"', $valueStart + 1)
        if ($valueEnd -lt 0) { Stop-Fail "$label：常量声明里的字符串字面量未闭合 —— 半改状态，已中止" }
        $oldConstValue = $file.Text.Substring($valueStart + 1, $valueEnd - $valueStart - 1)
        if ($oldConstValue -notmatch '^\?v=[0-9a-f]{16}$') {
            Stop-Fail "$label：常量值 '$oldConstValue' 不是 '?v=' + 16 位小写十六进制 —— 半改状态，已中止"
        }
        $oldDecl = "const $constName=`"$oldConstValue`";"
        $oldDeclHits = Get-OccurrenceCount -Text $file.Text -Needle $oldDecl
        if ($oldDeclHits -ne 1) {
            Stop-Fail "$label：常量声明 '$oldDecl' 命中 $oldDeclHits 次（要求恰好 1 次）—— 半改状态，已中止"
        }

        if ($oldConstValue -ceq $constValue) {
            return [pscustomobject]@{
                Label        = $label
                Tree         = 'renderer'
                Rel          = 'lib/theme.js'
                Path         = $TargetPath
                Action       = 'skip-no-change'
                State        = $state
                ConstantName = $constName
                VersionValue = $constValue
                OldVersionValue = $oldConstValue
                SiteCount    = 4
                CssPathProbeBefore = $cssPathProbeBefore
                CssPathProbeAfter  = $cssPathProbeBefore
                OldText      = $file.Text
                NewText      = $file.Text
                Sha256Before = $file.Sha256
                BytesBefore  = $file.Bytes.Length
                Sha256After  = $file.Sha256
                BytesAfter   = $file.Bytes.Length
            }
        }

        $declIdx2 = $file.Text.IndexOf($oldDecl, [StringComparison]::Ordinal)
        $newText = $file.Text.Substring(0, $declIdx2) + $newDecl + $file.Text.Substring($declIdx2 + $oldDecl.Length)
    }
    else {
        # plain：在 IIFE 首条语句之后插入常量声明
        $anchorHits = Get-OccurrenceCount -Text $file.Text -Needle $script:ThemeCacheBustDeclAnchor
        if ($anchorHits -ne 1) {
            Stop-Fail "$label：常量注入锚点命中 $anchorHits 次（要求恰好 1 次）—— 已中止"
        }
        $injectAt = $file.Text.IndexOf($script:ThemeCacheBustDeclAnchor, [StringComparison]::Ordinal) +
                    $script:ThemeCacheBustDeclAnchor.Length
        $newText = $file.Text.Substring(0, $injectAt) + $newDecl + $file.Text.Substring($injectAt)

        # 4 处逐处精确替换（IndexOf + Substring），每处断言恰好 1 次
        for ($i = 0; $i -lt $script:ThemeCacheBustSites.Count; $i++) {
            $site = $script:ThemeCacheBustSites[$i]
            $c = Get-OccurrenceCount -Text $newText -Needle $site.Before
            if ($c -ne 1) {
                Stop-Fail "$label：替换 '$($site.Name)' 时改前锚点命中 $c 次（要求恰好 1 次）—— 已中止"
            }
            $idx = $newText.IndexOf($site.Before, [StringComparison]::Ordinal)
            $newText = $newText.Substring(0, $idx) + $site.After + $newText.Substring($idx + $site.Before.Length)
        }
    }

    # ---- 改后断言（在内存里，落盘前先证明"能成功"）----
    if (-not $newText.Contains($constDeclNeedle)) {
        Stop-Fail "$label：改后文本不含常量声明 '$constDeclNeedle' —— 内部错误"
    }
    # 4 处改后锚点各恰好 1 次；4 处改前锚点必须 0 次（证明全部替换干净）
    for ($i = 0; $i -lt $script:ThemeCacheBustSites.Count; $i++) {
        $site = $script:ThemeCacheBustSites[$i]
        $after = Get-OccurrenceCount -Text $newText -Needle $site.After
        $before = Get-OccurrenceCount -Text $newText -Needle $site.Before
        if ($after -ne 1) {
            Stop-Fail "$label：改后 '$($site.Name)' 的新锚点命中 $after 次（要求恰好 1 次）—— 已中止"
        }
        if ($before -ne 0) {
            Stop-Fail "$label：改后仍残留 '$($site.Name)' 的改前锚点 $before 次 —— 替换不干净，已中止"
        }
    }
    # 注册表 cssPath 一字未动：改后仍然 0 处带 ?v=，且 'cssPath:"' 总处数与改前完全一致
    $versionedAfter = Get-VersionedCssPathCount -Text $newText
    if ($versionedAfter -ne 0) {
        Stop-Fail "$label：改后出现 $versionedAfter 处带 '?v=' 的 cssPath —— 改动波及了注册表（CardShell 打印会受影响），已中止"
    }
    $cssPathProbeAfter = Get-OccurrenceCount -Text $newText -Needle $script:ThemeCacheBustCssPathProbe
    if ($cssPathProbeAfter -ne $cssPathProbeBefore) {
        Stop-Fail "$label：改后 cssPath 总处数 $cssPathProbeAfter != 改前 $cssPathProbeBefore —— 注册表结构被改动，已中止"
    }
    # 插入点之外逐字未变：plain 时做**精确往返**证明——从改后文本出发，
    # 去掉常量声明 + 把 4 处新锚点逐个换回改前锚点，必须**逐字节还原**成原文件。
    # 这比前后缀对照强：它证明改后文本 = 原文本经过且仅经过这 5 处编辑。
    if ($state -eq 'plain') {
        if ($newText.Substring(0, $injectAt) -cne $file.Text.Substring(0, $injectAt)) {
            Stop-Fail "$label：常量注入点之前的文本发生了变化 —— 已中止"
        }
        $roundTrip = $newText.Substring(0, $injectAt) + $newText.Substring($injectAt + $newDecl.Length)
        foreach ($site in $script:ThemeCacheBustSites) {
            $c = Get-OccurrenceCount -Text $roundTrip -Needle $site.After
            if ($c -ne 1) { Stop-Fail "$label：往返还原时 '$($site.Name)' 的新锚点命中 $c 次（要求 1）—— 内部错误" }
            $idx = $roundTrip.IndexOf($site.After, [StringComparison]::Ordinal)
            $roundTrip = $roundTrip.Substring(0, $idx) + $site.Before + $roundTrip.Substring($idx + $site.After.Length)
        }
        if ($roundTrip -cne $file.Text) {
            Stop-Fail "$label：改后文本无法逐字节还原成原文件 —— 改动不止'常量声明 + 4 处 URL'，已中止"
        }
    }

    return [pscustomobject]@{
        Label        = $label
        Tree         = 'renderer'
        Rel          = 'lib/theme.js'
        Path         = $TargetPath
        Action       = if ($state -eq 'plain') { 'insert' } else { 'replace-version' }
        State        = $state
        ConstantName = $constName
        VersionValue = $constValue
        OldVersionValue = $null
        SiteCount    = 4
        CssPathProbeBefore = $cssPathProbeBefore
        CssPathProbeAfter  = $cssPathProbeAfter
        OldText      = $file.Text
        NewText      = $newText
        Sha256Before = $file.Sha256
        BytesBefore  = $file.Bytes.Length
        Sha256After  = Get-BytesSha256 ($script:Utf8NoBom.GetBytes($newText))
        BytesAfter   = $script:Utf8NoBom.GetByteCount($newText)
    }
}

# ============================================================================
# 主题卡片预览配色（SettingsModalShell-*.css）预演（纯内存，不写盘）
# ============================================================================

<#
    用 targetGlob 通配 + contentFeatures 内容特征定位唯一目标文件。
    与步骤 3 的 assets/index-*.js 同一套思路：先通配枚举，再按特征筛选，
    最后要求「恰好命中 1 个」，否则报错中止（绝不猜）。

    targetGlob 形如 "<树>/<目录...>/<文件名通配>"，第一段是树名（对应 $BaseDir），
    其余段拼成 $BaseDir 下的实际搜索目录。
#>
function Find-UniqueGlobTarget {
    param(
        [Parameter(Mandatory)][string]$BaseDir,
        [Parameter(Mandatory)][string]$Glob,
        [Parameter(Mandatory)][object[]]$Features,
        [Parameter(Mandatory)][string]$What
    )

    $segs = @(($Glob -replace '\\', '/') -split '/' | Where-Object { $_ -ne '' })
    if ($segs.Count -lt 2) { Stop-Fail "$What：targetGlob '$Glob' 段数不足（需要 <树>/<目录...>/<文件名>）" }
    $leafGlob = $segs[-1]
    $subDir = ($segs[1..($segs.Count - 2)]) -join '\'
    $searchDir = if ([string]::IsNullOrEmpty($subDir)) { $BaseDir } else { Join-Path $BaseDir $subDir }

    if (-not (Test-Path -LiteralPath $searchDir -PathType Container)) { Stop-Fail "$What：搜索目录不存在 '$searchDir'" }

    $candidates = @(Get-ChildItem -LiteralPath $searchDir -Filter $leafGlob -File)
    if ($candidates.Count -eq 0) { Stop-Fail "$What：通配 '$leafGlob' 在 '$searchDir' 下未命中任何文件" }

    $matches = [System.Collections.Generic.List[string]]::new()
    foreach ($cand in $candidates) {
        $probe = Read-Utf8File -Path $cand.FullName
        $ok = $true
        foreach ($feat in $Features) {
            if (-not $probe.Text.Contains([string]$feat)) { $ok = $false; break }
        }
        if ($ok) { $matches.Add($cand.FullName) }
    }
    if ($matches.Count -ne 1) {
        $list = ($matches | ForEach-Object { "    - $_" }) -join [Environment]::NewLine
        Stop-Fail "$What：通配 '$leafGlob' 在 '$searchDir' 下命中 $($candidates.Count) 个候选，内容特征筛选后命中 $($matches.Count) 个（要求恰好 1 个）：$([Environment]::NewLine)$list"
    }
    return [pscustomobject]@{
        Path              = $matches[0]
        SearchDir         = $searchDir
        CandidateCount    = $candidates.Count
        FeatureMatchCount = $matches.Count
    }
}

<#
    预演一个 theme-card-preview target：定位文件 → 锚点唯一性 → followedBy 断言 →
    幂等判定 → 内存里算出改后文本 → 断言新主题 3 条规则。
#>
function Resolve-CardPreviewPlan {
    param(
        [Parameter(Mandatory)]$Target,
        [Parameter(Mandatory)]$Patch,
        [Parameter(Mandatory)][string]$Tree,
        [Parameter(Mandatory)][string]$BaseDir,
        [Parameter(Mandatory)][string]$Label
    )

    $glob = [string](Get-RequiredProp $Target 'targetGlob' "$Label target")
    $features = @(Get-Prop $Target 'contentFeatures')
    if ($features.Count -eq 0) { Stop-Fail "$Label：contentFeatures 为空" }
    $classNames = Get-RequiredProp $Target 'classNames' "$Label target"
    $cardClass = [string](Get-RequiredProp $classNames 'card' "$Label classNames")
    $nameClass = [string](Get-RequiredProp $classNames 'name' "$Label classNames")
    $modeClass = [string](Get-RequiredProp $classNames 'mode' "$Label classNames")
    $anchor = [string](Get-RequiredProp $Target 'anchor' "$Label target")
    $insertText = [string](Get-RequiredProp $Target 'insertText' "$Label target")
    $legacyInsertText = [string](Get-Prop $Target 'legacyInsertText')
    # 完整插入文本（legacy 升级时 = 旧文本 + 增量）。回读断言要用它。
    $fullInsertText = $insertText

    # --- 颜色映射（patch 顶层，两棵树共用）---
    $colorMapping = Get-RequiredProp $Patch 'colorMapping' 'patch theme-card-preview'
    $byId = Get-RequiredProp $colorMapping 'byThemeId' 'patch theme-card-preview.colorMapping'
    $newIds = @(Get-Prop $Patch 'newThemeIds')
    if ($newIds.Count -eq 0) { Stop-Fail 'patch theme-card-preview：newThemeIds 为空' }
    $rulesPerTheme = [int](Get-RequiredProp $Patch 'expectedNewRulesPerTheme' 'patch theme-card-preview')

    # --- 由 classNames + byThemeId 重建 N 条规则文本（N = 主题数 x 每主题条数），并与 insertText 逐字对照 ---
    # 这样 insertText 不是"手抄的字符串"，而是可由 patch 的结构化字段推导出来的，
    # 二者不一致说明 patch 自身写错了。
    $expectedRules = [System.Collections.Generic.List[object]]::new()
    foreach ($id in $newIds) {
        $spec = Get-RequiredProp $byId ([string]$id) "patch theme-card-preview.colorMapping.byThemeId"
        $bg = [string](Get-RequiredProp $spec 'bg' "byThemeId.$id")
        $text = [string](Get-RequiredProp $spec 'name' "byThemeId.$id")
        $mode = [string](Get-RequiredProp $spec 'mode' "byThemeId.$id")
        foreach ($v in @($bg, $text, $mode)) {
            if ($v -cne $v.ToLowerInvariant()) { Stop-Fail "$Label：byThemeId.$id 的色值 '$v' 不是小写 hex（文件内既有规则均为小写）" }
            if ($v -notmatch '^#[0-9a-f]{3,8}$') { Stop-Fail "$Label：byThemeId.$id 的色值 '$v' 不是合法 hex" }
        }
        $expectedRules.Add([pscustomobject]@{ Id = [string]$id; Kind = 'card-bg';   Rule = ".$cardClass[data-theme=$id]{background:$bg}" })
        $expectedRules.Add([pscustomobject]@{ Id = [string]$id; Kind = 'name-text'; Rule = ".$cardClass[data-theme=$id] .$nameClass{color:$text}" })
        $expectedRules.Add([pscustomobject]@{ Id = [string]$id; Kind = 'mode-text'; Rule = ".$cardClass[data-theme=$id] .$modeClass{color:$mode}" })
    }
    if ($expectedRules.Count -ne ($newIds.Count * $rulesPerTheme)) {
        Stop-Fail "$Label：重建出的规则数 $($expectedRules.Count) != 主题数 $($newIds.Count) x 每主题 $rulesPerTheme 条"
    }
    $rebuilt = ($expectedRules | ForEach-Object { $_.Rule }) -join ''
    if ($rebuilt -cne $insertText) {
        Stop-Fail ("$Label：由 classNames + colorMapping 重建的 $($expectedRules.Count) 条规则与 patch 的 insertText 不是逐字相同 ——" +
            " patch 自身不一致，已中止。$([Environment]::NewLine)  重建：$rebuilt$([Environment]::NewLine)  文本：$insertText")
    }

    # --- 定位文件（通配 + 内容特征，恰好 1 个）---
    $located = Find-UniqueGlobTarget -BaseDir $BaseDir -Glob $glob -Features $features -What $Label
    $targetPath = $located.Path

    # 相对路径（供备份 / manifest / skin.json 登记）：targetGlob 形如
    # "renderer/assets/SettingsModalShell-*.css" / "server/desktop/dist-renderer/assets/..."
    # 第一段是树名，去掉它、把末段换成真实文件名，即为相对各自版本目录的路径。
    $globSegs = @(($glob -replace '\\', '/') -split '/' | Where-Object { $_ -ne '' })
    if ($globSegs.Count -lt 3) { Stop-Fail "$Label：targetGlob '$glob' 段数不足（需要 <树>/<目录...>/<文件名>），无法推出相对路径" }
    $rel = (@($globSegs[1..($globSegs.Count - 2)]) + (Split-Path $targetPath -Leaf)) -join '/'

    $file = Read-Utf8File -Path $targetPath

    # --- 锚点唯一性：必须恰好命中 1 次，否则报错中止 ---
    $anchorCount = Get-OccurrenceCount -Text $file.Text -Needle $anchor
    if ($anchorCount -eq 0) {
        Stop-Fail "$Label：锚点未命中（onAnchorMissing=error）—— 目标文件与 patches/theme-card-preview.patch 描述不符，已中止。$([Environment]::NewLine)  锚点：$anchor$([Environment]::NewLine)  新版构建？主题卡片规则里的类名带构建哈希，必须抄新构建里那一串（见 $($script:RepairDoc)）。"
    }
    if ($anchorCount -ne 1) {
        Stop-Fail "$Label：锚点命中 $anchorCount 次（要求恰好 1 次，onAnchorNotUnique=error）—— 已中止。$([Environment]::NewLine)  锚点：$anchor"
    }
    $anchorIdx = $file.Text.IndexOf($anchor, [StringComparison]::Ordinal)
    $anchorEnd = $anchorIdx + $anchor.Length

    # --- 既有卡片规则基线（用于改后断言"只增不改"）---
    $cardRuleProbe = ".$cardClass[data-theme="
    $ruleCountBefore = Get-OccurrenceCount -Text $file.Text -Needle $cardRuleProbe

    # --- 幂等判定：insertText 已紧跟在锚点之后 ---
    $insertCount = Get-OccurrenceCount -Text $file.Text -Needle $insertText
    $alreadyPatched = ($anchorEnd + $insertText.Length -le $file.Text.Length) -and
        ([string]::CompareOrdinal($file.Text, $anchorEnd, $insertText, 0, $insertText.Length) -eq 0)

    # --- 2026-10-18：legacy 升级（单主题 → 双主题）---
    # 旧版只贴了月满庭 3 条；现在 insertText 含 6 条。此时锚点后紧跟旧文本，
    # 真正的插入点在旧文本之后，且“只增不改”的增量只是新增主题那几条。
    $legacyUpgraded = $false
    $legacyLen = 0
    $legacyThemes = 0
    if (-not $alreadyPatched -and -not [string]::IsNullOrEmpty($legacyInsertText)) {
        if ($file.Text.Contains($anchor + $legacyInsertText)) {
            if ($insertText.StartsWith($legacyInsertText, [StringComparison]::Ordinal)) {
                $legacyThemes = Get-OccurrenceCount -Text $legacyInsertText -Needle ".$cardClass[data-theme="
                $legacyThemes = [int]($legacyThemes / $rulesPerTheme)
                $insertText = $insertText.Substring($legacyInsertText.Length)
                $legacyLen = $legacyInsertText.Length
                $legacyUpgraded = $true
                $insertCount = Get-OccurrenceCount -Text $file.Text -Needle $insertText
                $alreadyPatched = ($anchorEnd + $legacyLen + $insertText.Length -le $file.Text.Length) -and
                    ([string]::CompareOrdinal($file.Text, $anchorEnd + $legacyLen, $insertText, 0, $insertText.Length) -eq 0)
            }
            else {
                Stop-Fail "$Label：legacyInsertText 与当前 insertText 不是前缀关系，无法安全升级 —— 请手工处理"
            }
        }
    }
    if ($alreadyPatched) {
        if ($insertCount -ne 1) {
            Stop-Fail "$Label：insertText 出现 $insertCount 次（要求 1 次），状态不一致，请先跑 restore.ps1"
        }
        # 已贴过也要逐条复核各条规则各命中 1 次，否则不算可安全跳过的状态
        foreach ($er in $expectedRules) {
            $c = Get-OccurrenceCount -Text $file.Text -Needle $er.Rule
            if ($c -ne 1) { Stop-Fail "$Label：已贴过，但规则 '$($er.Kind)/$($er.Id)' 命中 $c 次（要求 1）—— 状态不一致，请先跑 restore.ps1" }
        }
        return [pscustomobject]@{
            Label            = $Label
            Tree             = $Tree
            Path             = $targetPath
            Rel              = $rel
            Action           = 'skip-already-patched'
            Anchor           = $anchor
            InsertText       = $insertText
            OldText          = $file.Text
            NewText          = $file.Text
            Sha256Before     = $file.Sha256
            BytesBefore      = $file.Bytes.Length
            AnchorCount      = $anchorCount
            InsertIndex      = -1
            FollowedByOk     = $true
            CandidateCount   = $located.CandidateCount
            FeatureMatchCount = $located.FeatureMatchCount
            RuleCountBefore  = $ruleCountBefore
            RuleCountAfter   = $ruleCountBefore
            CardRuleProbe    = $cardRuleProbe
            FullInsertText   = $fullInsertText
            NewIds           = $newIds
            ExpectedRules    = @($expectedRules | ForEach-Object { $_.Rule })
        }
    }
    if ($insertCount -gt 0) {
        Stop-Fail ("$Label：insertText 已在文件中出现 $insertCount 次，但不紧跟在锚点之后 ——" +
            " 可能是半改状态，请先跑 restore.ps1；若锚点也已不匹配，则 patches/ 需要重新生成，不要手工硬改。")
    }

    # --- 断言 anchor 之后的文本（走统一入口：卡片配色 patch 声明 followedBy 逐字相等）---
    # legacy 升级时，锚点后先是旧文本、再是 followedBy，故校验基准要推过旧文本。
    $followedResult = Assert-FollowedBy -Patch $Target -Text $file.Text -AnchorEnd ($anchorEnd + $legacyLen) `
        -LiteralClose (-1) -Label $Label
    $followedOk = $followedResult.Ok

    # --- 在锚点末尾插入，内存里算出改后文本 ---
    $insertIndex = $anchorEnd + $legacyLen
    $newText = $file.Text.Substring(0, $insertIndex) + $insertText + $file.Text.Substring($insertIndex)

    # --- 改后断言：新主题的卡片规则各 3 条（逐条精确命中 1 次）---
    foreach ($er in $expectedRules) {
        $c = Get-OccurrenceCount -Text $newText -Needle $er.Rule
        if ($c -ne 1) { Stop-Fail "$Label：改后规则 '$($er.Kind)/$($er.Id)' 命中 $c 次（要求 1）—— 插入结果不符合预期" }
    }
    foreach ($id in $newIds) {
        $probe = ".$cardClass[data-theme=$id]"
        $c = Get-OccurrenceCount -Text $newText -Needle $probe
        if ($c -ne $rulesPerTheme) {
            Stop-Fail "$Label：改后主题 '$id' 的卡片规则有 $c 条，期望 $rulesPerTheme 条"
        }
    }
    # 只增不改：规则前缀出现次数应恰好 + 新增主题数×每主题条数，且插入点前后文本逐字未变
    $ruleCountAfter = Get-OccurrenceCount -Text $newText -Needle $cardRuleProbe
    $expectedDelta = ($newIds.Count - $legacyThemes) * $rulesPerTheme
    if ($ruleCountAfter -ne ($ruleCountBefore + $expectedDelta)) {
        Stop-Fail "$Label：改后卡片规则数 $ruleCountAfter != 改前 $ruleCountBefore + $expectedDelta —— 插入影响到了既有规则"
    }
    if ($newText.Substring(0, $insertIndex) -cne $file.Text.Substring(0, $insertIndex)) {
        Stop-Fail "$Label：插入点之前的文本发生了变化"
    }
    if ($newText.Substring($insertIndex + $insertText.Length) -cne $file.Text.Substring($insertIndex)) {
        Stop-Fail "$Label：插入点之后的文本发生了变化"
    }

    return [pscustomobject]@{
        Label            = $Label
        Tree             = $Tree
        Path             = $targetPath
        Rel              = $rel
        Action           = 'modify'
        Anchor           = $anchor
        InsertText       = $insertText
        OldText          = $file.Text
        NewText          = $newText
        Sha256Before     = $file.Sha256
        BytesBefore      = $file.Bytes.Length
        AnchorCount      = $anchorCount
        InsertIndex      = $insertIndex
        FollowedByOk     = $followedOk
        CandidateCount   = $located.CandidateCount
        FeatureMatchCount = $located.FeatureMatchCount
        RuleCountBefore  = $ruleCountBefore
        RuleCountAfter   = $ruleCountAfter
        CardRuleProbe    = $cardRuleProbe
        FullInsertText   = $fullInsertText
        NewIds           = $newIds
        ExpectedRules    = @($expectedRules | ForEach-Object { $_.Rule })
    }
}

# ============================================================================
# 卡片调色板 patch 预演（纯内存，不写盘）
# ============================================================================

<#
    node 求值脚本（调色板版）：把 stdin 当作 JS 对象字面量真求值，输出
      { ok, count, ids, entries: { id: { "--bg": "...", ... } } }
    与注册表版（NodeEvalJs）分开，是因为这里要核对**每一对键值**，不只是数 id。
    14 项 x 15 键的 JSON 约 4 KB，走 stdout 没有压力。
#>
$script:NodePaletteEvalJs = 'let s="";process.stdin.setEncoding("utf8");' +
    'process.stdin.on("data",d=>{s+=d});' +
    'process.stdin.on("end",()=>{' +
    'let o;try{o=new Function("return ("+s+")")()}catch(e){' +
    'process.stdout.write(JSON.stringify({ok:false,error:String(e&&e.message)}));return}' +
    'let entries={};for(const k of Object.keys(o)){entries[k]=o[k]}' +
    'process.stdout.write(JSON.stringify({ok:true,count:Object.keys(o).length,ids:Object.keys(o),entries}));});'
$script:NodePaletteEvalArg = "eval(Buffer.from('" +
    [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($script:NodePaletteEvalJs)) +
    "','base64').toString('utf8'))"

<# 用 node 真求值调色板表对象字面量，返回 @{ ok; count; ids; entries } #>
function Invoke-NodePaletteEval {
    param([Parameter(Mandatory)][string]$Literal, [Parameter(Mandatory)][string]$What)
    $out = $Literal | & node -e $script:NodePaletteEvalArg
    $code = $LASTEXITCODE
    if ($code -ne 0) { Stop-Fail "$What：node 求值进程退出码 $code" }
    if ($null -eq $out) { Stop-Fail "$What：node 求值无输出" }
    $parsed = $null
    try {
        $parsed = ([string]$out).Trim() | ConvertFrom-Json
    }
    catch {
        Stop-Fail "$What：node 输出不是合法 JSON —— $($_.Exception.Message)"
    }
    if (-not (Get-Prop $parsed 'ok')) {
        Stop-Fail "$What：调色板字面量不是合法 JS 对象 —— $(Get-Prop $parsed 'error')"
    }
    return $parsed
}

<#
    核对「新增调色板项逐键逐值正确」。落盘后的回读复核与预演断言共用这一处，
    避免两边口径漂移（这类双份判据一旦漂移，就只剩弱的那份在管事）。
    返回错误描述数组（空 = 全通过）。
#>
function Test-PaletteEntries {
    param(
        [Parameter(Mandatory)]$Eval,
        [Parameter(Mandatory)][string[]]$Ids,
        [Parameter(Mandatory)][string[]]$Keys,
        [Parameter(Mandatory)]$Expected
    )
    $problems = [System.Collections.Generic.List[string]]::new()
    foreach ($id in $Ids) {
        $got = Get-Prop (Get-Prop $Eval 'entries') $id
        if ($null -eq $got) { $problems.Add("缺少 '$id'"); continue }
        $want = Get-Prop $Expected $id
        if ($null -eq $want) { $problems.Add("patch 的 byThemeId 缺少 '$id'"); continue }
        $gotKeys = @($got.PSObject.Properties | ForEach-Object { $_.Name })
        if ($gotKeys.Count -ne $Keys.Count) {
            $problems.Add("'$id' 有 $($gotKeys.Count) 个键，期望 $($Keys.Count)")
            continue
        }
        foreach ($k in $Keys) {
            $gotVal = Get-Prop $got $k
            $wantVal = Get-Prop $want $k
            if ($null -eq $gotVal) { $problems.Add("'$id' 缺少键 '$k'"); continue }
            if (-not [string]::Equals([string]$gotVal, [string]$wantVal, [StringComparison]::Ordinal)) {
                $problems.Add("'$id' 键 '$k' = '$gotVal'，期望 '$wantVal'")
            }
        }
    }
    return @($problems)
}

<#
    卡片调色板 patch（server/bundle/index.js 的 MGr 表）。

    为什么需要这一票：主题注册表被我们 patch 成「内建主题」后，folio 幻灯片烧主题时
    走的是 nYr() 查 MGr 这条路（运行时不会为内建主题提供 userTheme 变量），
    表里没有本皮肤的三个 id 就会抛 `no card palette for theme "<id>"`。

    纪律与另两份 patch 一致：内容特征防认错文件、锚点必须唯一、锚点后文必须结构校验通过、
    改前改后都用 node **真求值**（不是数字符串），且改后逐键逐值核对。
    差一点就写 `MGr = {` 当场自证：insertText 由 paletteKeys + byThemeId 重建，
    与 patch 里的 insertText 不逐字相同即中止（防手抄漂移）。
#>
function Resolve-CardPalettePlan {
    param(
        [Parameter(Mandatory)][string]$PatchPath,
        [Parameter(Mandatory)]$Patch,
        [Parameter(Mandatory)][string]$Tree,
        [Parameter(Mandatory)][string]$BaseDir,
        [Parameter(Mandatory)][string]$Rel,
        [Parameter(Mandatory)][string]$Label,
        # 同一文件可能先被别的 plan 改过：server bundle/index.js 先被「注册表插入」改、
        # 再被本函数「调色板插入」改，而落盘是**按 plan 顺序逐份写**的。
        # 若这里仍以磁盘旧文本为基，本 plan 的 NewText 会把前一份的插入整段覆盖掉
        # （2026-10-21 全新安装实测：注册表 11->14 刚写完，就被调色板那一步抹回 11）。
        # 传进来的是「前一份 plan 改后的文本」；sha256/字节数仍取磁盘（那是写入前的身份）。
        [string]$BaseText
    )

    foreach ($flag in @('onAnchorMissing', 'onAnchorNotUnique')) {
        if ((Get-Prop $Patch $flag) -ne 'error') { Stop-Fail "$Label：$flag 不是 'error'（不允许静默跳过）" }
    }
    if ((Get-Prop $Patch 'locateStrategy') -ne 'content-anchor') { Stop-Fail "$Label：locateStrategy 不是 'content-anchor'" }
    if ((Get-Prop $Patch 'insertionPoint') -ne 'after-anchor') { Stop-Fail "$Label：insertionPoint 不是 'after-anchor'" }
    if ([int](Get-RequiredProp $Patch 'anchorOccurrencesExpected' $Label) -ne 1) { Stop-Fail "$Label：anchorOccurrencesExpected 不是 1" }

    $anchor = [string](Get-RequiredProp $Patch 'anchor' $Label)
    $insertText = [string](Get-RequiredProp $Patch 'insertText' $Label)
    $beforeCtx = [string](Get-Prop (Get-Prop $Patch 'anchorContext') 'before')
    $countBaseline = [int](Get-RequiredProp $Patch 'countBaseline' $Label)
    $expectedAfter = [int](Get-RequiredProp $Patch 'expectedCountAfter' $Label)
    $newIds = @(Get-Prop $Patch 'newThemeIds' | ForEach-Object { [string]$_ })
    $paletteKeys = @(Get-Prop $Patch 'paletteKeys' | ForEach-Object { [string]$_ })
    $byThemeId = Get-RequiredProp $Patch 'byThemeId' $Label
    $features = @(Get-Prop $Patch 'contentFeatures')

    if ($newIds.Count -eq 0) { Stop-Fail "$Label：newThemeIds 为空" }
    if ($paletteKeys.Count -eq 0) { Stop-Fail "$Label：paletteKeys 为空" }

    # --- insertText 必须能由 paletteKeys + byThemeId 重建（防 patch 自身不一致）---
    $rebuilt = [System.Text.StringBuilder]::new()
    [void]$rebuilt.Append(',')
    $entryNo = 0
    foreach ($id in $newIds) {
        $spec = Get-RequiredProp $byThemeId $id "$Label byThemeId"
        if ($entryNo -gt 0) { [void]$rebuilt.Append(',') }
        [void]$rebuilt.Append("`n  `"$id`": {`n")
        $kNo = 0
        foreach ($k in $paletteKeys) {
            $v = [string](Get-RequiredProp $spec $k "$Label byThemeId.$id")
            $comma = if ($kNo -eq $paletteKeys.Count - 1) { '' } else { ',' }
            [void]$rebuilt.Append("    `"$k`": `"$v`"$comma`n")
            $kNo++
        }
        [void]$rebuilt.Append('  }')
        $entryNo++
    }
    $rebuiltText = $rebuilt.ToString()
    if (-not [string]::Equals($rebuiltText, $insertText, [StringComparison]::Ordinal)) {
        Stop-Fail ("$Label：由 paletteKeys + byThemeId 重建的 insertText 与 patch 里写的不是逐字相同 ——" +
            " patch 自身不一致，已中止。$([Environment]::NewLine)  重建：$rebuiltText$([Environment]::NewLine)  文本：$insertText")
    }

    $targetPath = Join-Path $BaseDir ($Rel -replace '/', '\')
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) { Stop-Fail "$Label：目标文件不存在 '$targetPath'" }
    $file = Read-Utf8File -Path $targetPath
    if (-not [string]::IsNullOrWhiteSpace($BaseText)) {
        # 沿用 Resolve-ThemeCacheBustPlan 的手法：只替换文本，sha256/字节数保留磁盘值。
        $file = [pscustomobject]@{ Text = $BaseText; Sha256 = $file.Sha256; Bytes = $file.Bytes }
    }

    foreach ($feat in $features) {
        if (-not $file.Text.Contains([string]$feat)) { Stop-Fail "$Label：内容特征缺失 '$feat' —— 目标文件与 patches/ 描述不符，已中止" }
    }

    # --- 幂等：锚点之后紧跟 insertText = 已贴过，逐键逐值复核后跳过 ---
    $alreadyPatched = $false
    if ($file.Text.Contains($anchor + $insertText)) {
        if ((Get-OccurrenceCount -Text $file.Text -Needle $insertText) -ne 1) {
            Stop-Fail "$Label：insertText 出现多次，状态不一致，请先跑 restore.ps1"
        }
        $alreadyPatched = $true
    }

    $state = Get-RegistryLiteralByAnchor -Text $file.Text -Anchor $anchor -What $Label
    $anchorEnd = $state.AnchorIdx + $anchor.Length

    # --- anchorContext.before 二次确认 ---
    $beforeOk = $true
    if (-not [string]::IsNullOrEmpty($beforeCtx)) {
        $beforeOk = $false
        if ($state.AnchorIdx -ge $beforeCtx.Length) {
            $beforeOk = ([string]::CompareOrdinal($file.Text, $state.AnchorIdx - $beforeCtx.Length, $beforeCtx, 0, $beforeCtx.Length) -eq 0)
        }
        if (-not $beforeOk) { Stop-Fail "$Label：anchorContext.before 与锚点前文不符 —— 目标文件已变，已中止" }
    }

    # 顺序不可调：结构校验只对「尚未贴过」的文件有意义。已贴过的文件里，锚点后面
    # 紧跟的就是自己插进去的那三项，Assert-FollowedBy 要求「锚点后必须直接闭合」，
    # 必然报错 —— 幂等分支必须先返回，否则第二次执行就当场炸（2026-10-20 踩过）。
    if ($alreadyPatched) {
        $evalNow = Invoke-NodePaletteEval -Literal $state.Literal -What "$Label（已贴过复核）"
        if ([int]$evalNow.count -ne $expectedAfter) {
            Stop-Fail "$Label：已贴过但调色板有 $($evalNow.count) 项，期望 $expectedAfter —— 状态不一致，请先跑 restore.ps1"
        }
        $problems = @(Test-PaletteEntries -Eval $evalNow -Ids $newIds -Keys $paletteKeys -Expected $byThemeId)
        if ($problems.Count -gt 0) {
            Stop-Fail "$Label：已贴过但调色板内容不符 —— $($problems -join '；')。请先跑 restore.ps1"
        }
        return [pscustomobject]@{
            Label        = $Label
            Tree         = $Tree
            Path         = $targetPath
            Rel          = $Rel
            Action       = 'skip-already-patched'
            Anchor       = $anchor
            InsertText   = $insertText
            OldText      = $file.Text
            NewText      = $file.Text
            Sha256Before = $file.Sha256
            BytesBefore  = $file.Bytes.Length
            CountBefore  = [int]$evalNow.count
            CountAfter   = [int]$evalNow.count
            IdsBefore    = @($evalNow.ids)
            IdsAfter     = @($evalNow.ids)
            NewIds       = $newIds
            PaletteKeys  = $paletteKeys
            AnchorCount  = $state.AnchorCount
            InsertIndex  = -1
            FollowedByOk = $true
            FollowedByKind = 'already-patched'
            BeforeContextOk = $beforeOk
        }
    }

    # --- 锚点后文：结构校验（锚点必须是表最后一项）---
    $followedResult = Assert-FollowedBy -Patch $Patch -Text $file.Text -AnchorEnd $anchorEnd -LiteralClose $state.LiteralClose -Label $Label

    # --- 改前：表项数必须是基线，且三个新 id 一个都还没有 ---
    $evalBefore = Invoke-NodePaletteEval -Literal $state.Literal -What "$Label（改前）"
    if ([int]$evalBefore.count -ne $countBaseline) {
        Stop-Fail "$Label：改前调色板有 $($evalBefore.count) 项，期望 $countBaseline —— 安装版本与 patch 不匹配，已中止。$([Environment]::NewLine)  若这是新版构建：按 $($script:RepairDoc) 把 countBaseline 改成 $($evalBefore.count)、expectedCountAfter 改成 $($evalBefore.count + 3)。"
    }
    foreach ($id in $newIds) {
        if (@($evalBefore.ids) -contains $id) { Stop-Fail "$Label：改前调色板里已有 '$id' —— 状态不一致，请先跑 restore.ps1" }
    }

    # --- 内存里算出改后文本 / 改后字面量 ---
    $insertIndex = $anchorEnd
    $newText = $file.Text.Substring(0, $insertIndex) + $insertText + $file.Text.Substring($insertIndex)
    $offsetInLiteral = $insertIndex - $state.LiteralOpen
    $newLiteral = $state.Literal.Substring(0, $offsetInLiteral) + $insertText + $state.Literal.Substring($offsetInLiteral)

    $evalAfter = Invoke-NodePaletteEval -Literal $newLiteral -What "$Label（改后预演）"
    if ([int]$evalAfter.count -ne $expectedAfter) {
        Stop-Fail "$Label：改后调色板有 $($evalAfter.count) 项，期望 $expectedAfter"
    }
    # 注意：函数返回 @() 会在调用方被展开成 $null，故两处调用点都必须用 @(...) 包装再取 .Count
    $problemsAfter = @(Test-PaletteEntries -Eval $evalAfter -Ids $newIds -Keys $paletteKeys -Expected $byThemeId)
    if ($problemsAfter.Count -gt 0) { Stop-Fail "$Label：改后预演内容不符 —— $($problemsAfter -join '；')" }
    # 既有 11 项必须一项不丢、且逐键逐值未变
    foreach ($oldId in @($evalBefore.ids)) {
        $gotOld = Get-Prop (Get-Prop $evalAfter 'entries') $oldId
        if ($null -eq $gotOld) { Stop-Fail "$Label：改后丢失了原有调色板项 '$oldId'" }
        $beforeJson = (Get-Prop (Get-Prop $evalBefore 'entries') $oldId) | ConvertTo-Json -Depth 10 -Compress
        $afterJson = $gotOld | ConvertTo-Json -Depth 10 -Compress
        if (-not [string]::Equals($beforeJson, $afterJson, [StringComparison]::Ordinal)) {
            Stop-Fail "$Label：改后既有调色板项 '$oldId' 被改动"
        }
    }
    # 只增不改：插入点前后的文本必须逐字未变
    if ($newText.Substring(0, $insertIndex) -cne $file.Text.Substring(0, $insertIndex)) {
        Stop-Fail "$Label：插入点之前的文本发生了变化"
    }
    if ($newText.Substring($insertIndex + $insertText.Length) -cne $file.Text.Substring($insertIndex)) {
        Stop-Fail "$Label：插入点之后的文本发生了变化"
    }

    $newBytes = $script:Utf8NoBom.GetBytes($newText)
    return [pscustomobject]@{
        Label        = $Label
        Tree         = $Tree
        Path         = $targetPath
        Rel          = $Rel
        Action       = 'modify'
        Anchor       = $anchor
        InsertText   = $insertText
        OldText      = $file.Text
        NewText      = $newText
        Sha256Before = $file.Sha256
        BytesBefore  = $file.Bytes.Length
        Sha256After  = Get-BytesSha256 $newBytes
        BytesAfter   = $newBytes.Length
        CountBefore  = [int]$evalBefore.count
        CountAfter   = [int]$evalAfter.count
        IdsBefore    = @($evalBefore.ids)
        IdsAfter     = @($evalAfter.ids)
        NewIds       = $newIds
        PaletteKeys  = $paletteKeys
        AnchorCount  = $state.AnchorCount
        InsertIndex  = $insertIndex
        FollowedByOk = $followedResult.Ok
        FollowedByKind = $followedResult.Kind
        BeforeContextOk = $beforeOk
    }
}

# ============================================================================
# JSON 文本级编辑原语（2026-10-24，工单 51）
#
# 为什么不用「parse → 改对象 → 重新序列化」这条老路：
#   1.1.111-beta 的 locales/*.json 里，上游自己留下了不规整的格式 ——
#   `"thinkingLevelHint"` 在同一个对象里出现两次、还有一行缩进错位（4 空格该是 6）。
#   于是「ConvertTo-Json(ConvertFrom-Json(x)) 必须与原文件逐字节相同」这条前置断言
#   在五个 locale 文件上全部失败（重复键会在往返里被合并掉，缩进也会被规整）。
#   一旦上游格式不规整，整份重序列化就必然重排别人的文件；而这段代码要改的地方
#   只有 `settings.appearance` 里的几个键。所以改成**文本级插入/替换**：
#   只碰目标成员那几个字符，其余字节原样保留 —— 对上游格式的规整度不再有任何依赖。
# ============================================================================

<#
    从某个 '{' / '[' 的下标出发，返回与之匹配的闭合括号下标。
    纯字符扫描：跳过字符串字面量（含反斜杠转义），只数括号深度。
#>
function Get-JsonClosingBracketIndex {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][int]$OpenIndex)
    $open = $Text[$OpenIndex]
    if ($open -cne '{' -and $open -cne '[') { Stop-Fail "内部错误：$OpenIndex 处不是 JSON 括号（读到 '$open'）" }
    $depth = 0
    $inString = $false
    for ($i = $OpenIndex; $i -lt $Text.Length; $i++) {
        $c = $Text[$i]
        if ($inString) {
            if ($c -eq '\') { $i++; continue }
            if ($c -eq '"') { $inString = $false }
            continue
        }
        if ($c -eq '"') { $inString = $true; continue }
        if ($c -eq '{' -or $c -eq '[') { $depth++ }
        elseif ($c -eq '}' -or $c -eq ']') {
            $depth--
            if ($depth -eq 0) { return $i }
        }
    }
    Stop-Fail '内部错误：JSON 括号未闭合'
}

<#
    从 Start 起找一个 JSON 值的**最后一个字符**下标（不含尾随空白/逗号）。
    字符串：到收尾引号；对象/数组：到匹配的闭合括号；其余（数字 / true / false / null）：
    到首个分隔符（逗号、右括号或空白）。
#>
function Find-JsonValueEnd {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][int]$Start)
    $c = $Text[$Start]
    if ($c -eq '"') {
        $j = $Start + 1
        while ($j -lt $Text.Length) {
            if ($Text[$j] -eq '\') { $j += 2; continue }
            if ($Text[$j] -eq '"') { return $j }
            $j++
        }
        Stop-Fail '内部错误：JSON 字符串未闭合'
    }
    if ($c -eq '{' -or $c -eq '[') { return (Get-JsonClosingBracketIndex -Text $Text -OpenIndex $Start) }
    $j = $Start
    while ($j -lt $Text.Length) {
        $ch = $Text[$j]
        if ($ch -eq ',' -or $ch -eq '}' -or $ch -eq ']' -or $ch -eq ' ' -or $ch -eq "`n" -or $ch -eq "`r" -or $ch -eq "`t") { break }
        $j++
    }
    return ($j - 1)
}

<#
    列出某个 JSON 对象的**直接成员**（不做递归），按文件里出现的顺序返回。
    每项：Key（未转义的键名）/ KeyStart（键的起始引号）/ KeyEnd（键的收尾引号）/
          ValueStart / ValueEnd（值的首末字符）。
    只认深度 1 的键：嵌套子对象里的同名键不会被误当成这个对象的成员。
#>
function Get-JsonDirectMembers {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][int]$OpenIndex, [Parameter(Mandatory)][int]$CloseIndex)
    $members = [System.Collections.Generic.List[object]]::new()
    $i = $OpenIndex + 1
    $state = 'expectKey'
    $keyStart = -1
    $keyEnd = -1
    while ($i -lt $CloseIndex) {
        $c = $Text[$i]
        if ($state -eq 'expectKey') {
            if ($c -eq ' ' -or $c -eq "`n" -or $c -eq "`r" -or $c -eq "`t" -or $c -eq ',') { $i++; continue }
            if ($c -ne '"') { Stop-Fail "内部错误：JSON 对象成员期望键，在 $i 处读到 '$c'" }
            $keyStart = $i
            $j = $i + 1
            while ($j -lt $CloseIndex) {
                if ($Text[$j] -eq '\') { $j += 2; continue }
                if ($Text[$j] -eq '"') { break }
                $j++
            }
            $keyEnd = $j
            $i = $j + 1
            $state = 'afterKey'
            continue
        }
        if ($state -eq 'afterKey') {
            if ($c -eq ':') { $i++; $state = 'inValue'; continue }
            if ($c -eq ' ' -or $c -eq "`n" -or $c -eq "`r" -or $c -eq "`t") { $i++; continue }
            Stop-Fail "内部错误：JSON 成员键后缺少冒号（位置 $i）"
        }
        # inValue：先跳过冒号后的空白，再定位值的首字符
        while ($i -lt $CloseIndex -and ($Text[$i] -eq ' ' -or $Text[$i] -eq "`n" -or $Text[$i] -eq "`r" -or $Text[$i] -eq "`t")) { $i++ }
        $valueStart = $i
        $valueEnd = Find-JsonValueEnd -Text $Text -Start $i
        $rawKey = $Text.Substring($keyStart + 1, $keyEnd - $keyStart - 1)
        # 键名里可能有转义（'\u4e2d' 之类）；用序列化器还原成真值，避免拿裸文本比对
        $key = $rawKey
        if ($rawKey.Contains('\')) {
            try { $key = ('{"' + $rawKey + '":0}') | ConvertFrom-Json | ForEach-Object { @($_.PSObject.Properties.Name)[0] } }
            catch { Stop-Fail "内部错误：键名 '$rawKey' 无法还原" }
        }
        $members.Add([pscustomobject]@{
                Key        = [string]$key
                KeyStart   = $keyStart
                KeyEnd     = $keyEnd
                ValueStart = $valueStart
                ValueEnd   = $valueEnd
            })
        $i = $valueEnd + 1
        $state = 'expectKey'
    }
    return $members
}

<# 把字符串编码成 JSON 字面量（含两端引号）。不转义非 ASCII，与上游文件的写法一致。 #>
function ConvertTo-JsonStringLiteral {
    param([Parameter(Mandatory)][AllowEmptyString()][string]$Value)
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.Append([char]0x22)
    foreach ($ch in $Value.ToCharArray()) {
        $code = [int]$ch
        if ($ch -eq [char]0x22) { [void]$sb.Append('\"') }
        elseif ($ch -eq [char]0x5C) { [void]$sb.Append('\\') }
        elseif ($ch -eq [char]0x0A) { [void]$sb.Append('\n') }
        elseif ($ch -eq [char]0x0D) { [void]$sb.Append('\r') }
        elseif ($ch -eq [char]0x09) { [void]$sb.Append('\t') }
        elseif ($ch -eq [char]0x08) { [void]$sb.Append('\b') }
        elseif ($ch -eq [char]0x0C) { [void]$sb.Append('\f') }
        elseif ($code -lt 0x20) { [void]$sb.Append('\u' + $code.ToString('x4')) }
        else { [void]$sb.Append($ch) }
    }
    [void]$sb.Append([char]0x22)
    return $sb.ToString()
}

<# 在某一行内部，取某个下标所在行的前导空白（缩进）。 #>
function Get-LineIndentOf {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][int]$Index)
    $lineStart = $Text.LastIndexOf("`n", [Math]::Max(0, $Index - 1))
    $lineStart = $lineStart + 1
    $k = $lineStart
    while ($k -lt $Text.Length -and ($Text[$k] -eq ' ' -or $Text[$k] -eq "`t")) { $k++ }
    return $Text.Substring($lineStart, $k - $lineStart)
}

# ============================================================================
# i18n 合并预演（纯内存，不写盘）
# ============================================================================

function Resolve-LocalePlan {
    param(
        [Parameter(Mandatory)][string]$Locale,
        [Parameter(Mandatory)][string]$FragmentPath,
        [Parameter(Mandatory)][string]$TargetPath,
        # 改名通道（2026-10-20）：叶名 -> 新文案。只允许改**已存在**的键，
        # 不允许借这个参数新建键（新建键仍然只能走 locale 片段）。
        [hashtable]$Overrides = @{}
    )

    $fragment = Read-JsonFile -Path $FragmentPath -What "locale 片段 '$Locale'"
    $file = Read-Utf8File -Path $TargetPath

    $root = $null
    try { $root = $file.Text | ConvertFrom-Json }
    catch { Stop-Fail "locale '$Locale' JSON 解析失败：$($_.Exception.Message)" }

    # --- 不再要求“整份重序列化能逐字节复现”（工单 51）：只在目标对象里做局部文本编辑。
    # 但仍需要一个“上游文件本身可解析”的地基：$root 已在上面解析成功。

    $settings = Get-Prop $root 'settings'
    if ($null -eq $settings) { Stop-Fail "locale '$Locale'：顶层缺少 'settings' 对象" }
    $appearance = Get-Prop $settings 'appearance'
    if ($null -eq $appearance) { Stop-Fail "locale '$Locale'：缺少 'settings.appearance' 对象" }

    # --- 文本级定位 settings.appearance 在**原文中的字符区间** ---
    $topOpen = $file.Text.IndexOf('{')
    if ($topOpen -lt 0) { Stop-Fail "locale '$Locale'：文件里找不到根对象" }
    $topClose = Get-JsonClosingBracketIndex -Text $file.Text -OpenIndex $topOpen
    $topMembers = Get-JsonDirectMembers -Text $file.Text -OpenIndex $topOpen -CloseIndex $topClose
    $settingsMember = @($topMembers | Where-Object { $_.Key -ceq 'settings' }) | Select-Object -First 1
    if ($null -eq $settingsMember) { Stop-Fail "locale '$Locale'：顶层缺少 'settings' 对象" }
    if ($file.Text[$settingsMember.ValueStart] -cne '{') { Stop-Fail "locale '$Locale'：'settings' 不是对象" }
    $setMembers = Get-JsonDirectMembers -Text $file.Text -OpenIndex $settingsMember.ValueStart -CloseIndex $settingsMember.ValueEnd
    $appearanceMember = @($setMembers | Where-Object { $_.Key -ceq 'appearance' }) | Select-Object -First 1
    if ($null -eq $appearanceMember) { Stop-Fail "locale '$Locale'：缺少 'settings.appearance' 对象" }
    if ($file.Text[$appearanceMember.ValueStart] -cne '{') { Stop-Fail "locale '$Locale'：'settings.appearance' 不是对象" }
    $appOpen = $appearanceMember.ValueStart
    $appClose = $appearanceMember.ValueEnd

    $origNames = @($appearance.PSObject.Properties.Name)

    # --- 片段契约：每个键必须是 settings.appearance.<leaf> 三段式 ---
    $additions = [System.Collections.Generic.List[object]]::new()
    $skipped = [System.Collections.Generic.List[string]]::new()
    foreach ($prop in $fragment.PSObject.Properties) {
        $key = [string]$prop.Name
        $parts = $key -split '\.'
        if ($parts.Count -ne 3 -or $parts[0] -cne 'settings' -or $parts[1] -cne 'appearance') {
            Stop-Fail "locale '$Locale'：片段键 '$key' 不是 settings.appearance.<leaf> 三段式，视为片段损坏"
        }
        $leaf = $parts[2]
        if ($leaf -notmatch '^[A-Za-z][A-Za-z0-9]*$') {
            Stop-Fail "locale '$Locale'：片段键叶名 '$leaf' 不是合法标识符"
        }
        $value = [string]$prop.Value
        if ([string]::IsNullOrEmpty($value)) { Stop-Fail "locale '$Locale'：键 '$key' 的文案为空" }

        if ($origNames -contains $leaf) {
            $skipped.Add($leaf)
        }
        else {
            $additions.Add([pscustomobject]@{ Leaf = $leaf; Value = $value })
        }
    }

    # --- 改名（2026-10-20）：只改点名的键；本票里该键若是本次新建的，就直接校正新建值 ---
    $renames = [System.Collections.Generic.List[object]]::new()
    $postNames = @($origNames) + @($additions | ForEach-Object { $_.Leaf })
    foreach ($leaf in @($Overrides.Keys | Sort-Object)) {
        if ($postNames -notcontains $leaf) { Stop-Fail "locale '$Locale'：改名目标 '$leaf' 在文件里不存在（改名不负责新建键）" }
        $want = [string]$Overrides[$leaf]
        if ([string]::IsNullOrEmpty($want)) { Stop-Fail "locale '$Locale'：改名目标 '$leaf' 的新文案为空" }
        $added = $additions | Where-Object { $_.Leaf -ceq $leaf } | Select-Object -First 1
        if ($null -ne $added) {
            # 同一次跑里“新建 + 改名”：直接让新建值等于改名值，不制造一个多余的 rename 条目
            $added.Value = $want
            continue
        }
        $have = [string](Get-Prop $appearance $leaf)
        if ($have -cne $want) { $renames.Add([pscustomobject]@{ Leaf = $leaf; From = $have; To = $want }) }
    }

    if ($additions.Count -eq 0 -and $renames.Count -eq 0) {
        return [pscustomobject]@{
            Locale      = $Locale
            Path        = $TargetPath
            Action      = 'skip-no-change'
            OldText     = $file.Text
            NewText     = $file.Text
            Sha256Before = $file.Sha256
            Added       = @()
            Renamed     = @()
            Skipped     = @($skipped)
            OrigNames   = $origNames
            OrigAppearance = $appearance
            NewAppearance  = $appearance
            Root        = $root
        }
    }

    foreach ($a in $additions) {
        Add-Member -InputObject $appearance -MemberType NoteProperty -Name $a.Leaf -Value $a.Value
    }
    foreach ($rn in $renames) {
        $appearance.PSObject.Properties[$rn.Leaf].Value = $rn.To
    }

    # --- 文本级写回（工单 51）：只碰下面这几个编辑区间，其余字节原样保留 ---
    $newText = $file.Text
    $nl = if ($newText.Contains("`r`n")) { "`r`n" } else { "`n" }
    $edits = [System.Collections.Generic.List[object]]::new()

    # (a) 改名：只替换目标键的值字面量
    if ($renames.Count -gt 0) {
        $appMembers0 = Get-JsonDirectMembers -Text $newText -OpenIndex $appOpen -CloseIndex $appClose
        foreach ($rn in $renames) {
            $m = @($appMembers0 | Where-Object { $_.Key -ceq $rn.Leaf }) | Select-Object -First 1
            if ($null -eq $m) { Stop-Fail "locale '$Locale'：改名目标 '$($rn.Leaf)' 在 settings.appearance 里找不到（改前预检已过，属内部错误）" }
            if ($newText[$m.ValueStart] -cne '"') { Stop-Fail "locale '$Locale'：改名目标 '$($rn.Leaf)' 的值不是字符串字面量，拒绝文本级改写" }
            $edits.Add([pscustomobject]@{
                    Kind  = 'replace'
                    Start = $m.ValueStart
                    End   = $m.ValueEnd
                    Text  = (ConvertTo-JsonStringLiteral -Value $rn.To)
                })
        }
    }

    # (b) 新增键：追加到 settings.appearance 的最后一个成员之后（与原先 Add-Member 的语义一致：插在末尾）
    if ($additions.Count -gt 0) {
        $appMembers1 = Get-JsonDirectMembers -Text $newText -OpenIndex $appOpen -CloseIndex $appClose
        if ($appMembers1.Count -eq 0) {
            # appearance 为空对象：本票不会出现，不做猜测，直接报错而不是乱插
            Stop-Fail "locale '$Locale'：settings.appearance 是空对象，本脚本不支持自动插入（需人工定位锚点）"
        }
        $lastMember = $appMembers1[$appMembers1.Count - 1]
        $childIndent = Get-LineIndentOf -Text $newText -Index $lastMember.KeyStart
        $items = @()
        foreach ($a in $additions) {
            $items += ((ConvertTo-JsonStringLiteral -Value $a.Leaf) + ': ' + (ConvertTo-JsonStringLiteral -Value $a.Value))
        }
        $payload = ',' + $nl + $childIndent + ($items -join (',' + $nl + $childIndent))
        $edits.Add([pscustomobject]@{
                Kind  = 'insert'
                Start = ($lastMember.ValueEnd + 1)
                End   = -1
                Text  = $payload
            })
    }

    # 从后往前应用，前面的编辑区间下标才不会被位移
    foreach ($e in ($edits | Sort-Object -Property Start -Descending)) {
        if ($e.Kind -eq 'insert') {
            $newText = $newText.Substring(0, $e.Start) + $e.Text + $newText.Substring($e.Start)
        }
        else {
            $newText = $newText.Substring(0, $e.Start) + $e.Text + $newText.Substring($e.End + 1)
        }
    }

    # --- 改后校验：只增键、不动既有内容 ---
    $newRoot = $null
    try { $newRoot = $newText | ConvertFrom-Json }
    catch { Stop-Fail "locale '$Locale'：合并结果不是合法 JSON —— $($_.Exception.Message)" }

    $newSettings = Get-Prop $newRoot 'settings'
    $newAppearance = Get-Prop $newSettings 'appearance'
    $newNames = @($newAppearance.PSObject.Properties.Name)

    $topBefore = (@($root.PSObject.Properties.Name) -join '|')
    $topAfter = (@($newRoot.PSObject.Properties.Name) -join '|')
    if ($topBefore -cne $topAfter) { Stop-Fail "locale '$Locale'：顶层键发生变化" }

    $setBefore = (@($settings.PSObject.Properties.Name) -join '|')
    $setAfter = (@($newSettings.PSObject.Properties.Name) -join '|')
    if ($setBefore -cne $setAfter) { Stop-Fail "locale '$Locale'：settings 下的键发生变化" }

    if ($newNames.Count -ne ($origNames.Count + $additions.Count)) {
        Stop-Fail "locale '$Locale'：appearance 键数 $($newNames.Count)，期望 $($origNames.Count + $additions.Count)"
    }
    $prefix = ($newNames[0..($origNames.Count - 1)] -join '|')
    if ($prefix -cne ($origNames -join '|')) { Stop-Fail "locale '$Locale'：appearance 原有键序被改变" }

    foreach ($name in $origNames) {
        $a = Get-Prop $appearance $name | ConvertTo-Json -Depth 100 -Compress
        $b = Get-Prop $newAppearance $name | ConvertTo-Json -Depth 100 -Compress
        if ($a -cne $b) {
            # 改名是唯一允许改变既有键值的通道，且只许改成登记过的那个值
            $rn = $renames | Where-Object { $_.Leaf -ceq $name } | Select-Object -First 1
            if ($null -eq $rn) { Stop-Fail "locale '$Locale'：既有键 '$name' 的值被改动" }
            if ([string](Get-Prop $newAppearance $name) -cne $rn.To) { Stop-Fail "locale '$Locale'：改名键 '$name' 写入值不符" }
        }
    }
    foreach ($a in $additions) {
        $got = Get-Prop $newAppearance $a.Leaf
        if ($got -cne $a.Value) { Stop-Fail "locale '$Locale'：新键 '$($a.Leaf)' 写入值不符" }
    }

    $actionName = if ($additions.Count -gt 0 -and $renames.Count -gt 0) { 'merge+rename' } elseif ($renames.Count -gt 0) { 'rename' } else { 'merge' }

    return [pscustomobject]@{
        Locale      = $Locale
        Path        = $TargetPath
        Action      = $actionName
        OldText     = $file.Text
        NewText     = $newText
        Sha256Before = $file.Sha256
        Added       = @($additions | ForEach-Object { $_.Leaf })
        Renamed     = @($renames | ForEach-Object { $_.Leaf })
        RenamedFrom = @($renames | ForEach-Object { "$($_.Leaf)=$($_.From)" })
        Skipped     = @($skipped)
        OrigNames   = $origNames
        OrigAppearance = $appearance
        NewAppearance  = $newAppearance
        Root        = $root
    }
}

# ============================================================================
# 失败报告
# ============================================================================

function Write-FailureReport {
    param([Parameter(Mandatory)][string]$Message)
    Write-Log ''
    Write-Log ('!' * 72)
    Write-Log '失败：已中止，未继续执行后续步骤'
    Write-Log ('!' * 72)
    Write-Log "原因：$Message"
    Write-Log ''
    Write-Log "已完成步骤（$($script:Completed.Count) 项）："
    if ($script:Completed.Count -eq 0) {
        Write-Log '  （无：尚未执行任何写入）'
    }
    else {
        foreach ($s in $script:Completed) { Write-Log "  - $s" }
    }
    Write-Log ''
    Write-Log "备份目录：$($script:BackupDir)"
    Write-Log "skin.json：$($script:SkinJsonPath)"
    Write-Log ''
    Write-Log '回滚指引：'
    Write-Log '  1) 若备份目录已创建，用 restore.ps1 逐文件还原（工单 06）：'
    Write-Log "       pwsh -File scripts\restore.ps1 -BackupDir `"$($script:BackupDir)`" -Apply"
    Write-Log '  2) 若备份目录显示"(尚未创建)"，说明失败发生在任何写入之前，安装目录未被改动。'
}

# ============================================================================
# 浮层面板取景框：CSS 源合成 + JS 追加（工单 30）
# ============================================================================

<#
    读取并校验浮层面板源文件（src/panel-frame/dark.css 与 bg.js）。

    两者都是本仓维护的纯文本，要求 UTF-8 无 BOM + LF（与其它 CSS 源同标准）。
    CSS 源**不含**占位符：图由 JS 从 [data-chalkboard-root] 的计算样式搬来
    （为什么不内联第二份：变量值有长度上限，3.9 MB 会被静默丢弃 —— 见 bg.js 文件头）。
#>
function Read-PanelFrameSources {
    param(
        [Parameter(Mandatory)][string]$SrcDir,
        [string]$DirName = $null,
        [string]$ThemeId = $null
    )

    $dir = if ($DirName) { $DirName } else { $script:PanelFrameDir }

    $cssPath = Join-Path (Join-Path $SrcDir $dir) $script:PanelFrameCssFile
    if (-not (Test-Path -LiteralPath $cssPath -PathType Leaf)) {
        Stop-Fail "浮层面板 CSS 源缺失：'$cssPath'（工单 30 产出）"
    }
    $cssFile = Read-CssSourceFile -Path $cssPath -What "浮层面板 CSS 源 '$($script:PanelFrameCssFile)'"

    $jsPath = Join-Path (Join-Path $SrcDir $dir) $script:PanelFrameSourceFile
    if (-not (Test-Path -LiteralPath $jsPath -PathType Leaf)) {
        Stop-Fail "浮层面板 JS 源缺失：'$jsPath'（工单 30 产出）"
    }
    $jsFile = Read-CssSourceFile -Path $jsPath -What "浮层面板 JS 源 '$($script:PanelFrameSourceFile)'"
    if (-not $jsFile.Text.Contains($script:PanelFrameFeature)) {
        Stop-Fail "浮层面板 JS 源 '$jsPath' 不含特征串 '$($script:PanelFrameFeature)' —— 文件与脚本约定不符"
    }

    # 多个主题共用同一个 lib/theme.js：每份 JS 块必须有**自己的标记行**，
    # 否则后贴的会裁掉先贴的。标记 = 基础标记 + 主题 id（首个主题保留原标记，
    # 以保证月满庭已贴入的结果逐字节不变）。
    $marker = Get-PanelFrameMarker -ThemeId $ThemeId

    return [pscustomobject]@{
        CssPath     = $cssPath
        CssSha256   = $cssFile.Sha256
        CssBytes    = $cssFile.Bytes.Length
        CssText     = $cssFile.Text
        JsPath      = $jsPath
        JsSha256    = $jsFile.Sha256
        JsBytes     = $jsFile.Bytes.Length
        JsText      = $jsFile.Text
        Marker      = $marker
        ThemeId     = $ThemeId
    }
}

<#
    每个主题的取景框 JS 块标记行。
    首个主题（hana-moonlit-court）用**原来的标记**（"/* hana-panel-frame */"），
    保证它已贴入的结果不变；其余主题用 "/* hana-panel-frame:<主题 id> */"。

    ⚠️ 主题 id 必须写在注释**内部**：早先写成 "/* hana-panel-frame */ [id]"，
    那样后者的文本会以前者开头，按裸串计数时基础标记会被数成 2 次
    （2026-10-18 真机贴入时就是这报错）。
    单主题时只返回原标记，行为与旧版逐字节相同。
#>
function Get-PanelFrameMarker {
    param([string]$ThemeId = $null)

    $primaryId = 'hana-moonlit-court'
    if ([string]::IsNullOrEmpty($ThemeId) -or $ThemeId -eq $primaryId) {
        return $script:PanelFrameMarker
    }
    return ('/* hana-panel-frame:' + $ThemeId + ' */')
}

<#
    预演：把浮层面板 JS 追加到 renderer 树 lib/theme.js 的末尾（纯内存，不写盘）。

    为什么是「追加到末尾」而不是「插到 IIFE 里」：
      theme.js 是一个自执行 IIFE，末尾之后是 sourceMappingURL 注释行。追加在注释之后
      就落在 IIFE 之外，是一个独立的 IIFE —— 不依赖主 IIFE 的任何内部变量，
      也不需要把内容塞进 minified 代码中间（那样锚点很难稳）。

    干净状态只有两种，其余一律报错中止（不猜、不静默跳过）：
      * appended —— 文件里已有标记行：把标记**及其之后**的内容整体裁掉再重新追加
                    （幂等：源文件变了也能重贴；不产生第二份）。
      * plain    —— 文件里没有标记行：直接在末尾追加。
      半改状态（有特征串但没有标记行）显式报错，提示先跑 restore.ps1。
#>
function Resolve-PanelFramePlan {
    param(
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][string]$JsText,
        [Parameter(Mandatory)][string]$BaseText,
        [string]$Marker = $null
    )

    $label = 'renderer lib/theme.js（浮层面板取景框 JS）'
    # 2026-10-18：标记行按主题区分，多个主题的 JS 块才能共存、各自幂等。
    $marker = if ($Marker) { $Marker } else { $script:PanelFrameMarker }
    $markerHits = Get-OccurrenceCount -Text $BaseText -Needle $marker
    $featureHits = Get-OccurrenceCount -Text $BaseText -Needle $script:PanelFrameFeature

    # 幂等/半改判定的锚是**标记行**（它在源里唯一）；特征串只用来在无标记时报「半改」。
    # 注意特征串在 JS 源里可能出现**多次**（守卫 + 赋值），所以不能断言它「命中 1 次」；
    # 真正要断的是「整段 JS 源在结果里恰好出现 1 次」（见下面的改后断言）。
    #
    # 2026-10-18（多主题）：判定必须基于**基础标记**（不带主题后缀）——
    # 否则第二个主题会把「已有其它主题的块」误判成半改状态。
    $baseMarkerHits = Get-OccurrenceCount -Text $BaseText -Needle $script:PanelFrameMarker
    if ($markerHits -eq 0 -and $featureHits -ne 0 -and $baseMarkerHits -eq 0) {
        Stop-Fail ("$label：文件里有特征串 '$($script:PanelFrameFeature)' 但没有任何面板标记行 —— " +
            '半改状态（可能是手工改过），请先跑 scripts/restore.ps1 回到原样再重贴。')
    }
    if ($markerHits -gt 1) {
        Stop-Fail "$label：标记行 '$marker' 命中 $markerHits 次（要求 0 或 1）—— 请先跑 scripts/restore.ps1"
    }

    # 基准文本 = 步骤 10b 预演出的 theme.js 改后文本（注册表 patch + 版本常量已应用）。
    # 读盘只用于取备份所需的「改动前 sha256 / 字节数」（备份发生在任何写入之前）。
    $disk = Read-Utf8File -Path $TargetPath
    $base = [pscustomobject]@{ Text = $BaseText; Sha256 = $disk.Sha256; Bytes = $disk.Bytes.Length }

    # 追加块：换行 + 标记行 + 换行 + JS 源（保证与前后行分隔）。
    # 标记行用 /* */ 注释形式，JS 里合法，也便于 grep。
    $block = "`n$marker`n$JsText"

    # 去掉末尾追加块后的「前缀」。两种状态都先算出基准文本的前缀，供往返断言用。
    #   appended —— 基准文本里已含旧块（上一次贴的）：从标记行前的那个换行开始裁
    #   plain    —— 基准文本本来就没块：只是去掉末尾多余换行
    $state = if ($markerHits -eq 1) { 'appended' } else { 'plain' }
    $baseTrim = $base.Text
    if ($state -eq 'appended') {
        $bIdx = $baseTrim.IndexOf($marker, [StringComparison]::Ordinal)
        if ($bIdx -gt 0 -and $baseTrim[$bIdx - 1] -eq "`n") { $bIdx-- }
        $baseTrim = $baseTrim.Substring(0, $bIdx)
    }
    elseif ($baseTrim.EndsWith("`n")) {
        $baseTrim = $baseTrim.Substring(0, $baseTrim.Length - 1)
    }

    $newText = $baseTrim + $block

    # ---- 改后断言（内存里，落盘前先证明「能成功」）----
    if ((Get-OccurrenceCount -Text $newText -Needle $marker) -ne 1) {
        Stop-Fail "$label：改后标记行命中数不为 1 —— 内部错误"
    }
    # 整段 JS 源必须恰好出现 1 次（这才是「追加了、且只追加了一份」的硬证据）。
    if ((Get-OccurrenceCount -Text $newText -Needle $JsText) -ne 1) {
        Stop-Fail "$label：改后整段 JS 源命中数不为 1 —— 内部错误"
    }
    # 关键：改后文本 = 前缀 + 块，且前缀逐字节等于基准文本去块后的前缀。
    # 这证明改动只发生在末尾那一段，其余内容一字未动。
    $roundTrip = $newText.Substring(0, $newText.Length - $block.Length)
    if ($roundTrip -cne $baseTrim) {
        Stop-Fail "$label：裁掉追加块后无法逐字节还原成原文本 —— 改动波及了其它内容，已中止"
    }

    return [pscustomobject]@{
        Label        = $label
        Tree         = 'renderer'
        Rel          = 'lib/theme.js'
        Path         = $TargetPath
        Action       = if ($state -eq 'appended') { 'rewrite' } else { 'append' }
        State        = $state
        Marker       = $marker
        JsPath       = $null
        JsSha256     = $null
        OldText      = $base.Text
        NewText      = $newText
        Sha256Before = $base.Sha256
        BytesBefore  = $base.Bytes
        Sha256After  = Get-BytesSha256 ($script:Utf8NoBom.GetBytes($newText))
        BytesAfter   = $script:Utf8NoBom.GetByteCount($newText)
    }
}

# ============================================================================
# 独立文档的主题 <link>（工单 36-B）预演（纯内存，不写盘）
# ============================================================================

<#
    预演：把 renderer 树里没有 #themeSheet 的两个 html（browser-viewer.html /
    viewer-window.html）的写死 warm-paper <link> 换成当前主题的 <link id="themeSheet">。

    干净状态只有两种，其余一律报错中止（不猜、不静默跳过）：
      * plain  —— 文档里恰好有 1 处「assets/warm-paper-*.css」的 <link>，且没有 id="themeSheet"：
                  把整段 link 换成目标 link。
      * posted —— 文档里恰好有 1 处 id="themeSheet" 的 <link>，且没有 warm-paper 引用：
                  若 href 与本次要写的逐字相同 -> skip-no-change（幂等，不重写文件）；
                  不同（主题改名 / 版本串变化）-> 重写该 link。
      半改状态（既没有 warm-paper 引用、也没有 #themeSheet）显式报错，提示先跑 restore.ps1。

    为什么版本串由调用方给出（不在这里另算）：必须与步骤 10b 用**同一个** $script:ThemeCacheBustVersion
    （= renderer 树合成后主题 CSS 的 sha256 前 16 位），否则皮肤一升级，html 里的 ?v=
    与 theme.js 里的 HANA_SKIN_CSS_V 就会对不上，theme.js 的快路径比较失效。
#>
function Resolve-ThemeLinkPlan {
    param(
        [Parameter(Mandatory)][string]$TargetPath,
        [Parameter(Mandatory)][string]$Rel,
        [Parameter(Mandatory)][string]$Display,
        [Parameter(Mandatory)][string]$ThemeFile,
        [string]$CacheBustQuery
    )

    $label = "renderer $Rel（独立文档主题 link）"
    if ([string]::IsNullOrWhiteSpace($ThemeFile)) { Stop-Fail "$label：主题 CSS 文件名为空 —— 内部错误" }
    if (-not [string]::IsNullOrWhiteSpace($CacheBustQuery) -and $CacheBustQuery -notmatch '^\?v=[0-9a-f]{16}$') {
        Stop-Fail "$label：版本查询串 '$CacheBustQuery' 不是 '?v=' + 16 位小写十六进制 —— 内部错误"
    }
    $query = if ([string]::IsNullOrWhiteSpace($CacheBustQuery)) { '' } else { $CacheBustQuery }
    $targetHref = "themes/$ThemeFile$query"
    $targetLink = ('<link rel="stylesheet" crossorigin href="{0}" id="{1}">' -f $targetHref, $script:ThemeLinkId)

    $disk = Read-Utf8File -Path $TargetPath
    $text = $disk.Text

    # --- 改前计数（三把尺子：warm-paper 引用 / 已贴的 #themeSheet / 我们的主题 href）---
    $pattern = $script:ThemeLinkPattern
    $rawHits = [regex]::Matches($text, $pattern)
    $rawCount = $rawHits.Count
    $warmCount = Get-OccurrenceCount -Text $text -Needle 'assets/warm-paper-'
    $sheetIdCount = Get-OccurrenceCount -Text $text -Needle ('id="' + $script:ThemeLinkId + '"')
    # posted 探针 = **整段** <link ... id="themeSheet" ...>（见常量处注释：不能用 'href="themes/' 前缀，
    # 官方自有的 <link href="themes/continuous-corners.css"> 会被一起数进来）
    $postedHits = [regex]::Matches($text, $script:ThemeLinkPostedPattern)
    $postedCount = $postedHits.Count
    # 参考量（不参与判定）：既带 themes/<本主题> 又是整段 link
    $themeHrefCount = [regex]::Matches($text, ('<link\b[^>]*\bhref="themes/' + [regex]::Escape($ThemeFile))).Count

    $state = $null
    if ($rawCount -eq 1 -and $warmCount -eq 1 -and $sheetIdCount -eq 0 -and $postedCount -eq 0) { $state = 'plain' }
    elseif ($rawCount -eq 0 -and $warmCount -eq 0 -and $sheetIdCount -eq 1 -and $postedCount -eq 1) { $state = 'posted' }
    $patternNote = if ($rawCount -gt 0) { [string]$rawHits[0].Value } else { '(未命中)' }

    if ($null -eq $state) {
        $idNeedle = 'id="' + $script:ThemeLinkId + '"'
        $detail = @(
            "  整段 warm-paper <link> 正则命中 $rawCount 次（期望：plain 时 1 次）  实测片段：$patternNote"
            "  裸串 'assets/warm-paper-' 命中 $warmCount 次（期望：plain 时 1 次、posted 时 0 次）"
            "  串 '$idNeedle' 命中 $sheetIdCount 次（期望：plain 时 0 次、posted 时 1 次）"
            "  整段 '<link ... id=`"$($script:ThemeLinkId)`" ...>' 命中 $postedCount 次（期望：plain 时 0 次、posted 时 1 次）"
            "  （参考）'<link ... href=`"themes/$ThemeFile' 命中 $themeHrefCount 次；官方自有的 themes/continuous-corners.css 不计入上述探针"
        )
        Stop-Fail ("$label：无法判定为 plain 或 posted 这两种干净状态" +
            "（疑似半改状态：请先跑 scripts/restore.ps1 回到原样，再重新 -Apply；不要手工改 html）$([Environment]::NewLine)" +
            ($detail -join [Environment]::NewLine))
    }

    if ($state -eq 'posted') {
        # 已是 posted：整段正则抠出当前 <link ... id="themeSheet" ...>，与目标逐字比对
        $currentLink = [string]$postedHits[0].Value
        $openIdx = $postedHits[0].Index
        $closeIdx = $openIdx + $currentLink.Length - 1

        if ($currentLink -ceq $targetLink) {
            return [pscustomobject]@{
                Label        = $label
                Tree         = 'renderer'
                Rel          = $Rel
                Display      = $Display
                Path         = $TargetPath
                Action       = 'skip-no-change'
                State        = $state
                ThemeFile    = $ThemeFile
                CacheBust    = $CacheBustQuery
                TargetHref   = $targetHref
                TargetLink   = $targetLink
                OldLink      = $currentLink
                LinkCount    = 0
                WarmCountBefore = $warmCount
                WarmCountAfter  = 0
                SheetIdBefore   = $sheetIdCount
                SheetIdAfter    = 1
                RegexBefore  = $rawCount
                OldText      = $text
                NewText      = $text
                Sha256Before = $disk.Sha256
                BytesBefore  = $disk.Bytes.Length
                Sha256After  = $disk.Sha256
                BytesAfter   = $disk.Bytes.Length
            }
        }

        # 主题改名 / 版本串变化：只重写这一段 link，其余逐字不动
        $newText = $text.Substring(0, $openIdx) + $targetLink + $text.Substring($closeIdx + 1)
        $oldLink = $currentLink
    }
    else {
        # plain：整段替换（只替换匹配到的那一段，不做全局替换）
        $oldLink = [string]$rawHits[0].Value
        $newText = [regex]::Replace($text, $pattern, { param($m) $targetLink }, 1)
    }

    # ---- 改后断言（内存里，落盘前先证明"能成功"）----
    if ($text -ceq $newText) {
        Stop-Fail "$label：改后文本与改前逐字相同 —— 替换没有生效（内部错误）"
    }
    if ((Get-OccurrenceCount -Text $newText -Needle 'assets/warm-paper-') -ne 0) {
        Stop-Fail "$label：改后仍残留 'assets/warm-paper-' 引用 —— 替换不干净，已中止"
    }
    if ((Get-OccurrenceCount -Text $newText -Needle $targetLink) -ne 1) {
        Stop-Fail "$label：改后目标 link 命中数不为 1（要求恰好 1 次）—— 已中止"
    }
    if ((Get-OccurrenceCount -Text $newText -Needle ('id="' + $script:ThemeLinkId + '"')) -ne 1) {
        Stop-Fail "$label：改后 id=`"$($script:ThemeLinkId)`" 命中数不为 1（要求恰好 1 次）—— 已中止"
    }
    if ([regex]::Matches($newText, $pattern).Count -ne 0) {
        Stop-Fail "$label：改后整段 warm-paper <link> 正则仍有命中 —— 替换不干净，已中止"
    }
    # 往返证明：把目标 link 换回改前那一段，必须逐字节还原成原文件。
    # 这证明改动只发生在这一处，其余内容一字未动（含文档的 LF 行尾与缩进）。
    $tIdx = $newText.IndexOf($targetLink, [StringComparison]::Ordinal)
    $roundTrip = $newText.Substring(0, $tIdx) + $oldLink + $newText.Substring($tIdx + $targetLink.Length)
    if ($roundTrip -cne $text) {
        Stop-Fail ("$label：改后文本无法逐字节还原成原文件 —— 改动波及了这一处 link 之外的内容，已中止" +
            "（请先跑 scripts/restore.ps1 回到原样）")
    }

    return [pscustomobject]@{
        Label        = $label
        Tree         = 'renderer'
        Rel          = $Rel
        Display      = $Display
        Path         = $TargetPath
        Action       = 'replace-theme-link'
        State        = $state
        ThemeFile    = $ThemeFile
        CacheBust    = $CacheBustQuery
        TargetHref   = $targetHref
        TargetLink   = $targetLink
        OldLink      = $oldLink
        LinkCount    = 1
        WarmCountBefore = $warmCount
        WarmCountAfter  = 0
        SheetIdBefore   = $sheetIdCount
        SheetIdAfter    = 1
        RegexBefore  = $rawCount
        OldText      = $text
        NewText      = $newText
        Sha256Before = $disk.Sha256
        BytesBefore  = $disk.Bytes.Length
        Sha256After  = Get-BytesSha256 ($script:Utf8NoBom.GetBytes($newText))
        BytesAfter   = $script:Utf8NoBom.GetByteCount($newText)
    }
}

# ============================================================================
# 主流程
# ============================================================================

$isDryRun = -not $Apply
$modeText = if ($isDryRun) { 'DRY-RUN（默认；不写入任何文件。要真正贴入请加 -Apply）' } else { 'APPLY（已显式确认，将写入并先备份）' }

try {
    Write-Head "hana-skin apply.ps1（月满庭 / 极光 / Deepsleep）—— $modeText"

    # ------------------------------------------------------------------
    # 0. 解析仓库路径与依赖文件
    # ------------------------------------------------------------------
    if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
        $RepoRoot = Split-Path -Parent $PSScriptRoot
    }
    $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
    # 备份根：显式传参 > 环境变量 > <RepoRoot>/backups（旧行为）
    $backupRootSource = '默认（<RepoRoot>/backups）'
    if (-not [string]::IsNullOrWhiteSpace($BackupRoot)) {
        $backupRootSource = '-BackupRoot 参数'
    }
    elseif (-not [string]::IsNullOrWhiteSpace($env:HANA_SKIN_BACKUP_ROOT)) {
        $BackupRoot = $env:HANA_SKIN_BACKUP_ROOT
        $backupRootSource = '环境变量 HANA_SKIN_BACKUP_ROOT'
    }
    else {
        $BackupRoot = Join-Path $RepoRoot 'backups'
    }
    if ([string]::IsNullOrWhiteSpace($SkinJson)) { $SkinJson = Join-Path $RepoRoot 'skin.json' }
    $script:SkinJsonPath = $SkinJson

    Write-Log "[0] 仓库根：$RepoRoot"
    Write-Log "      备份根：$BackupRoot（来源：$backupRootSource）"

    # ------------------------------------------------------------------
    # 0a. 档位继承（工单 18）
    #
    # $Material / $Background 的参数默认值是 'none'，它的本意是"本次没说"，
    # 但 PowerShell 区分不了"没传"与"传了 none"（除非看 $PSBoundParameters）。
    # 1.0.16 重贴时就踩了这个：默认 none 被当成"要 none"，于是上一版挂着的
    # 深色背景图与右侧工作区透明规则被静默抹掉，界面上看起来就像"效果丢了"。
    #
    # 规则：未显式传参时，沿用 skin.json 记录的上次档位；显式传参则一律按传的来，
    # 并在与记录不同时打印提醒。
    # 注意：没有可继承的东西时不打印任何内容，以保证首次贴入 / dry-run 的输出格式不变。
    # ------------------------------------------------------------------
    $tierRecord = Get-PreviousTierRecord -Path $SkinJson
    $inheritMaterial = -not $PSBoundParameters.ContainsKey('Material')
    $inheritBackground = -not $PSBoundParameters.ContainsKey('Background')
    $inheritBust = -not $PSBoundParameters.ContainsKey('ThemeCacheBust')
    $inheritedNotes = @()

    if ($null -ne $tierRecord) {
        $prevAt = if ([string]::IsNullOrWhiteSpace($tierRecord.AppliedAtLocal)) { '(未记录时间)' } else { $tierRecord.AppliedAtLocal }

        foreach ($spec in @(
                [pscustomobject]@{ Name = 'Material'; Flag = '-Material'; Legal = @('none', 'subtle', 'bold'); Prev = $tierRecord.Material; Now = $Material; Inherit = $inheritMaterial }
                [pscustomobject]@{ Name = 'Background'; Flag = '-Background'; Legal = @('none', 'dark'); Prev = $tierRecord.Background; Now = $Background; Inherit = $inheritBackground }
            )) {
            # 记录里没有该档位 / 是不认识的档位（例如手工改过 skin.json）：不继承，也不啃声
            if ([string]::IsNullOrWhiteSpace($spec.Prev)) { continue }
            $prevVal = $spec.Prev.ToLowerInvariant()
            if ($spec.Legal -notcontains $prevVal) { continue }

            if ($spec.Inherit) {
                if ($prevVal -cne $spec.Now.ToLowerInvariant()) {
                    if ($spec.Name -ceq 'Material') { $Material = $prevVal } else { $Background = $prevVal }
                    $inheritedNotes += "$($spec.Flag) $prevVal"
                }
            }
            elseif ($prevVal -cne $spec.Now.ToLowerInvariant()) {
                Write-Log "[0] 提醒：skin.json（$prevAt 贴入）记录 $($spec.Flag) $prevVal，本次显式传了 $($spec.Flag) $($spec.Now) —— 按本次的来，会改变现有合成结果。"
            }
        }

        # 缓存绕过：skin.json 里记的是版本串，有串 = 上次开了，为空 = 上次关了
        $prevBustMode = if ([string]::IsNullOrWhiteSpace([string]$tierRecord.ThemeCacheBust)) { 'none' } else { 'on' }
        if ($inheritBust) {
            if ($prevBustMode -cne $ThemeCacheBust.ToLowerInvariant()) {
                $ThemeCacheBust = $prevBustMode
                $inheritedNotes += "-ThemeCacheBust $prevBustMode"
            }
        }
        elseif ($prevBustMode -cne $ThemeCacheBust.ToLowerInvariant()) {
            Write-Log "[0] 提醒：skin.json（$prevAt 贴入）记录 -ThemeCacheBust $prevBustMode，本次显式传了 $ThemeCacheBust —— 按本次的来。"
        }

        if ($inheritedNotes.Count -gt 0) {
            Write-Log "[0] 未显式指定，沿用 skin.json 上次贴入（$prevAt）的档位：$($inheritedNotes -join '  ')"
            Write-Log '      要改变它，显式传参即可（例如 -Background none）；只传其中一项时，其余仍沿用记录。'
        }
    }

    $srcDir = Join-Path $RepoRoot 'src'
    $patchDir = Join-Path $RepoRoot 'patches'
    $localePatchDir = Join-Path $patchDir 'locales'

    foreach ($t in $script:ThemeDefs) {
        $p = Join-Path $srcDir $t.File
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Stop-Fail "源 CSS 缺失：'$p'（工单 02 产出）" }
        Add-Member -InputObject $t -MemberType NoteProperty -Name SourcePath -Value $p -Force
        $srcFile = Read-CssSourceFile -Path $p -What "配色源 '$($t.File)'"
        Add-Member -InputObject $t -MemberType NoteProperty -Name SourceSha256 -Value $srcFile.Sha256 -Force
        Add-Member -InputObject $t -MemberType NoteProperty -Name SourceBytes -Value $srcFile.Bytes.Length -Force
        Add-Member -InputObject $t -MemberType NoteProperty -Name SourceText -Value $srcFile.Text -Force
    }

    # --- App 面材质源（工单 41）---
    # 与 -Material / -Background **不同**：它不受档位参数控制 —— src/app-surface/ 目录里
    # 有几份 *.css 就贴几份（按文件名字典序），目录为空 / 不存在 = 不合成，行为与今天
    # 逐字节相同（验收标准第 1 条）。故这里也不加任何档位参数。
    #
    # 为什么必须**在材质段之前**读：材质段那句"server 树只写配色源 / 不贴材质档位源"要按
    # 本变量分支（本变量为 $null 时逐字保留原文），否则 src/app-surface/ 为空时 dry-run
    # 输出会变 —— 那就违反验收标准第 1 条。
    $script:AppSurfaceSources = Read-AppSurfaceSources -SrcDir $srcDir
    if ($null -ne $script:AppSurfaceSources) {
        # 落盘回读要用到的基线：配色源自带的 'data:image' 处数（--select-arrow 的 SVG 图标，
        # 与背景无关）。断言"合成后的处数 == 这个基线"，才能证明 App 面材质源没引入图片。
        $script:AppSurfaceDataImageBaseline = 0
        foreach ($t in $script:ThemeDefs) {
            $b = Get-OccurrenceCount -Text $t.SourceText -Needle 'data:image'
            if ($b -gt $script:AppSurfaceDataImageBaseline) { $script:AppSurfaceDataImageBaseline = $b }
        }
        Write-Log "[0] App 面材质源（src/$($script:AppSurfaceDir)/）：$($script:AppSurfaceSources.Count) 份"
        foreach ($item in $script:AppSurfaceSources.Items) {
            Write-Log "      $($item.Rel)  sha256=$($item.Sha256)  bytes=$($item.Bytes)"
        }
        Write-Log '      合成规则：**server 树** themes/*.css = 配色源 + 换行 + App 面材质源（字典序，每份之间一个换行）'
        Write-Log '                renderer 树不受影响（配色源 + [材质源] + [背景源] + [面板源]，规则不变）'
        Write-Log "      特征串 '$($script:AppSurfaceFeature)' 逐份命中；源内禁止 data-theme= 字面量与 data:image（已断言）"
        Write-Log "      落盘回读断言：合成文件里 '$($script:AppSurfaceFeature)' >= 1 处、每份源整段各 1 处、data:image 处数 == 配色源基线 $($script:AppSurfaceDataImageBaseline)（配色源自带 1 处 SVG 图标）"
    }
    # 注意：src/app-surface/ 为空时**不打印任何 App 面相关内容**，也不改动任何输出格式。

    # --- 材质源（第二期 · 工单 08）---
    # 档位非法时**不静默降级**：ValidateSet 已拦住命令行传入的非法值，这里再兜一次
    # （例如通过 splatting / 直接给变量赋值绕过绑定），确保绝不出现"要 subtle 却贴了纯配色"。
    $materialTiers = @('none', 'subtle', 'bold')
    if ($materialTiers -notcontains $Material) {
        Stop-Fail "-Material 档位非法：'$Material'（合法值：$($materialTiers -join ' / ')）"
    }
    # 归一化小写：PowerShell 的 ValidateSet / -notcontains 都是大小写不敏感的，所以
    # -Material SUBTLE 能通过校验；但 skin.json 要记录**规范档位名**与**实际源路径**，
    # 不能把用户输入的原样大小写写进去（否则路径 src/material/SUBTLE.css 只是"碰巧"
    # 在 Windows 上命中，跨平台/审计都会失真）。
    $Material = $Material.ToLowerInvariant()
    $script:MaterialTier = $Material

    # 2026-10-18：材质 / 背景 / 取景框三类源都改为**按主题**读取。
    # 每个主题把自己的源挂在 $Theme.MaterialSource / $Theme.BackgroundSource / $Theme.PanelFrameSources 上，
    # 合成时按主题取，互不引用（用户要求：极光独立于月满庭）。
    # 月满庭那三项仍指回它原来的目录，因此它的合成结果应当逐字节不变。
    foreach ($t in $script:ThemeDefs) {
        Add-Member -InputObject $t -MemberType NoteProperty -Name MaterialSource -Value $null -Force
        Add-Member -InputObject $t -MemberType NoteProperty -Name BackgroundSource -Value $null -Force
        Add-Member -InputObject $t -MemberType NoteProperty -Name PanelFrameSources -Value $null -Force
    }

    if ($Material -ne 'none') {
        foreach ($t in $script:ThemeDefs) {
            $tMaterialDir = if ($t.PSObject.Properties['MaterialDir'] -and $t.MaterialDir) { $t.MaterialDir } else { $script:MaterialDir }
            $materialPath = Join-Path (Join-Path $srcDir $tMaterialDir) "$Material.css"
            if (-not (Test-Path -LiteralPath $materialPath -PathType Leaf)) {
                Stop-Fail ("-Material $Material 需要材质源，但文件不存在：'$materialPath'（主题 '$($t.Id)'）。" +
                    "请先交付该主题该档位的材质源，或用 -Material none 贴纯配色（不静默降级）。")
            }
            $materialFile = Read-CssSourceFile -Path $materialPath -What "材质源 '$Material'（主题 $($t.Id)）"
            Add-Member -InputObject $t -MemberType NoteProperty -Name MaterialSource -Force -Value ([pscustomobject]@{
                    Path   = $materialPath
                    Sha256 = $materialFile.Sha256
                    Bytes  = $materialFile.Bytes.Length
                    Text   = $materialFile.Text
                })
            Write-Log "[0] 材质档位：$Material（主题 $($t.Id) 材质源：$materialPath）"
            Write-Log "      材质源 sha256：$($materialFile.Sha256)"
        }
        # server 树那一半如实写：没有 App 面材质源时它与工单 08 时逐字相同（"只写配色源"），
        # 有 App 面材质源时才改口径 —— 保证 src/app-surface/ 为空时 dry-run 输出逐字节不变。
        if ($null -eq $script:AppSurfaceSources) {
            Write-Log '      合成规则：renderer 树 themes/*.css = 配色源 + 换行 + 材质源；server 树只写配色源'
        }
        else {
            Write-Log '      合成规则：renderer 树 themes/*.css = 配色源 + 换行 + 材质源；server 树不贴材质档位源（改为贴 src/app-surface/*.css）'
        }
    }
    # 注意：-Material none 时**不打印任何材质相关内容**，也不改动任何输出格式。

    # --- 背景源（第二期 · 工单 14）---
    # 与 -Material 同样：档位非法不静默降级（ValidateSet 已拦命令行，这里再兜一次），
    # 背景源缺失 / 图片缺失都显式报错非零退出。
    $backgroundTiers = @('none', 'dark')
    if ($backgroundTiers -notcontains $Background) {
        Stop-Fail "-Background 档位非法：'$Background'（合法值：$($backgroundTiers -join ' / ')）"
    }
    $Background = $Background.ToLowerInvariant()
    $script:BackgroundTier = $Background

    if ($Background -ne 'none') {
        foreach ($t in $script:ThemeDefs) {
            # HasBackground = $false 的主题不参与背景层（也就没有取景框）
            $hasBg = if ($t.PSObject.Properties['HasBackground']) { [bool]$t.HasBackground } else { $true }
            if (-not $hasBg) { continue }

            $tBgDir = if ($t.PSObject.Properties['BackgroundDir'] -and $t.BackgroundDir) { $t.BackgroundDir } else { $script:BackgroundDir }
            $bgPath = Join-Path (Join-Path $srcDir $tBgDir) "$Background.css"
            if (-not (Test-Path -LiteralPath $bgPath -PathType Leaf)) {
                Stop-Fail ("-Background $Background 需要背景源，但文件不存在：'$bgPath'（主题 '$($t.Id)'）。" +
                    '请先交付该主题该档位的背景源，或用 -Background none 贴纯配色（不静默降级）。')
            }
            $bgFile = Read-CssSourceFile -Path $bgPath -What "背景源 '$Background'（主题 $($t.Id)）"

            # 图片：必须是 PNG（data URI 的 MIME 写死 image/png）。
            $assetRel = if ($t.PSObject.Properties['BackgroundAsset'] -and $t.BackgroundAsset) { $t.BackgroundAsset } else { $script:BackgroundDarkAsset }
            $assetSub = $assetRel -replace '/', '\'
            $assetPath = Join-Path (Join-Path $srcDir $tBgDir) $assetSub
            if (-not (Test-Path -LiteralPath $assetPath -PathType Leaf)) {
                Stop-Fail "-Background $Background 需要背景图，但文件不存在：'$assetPath'（主题 $($t.Id)，不静默降级）"
            }
            $assetBytes = [System.IO.File]::ReadAllBytes($assetPath)
            if ($assetBytes.Length -lt 8 -or
                $assetBytes[0] -ne 0x89 -or $assetBytes[1] -ne 0x50 -or
                $assetBytes[2] -ne 0x4E -or $assetBytes[3] -ne 0x47) {
                Stop-Fail "背景图不是 PNG（magic 不符）：'$assetPath'"
            }
            $dataUri = 'data:image/png;base64,' + [Convert]::ToBase64String($assetBytes)
            $bgSourceText = Expand-BackgroundTemplate -TemplateText $bgFile.Text -DataUri $dataUri -What "背景源 '$Background'（主题 $($t.Id)）"

            Add-Member -InputObject $t -MemberType NoteProperty -Name BackgroundSource -Force -Value ([pscustomobject]@{
                    Path           = $bgPath
                    Sha256         = $bgFile.Sha256
                    Text           = $bgSourceText
                    AssetPath      = $assetPath
                    AssetSha256    = (Get-BytesSha256 $assetBytes)
                    AssetBytes     = $assetBytes.Length
                    DataUriSha256  = (Get-BytesSha256 ($script:Utf8NoBom.GetBytes($dataUri)))
                })

            Write-Log "[0] 背景档位：$Background（主题 $($t.Id) 背景源：$bgPath）"
            Write-Log "      背景源 sha256：$($bgFile.Sha256)"
            Write-Log "      背景图：$assetPath"
            Write-Log "      背景图 sha256：$((Get-BytesSha256 $assetBytes))  bytes=$($assetBytes.Length)"
            Write-Log "      占位符 '$($script:BackgroundDarkPlaceholder)' 命中 1 次，已替换为 data:image/png;base64,<...>"
        }
        Write-Log '      合成规则：renderer 树**深色**主题 = 配色源 + [材质源] + 背景源；server 树不含背景'
    }
    # 注意：-Background none 时**不打印任何背景相关内容**，也不改动任何输出格式。

    # --- 浮层面板取景框（工单 30）---
    # 与 -Background 同档：有背景源才谈面板（面板的图从 [data-chalkboard-root] 搬来）。
    # 故只在 Background 非 none 时加载；-Background none 时不加载、不打印、不合成。
    if ($Background -ne 'none') {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.BackgroundSource) { continue }
            $tPanelDir = if ($t.PSObject.Properties['PanelFrameDir'] -and $t.PanelFrameDir) { $t.PanelFrameDir } else { $script:PanelFrameDir }
            $pf = Read-PanelFrameSources -SrcDir $srcDir -DirName $tPanelDir -ThemeId $t.Id
            Add-Member -InputObject $t -MemberType NoteProperty -Name PanelFrameSources -Force -Value $pf
            Write-Log "[0] 浮层面板取景框（主题 $($t.Id)）：$($pf.CssPath)"
            Write-Log "      面板 CSS 源 sha256：$($pf.CssSha256)"
            Write-Log "      面板 JS 源：$($pf.JsPath)  sha256：$($pf.JsSha256)"
        }
        Write-Log '      合成规则：renderer 树主题 CSS 末尾再拼面板 CSS；lib/theme.js 末尾追加面板 JS'
    }

    # --- 主题 CSS 版本参数（第二期 · 工单 16）---
    # 同 -Material / -Background：档位非法不静默降级（ValidateSet 已拦命令行，这里再兜一次）。
    # 归一化小写：PowerShell 的 ValidateSet / -notcontains 都是大小写不敏感的，
    # 但皮肤版本串会被写进 theme.js 与 skin.json，必须是规范值。
    if ($script:ThemeCacheBustModes -notcontains $ThemeCacheBust) {
        Stop-Fail "-ThemeCacheBust 档位非法：'$ThemeCacheBust'（合法值：$($script:ThemeCacheBustModes -join ' / ')）"
    }
    $ThemeCacheBust = $ThemeCacheBust.ToLowerInvariant()
    $script:ThemeCacheBustMode = $ThemeCacheBust

    foreach ($rp in $script:RegistryPatchFiles) {
        $p = Join-Path $patchDir $rp.Patch
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Stop-Fail "patch 缺失：'$p'（工单 03 产出）" }
    }
    $cardPatchPath0 = Join-Path $patchDir $script:CardPreviewPatchFile
    if (-not (Test-Path -LiteralPath $cardPatchPath0 -PathType Leaf)) { Stop-Fail "patch 缺失：'$cardPatchPath0'（主题卡片预览配色）" }
    $palettePatchPath = Join-Path $patchDir $script:CardPalettePatchFile
    if (-not (Test-Path -LiteralPath $palettePatchPath -PathType Leaf)) { Stop-Fail "patch 缺失：'$palettePatchPath'（卡片调色板）" }
    foreach ($loc in $script:Locales) {
        $p = Join-Path $localePatchDir "$loc.patch.json"
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { Stop-Fail "locale 片段缺失：'$p'（工单 04 产出）" }
    }

    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($null -eq $nodeCmd) {
        Stop-Fail 'PATH 中找不到 node —— 三处注册表的"主题数 == 12"断言需要 node 真求值，无法降级'
    }
    Write-Log "      node：$($nodeCmd.Source)"

    # ------------------------------------------------------------------
    # 1. 定位两个版本目录
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[1] 定位 renderer / server 版本目录'

    $rendererVersion = ''
    $serverVersion = ''
    $usedLocate = $false

    if (-not [string]::IsNullOrWhiteSpace($RendererDir) -and -not [string]::IsNullOrWhiteSpace($ServerDir)) {
        Write-Log '      两个目录均由 -RendererDir / -ServerDir 覆盖，跳过 locate.ps1（不改动真实安装）'
    }
    else {
        $locateScript = Join-Path $PSScriptRoot 'locate.ps1'
        if (-not (Test-Path -LiteralPath $locateScript -PathType Leaf)) { Stop-Fail "locate.ps1 缺失：'$locateScript'" }
        Write-Log "      调用 locate.ps1（TargetJson = $TargetJson）"
        $locateResult = & $locateScript -TargetJson $TargetJson
        if ($null -eq $locateResult) { Stop-Fail 'locate.ps1 未返回结果' }
        $usedLocate = $true
        if ([string]::IsNullOrWhiteSpace($RendererDir)) { $RendererDir = [string]$locateResult.rendererVersionDir }
        if ([string]::IsNullOrWhiteSpace($ServerDir)) { $ServerDir = [string]$locateResult.serverVersionDir }
        $rendererVersion = [string]$locateResult.rendererVersion
        $serverVersion = [string]$locateResult.serverVersion
    }

    foreach ($pair in @(
            [pscustomobject]@{ Kind = 'renderer'; Dir = $RendererDir }
            [pscustomobject]@{ Kind = 'server'; Dir = $ServerDir }
        )) {
        $kind = $pair.Kind
        $dir = $pair.Dir
        if ([string]::IsNullOrWhiteSpace($dir)) { Stop-Fail "$kind 版本目录为空" }
        if (-not [System.IO.Path]::IsPathRooted($dir)) { Stop-Fail "$kind 版本目录不是绝对路径：'$dir'" }
        if (-not (Test-Path -LiteralPath $dir -PathType Container)) { Stop-Fail "$kind 版本目录不存在：'$dir'" }
    }
    $RendererDir = (Resolve-Path -LiteralPath $RendererDir).Path
    $ServerDir = (Resolve-Path -LiteralPath $ServerDir).Path
    Write-Log "      renderer = $RendererDir"
    Write-Log "      server   = $ServerDir"

    $versionLabel = Split-Path -Leaf $RendererDir

    # ------------------------------------------------------------------
    # 2. 校验目录与关键文件就位
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[2] 校验关键文件就位'

    $required = @(
        [pscustomobject]@{ Tree = 'renderer'; Rel = 'themes'; Type = 'Container'; Display = 'themes/ 目录' }
        [pscustomobject]@{ Tree = 'renderer'; Rel = 'lib/theme.js'; Type = 'Leaf'; Display = 'lib/theme.js' }
        [pscustomobject]@{ Tree = 'renderer'; Rel = 'assets'; Type = 'Container'; Display = 'assets/ 目录' }
        [pscustomobject]@{ Tree = 'renderer'; Rel = 'locales'; Type = 'Container'; Display = 'locales/ 目录' }
        [pscustomobject]@{ Tree = 'server'; Rel = 'bundle/index.js'; Type = 'Leaf'; Display = 'bundle/index.js' }
        [pscustomobject]@{ Tree = 'server'; Rel = 'desktop/dist-renderer/themes'; Type = 'Container'; Display = 'desktop/dist-renderer/themes/ 目录' }
    )
    $missing = @()
    foreach ($item in $required) {
        $base = if ($item.Tree -eq 'renderer') { $RendererDir } else { $ServerDir }
        $full = Join-Path $base ($item.Rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $full -PathType $item.Type)) {
            $missing += "$($item.Tree) 树缺少 $($item.Display)（期望：'$full'）"
        }
    }
    foreach ($loc in $script:Locales) {
        $full = Join-Path $RendererDir "locales\$loc.json"
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { $missing += "renderer 树缺少 locales/$loc.json（期望：'$full'）" }
    }
    if ($missing.Count -gt 0) {
        $detail = ($missing | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
        Stop-Fail "关键文件校验失败，共 $($missing.Count) 项：$([Environment]::NewLine)$detail"
    }
    Write-Log "      通过：renderer（themes/、lib/theme.js、assets/、locales/*.json）+ server（bundle/index.js、desktop/dist-renderer/themes/）"

    # ------------------------------------------------------------------
    # 3. 定位 assets/index-*.js（通配 + 内容特征）
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[3] 定位 renderer assets/index-*.js（通配 + 内容特征）'

    $bundlePatchPath = Join-Path $patchDir 'theme-registry-bundle.patch'
    $bundlePatch = Read-JsonFile -Path $bundlePatchPath -What 'patch theme-registry-bundle'
    $bundleGlob = [string](Get-RequiredProp $bundlePatch 'targetGlob' 'patch theme-registry-bundle')
    $bundleLeafGlob = Split-Path $bundleGlob -Leaf
    $bundleFeatures = @(Get-Prop $bundlePatch 'contentFeatures')
    $bundleAnchor = [string](Get-Prop $bundlePatch 'anchor')

    $assetsDir = Join-Path $RendererDir 'assets'
    $candidates = @(Get-ChildItem -LiteralPath $assetsDir -Filter $bundleLeafGlob -File)
    if ($candidates.Count -eq 0) { Stop-Fail "通配 '$bundleLeafGlob' 在 '$assetsDir' 下未命中任何文件" }

    $featureMatches = [System.Collections.Generic.List[string]]::new()
    foreach ($cand in $candidates) {
        $probe = Read-Utf8File -Path $cand.FullName
        $ok = $true
        foreach ($feat in $bundleFeatures) {
            if (-not $probe.Text.Contains([string]$feat)) { $ok = $false; break }
        }
        if ($ok -and (Get-OccurrenceCount -Text $probe.Text -Needle $bundleAnchor) -eq 1) {
            $featureMatches.Add($cand.FullName)
        }
    }
    if ($featureMatches.Count -ne 1) {
        $list = ($featureMatches | ForEach-Object { "    - $_" }) -join [Environment]::NewLine
        Stop-Fail "assets/index-*.js 内容特征命中 $($featureMatches.Count) 个（要求恰好 1 个）：$([Environment]::NewLine)$list"
    }
    $bundleFile = $featureMatches[0]
    Write-Log "      通配命中 $($candidates.Count) 个候选，内容特征 + 唯一锚点命中 1 个："
    Write-Log "      $bundleFile"

    # ------------------------------------------------------------------
    # 4. 预演：注册表三处 + i18n 五份 + CSS 四目标（纯内存）
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[4] 预演（内存中完成全部定位与断言，尚未写盘）'

    $registryPlans = [System.Collections.Generic.List[object]]::new()
    foreach ($rp in $script:RegistryPatchFiles) {
        $patchObj = Read-JsonFile -Path (Join-Path $patchDir $rp.Patch) -What "patch $($rp.Patch)"
        $targetRel = [string](Get-RequiredProp $patchObj 'target' "patch $($rp.Patch)")
        $segs = $targetRel -split '/'
        $tree = $segs[0]
        $rel = ($segs[1..($segs.Count - 1)] -join '/')
        $base = if ($tree -eq 'renderer') { $RendererDir } else { $ServerDir }

        if ($rp.Patch -eq 'theme-registry-bundle.patch') {
            # bundle 份的 target 是 glob（assets/index-*.js），实际文件已由步骤 3 定位；
            # 相对路径必须用真实文件名，否则备份/登记会写成带 * 的假路径。
            $targetPath = $bundleFile
            $rel = "assets/$(Split-Path $bundleFile -Leaf)"
        }
        else {
            $targetPath = Join-Path $base ($rel -replace '/', '\')
        }

        if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) { Stop-Fail "$($rp.Label)：目标文件不存在 '$targetPath'" }

        $plan = Resolve-RegistryPlan -PatchPath (Join-Path $patchDir $rp.Patch) -Tree $tree -TargetPath $targetPath -Label $rp.Label
        $plan.Rel = $rel
        $registryPlans.Add($plan)

        $verb = if ($plan.Action -eq 'modify') { '改' } else { '已贴过，跳过' }
        Write-Log ("      [$($rp.Label)] $verb  锚点命中 $($plan.AnchorCount) 次；主题数 $($plan.CountBefore) -> $($plan.CountAfter)")
        Write-Log ("          文件：$targetPath")
    }

    $localePlans = [System.Collections.Generic.List[object]]::new()
    # 主题显示名的改名清单（ThemeDefs 里带 LabelKey/LabelName 的项），只对已存在键生效
    $labelOverrides = @{}
    foreach ($t in $script:ThemeDefs) {
        if ($t.PSObject.Properties['Labels'] -and $null -ne $t.Labels) {
            foreach ($leaf in $t.Labels.Keys) {
                if ([string]::IsNullOrEmpty($leaf)) { continue }
                $labelOverrides[[string]$leaf] = [string]$t.Labels[$leaf]
            }
        }
    }
    foreach ($loc in $script:Locales) {
        $plan = Resolve-LocalePlan -Locale $loc -FragmentPath (Join-Path $localePatchDir "$loc.patch.json") -TargetPath (Join-Path $RendererDir "locales\$loc.json") -Overrides $labelOverrides
        $localePlans.Add($plan)
        $verb = switch ([string]$plan.Action) {
            'merge' { "新增 $($plan.Added.Count) 键" }
            'rename' { "改名 $(@($plan.Renamed).Count) 键" }
            'merge+rename' { "新增 $($plan.Added.Count) 键 + 改名 $(@($plan.Renamed).Count) 键" }
            default { '已存在，跳过' }
        }
        $renamedNote = if (@($plan.Renamed).Count -gt 0) { "（改名：$((@($plan.Renamed)) -join ', ')）" } else { '' }
        $skippedNote = if (@($plan.Skipped).Count -gt 0) { "（跳过已存在：$(@($plan.Skipped) -join ', ')）" } else { '' }
        Write-Log "      [locales/$loc.json] $verb$renamedNote$skippedNote"
    }

    $cssPlans = [System.Collections.Generic.List[object]]::new()
    foreach ($t in $script:ThemeDefs) {
        $destRenderer = Join-Path $RendererDir "themes\$($t.File)"
        $destServer = Join-Path $ServerDir "desktop\dist-renderer\themes\$($t.File)"
        foreach ($d in @(
                [pscustomobject]@{ Tree = 'renderer'; Rel = "themes/$($t.File)"; Dest = $destRenderer }
                [pscustomobject]@{ Tree = 'server'; Rel = "desktop/dist-renderer/themes/$($t.File)"; Dest = $destServer }
            )) {
            $exists = Test-Path -LiteralPath $d.Dest -PathType Leaf
            # renderer 树合成：材质与背景都只贴这里。server 树另有自己的合成（配色源 + App 面材质源）。
            # 合成为**内存里的确切文本**：落盘时用 Write-Utf8NoBomFile 写它，而不是 Copy-Item
            # —— 这样落盘前后都能逐字节算 sha256，与第一期的 Copy-Item + 校验模式等价
            # （甚至更强：能验文本）。
            #
            # 背景只进**深色**主题文件（工单 14：只做深色版；工单 21 起皮肤本身也只剩深色）。
            # 这层判定放在 Join-ThemeCss 里（按 Theme.Id 判），调用方只需传档位。
            $composedText = $null
            $expectSha = $t.SourceSha256
            $expectBytes = $t.SourceBytes
            if ($d.Tree -eq 'renderer') {
                $composedText = Join-ThemeCss -Theme $t -MaterialTier $script:MaterialTier -BackgroundTier $script:BackgroundTier
                if ($null -ne $composedText) {
                    $expectSha = Get-BytesSha256 ($script:Utf8NoBom.GetBytes($composedText))
                    $expectBytes = $script:Utf8NoBom.GetByteCount($composedText)
                }
            }
            # server 树（App 面）：配色源 + 换行 + src/app-surface/*.css（工单 41）。
            # 与 renderer 树互不影响；目录为空时 Join-AppSurfaceCss 返回 $null，走 Copy-Item。
            elseif ($d.Tree -eq 'server') {
                $composedText = Join-AppSurfaceCss -Theme $t
                if ($null -ne $composedText) {
                    $expectSha = Get-BytesSha256 ($script:Utf8NoBom.GetBytes($composedText))
                    $expectBytes = $script:Utf8NoBom.GetByteCount($composedText)
                }
            }
            # 该目标实际合成的成分（供输出/审计）
            $matPart = if ($d.Tree -eq 'renderer' -and $script:MaterialTier -ne 'none' -and $null -ne $t.MaterialSource) { $script:MaterialTier } else { 'none' }
            $bgPart = if ($d.Tree -eq 'renderer' -and $script:BackgroundTier -eq 'dark' -and $null -ne $t.BackgroundSource) { $script:BackgroundTier } else { 'none' }
            $panelPart = if ($d.Tree -eq 'renderer' -and $null -ne $t.PanelFrameSources) { 'on' } else { 'none' }
            $appPart = if ($d.Tree -eq 'server' -and $null -ne $script:AppSurfaceSources) { 'on' } else { 'none' }
            $cssPlans.Add([pscustomobject]@{
                    Tree       = $d.Tree
                    Rel        = $d.Rel
                    Dest       = $d.Dest
                    ThemeId    = $t.Id
                    SourcePath = $t.SourcePath
                    SourceSha  = $expectSha
                    ComposedText = $composedText
                    ExpectBytes = $expectBytes
                    MaterialPart = $matPart
                    BackgroundPart = $bgPart
                    PanelFramePart = $panelPart
                    AppSurfacePart = $appPart
                    Action     = if ($exists) { 'overwrite' } else { 'create' }
                    Sha256Before = if ($exists) { Get-FileSha256 $d.Dest } else { $null }
                })
        }
    }
    foreach ($c in $cssPlans) {
        $srcNote = "src/$(Split-Path $c.SourcePath -Leaf)"
        # 合成成分按**该 plan 的主题**取目录（多主题时不能再用全局单值）
        $cTheme = $script:ThemeDefs | Where-Object { $_.Id -eq $c.ThemeId } | Select-Object -First 1
        $cMatDir = if ($cTheme -and $cTheme.MaterialDir) { $cTheme.MaterialDir } else { $script:MaterialDir }
        $cBgDir = if ($cTheme -and $cTheme.BackgroundDir) { $cTheme.BackgroundDir } else { $script:BackgroundDir }
        $cPanelDir = if ($cTheme -and $cTheme.PanelFrameDir) { $cTheme.PanelFrameDir } else { $script:PanelFrameDir }
        $adds = [System.Collections.Generic.List[string]]::new()
        if ($c.MaterialPart -ne 'none') { $adds.Add("src/$cMatDir/$($c.MaterialPart).css") }
        if ($c.BackgroundPart -ne 'none') { $adds.Add("src/$cBgDir/$($c.BackgroundPart).css") }
        if ($c.PanelFramePart -ne 'none') { $adds.Add("src/$cPanelDir/$($script:PanelFrameCssFile)") }
        if ($c.AppSurfacePart -ne 'none') { foreach ($item in $script:AppSurfaceSources.Items) { $adds.Add($item.Rel) } }
        if ($adds.Count -gt 0) { $srcNote = "$srcNote + $($adds -join ' + ')（合成）" }
        Write-Log "      [$($c.Tree)/$($c.Rel)] $($c.Action)  <- $srcNote"
    }

    # --- 主题 CSS 版本参数（工单 16；算法于工单 21 改为单主题）---
    # 版本串 = renderer 树**合成后**主题 CSS 的 sha256 **前 16 位**（16 位小写十六进制）。
    # 用「合成后」而不是「配色源」：合成后 = 配色源 + [材质源] + [背景源]，
    # 故配色 / 材质 / 背景任一内容变化，版本串必变。
    # 工单 21 之前是「两份主题 CSS 的 sha256 各前 8 位拼接 = light8 + dark8」；皮肤改单主题
    # （浅色主题与其源文件整体删除）后不再有第二份哈希，故直接取这一份合成后哈希的前 16 位，
    # 长度 / 字符集 / theme.js 里 '?v=<版本串>' 的格式一概不变。
    $script:ThemeCacheBustVersion = $null
    $script:ThemeCacheBustPlan = $null

    # renderer lib/theme.js 的注册表预演（步骤 7 已完成）。
    # 2026-10-14 修缺陷：原先这段被放在下面 -ThemeCacheBust on 的分支里，而它被三条路径共用
    #   —— 10b（on 时算基准文本；none 时的 else 兜底）、10c 面板段（无条件是它）。
    #   于是 `-ThemeCacheBust none -Background dark` 这种组合必然崩：
    #   「无法检索变量 '$themeJsRegistryPlan'」（Set-StrictMode 下未定义变量即报错）。
    #   现提到分支外，两档都先算好；分支内只保留真正与缓存参数相关的事（版本串 / 预演）。
    $themeJsRegistryPlan = @($registryPlans | Where-Object { $_.Rel -eq 'lib/theme.js' })
    if ($themeJsRegistryPlan.Count -ne 1) {
        Stop-Fail "内部错误：renderer lib/theme.js 的注册表预演有 $($themeJsRegistryPlan.Count) 个（要求恰好 1 个）"
    }

    if ($script:ThemeCacheBustMode -eq 'on') {
        $rendererCss = @($cssPlans | Where-Object { $_.Tree -eq 'renderer' })
        if ($rendererCss.Count -ne $script:ThemeDefs.Count) {
            Stop-Fail "内部错误：renderer 树应有 $($script:ThemeDefs.Count) 个主题 CSS 目标，实际 $($rendererCss.Count) 个"
        }
        if ($rendererCss.Count -lt 1) {
            Stop-Fail '内部错误：renderer 树没有任何主题 CSS 目标'
        }
        # 2026-10-18：多主题时版本串必须覆盖**全部**主题的合成结果，
        # 否则只改紫色主题时缓存不会失效。做法：按主题顺序拼 「id:sha256」 再取 sha256 前 16 位。
        # 单主题时退化为原算法（直接取那份的 sha256 前 16 位），保证月满庭的版本串不变。
        $detail = [System.Collections.Generic.List[string]]::new()
        $sorted = @($rendererCss | Sort-Object { $_.Rel })
        $createdVersion = $null
        if ($sorted.Count -eq 1) {
            $themeRow = $sorted[0]
            $sha = [string]$themeRow.SourceSha
            if ($sha -notmatch '^[0-9a-f]{64}$') { Stop-Fail "主题 '$($themeRow.ThemeId)' 的合成后 sha256 '$sha' 不是 64 位小写十六进制 —— 内部错误" }
            $createdVersion = $sha.Substring(0, 16)
            $detail.Add("$($themeRow.ThemeId) sha256=$sha -> 前 16 位 $createdVersion")
        }
        else {
            $concat = ($sorted | ForEach-Object {
                    $s = [string]$_.SourceSha
                    if ($s -notmatch '^[0-9a-f]{64}$') { Stop-Fail "主题 '$($_.ThemeId)' 的合成后 sha256 '$s' 不是 64 位小写十六进制 —— 内部错误" }
                    "$($_.ThemeId):$s"
                }) -join '|'
            $createdVersion = (Get-BytesSha256 ($script:Utf8NoBom.GetBytes($concat))).Substring(0, 16)
            foreach ($row in $sorted) { $detail.Add("$($row.ThemeId) sha256=$($row.SourceSha)") }
            $detail.Add("合取摘要 sha256=$((Get-BytesSha256 ($script:Utf8NoBom.GetBytes($concat)))) -> 前 16 位 $createdVersion")
        }
        $script:ThemeCacheBustVersion = $createdVersion

        # 基准文本 = 步骤 7 预演出的 renderer lib/theme.js 改后文本（注册表 patch 已应用）。
        # 该预演必然是本次已完成的（步骤 4 的注册表预演在前），故 NewText 一定可用。
        $themeJsPath = Join-Path $RendererDir 'lib\theme.js'
        $themeJsBaseText = [string]$themeJsRegistryPlan[0].NewText
        $script:ThemeCacheBustPlan = Resolve-ThemeCacheBustPlan -TargetPath $themeJsPath -VersionString $createdVersion -BaseText $themeJsBaseText

        Write-Log ''
        Write-Log "[4b] 主题 CSS 版本参数（-ThemeCacheBust $($script:ThemeCacheBustMode)）"
        Write-Log "      版本串（合成后主题 CSS 的 sha256 前 16 位）：$createdVersion"
        foreach ($d in $detail) { Write-Log "        $d" }
        $verb = switch ($script:ThemeCacheBustPlan.Action) {
            'insert'          { '将注入版本常量并把 4 处主题 CSS URL 改为带版本参数' }
            'replace-version' { '版本串已变化，将只替换常量值（4 处 URL 不动）' }
            'skip-no-change'  { '版本串未变，跳过（幂等，不重写文件）' }
            default           { $script:ThemeCacheBustPlan.Action }
        }
        Write-Log "      [renderer/lib/theme.js] $verb"
        Write-Log "          文件：$themeJsPath"
        Write-Log "          状态：$($script:ThemeCacheBustPlan.State)（plain = 尚无常量；busted = 已带版本参数）"
        Write-Log "          4 处 URL 锚点改前/改后命中数断言通过（各 1 次）"
        Write-Log "          注册表 cssPath 保持原样（CardShell 打印依赖）：$($script:ThemeCacheBustRegistryCssPathNote)"
    }

    # --- 浮层面板取景框 JS（工单 30）---
    # 基准文本 = 步骤 10b 预演出的 theme.js 改后文本（注册表 patch + 版本常量已应用）。
    # 这样步骤 10b 与 10c 的改动能叠加，不会互相覆盖。
    #
    # 2026-10-18（第二个主题）：lib/theme.js 只有一个，而每个主题自带走一份取景框 JS。
    # 做法是**链式追加**：第 N 个主题的基准文本 = 第 N-1 个主题改后的文本；
    # 每个块用**自己的标记行**（主题 id 后缀），所以重贴时能各裁各的、互不吞噬。
    $script:PanelFramePlans = @()
    $script:PanelFramePlan = $null
    $themeJsPath2 = Join-Path $RendererDir 'lib\theme.js'
    $themeJsBase2 = if ($null -ne $script:ThemeCacheBustPlan) {
        [string]$script:ThemeCacheBustPlan.NewText
    }
    else {
        [string]$themeJsRegistryPlan[0].NewText
    }
    $pfIndex = 0
    foreach ($t in $script:ThemeDefs) {
        if ($null -eq $t.PanelFrameSources) { continue }
        $pf = $t.PanelFrameSources
        $pfPlan = Resolve-PanelFramePlan -TargetPath $themeJsPath2 -JsText $pf.JsText -BaseText $themeJsBase2 -Marker $pf.Marker
        # StrictMode：属性不存在时不能直接赋值，统一用 Add-Member -Force
        Add-Member -InputObject $pfPlan -MemberType NoteProperty -Name JsPath -Value $pf.JsPath -Force
        Add-Member -InputObject $pfPlan -MemberType NoteProperty -Name JsSha256 -Value $pf.JsSha256 -Force
        Add-Member -InputObject $pfPlan -MemberType NoteProperty -Name JsText -Value $pf.JsText -Force
        Add-Member -InputObject $pfPlan -MemberType NoteProperty -Name ThemeId -Value $t.Id -Force
        Add-Member -InputObject $pfPlan -MemberType NoteProperty -Name Marker -Value $pf.Marker -Force
        $script:PanelFramePlans += $pfPlan
        # 下一个主题在本次改后的文本上继续
        $themeJsBase2 = [string]$pfPlan.NewText
        $pfIndex++

        Write-Log ''
        Write-Log "[4c] 浮层面板取景框（$($t.Id)：卡片中心 / 能力 / 自动化 / 市场 / 设置）"
        $pfVerb = switch ($pfPlan.Action) {
            'append'  { '将把面板 JS 追加到 lib/theme.js 末尾' }
            'rewrite' { '已贴过，将重写末尾的面板 JS 段（幂等）' }
            default   { $pfPlan.Action }
        }
        Write-Log "      [renderer/lib/theme.js] $pfVerb"
        $tPanelDir = if ($t.PSObject.Properties['PanelFrameDir'] -and $t.PanelFrameDir) { $t.PanelFrameDir } else { $script:PanelFrameDir }
        Write-Log "          面板 CSS：src/$tPanelDir/$($script:PanelFrameCssFile)  sha256=$($pf.CssSha256)"
        Write-Log "          面板 JS ：src/$tPanelDir/$($script:PanelFrameSourceFile)  sha256=$($pf.JsSha256)"
        Write-Log "          标记行：$($pf.Marker)"
        Write-Log "          状态：$($pfPlan.State)（plain = 尚未追加；appended = 已有标记行，将重写）"
        Write-Log "          追加后 theme.js 字节：$($pfPlan.BytesBefore) -> $($pfPlan.BytesAfter)"
    }
    # 兼容旧引用点：单主题时指向唯一那个 plan
    if ($script:PanelFramePlans.Count -ge 1) {
        $script:PanelFramePlan = $script:PanelFramePlans[0]
        $script:PanelFrameSources = $script:ThemeDefs | ForEach-Object { $_.PanelFrameSources } | Where-Object { $null -ne $_ } | Select-Object -First 1
    }

    # --- 独立文档的主题 <link>（工单 36-B）---
    # 两个 html 是**独立文档**：它们的 <html data-theme> 由 lib/theme.js 设，
    # 但文档里没有 #themeSheet，theme.js 就只设属性、不创建/替换 link
    # （L(e) 里 'const s=document.getElementById("themeSheet")' 为 null 时直接 return）。
    # 于是写死的 assets/warm-paper-<hash>.css 永远留着 —— 而它的作用域是
    # [data-theme=warm-paper],:root:not([data-theme])，与文档的 data-theme 不匹配 -> 变量全空。
    #
    # 版本串**复用步骤 10b 现算的同一个**（$script:ThemeCacheBustVersion），不另算一份：
    # 两处必须同源，否则皮肤升级后 html 里的 ?v= 与 theme.js 的常量会对不上。
    # -ThemeCacheBust none 时该变量为 $null -> 写不带 ?v= 的 href（与 theme.js 不加参数时一致）。
    $script:ThemeLinkPlans = [System.Collections.Generic.List[object]]::new()
    $themeLinkQuery = if ($null -eq $script:ThemeCacheBustVersion) { $null } else { "?v=$($script:ThemeCacheBustVersion)" }
    $themeLinkFile = $script:ThemeDefs[0].File
    foreach ($tl in $script:ThemeLinkTargets) {
        $tlPath = Join-Path $RendererDir ($tl.Rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $tlPath -PathType Leaf)) {
            Stop-Fail "$($tl.Display)：目标文件不存在 '$tlPath'（renderer 树的独立文档清单可能变了）"
        }
        $script:ThemeLinkPlans.Add((Resolve-ThemeLinkPlan -TargetPath $tlPath -Rel $tl.Rel -Display $tl.Display `
                    -ThemeFile $themeLinkFile -CacheBustQuery $themeLinkQuery))
    }

    Write-Log ''
    Write-Log "[4d] 独立文档主题 link（browser-viewer.html / viewer-window.html，工单 36-B）"
    Write-Log "      目标 href：themes/$themeLinkFile$themeLinkQuery   id=$($script:ThemeLinkId)"
    Write-Log "      版本串来源：步骤 4b 现算的同一个（renderer 树合成后主题 CSS 的 sha256 前 16 位）$(if ($null -eq $script:ThemeCacheBustVersion) { '（-ThemeCacheBust none：不带 ?v=）' } else { '' })"
    foreach ($tlp in $script:ThemeLinkPlans) {
        $tlVerb = switch ($tlp.Action) {
            'replace-theme-link' { '将把写死的 assets/warm-paper-*.css 引用换成当前主题 link' }
            'skip-no-change'     { '已贴过且逐字相同，跳过（幂等，不重写文件）' }
            default              { $tlp.Action }
        }
        Write-Log "      [renderer/$($tlp.Rel)] $tlVerb"
        Write-Log "          状态：$($tlp.State)（plain = 仍是 warm-paper 引用；posted = 已带 #themeSheet）"
        Write-Log "          命中数断言：整段 warm-paper <link> 正则 $($tlp.RegexBefore) 次（期望 1）；裸串 'assets/warm-paper-' $($tlp.WarmCountBefore) 次；id=`"$($script:ThemeLinkId)`" $($tlp.SheetIdBefore) 次"
        if ($tlp.Action -ne 'skip-no-change') {
            Write-Log "          改前：$($tlp.OldLink)"
            Write-Log "          改后：$($tlp.TargetLink)"
            Write-Log "          字节：$($tlp.BytesBefore) -> $($tlp.BytesAfter)   sha256=$($tlp.Sha256Before) -> $($tlp.Sha256After)"
        }
        else {
            Write-Log "          当前：$($tlp.TargetLink)   sha256=$($tlp.Sha256Before)"
        }
    }

    # --- 主题卡片预览配色（SettingsModalShell-*.css，两棵树）---
    $cardPatchPath = Join-Path $patchDir $script:CardPreviewPatchFile
    $cardPatch = Read-JsonFile -Path $cardPatchPath -What "patch $($script:CardPreviewPatchFile)"
    foreach ($flag in @('onAnchorMissing', 'onAnchorNotUnique')) {
        if ((Get-Prop $cardPatch $flag) -ne 'error') {
            Stop-Fail "patch $($script:CardPreviewPatchFile)：$flag 不是 'error'（不允许静默跳过）"
        }
    }
    if ((Get-Prop $cardPatch 'locateStrategy') -ne 'content-anchor') {
        Stop-Fail "patch $($script:CardPreviewPatchFile)：locateStrategy 不是 'content-anchor'"
    }
    if ((Get-Prop $cardPatch 'insertionPoint') -ne 'after-anchor') {
        Stop-Fail "patch $($script:CardPreviewPatchFile)：insertionPoint 不是 'after-anchor'"
    }
    if ([int](Get-RequiredProp $cardPatch 'anchorOccurrencesExpected' "patch $($script:CardPreviewPatchFile)") -ne 1) {
        Stop-Fail "patch $($script:CardPreviewPatchFile)：anchorOccurrencesExpected 不是 1"
    }

    $cardPlans = [System.Collections.Generic.List[object]]::new()
    $cardTargets = @(Get-RequiredProp $cardPatch 'targets' "patch $($script:CardPreviewPatchFile)")
    foreach ($treeName in @('renderer', 'server')) {
        $targetsOfTree = @($cardTargets | Where-Object { [string](Get-Prop $_ 'tree') -eq $treeName })
        if ($targetsOfTree.Count -ne 1) {
            Stop-Fail "patch $($script:CardPreviewPatchFile)：tree '$treeName' 的 target 有 $($targetsOfTree.Count) 个（要求恰好 1 个）"
        }
        $tgt = $targetsOfTree[0]
        $baseDir = if ($treeName -eq 'renderer') { $RendererDir } else { $ServerDir }
        $label = "$treeName assets/SettingsModalShell-*.css（主题卡片配色）"
        $plan = Resolve-CardPreviewPlan -Target $tgt -Patch $cardPatch -Tree $treeName -BaseDir $baseDir -Label $label
        $cardPlans.Add($plan)

        $verb = if ($plan.Action -eq 'modify') { '改' } else { '已贴过，跳过' }
        Write-Log "      [$label] $verb  通配命中 $($plan.CandidateCount) 个候选，内容特征命中 $($plan.FeatureMatchCount) 个；锚点命中 $($plan.AnchorCount) 次"
        Write-Log "          文件：$($plan.Path)"
        Write-Log "          相对路径：$($plan.Rel)  卡片规则数 $($plan.RuleCountBefore) -> $($plan.RuleCountAfter)"
    }

    # --- 卡片调色板（server 树 bundle/index.js 的 MGr 表）---
    $palettePatch = Read-JsonFile -Path $palettePatchPath -What "patch $($script:CardPalettePatchFile)"
    $paletteRel = [string](Get-RequiredProp $palettePatch 'target' "patch $($script:CardPalettePatchFile)")
    $paletteTree = ($paletteRel -split '/')[0]
    $paletteRelInner = (($paletteRel -split '/')[1..(($paletteRel -split '/').Count - 1)] -join '/')
    if ($paletteTree -ne 'server') { Stop-Fail "patch $($script:CardPalettePatchFile)：target 不在 server 树（实际 '$paletteRel'）" }
    $paletteLabel = 'server bundle/index.js（卡片调色板）'
    # 先看同文件是否已有「改」类 plan（注册表插入）。有就把它改后的文本作为基底，
    # 否则本 plan 落盘时会把注册表那次插入覆盖掉（全新安装必踩）。
    $paletteTargetPath = Join-Path $ServerDir ($paletteRelInner -replace '/', '\')
    $palettePriorPlans = @($registryPlans | Where-Object {
            $_.Action -eq 'modify' -and [string]::Equals([string]$_.Path, $paletteTargetPath, [StringComparison]::OrdinalIgnoreCase)
        })
    if ($palettePriorPlans.Count -gt 1) {
        Stop-Fail "内部错误：server bundle/index.js 有 $($palettePriorPlans.Count) 份待写 plan（期望 ≤1），无法确定基底"
    }
    $paletteBaseText = if ($palettePriorPlans.Count -eq 1) { [string]$palettePriorPlans[0].NewText } else { $null }
    if ($null -ne $paletteBaseText) { Write-Log '      （同文件已有注册表 plan，调色板以它改后的文本为基底）' }
    $cardPalettePlan = Resolve-CardPalettePlan -PatchPath $palettePatchPath -Patch $palettePatch -Tree $paletteTree `
        -BaseDir $ServerDir -Rel $paletteRelInner -Label $paletteLabel -BaseText $paletteBaseText
    $paletteVerb = if ($cardPalettePlan.Action -eq 'modify') { '改' } else { '已贴过，跳过' }
    Write-Log "      [$paletteLabel] $paletteVerb  锚点命中 $($cardPalettePlan.AnchorCount) 次；调色板项数 $($cardPalettePlan.CountBefore) -> $($cardPalettePlan.CountAfter)"
    Write-Log "          文件：$($cardPalettePlan.Path)"
    Write-Log "          新增项：$((@($cardPalettePlan.NewIds)) -join ', ')（每项 $(@($cardPalettePlan.PaletteKeys).Count) 个键，逐键逐值 node 真求值核对）"

    # ------------------------------------------------------------------
    # 5. 同版本备份检测
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[5] 检查是否已贴过（同版本备份）'

    $existingBackups = @()
    $incompleteBackups = @()
    if (Test-Path -LiteralPath $BackupRoot -PathType Container) {
        foreach ($d in @(Get-ChildItem -LiteralPath $BackupRoot -Directory -Filter "$versionLabel-*" | Sort-Object Name)) {
            # 只有写完 manifest.json 的备份才算"一次完整贴入"。
            # 上次中途失败留下的空目录不算，否则会误报"已贴过"。
            if (Test-Path -LiteralPath (Join-Path $d.FullName 'manifest.json') -PathType Leaf) {
                $existingBackups += $d.FullName
            }
            else {
                $incompleteBackups += $d.FullName
            }
        }
    }
    if ($incompleteBackups.Count -gt 0) {
        Write-Log "      注意：$($incompleteBackups.Count) 个目录没有 manifest.json（上次中途失败留下的残骸，不计入已贴过）："
        foreach ($b in $incompleteBackups) { Write-Log "        - $b" }
    }
    if ($existingBackups.Count -eq 0) {
        Write-Log "      未发现 $versionLabel 的完整历史备份（backups 根：$BackupRoot）"
    }
    else {
        Write-Log "      发现 $($existingBackups.Count) 个同版本完整备份（可能已贴过）："
        foreach ($b in $existingBackups) { Write-Log "        - $b" }
        if ($Force) {
            Write-Log '      -Force 已指定：跳过"是否覆盖"询问，直接覆盖'
        }
        elseif ($isDryRun) {
            Write-Log '      （dry-run）真实执行时会询问"已贴过，是否覆盖？"；-Force 可跳过'
        }
        else {
            $answer = $null
            try {
                $answer = Read-Host "检测到同版本备份，可能已贴过。是否覆盖？[y/N]"
            }
            catch {
                Stop-Fail ("检测到同版本备份，但当前是非交互会话，无法询问是否覆盖。" +
                    "请显式表态：确认覆盖加 -Force，或先跑 restore.ps1 回滚后再贴。")
            }
            if ($answer -notmatch '^(?i)y(es)?$') {
                Write-Log '      用户选择不覆盖，退出（未写入任何文件）'
                exit 0
            }
            Write-Log '      用户确认覆盖，继续'
        }
    }

    $timestamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
    $script:BackupDir = Join-Path $BackupRoot "$versionLabel-$timestamp"

    # ------------------------------------------------------------------
    # dry-run：打印计划后退出
    # ------------------------------------------------------------------
    if ($isDryRun) {
        Write-Head 'DRY-RUN：以下为将要执行的操作（本次未写入任何文件）'

        $backupCount = $registryPlans.Count + $localePlans.Count + $cardPlans.Count + 1 + @($cssPlans | Where-Object { $_.Action -eq 'overwrite' }).Count + @($script:ThemeCacheBustPlan | Where-Object { $null -ne $_ }).Count + @($script:PanelFramePlan | Where-Object { $null -ne $_ }).Count + $script:ThemeLinkPlans.Count
        Write-Log "[步骤 4] 备份将被修改的原文件 -> $($script:BackupDir)"
        Write-Log "         将备份 $backupCount 个已存在文件 + 写 manifest.json"
        Write-Log ''
        Write-Log '[步骤 5] 贴入一份 CSS 到 renderer 树 themes/'
        # server 树这次的成分**如实**写：有 App 面材质源就是"配色源 + App 面材质源"，
        # 没有就回到原文（逐字不变）—— 不再打印"server 树只写配色源"这类已失真的话。
        if ($null -eq $script:AppSurfaceSources) {
            Write-Log '[步骤 6] 贴入同一份 CSS 到 server 树 desktop/dist-renderer/themes/'
        }
        else {
            Write-Log "[步骤 6] 贴入一份 CSS 到 server 树 desktop/dist-renderer/themes/（配色源 + App 面材质源（$($script:AppSurfaceSources.Count) 份））"
        }
        if ($null -ne $script:PanelFrameSources) {
            Write-Log "         （浮层面板取景框：renderer 树深色主题再拼各主题自己的 src/<主题>/...；server 树不含）"
        }
        if ($script:MaterialTier -ne 'none') {
            # 这一句按 App 面材质源分支：没有它时**逐字保留工单 08 的原文**，
            # 使 src/app-surface/ 为空时 dry-run 输出与今天逐字节相同（验收标准第 1 条）。
            if ($null -eq $script:AppSurfaceSources) {
                Write-Log "         （材质档位 $($script:MaterialTier)：renderer 树写「配色源 + 材质源」合成文本，server 树只写配色源）"
            }
            else {
                Write-Log "         （材质档位 $($script:MaterialTier)：renderer 树写「配色源 + 材质源」合成文本；server 树不贴材质档位源，改为贴 src/app-surface/*.css）"
            }
            foreach ($t in $script:ThemeDefs) {
                if ($null -eq $t.MaterialSource) { continue }
                $tMatDir = if ($t.PSObject.Properties['MaterialDir'] -and $t.MaterialDir) { $t.MaterialDir } else { $script:MaterialDir }
                Write-Log "           材质源（$($t.Id)）：src/$tMatDir/$($script:MaterialTier).css  sha256=$($t.MaterialSource.Sha256)"
            }
        }
        if ($script:BackgroundTier -ne 'none') {
            Write-Log "         （背景档位 $($script:BackgroundTier)：只给带背景的主题写「配色源 + [材质源] + 背景源」，server 树不含背景）"
            foreach ($t in $script:ThemeDefs) {
                if ($null -eq $t.BackgroundSource) { continue }
                $tBgDir = if ($t.PSObject.Properties['BackgroundDir'] -and $t.BackgroundDir) { $t.BackgroundDir } else { $script:BackgroundDir }
                Write-Log "           背景源（$($t.Id)）：src/$tBgDir/$($script:BackgroundTier).css  sha256=$($t.BackgroundSource.Sha256)"
                Write-Log "           背景图（$($t.Id)）：$($t.BackgroundSource.AssetPath)  sha256=$($t.BackgroundSource.AssetSha256)  bytes=$($t.BackgroundSource.AssetBytes)"
            }
        }
        # App 面材质（工单 41）：server 树这次的**真实**成分，不再只写一句"server 树只写配色源"。
        if ($null -ne $script:AppSurfaceSources) {
            Write-Log "         （App 面材质：server 树写「配色源 + App 面材质源（$($script:AppSurfaceSources.Count) 份，字典序）」合成文本；renderer 树不受影响）"
            foreach ($item in $script:AppSurfaceSources.Items) {
                Write-Log "           App 面材质源：$($item.Rel)  sha256=$($item.Sha256)"
            }
        }
        # src/app-surface/ 为空时**不打印任何 App 面相关内容**：这样 dry-run 输出与
        # src/app-surface/ 尚不存在的今天**逐字节相同**（验收标准第 1 条，
        # 实测见 .scratch/t41-evidence/empty-appsurface.txt）。
        foreach ($c in $cssPlans) {
            Write-Log "         [$($c.Tree)] $($c.Rel)  ($($c.Action))"
            # 未发生任何合成时保持原样输出，不追加任何行，使输出与"无新源"时逐字节一致。
            if ($null -ne $c.ComposedText) {
                $parts = [System.Collections.Generic.List[string]]::new()
                $parts.Add("src/$(Split-Path $c.SourcePath -Leaf)")
                $cTheme2 = $script:ThemeDefs | Where-Object { $_.Id -eq $c.ThemeId } | Select-Object -First 1
                $cMatDir2 = if ($cTheme2 -and $cTheme2.MaterialDir) { $cTheme2.MaterialDir } else { $script:MaterialDir }
                $cBgDir2 = if ($cTheme2 -and $cTheme2.BackgroundDir) { $cTheme2.BackgroundDir } else { $script:BackgroundDir }
                $cPanelDir2 = if ($cTheme2 -and $cTheme2.PanelFrameDir) { $cTheme2.PanelFrameDir } else { $script:PanelFrameDir }
                if ($c.MaterialPart -ne 'none') { $parts.Add("src/$cMatDir2/$($c.MaterialPart).css") }
                if ($c.BackgroundPart -ne 'none') { $parts.Add("src/$cBgDir2/$($c.BackgroundPart).css") }
                if ($c.PanelFramePart -ne 'none') { $parts.Add("src/$cPanelDir2/$($script:PanelFrameCssFile)") }
                if ($c.AppSurfacePart -ne 'none') { foreach ($item in $script:AppSurfaceSources.Items) { $parts.Add($item.Rel) } }
                Write-Log "                    合成目标 sha256=$($c.SourceSha)  bytes=$($c.ExpectBytes)  源=$($parts -join ' + ')"
            }
        }
        Write-Log ''
        Write-Log '[步骤 7-9] 改三处注册表'
        foreach ($r in $registryPlans) {
            $note = if ($r.Action -eq 'modify') { "将插入 $(@($r.NewIds).Count) 项" } else { '已贴过，跳过（幂等）' }
            Write-Log "         [$($r.Label)] $note  主题数 $($r.CountBefore) -> $($r.CountAfter)"
        }
        Write-Log ''
        Write-Log '[步骤 9b] 补卡片调色板（server bundle/index.js 的 MGr 表）'
        Write-Log "         [$($cardPalettePlan.Label)] $(if ($cardPalettePlan.Action -eq 'modify') { "将插入 $(@($cardPalettePlan.NewIds).Count) 项" } else { '已贴过，跳过（幂等）' })  调色板项数 $($cardPalettePlan.CountBefore) -> $($cardPalettePlan.CountAfter)"
        Write-Log "                    新增：$((@($cardPalettePlan.NewIds)) -join ', ')（每项 $(@($cardPalettePlan.PaletteKeys).Count) 个键）"
        Write-Log "                    锚点命中 $($cardPalettePlan.AnchorCount) 次  followedBy 结构校验通过：$(if ($cardPalettePlan.FollowedByOk) { '是' } else { '否' })"
        Write-Log '                    用途：让 folio 幻灯片能烧入本皮肤主题（不补则 no card palette for theme）'
        Write-Log ''
        Write-Log '[步骤 10] 改两棵树主题卡片预览配色 CSS（SettingsModalShell-*.css）'
        foreach ($cp in $cardPlans) {
            $note = if ($cp.Action -eq 'modify') { "将插入 $($cp.ExpectedRules.Count) 条规则（$($cp.NewIds.Count) 主题 x 3 条）" } else { '已贴过，跳过（幂等）' }
            Write-Log "         [$($cp.Tree)] $($cp.Rel)  $note"
            Write-Log "                    卡片规则数 $($cp.RuleCountBefore) -> $($cp.RuleCountAfter)  锚点命中 $($cp.AnchorCount) 次  followedBy 校验通过"
        }
        Write-Log ''
        Write-Log '[步骤 10b] 改 renderer lib/theme.js：主题 CSS 加版本参数（绕过渲染器 HTTP 缓存）'
        if ($null -eq $script:ThemeCacheBustPlan) {
            Write-Log "         （-ThemeCacheBust $($script:ThemeCacheBustMode)：不改 theme.js，与不启用时逐字节一致）"
        }
        else {
            $tcbNote = switch ($script:ThemeCacheBustPlan.Action) {
                'insert'          { '将注入版本常量，并把 4 处主题 CSS 的 URL 改为带版本参数' }
                'replace-version' { '版本串已变化，将只替换常量值（4 处 URL 不动）' }
                'skip-no-change'  { '版本串未变，跳过（幂等）' }
                default           { $script:ThemeCacheBustPlan.Action }
            }
            Write-Log "         [renderer/lib/theme.js] $tcbNote"
            Write-Log "                    版本常量 $($script:ThemeCacheBustPlan.ConstantName) 版本串 $($script:ThemeCacheBustPlan.VersionValue)"
            Write-Log "                    4 处 URL：new URL 比较基准 / 快路径分支 / 新建 link / load 回调"
            Write-Log "                    注册表 cssPath 保持原样（不改）：$($script:ThemeCacheBustRegistryCssPathNote)"
        }
        Write-Log ''
        Write-Log '[步骤 10c] 追加浮层面板取景框 JS 到 renderer lib/theme.js'
        if ($null -eq $script:PanelFramePlan) {
            Write-Log '         （未加载面板源：-Background none，不改 theme.js）'
        }
        else {
            $pfNote = switch ($script:PanelFramePlan.Action) {
                'append'  { '将把面板 JS 追加到 lib/theme.js 末尾' }
                'rewrite' { '已有标记行，将重写末尾的面板 JS 段（幂等）' }
                default   { $script:PanelFramePlan.Action }
            }
            Write-Log "         [renderer/lib/theme.js] $pfNote"
            Write-Log "                    标记行：$($script:PanelFramePlan.Marker)"
            Write-Log "                    面板 JS sha256：$($script:PanelFramePlan.JsSha256)"
        }
        Write-Log ''
        Write-Log '[步骤 10d] 改两个独立文档的主题 <link>（browser-viewer.html / viewer-window.html）'
        Write-Log "                    目标：<link rel=`"stylesheet`" crossorigin href=`"themes/$themeLinkFile$themeLinkQuery`" id=`"$($script:ThemeLinkId)`">"
        Write-Log "                    替换锚点（通配，不写死构建哈希）：$($script:ThemeLinkPattern)"
        foreach ($tlp in $script:ThemeLinkPlans) {
            $tlNote = if ($tlp.Action -eq 'replace-theme-link') { '将替换写死的 assets/warm-paper-*.css 引用' } else { '已贴过且逐字相同，跳过（幂等）' }
            Write-Log "                    [$($tlp.Rel)] $tlNote"
            Write-Log "                               命中数：正则 $($tlp.RegexBefore) 次 / 裸串 'assets/warm-paper-' $($tlp.WarmCountBefore) 次 / id=`"$($script:ThemeLinkId)`" $($tlp.SheetIdBefore) 次"
            if ($tlp.Action -ne 'skip-no-change') {
                Write-Log "                               改前：$($tlp.OldLink)"
                Write-Log "                               改后：$($tlp.TargetLink)"
            }
        }
        Write-Log ''
        Write-Log '[步骤 11] 补 i18n 到 renderer locales/*.json'
        foreach ($l in $localePlans) {
            $dryVerb = switch ([string]$l.Action) {
                'merge' { "新增 $(@($l.Added).Count) 键：$((@($l.Added)) -join ', ')" }
                'rename' { "改名 $((@($l.Renamed)) -join ', ')" }
                'merge+rename' { "新增 $(@($l.Added).Count) 键：$((@($l.Added)) -join ', ') + 改名 $((@($l.Renamed)) -join ', ')" }
                default { '已存在，跳过' }
            }
            Write-Log "         [locales/$($l.Locale).json] $dryVerb"
        }
        Write-Log ''
        Write-Log "[步骤 12] 写 skin.json -> $SkinJson"
        Write-Log '          登记：renderer / server 两个版本目录、每个被改文件的 sha256、时间戳'
        if ($script:MaterialTier -ne 'none') {
            foreach ($t in $script:ThemeDefs) {
                if ($null -eq $t.MaterialSource) { continue }
                Write-Log "          材质（$($t.Id)）：material=$($script:MaterialTier)  材质源 sha256=$($t.MaterialSource.Sha256)"
            }
        }
        if ($script:BackgroundTier -ne 'none') {
            foreach ($t in $script:ThemeDefs) {
                if ($null -eq $t.BackgroundSource) { continue }
                Write-Log "          背景（$($t.Id)）：background=$($script:BackgroundTier)  背景源 sha256=$($t.BackgroundSource.Sha256)"
                Write-Log "                背景图 sha256=$($t.BackgroundSource.AssetSha256)  只进 renderer 树对应主题文件"
            }
        }
        Write-Log ''
        Write-Log '[步骤 13] 提示：需重启 Hana 生效'
        Write-Log ''
        Write-Log '以上均未执行。确认无误后加 -Apply 真正贴入。'
        exit 0
    }

    # ==================================================================
    # 执行阶段（仅 -Apply）
    # ==================================================================

    # ------------------------------------------------------------------
    # 4. 备份
    # ------------------------------------------------------------------
    Write-Head '[步骤 4/13] 备份将被修改的原文件'

    $backupEntries = [System.Collections.Generic.List[object]]::new()
    $filesDirName = 'files'

    function Add-BackupEntry {
        param(
            [Parameter(Mandatory)][string]$Tree,
            [Parameter(Mandatory)][string]$Rel,
            [Parameter(Mandatory)][string]$Abs,
            [Parameter(Mandatory)][string]$Kind
        )
        $existed = Test-Path -LiteralPath $Abs -PathType Leaf
        $entry = [pscustomobject]@{
            Tree          = $Tree
            RelPath       = $Rel
            Kind          = $Kind
            Existed       = $existed
            BackupRelPath = $null
            Sha256Before  = $null
            BytesBefore   = $null
        }
        if ($existed) {
            $dest = Join-Path (Join-Path $script:BackupDir $filesDirName) (Join-Path $Tree ($Rel -replace '/', '\'))
            $destDir = Split-Path -Parent $dest
            if (-not (Test-Path -LiteralPath $destDir -PathType Container)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -LiteralPath $Abs -Destination $dest -Force
            $entry.BackupRelPath = "$filesDirName/$Tree/$Rel"
            $entry.Sha256Before = Get-FileSha256 $Abs
            $entry.BytesBefore = (Get-Item -LiteralPath $Abs).Length
            # 备份必须与源逐字节一致
            if ((Get-FileSha256 $dest) -cne $entry.Sha256Before) { Stop-Fail "备份校验失败（副本 sha256 与源不一致）：'$Abs'" }
        }
        $backupEntries.Add($entry)
    }

    foreach ($r in $registryPlans) {
        Add-BackupEntry -Tree $r.Tree -Rel $r.Rel -Abs $r.Path -Kind 'registry'
    }
    foreach ($l in $localePlans) {
        Add-BackupEntry -Tree 'renderer' -Rel "locales/$($l.Locale).json" -Abs $l.Path -Kind 'locale'
    }
    foreach ($c in $cssPlans) {
        Add-BackupEntry -Tree $c.Tree -Rel $c.Rel -Abs $c.Dest -Kind 'theme-css'
    }
    foreach ($cp in $cardPlans) {
        Add-BackupEntry -Tree $cp.Tree -Rel $cp.Rel -Abs $cp.Path -Kind 'card-preview-css'
    }
    # 卡片调色板（工单 73）：改的是 server bundle/index.js（该文件已作为 registry 备份过，
    # 但这里单独登记一条 —— manifest 要能如实回答「本次到底动没动调色板表」）
    Add-BackupEntry -Tree $cardPalettePlan.Tree -Rel $cardPalettePlan.Rel -Abs $cardPalettePlan.Path -Kind 'card-palette'
    # 主题 CSS 版本参数（工单 16）：lib/theme.js 会被改动，必须纳入备份与回滚范围。
    # lib/theme.js 同时也被步骤 7 的注册表 patch 改（Kind='registry'），故这里再登记一条
    # Kind='theme-cache-bust' 的条目——它没有 Existed 闸门，Action='skip-no-change' 时也会进备份，
    # 于是「本次贴入到底动没动 theme.js」在 manifest 里是确定的，restore.ps1 也必然覆盖它。
    if ($null -ne $script:ThemeCacheBustPlan) {
        Add-BackupEntry -Tree $script:ThemeCacheBustPlan.Tree -Rel $script:ThemeCacheBustPlan.Rel -Abs $script:ThemeCacheBustPlan.Path -Kind 'theme-cache-bust'
    }
    # 浮层面板取景框（工单 30）：同样改 lib/theme.js，单独登记一条（同 theme-cache-bust 的理由）。
    if ($null -ne $script:PanelFramePlan) {
        Add-BackupEntry -Tree $script:PanelFramePlan.Tree -Rel $script:PanelFramePlan.Rel -Abs $script:PanelFramePlan.Path -Kind 'panel-frame-js'
    }
    # 独立文档的主题 link（工单 36-B）：两个 html 各自登记一条 Kind='theme-link'。
    # 它们 Action='skip-no-change' 时也会进备份（同 theme-cache-bust 的理由）：
    # 「本次贴入到底动没动这两个文件」在 manifest 里必须是确定的，restore.ps1 也必然覆盖它们。
    foreach ($tlp in $script:ThemeLinkPlans) {
        Add-BackupEntry -Tree $tlp.Tree -Rel $tlp.Rel -Abs $tlp.Path -Kind 'theme-link'
    }

    $backedUp = @($backupEntries | Where-Object { $_.Existed })
    Write-Log "      备份目录：$($script:BackupDir)"
    Write-Log "      已备份 $($backedUp.Count) 个已存在文件（另 $($backupEntries.Count - $backedUp.Count) 个为新建，无原文件可备份）"
    foreach ($e in $backedUp) { Write-Log "        - $($e.Tree)/$($e.RelPath)" }

    # 备份 manifest：restore.ps1 逐文件还原所需的最小信息集
    $pristineBackupDir = if ($existingBackups.Count -gt 0) { $existingBackups[0] } else { $script:BackupDir }
    $manifest = [ordered]@{
        schema              = 1
        versionLabel        = $versionLabel
        createdAt           = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        createdAtLocal      = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        tool                = 'scripts/apply.ps1'
        rendererVersionDir  = $RendererDir
        serverVersionDir    = $ServerDir
        pristineBackupDir   = $pristineBackupDir
        entries             = @($backupEntries | ForEach-Object {
                [ordered]@{
                    tree          = $_.Tree
                    relPath       = $_.RelPath
                    kind          = $_.Kind
                    existed       = $_.Existed
                    backupRelPath = $_.BackupRelPath
                    sha256Before  = $_.Sha256Before
                    bytesBefore   = $_.BytesBefore
                }
            })
    }
    $manifestText = ($manifest | ConvertTo-Json -Depth 10) -replace "`r`n", "`n"
    if (-not $manifestText.EndsWith("`n")) { $manifestText += "`n" }
    Write-Utf8NoBomFile -Path (Join-Path $script:BackupDir 'manifest.json') -Text $manifestText
    $script:Completed.Add("步骤4：备份 $($backedUp.Count) 个原文件 -> $($script:BackupDir)（含 manifest.json）")

    # ------------------------------------------------------------------
    # 5-6. 贴入 CSS（两棵树）
    # ------------------------------------------------------------------
    Write-Head '[步骤 5-6/13] 贴入主题 CSS 到两棵树'

    $fileRecords = [System.Collections.Generic.List[object]]::new()

    foreach ($c in $cssPlans) {
        # 无材质：与第一期完全一致（Copy-Item 整文件拷贝）。
        # 有材质（仅 renderer 树）：写内存里已算好的合成文本；两条路径都做落盘后 sha256 校验。
        if ($null -eq $c.ComposedText) {
            Copy-Item -LiteralPath $c.SourcePath -Destination $c.Dest -Force
        }
        else {
            Write-Utf8NoBomFile -Path $c.Dest -Text $c.ComposedText
        }
        $after = Get-FileSha256 $c.Dest
        if ($after -cne $c.SourceSha) {
            $what = if ($null -ne $c.ComposedText) { "合成文本（$($c.SourcePath) + 附加源）" } else { "源 '$($c.SourcePath)'" }
            Stop-Fail "CSS 贴入校验失败：'$($c.Dest)' 的 sha256 与$what 不一致"
        }
        $writtenBytes = (Get-Item -LiteralPath $c.Dest).Length
        if ($writtenBytes -ne $c.ExpectBytes) {
            Stop-Fail "CSS 贴入校验失败：'$($c.Dest)' 的字节数 $writtenBytes 与预期 $($c.ExpectBytes) 不一致"
        }
        # -Material none 时保持第一期原样输出（不追加 bytes= 后缀），使整轮输出逐字节一致。
        $bytesNote = if ($null -ne $c.ComposedText) { "  bytes=$writtenBytes" } else { '' }
        Write-Log "      [$($c.Tree)] $($c.Rel)  ($($c.Action))  sha256=$after$bytesNote"
        $fileRecords.Add([pscustomobject]@{
                Tree = $c.Tree; RelPath = $c.Rel; Action = $c.Action
                Sha256 = $after; Sha256Before = $c.Sha256Before
                Bytes = $writtenBytes
                Material = $c.MaterialPart
                Background = $c.BackgroundPart
                PanelFrame = $c.PanelFramePart
                AppSurface = $c.AppSurfacePart
            })
    }
    $script:Completed.Add("步骤5：贴入 1 份 CSS 到 renderer 树 themes/")
    $script:Completed.Add("步骤6：贴入 1 份 CSS 到 server 树 desktop/dist-renderer/themes/")

    # --- App 面材质落盘后的独立回读复核（工单 41）---
    # 背景那段只能证明 server 树「没有」图，证不了「新源确实贴进去了」——
    # 故这里补一条**正向**断言：server 树那份文件里必须能找到 App 面材质源的特征串，
    # 且 renderer 树那份**必须找不到**（App 面材质只贴 server 树，这是本票的硬边界）。
    if ($null -ne $script:AppSurfaceSources) {
        Write-Log ''
        Write-Log "      App 面材质落盘复核（回读，期望：仅 server 树含特征串 '$($script:AppSurfaceFeature)'）"
        foreach ($c in $cssPlans) {
            if (-not (Test-Path -LiteralPath $c.Dest -PathType Leaf)) {
                Stop-Fail "App 面材质复核：目标文件不存在 '$($c.Dest)'"
            }
            $probe = Read-Utf8File -Path $c.Dest
            $hits = Get-OccurrenceCount -Text $probe.Text -Needle $script:AppSurfaceFeature
            if ($c.AppSurfacePart -ne 'none') {
                if ($hits -lt 1) {
                    Stop-Fail "App 面材质复核：'$($c.Dest)' 找不到特征串 '$($script:AppSurfaceFeature)' —— App 面材质没有贴进去"
                }
                # 逐份源都要整段命中（证明拼的是本仓源文件本体，不是零散字符）
                foreach ($item in $script:AppSurfaceSources.Items) {
                    $seg = Get-OccurrenceCount -Text $probe.Text -Needle $item.Text
                    if ($seg -ne 1) {
                        Stop-Fail "App 面材质复核：'$($c.Dest)' 里整段源 '$($item.Rel)' 命中 $seg 次（要求 1）"
                    }
                }
                # 「App 面不吃背景」的正确口径：**本源没有引入任何 data:image**。
                # 不能断言整份文件 0 处 —— 配色源本身自带一处 SVG 图标 data URI
                # （--select-arrow，见 src/hana-moonlit-court.css:119），它跟背景无关。
                # 故断言"合成后的计数 == 配色源的计数"：App 面材质源一个都没加进来。
                $digits = Get-OccurrenceCount -Text $probe.Text -Needle 'data:image'
                if ($digits -ne $script:AppSurfaceDataImageBaseline) {
                    Stop-Fail ("App 面材质复核：'$($c.Dest)' 的 'data:image' 有 $digits 处，" +
                        "而配色源基线是 $($script:AppSurfaceDataImageBaseline) 处 —— App 面材质源引入了图片（工单 41 §6：App 面不吃背景）")
                }
                Write-Log "        [有 App 面材质] $($c.Tree)/$($c.Rel)  特征串 $hits 处；$($script:AppSurfaceSources.Count) 份源整段各 1 处；data:image $digits 处（= 配色源基线 $($script:AppSurfaceDataImageBaseline)，未新增）"
            }
            else {
                if ($hits -ne 0) {
                    Stop-Fail "App 面材质复核：'$($c.Dest)' 不应含 '$($script:AppSurfaceFeature)'，实际 $hits 处（App 面材质只贴 server 树）"
                }
                Write-Log "        [无 App 面材质] $($c.Tree)/$($c.Rel)  特征串命中 0 处"
            }
        }
        $script:Completed.Add('步骤5-6：App 面材质落盘回读复核（仅 server 树含特征串）')
    }

    # --- 背景落盘后的独立回读复核（工单 14）---
    # 不复用上面的内存结果：重新读盘、逐字断言「图只进 renderer 树的深色主题文件」。
    # 这是本票最容易悄悄出错的地方（server 树混进 data:image，或深色主题漏贴），
    # 所以正反两面都断言，且用显式失败而不是静默通过。
    #
    # 断言口径（为什么不是「命中数 == 1」）：
    #   裸 marker 'data:image/png;base64,' 在合成文件里**必然出现 >= 2 次**：
    #     (1) src/background/dark.css 的文件头**注释**里作为文档说明写了一次
    #         （"（形式：data:image/png;base64,<b64>）"）；
    #     (2) url("data:image/png;base64,<真图>") 里的真图。
    #   所以「== 1」是恒假的错误断言（会每次写盘后误判失败，留下半完成状态）。
    #   正确的口径分两条：
    #     * 真图存在：文本里必须含 'url("data:image/png;base64,'（这才是真图的标志，
    #       注释里的裸 marker 不带 url( 前缀）；
    #     * 未降级为空：裸 marker 至少 1 处（0 处说明图完全没进去）。
    #   注释里那次出现是**预期内**的，不作断言。
    if ($script:BackgroundTier -ne 'none') {
        $bgMarker = 'data:image/png;base64,'
        # 真图标志：带 url( 前缀，只可能来自替换后的 url("__BG_DARK_DATA_URI__")。
        $bgUrlMarker = 'url("data:image/png;base64,'
        Write-Log ''
        Write-Log '      背景落盘复核（回读，期望：仅 renderer 树深色主题含 url("data:image/png;base64,...")）'
        foreach ($c in $cssPlans) {
            if (-not (Test-Path -LiteralPath $c.Dest -PathType Leaf)) {
                Stop-Fail "背景复核：目标文件不存在 '$($c.Dest)'"
            }
            $probe = Read-Utf8File -Path $c.Dest
            $hits = Get-OccurrenceCount -Text $probe.Text -Needle $bgMarker
            $urlHits = Get-OccurrenceCount -Text $probe.Text -Needle $bgUrlMarker
            $shouldHaveBg = ($c.BackgroundPart -ne 'none')
            if ($shouldHaveBg) {
                if ($hits -lt 1) {
                    Stop-Fail "背景复核：'$($c.Dest)' 完全不含 '$bgMarker'（期望至少 1 处）—— 背景没有贴进去"
                }
                if ($urlHits -lt 1) {
                    Stop-Fail ("背景复核：'$($c.Dest)' 不含真图标志 '$bgUrlMarker'（裸 marker 有 $hits 处，但都不在 url() 里）—— " +
                        "背景图没有真正替换进 url()")
                }
                # 占位符不得残留
                $left = Get-OccurrenceCount -Text $probe.Text -Needle $script:BackgroundDarkPlaceholder
                if ($left -ne 0) {
                    Stop-Fail "背景复核：'$($c.Dest)' 残留占位符 $($script:BackgroundDarkPlaceholder) $left 处"
                }
                Write-Log "        [有背景] $($c.Tree)/$($c.Rel)  真图 url() 命中 $urlHits 处（裸 marker $hits 处，含文件头注释 1 处）  占位符残留 0 处"
            }
            else {
                if ($hits -ne 0) {
                    Stop-Fail "背景复核：'$($c.Dest)' 不应含 '$bgMarker'，实际 $hits 处（背景只应进 renderer 树的深色主题文件）"
                }
                Write-Log "        [无背景] $($c.Tree)/$($c.Rel)  data:image/png 命中 0 处"
            }
        }
        $script:Completed.Add('步骤5-6：背景落盘回读复核（仅 renderer 深色主题含真图 url()）')
    }

    # ------------------------------------------------------------------
    # 7-9. 改三处注册表
    # ------------------------------------------------------------------
    Write-Head '[步骤 7-9/13] 改三处注册表'

    $stepNo = 7
    foreach ($r in $registryPlans) {
        if ($r.Action -eq 'skip-already-patched') {
            Write-Log "      [步骤 $stepNo] $($r.Label)：已贴过，跳过（幂等）  主题数 $($r.CountBefore)"
        }
        else {
            Write-Utf8NoBomFile -Path $r.Path -Text $r.NewText
            # 落盘后回读独立复核（不是复用内存里的预演结果）
            $after = Read-Utf8File -Path $r.Path
            if ((Get-BytesSha256 $after.Bytes) -cne (Get-BytesSha256 ($script:Utf8NoBom.GetBytes($r.NewText)))) {
                Stop-Fail "$($r.Label)：写入后回读与预期文本不一致"
            }
            $state = Get-RegistryLiteralByAnchor -Text $after.Text -Anchor $r.Anchor -What "$($r.Label)（改后复核）"
            $eval = Invoke-NodeLiteralEval -Literal $state.Literal -What "$($r.Label)（改后复核）"
            if ([int]$eval.count -ne $r.CountAfter) {
                Stop-Fail "$($r.Label)：改后回读主题数为 $($eval.count)，期望 $($r.CountAfter)"
            }
            foreach ($id in $r.NewIds) {
                if (@($eval.ids) -notcontains [string]$id) { Stop-Fail "$($r.Label)：改后回读缺少新主题 '$id'" }
            }
            Write-Log "      [步骤 $stepNo] $($r.Label)：已插入 $(@($r.NewIds).Count) 项  主题数 $($r.CountBefore) -> $([int]$eval.count)（node 真求值）"
        }
        $fileRecords.Add([pscustomobject]@{
                Tree = $r.Tree; RelPath = $r.Rel; Action = $r.Action
                Sha256 = (Get-FileSha256 $r.Path); Sha256Before = $r.Sha256Before
                Bytes = (Get-Item -LiteralPath $r.Path).Length
            })
        $script:Completed.Add("步骤${stepNo}：注册表 $($r.Label)（$($r.Action)）")
        $stepNo++
    }

    # ------------------------------------------------------------------
    # 9b. 补卡片调色板（server bundle 的 MGr 表，工单 73）
    # ------------------------------------------------------------------
    Write-Head '[步骤 9b/13] 补卡片调色板（server bundle/index.js 的 MGr 表）'

    if ($cardPalettePlan.Action -eq 'skip-already-patched') {
        Write-Log "      [$($cardPalettePlan.Label)]：已贴过，跳过（幂等）  调色板项数 $($cardPalettePlan.CountBefore)（逐键逐值复核通过）"
    }
    else {
        Write-Utf8NoBomFile -Path $cardPalettePlan.Path -Text $cardPalettePlan.NewText
        # 落盘后回读独立复核（不复用内存里的预演结果）
        $palAfter = Read-Utf8File -Path $cardPalettePlan.Path
        if ((Get-BytesSha256 $palAfter.Bytes) -cne $cardPalettePlan.Sha256After) {
            Stop-Fail "[$($cardPalettePlan.Label)]：写入后回读 sha256 与预期不一致（实际 $(Get-BytesSha256 $palAfter.Bytes)，期望 $($cardPalettePlan.Sha256After)）"
        }
        if (-not $palAfter.Text.Contains($cardPalettePlan.Anchor + $cardPalettePlan.InsertText)) {
            Stop-Fail "[$($cardPalettePlan.Label)]：回读发现 insertText 未紧跟在锚点之后"
        }
        $palState = Get-RegistryLiteralByAnchor -Text $palAfter.Text -Anchor $cardPalettePlan.Anchor -What "$($cardPalettePlan.Label)（改后复核）"
        $palEval = Invoke-NodePaletteEval -Literal $palState.Literal -What "$($cardPalettePlan.Label)（改后复核）"
        if ([int]$palEval.count -ne $cardPalettePlan.CountAfter) {
            Stop-Fail "[$($cardPalettePlan.Label)]：改后回读调色板有 $($palEval.count) 项，期望 $($cardPalettePlan.CountAfter)"
        }
        $palProblems = @(Test-PaletteEntries -Eval $palEval -Ids @($cardPalettePlan.NewIds) -Keys @($cardPalettePlan.PaletteKeys) `
            -Expected (Get-RequiredProp $palettePatch 'byThemeId' "patch $($script:CardPalettePatchFile)"))
        if ($palProblems.Count -gt 0) { Stop-Fail "[$($cardPalettePlan.Label)]：改后回读内容不符 —— $($palProblems -join '；')" }
        Write-Log "      [$($cardPalettePlan.Label)]：已插入 $(@($cardPalettePlan.NewIds).Count) 项  调色板项数 $($cardPalettePlan.CountBefore) -> $([int]$palEval.count)（node 真求值）"
        Write-Log "          新增：$((@($cardPalettePlan.NewIds)) -join ', ')（每项 $(@($cardPalettePlan.PaletteKeys).Count) 个键，逐键逐值核对）"
        Write-Log "          sha256=$(Get-FileSha256 $cardPalettePlan.Path)  bytes=$($palAfter.Bytes.Length)"
    }
    $fileRecords.Add([pscustomobject]@{
            Tree = $cardPalettePlan.Tree; RelPath = $cardPalettePlan.Rel; Action = $cardPalettePlan.Action
            Sha256 = (Get-FileSha256 $cardPalettePlan.Path); Sha256Before = $cardPalettePlan.Sha256Before
            Bytes = (Get-Item -LiteralPath $cardPalettePlan.Path).Length
        })
    $script:Completed.Add("步骤9b：补卡片调色板（$($cardPalettePlan.Action)）")

    # ------------------------------------------------------------------
    # 10b. 改 renderer lib/theme.js：主题 CSS 加版本参数（工单 16）
    # ------------------------------------------------------------------
    if ($null -ne $script:ThemeCacheBustPlan) {
        $tcb = $script:ThemeCacheBustPlan
        Write-Head '[步骤 10b/13] 改 renderer lib/theme.js：主题 CSS 加版本参数（绕过渲染器 HTTP 缓存）'
        if ($tcb.Action -eq 'skip-no-change') {
            Write-Log "      [renderer/lib/theme.js]：版本串未变（$($tcb.VersionValue)），跳过（幂等，未重写文件）"
        }
        else {
            Write-Utf8NoBomFile -Path $tcb.Path -Text $tcb.NewText
            # 落盘后回读独立复核（不复用内存里的预演结果）
            $after = Read-Utf8File -Path $tcb.Path
            if ((Get-BytesSha256 $after.Bytes) -cne $tcb.Sha256After) {
                Stop-Fail "[$($tcb.Rel)]：写入后回读 sha256 与预期不一致（实际 $(Get-BytesSha256 $after.Bytes)，期望 $($tcb.Sha256After)）"
            }
            $declExpect = 'const ' + $tcb.ConstantName + '="' + $tcb.VersionValue + '";'
            if (-not $after.Text.Contains($declExpect)) {
                Stop-Fail "[$($tcb.Rel)]：回读发现版本常量声明未按预期写入"
            }
            foreach ($site in $script:ThemeCacheBustSites) {
                $cAfter = Get-OccurrenceCount -Text $after.Text -Needle $site.After
                $cBefore = Get-OccurrenceCount -Text $after.Text -Needle $site.Before
                if ($cAfter -ne 1) { Stop-Fail "[$($tcb.Rel)]：回读 '$($site.Name)' 新锚点命中 $cAfter 次（要求 1）" }
                if ($cBefore -ne 0) { Stop-Fail "[$($tcb.Rel)]：回读 '$($site.Name)' 仍残留改前锚点 $cBefore 次" }
            }
            $versionedReadback = Get-VersionedCssPathCount -Text $after.Text
            if ($versionedReadback -ne 0) {
                Stop-Fail "[$($tcb.Rel)]：回读发现 $versionedReadback 处带 '?v=' 的 cssPath —— 注册表被波及（CardShell 打印会受影响）"
            }
            if ((Get-OccurrenceCount -Text $after.Text -Needle $script:ThemeCacheBustCssPathProbe) -ne $tcb.CssPathProbeBefore) {
                Stop-Fail "[$($tcb.Rel)]：回读发现 cssPath 总处数与改动前不一致 —— 注册表结构被波及"
            }
            $tcbVerb = if ($tcb.Action -eq 'insert') { '已注入版本常量并把 4 处主题 CSS URL 改为带版本参数' } else { '版本串已变化，已替换常量值（4 处 URL 不动）' }
            Write-Log "      [renderer/lib/theme.js]：$tcbVerb"
            Write-Log ('          版本常量 ' + $tcb.ConstantName + ' = "' + $tcb.VersionValue + '"')
            Write-Log "          4 处 URL 回读复核通过（新锚点各 1 次、改前锚点 0 次）"
            Write-Log "          sha256=$($tcb.Sha256After)  bytes=$($tcb.BytesAfter)"
        }
        $fileRecords.Add([pscustomobject]@{
                Tree = $tcb.Tree; RelPath = $tcb.Rel; Action = $tcb.Action
                Sha256 = (Get-FileSha256 $tcb.Path); Sha256Before = $tcb.Sha256Before
                Bytes = (Get-Item -LiteralPath $tcb.Path).Length
                ThemeCacheBust = $tcb.VersionValue
            })
        $script:Completed.Add("步骤10b：改 renderer lib/theme.js 主题 CSS 版本参数（$($tcb.Action)）")
    }

    # ------------------------------------------------------------------
    # 10c. 追加浮层面板取景框 JS（工单 30）
    # ------------------------------------------------------------------
    # 与 10b 的关系：10b 先写「注册表 + 版本常量」，10c 再在**那个文本**基础上追加面板 JS。
    # 两步各写一次同一个文件，各自回读独立复核；fileRecords 里因此会有多条 lib/theme.js
    # （与现状一致，check.ps1 取**最后一条**为准）。
    if ($null -ne $script:PanelFramePlan) {
        # 2026-10-18：多主题时 lib/theme.js 只有一个，而每主题一个 JS 块（链式追加）。
        # 所以**只写一次**：取最后一个 plan 的 NewText（它已包含前面所有块的叠加），
        # 但每个块的标记行与整段 JS 都要逐个回读复核。
        $pf = $script:PanelFramePlans[$script:PanelFramePlans.Count - 1]
        Write-Head '[步骤 10c/13] 追加浮层面板取景框 JS 到 renderer lib/theme.js'
        Write-Utf8NoBomFile -Path $pf.Path -Text $pf.NewText
        # 落盘后回读独立复核（不复用内存里的预演结果）
        $pfAfter = Read-Utf8File -Path $pf.Path
        if ((Get-BytesSha256 $pfAfter.Bytes) -cne $pf.Sha256After) {
            Stop-Fail "[$($pf.Rel)]：写入后回读 sha256 与预期不一致（实际 $(Get-BytesSha256 $pfAfter.Bytes)，期望 $($pf.Sha256After)）"
        }
        foreach ($pfc in $script:PanelFramePlans) {
            if ((Get-OccurrenceCount -Text $pfAfter.Text -Needle $pfc.Marker) -ne 1) {
                Stop-Fail "[$($pf.Rel)]：回读发现标记行 '$($pfc.Marker)' 命中数不为 1"
            }
            if ((Get-OccurrenceCount -Text $pfAfter.Text -Needle $pfc.JsText) -ne 1) {
                Stop-Fail "[$($pf.Rel)]：回读发现主题 '$($pfc.ThemeId)' 的整段面板 JS 源命中数不为 1"
            }
        }
        if ((Get-OccurrenceCount -Text $pfAfter.Text -Needle $script:PanelFrameFeature) -lt $script:PanelFramePlans.Count) {
            Stop-Fail "[$($pf.Rel)]：回读发现特征串 '$($script:PanelFrameFeature)' 命中数少于主题数 $($script:PanelFramePlans.Count)"
        }
        # 面板 CSS 必须真的在 renderer 主题文件里（server 树不含）。
        # 工单 31：扩到五个目标，逐个核对（任一缺失即判失败）。
        $panelCssProbes = @(
            '#chalkboardCardCenterPanel > [class*="floatingPanelInner"]',
            '#capabilitiesPanel > [class*="floatingPanelInner"]',
            '#automationHubPanel > [class*="floatingPanelInner"]',
            '[data-testid="market-modal-overlay"] > [class*="container"]',
            ':has(> [data-input-ctx-zone="settings"])'
        )
        foreach ($c in $cssPlans) {
            $probe = Read-Utf8File -Path $c.Dest
            $hits = 0
            foreach ($needle in $panelCssProbes) {
                if ((Get-OccurrenceCount -Text $probe.Text -Needle $needle) -ge 1) { $hits++ }
            }
            if ($c.PanelFramePart -ne 'none') {
                if ($hits -lt $panelCssProbes.Count) {
                    Stop-Fail "面板 CSS 复核：'$($c.Dest)' 只命中 $hits/$($panelCssProbes.Count) 个目标选择器 —— 面板规则没有完整贴进去"
                }
                Write-Log "        [有面板规则] $($c.Tree)/$($c.Rel)  目标选择器命中 $hits/$($panelCssProbes.Count) 处"
            }
            else {
                if ($hits -ne 0) { Stop-Fail "面板 CSS 复核：'$($c.Dest)' 不应含面板规则，实际命中 $hits 个目标选择器" }
            }
        }
        $pfVerb = if ($pf.Action -eq 'append') { '已追加面板 JS' } else { '已重写面板 JS 段（幂等）' }
        Write-Log "      [renderer/lib/theme.js]：$pfVerb"
        Write-Log "          标记行回读 1 处；整段面板 JS 源回读 1 处"
        Write-Log "          sha256=$($pf.Sha256After)  bytes=$($pf.BytesAfter)"
        $fileRecords.Add([pscustomobject]@{
                Tree = $pf.Tree; RelPath = $pf.Rel; Action = $pf.Action
                Sha256 = (Get-FileSha256 $pf.Path); Sha256Before = $pf.Sha256Before
                Bytes = (Get-Item -LiteralPath $pf.Path).Length
                PanelFrame = 'on'
            })
        $script:Completed.Add("步骤10c：追加浮层面板取景框 JS（$($pf.Action)）")
    }

    # ------------------------------------------------------------------
    # 10d. 改两个独立文档的主题 <link>（工单 36-B）
    # ------------------------------------------------------------------
    Write-Head '[步骤 10d/13] 改两个独立文档的主题 <link>（browser-viewer.html / viewer-window.html）'

    foreach ($tlp in $script:ThemeLinkPlans) {
        if ($tlp.Action -eq 'skip-no-change') {
            Write-Log "      [renderer/$($tlp.Rel)]：已贴过且逐字相同（$($tlp.TargetHref)），跳过（幂等，未重写文件）"
        }
        else {
            Write-Utf8NoBomFile -Path $tlp.Path -Text $tlp.NewText
            # 落盘后回读独立复核（不复用内存里的预演结果）
            $tlAfter = Read-Utf8File -Path $tlp.Path
            if ((Get-BytesSha256 $tlAfter.Bytes) -cne $tlp.Sha256After) {
                Stop-Fail "[renderer/$($tlp.Rel)]：写入后回读 sha256 与预期不一致（实际 $(Get-BytesSha256 $tlAfter.Bytes)，期望 $($tlp.Sha256After)）"
            }
            # ① 目标 link 恰好 1 处；② warm-paper 引用 0 处；③ #themeSheet 恰好 1 处；④ 行尾未被改动
            $tHits = Get-OccurrenceCount -Text $tlAfter.Text -Needle $tlp.TargetLink
            if ($tHits -ne 1) { Stop-Fail "[renderer/$($tlp.Rel)]：回读目标 link 命中 $tHits 次（要求 1）" }
            $warmLeft = Get-OccurrenceCount -Text $tlAfter.Text -Needle 'assets/warm-paper-'
            if ($warmLeft -ne 0) { Stop-Fail "[renderer/$($tlp.Rel)]：回读仍残留 'assets/warm-paper-' $warmLeft 处" }
            $idLeft = Get-OccurrenceCount -Text $tlAfter.Text -Needle ('id="' + $script:ThemeLinkId + '"')
            if ($idLeft -ne 1) { Stop-Fail "[renderer/$($tlp.Rel)]：回读 id=`"$($script:ThemeLinkId)`" 命中 $idLeft 次（要求 1）" }
            if ((Get-OccurrenceCount -Text $tlAfter.Text -Needle ('href="' + $tlp.TargetHref + '"')) -ne 1) {
                Stop-Fail "[renderer/$($tlp.Rel)]：回读 href=`"$($tlp.TargetHref)`" 命中数不为 1 —— 主题 link 不唯一"
            }
            if ([regex]::Matches($tlAfter.Text, $script:ThemeLinkPattern).Count -ne 0) {
                Stop-Fail "[renderer/$($tlp.Rel)]：回读整段 warm-paper <link> 正则仍有命中 —— 替换不干净"
            }
            # 用户可见项：文档里 <html> 的 data-theme 由 lib/theme.js 设；那个 <script> 必须还在
            if (-not $tlAfter.Text.Contains('lib/theme.js')) {
                Stop-Fail "[renderer/$($tlp.Rel)]：回读发现 lib/theme.js 的 <script> 不见了 —— 改动波及了其它内容"
            }
            $tlActNote = if ($tlp.State -eq 'plain') { '已替换写死的 warm-paper 引用' } else { '版本串 / 主题已变化，已重写该主题 link（幂等）' }
            Write-Log "      [renderer/$($tlp.Rel)]：$tlActNote"
            Write-Log "          改后：$($tlp.TargetLink)"
            Write-Log "          回读复核：目标 link 1 处；'assets/warm-paper-' 0 处；id=`"$($script:ThemeLinkId)`" 1 处"
            Write-Log "          sha256=$($tlp.Sha256After)  bytes=$($tlp.BytesAfter)"
        }
        $fileRecords.Add([pscustomobject]@{
                Tree = $tlp.Tree; RelPath = $tlp.Rel; Action = $tlp.Action
                Sha256 = (Get-FileSha256 $tlp.Path); Sha256Before = $tlp.Sha256Before
                Bytes = (Get-Item -LiteralPath $tlp.Path).Length
                ThemeLink = $tlp.TargetHref
            })
    }
    $script:Completed.Add('步骤10d：改两个独立文档的主题 <link>（browser-viewer.html / viewer-window.html）')

    # ------------------------------------------------------------------
    # 10. 改两棵树主题卡片预览配色 CSS
    # ------------------------------------------------------------------
    Write-Head '[步骤 10/13] 改两棵树主题卡片预览配色 CSS（SettingsModalShell-*.css）'

    foreach ($cp in $cardPlans) {
        if ($cp.Action -eq 'skip-already-patched') {
            Write-Log "      [$($cp.Tree)] $($cp.Rel)：已贴过，跳过（幂等）  卡片规则数 $($cp.RuleCountBefore)"
        }
        else {
            Write-Utf8NoBomFile -Path $cp.Path -Text $cp.NewText
            # 落盘后回读独立复核（不是复用内存里的预演结果）
            $after = Read-Utf8File -Path $cp.Path
            if ((Get-BytesSha256 $after.Bytes) -cne (Get-BytesSha256 ($script:Utf8NoBom.GetBytes($cp.NewText)))) {
                Stop-Fail "[$($cp.Tree)] $($cp.Rel)：写入后回读与预期文本不一致"
            }
            if (-not $after.Text.Contains($cp.Anchor + $cp.FullInsertText)) {
                Stop-Fail "[$($cp.Tree)] $($cp.Rel)：回读发现 insertText 未紧跟在锚点之后"
            }
            foreach ($rule in $cp.ExpectedRules) {
                $c = Get-OccurrenceCount -Text $after.Text -Needle $rule
                if ($c -ne 1) { Stop-Fail "[$($cp.Tree)] $($cp.Rel)：回读规则命中 $c 次（要求 1）—— $rule" }
            }
            $ruleCountNow = Get-OccurrenceCount -Text $after.Text -Needle $cp.CardRuleProbe
            if ($ruleCountNow -ne $cp.RuleCountAfter) {
                Stop-Fail "[$($cp.Tree)] $($cp.Rel)：回读卡片规则数为 $ruleCountNow，期望 $($cp.RuleCountAfter)"
            }
            Write-Log "      [$($cp.Tree)] $($cp.Rel)：已插入 $($cp.ExpectedRules.Count) 条规则（$($cp.NewIds.Count) 主题 x 3 条）  卡片规则数 $($cp.RuleCountBefore) -> $ruleCountNow"
            Write-Log "          sha256=$(Get-FileSha256 $cp.Path)"
        }
        $fileRecords.Add([pscustomobject]@{
                Tree = $cp.Tree; RelPath = $cp.Rel; Action = $cp.Action
                Sha256 = (Get-FileSha256 $cp.Path); Sha256Before = $cp.Sha256Before
                Bytes = (Get-Item -LiteralPath $cp.Path).Length
            })
    }
    $script:Completed.Add('步骤10：改两棵树主题卡片预览配色 CSS（SettingsModalShell-*.css）')

    # ------------------------------------------------------------------
    # 11. 补 i18n
    # ------------------------------------------------------------------
    Write-Head '[步骤 11/13] 补 i18n 到 renderer locales/*.json'

    foreach ($l in $localePlans) {
        if ($l.Action -eq 'skip-no-change') {
            Write-Log "      [locales/$($l.Locale).json] 全部键均已存在，跳过（幂等，不重写文件）"
        }
        else {
            Write-Utf8NoBomFile -Path $l.Path -Text $l.NewText
            $after = Read-Utf8File -Path $l.Path
            $newRoot = $after.Text | ConvertFrom-Json
            $app = Get-Prop (Get-Prop $newRoot 'settings') 'appearance'
            foreach ($leaf in $l.Added) {
                $got = Get-Prop $app $leaf
                if ([string]::IsNullOrEmpty([string]$got)) { Stop-Fail "locales/$($l.Locale).json：回读缺少键 '$leaf'" }
            }
            # 只增键 + 改名：原键仍在，值只有「登记过的改名键」允许变
            $renamedLeaves = @($l.Renamed)
            foreach ($name in $l.OrigNames) {
                $b = Get-Prop $app $name | ConvertTo-Json -Depth 100 -Compress
                if ($renamedLeaves -contains $name) {
                    $want = Get-Prop $l.NewAppearance $name | ConvertTo-Json -Depth 100 -Compress
                    if ($b -cne $want) { Stop-Fail "locales/$($l.Locale).json：改名键 '$name' 回读值与计划不符" }
                }
                else {
                    $a = Get-Prop $l.OrigAppearance $name | ConvertTo-Json -Depth 100 -Compress
                    if ($a -cne $b) { Stop-Fail "locales/$($l.Locale).json：回读发现既有键 '$name' 被改动" }
                }
            }
            $skippedNote = if (@($l.Skipped).Count -gt 0) { "（跳过已存在：$((@($l.Skipped)) -join ', ')）" } else { '' }
            $renamedNote = if (@($l.Renamed).Count -gt 0) { "，改名 $((@($l.Renamed)) -join ', ')" } else { '' }
            Write-Log "      [locales/$($l.Locale).json] 新增 $(@($l.Added).Count) 键$renamedNote$skippedNote"
        }
        $fileRecords.Add([pscustomobject]@{
                Tree = 'renderer'; RelPath = "locales/$($l.Locale).json"; Action = $l.Action
                Sha256 = (Get-FileSha256 $l.Path); Sha256Before = $l.Sha256Before
                Bytes = (Get-Item -LiteralPath $l.Path).Length
            })
    }
    $script:Completed.Add('步骤11：补 i18n 到 5 个 locale 文件')

    # ------------------------------------------------------------------
    # 12. 写 skin.json
    # ------------------------------------------------------------------
    Write-Head '[步骤 12/13] 写 skin.json'

    $skin = [ordered]@{
        schema        = 1
        skin          = 'hana-moonlit-court'
        displayName   = '月满庭'
        appliedAt     = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        appliedAtLocal = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        tool          = 'scripts/apply.ps1'
        repoRoot      = $RepoRoot
        renderer      = [ordered]@{ versionDir = $RendererDir; version = $rendererVersion }
        server        = [ordered]@{ versionDir = $ServerDir; version = $serverVersion }
        versionLabel  = $versionLabel
        backupDir     = $script:BackupDir
        # 备份根（工单 78）：本次用的根目录 + 它从哪来。换盘 / 换工作树时先看这两个字段。
        backupRoot    = $BackupRoot
        backupRootSource = $backupRootSource
        pristineBackupDir = $pristineBackupDir
        previousBackupDirs = @($existingBackups)
        # 材质档位（工单 08）。none 时 materialSource 为 $null：如实记录"本次没贴材质"。
        material      = $script:MaterialTier
        materialSource = if ($script:MaterialTier -eq 'none') { $null } else {
            # 2026-10-18：多主题 —— 顶层字段记"首个主题"（保持旧读法可用），
            # 完整名单记在 byThemeId。
            $firstMat = $script:ThemeDefs | Where-Object { $null -ne $_.MaterialSource } | Select-Object -First 1
            [ordered]@{
                tier      = $script:MaterialTier
                path      = if ($firstMat) { "src/$($firstMat.MaterialDir)/$($script:MaterialTier).css" } else { $null }
                sha256    = if ($firstMat) { $firstMat.MaterialSource.Sha256 } else { $null }
                appliedTo = 'renderer'
                byThemeId = [ordered]@{}
                note      = 'renderer 树 themes/*.css = 配色源 + 换行 + 材质源（每主题各取自己的源）；server 树不贴材质源（其成分见 appSurfaceSource）'
            }
        }
        # App 面材质（工单 41）：src/app-surface/*.css，只贴 **server 树**。
        # 目录为空时为 $null：如实记录"本次没贴 App 面材质"。
        # 只作用于首个主题的 server CSS 文件（App 面不吃主题作用域，两份文件内容相同）。
        appSurface    = if ($null -eq $script:AppSurfaceSources) { $null } else { 'on' }
        appSurfaceSource = if ($null -eq $script:AppSurfaceSources) { $null } else {
            $firstThemeId = $script:ThemeDefs[0].Id
            [ordered]@{
                count     = $script:AppSurfaceSources.Count
                dir       = "src/$($script:AppSurfaceDir)"
                sources   = @($script:AppSurfaceSources.Items | ForEach-Object {
                        [ordered]@{
                            path   = $_.Rel
                            sha256 = $_.Sha256
                            bytes  = $_.Bytes
                        }
                    })
                paths     = @($script:AppSurfaceSources.Items | ForEach-Object { $_.Rel })
                path      = if ($script:AppSurfaceSources.Count -eq 1) { $script:AppSurfaceSources.Items[0].Rel } else { $null }
                sha256    = if ($script:AppSurfaceSources.Count -eq 1) { $script:AppSurfaceSources.Items[0].Sha256 } else { $null }
                appliedTo = 'server'
                appliedThemeId = $firstThemeId
                feature   = $script:AppSurfaceFeature
                separator = '换行（每份源之间一个）'
                composition = 'server 树 desktop/dist-renderer/themes/*.css = 配色源 + 换行 + src/app-surface/*.css（文件名字典序）'
                composedServerSha256 = @($fileRecords | Where-Object {
                        $_.Tree -eq 'server' -and $_.RelPath -eq "desktop/dist-renderer/themes/$firstThemeId.css"
                    } | ForEach-Object { $_.Sha256 })
                note      = 'server 树是 App 面唯一的样式表入口（server bundle 的 /apps/theme.css 路由原样读它，只把 [data-theme="…"] 替换成 :root）；App 面不吃背景（源内禁止 data:image），renderer 树不含本源。'
            }
        }
        # 背景档位（工单 14）。none 时 backgroundSource 为 $null：如实记录"本次没贴背景"。
        background    = $script:BackgroundTier
        backgroundSource = if ($script:BackgroundTier -eq 'none') { $null } else {
            $firstBg = $script:ThemeDefs | Where-Object { $null -ne $_.BackgroundSource } | Select-Object -First 1
            [ordered]@{
                tier      = $script:BackgroundTier
                path      = if ($firstBg) { "src/$($firstBg.BackgroundDir)/$($script:BackgroundTier).css" } else { $null }
                sha256    = if ($firstBg) { $firstBg.BackgroundSource.Sha256 } else { $null }
                asset     = if ($firstBg) { "src/$($firstBg.BackgroundDir)/$($firstBg.BackgroundAsset)" } else { $null }
                assetSha256 = if ($firstBg) { $firstBg.BackgroundSource.AssetSha256 } else { $null }
                assetBytes  = if ($firstBg) { $firstBg.BackgroundSource.AssetBytes } else { $null }
                dataUriSha256 = if ($firstBg) { $firstBg.BackgroundSource.DataUriSha256 } else { $null }
                appliedTo = 'renderer'
                appliedThemeId = if ($firstBg) { $firstBg.Id } else { $null }
                placeholder = $script:BackgroundDarkPlaceholder
                byThemeId = [ordered]@{}
                composedRendererSha256 = @($fileRecords | Where-Object {
                        $_.Tree -eq 'renderer' -and $firstBg -and $_.RelPath -eq "themes/$($firstBg.Id).css"
                    } | ForEach-Object { $_.Sha256 })
                note      = '只给 renderer 树的主题文件写「配色源 + [材质源] + 背景源」（每主题各取自己的源）；server 树不含背景'
            }
        }
        # 浮层面板取景框（工单 30）。未加载面板源时为 $null：如实记录「本次没贴」。
        panelFrame = if ($null -eq $script:PanelFramePlan) { $null } else { 'on' }
        panelFrameSource = if ($null -eq $script:PanelFramePlan) { $null } else {
            $firstPf = $script:ThemeDefs | Where-Object { $null -ne $_.PanelFrameSources } | Select-Object -First 1
            [ordered]@{
                cssPath        = if ($firstPf) { "src/$($firstPf.PanelFrameDir)/$($script:PanelFrameCssFile)" } else { $null }
                cssSha256      = if ($firstPf) { $firstPf.PanelFrameSources.CssSha256 } else { $null }
                jsPath         = if ($firstPf) { "src/$($firstPf.PanelFrameDir)/$($script:PanelFrameSourceFile)" } else { $null }
                jsSha256       = if ($firstPf) { $firstPf.PanelFrameSources.JsSha256 } else { $null }
                marker         = $script:PanelFramePlan.Marker
                markers        = @($script:PanelFramePlans | ForEach-Object { $_.Marker })
                jsTarget       = 'renderer/lib/theme.js'
                appliedTo      = 'renderer'
                appliedThemeId = if ($firstPf) { $firstPf.Id } else { $null }
                byThemeId      = [ordered]@{}
                scopedPanels   = @('chalkboardCardCenterPanel', 'capabilitiesPanel', 'automationHubPanel', 'market-modal-overlay', 'settings-modal')
                note           = '面板 CSS 拼在各自主题文件末尾；面板 JS 追加到 renderer lib/theme.js 末尾（每个主题一个独立标记行，可共存）。目标：卡片中心 / 能力 / 自动化 三个浮层面板 + 扩展（市场）模态 + 设置模态。'
            }
        }
        # 主题 CSS 版本参数（工单 16）。none 时 themeCacheBust 为 $null：如实记录"本次没给 theme.js 加版本参数"。
        # themeCacheBust = 版本串本体（16 位十六进制，= 合成后主题 CSS 的 sha256 前 16 位）；
        # themeCacheBustQuery = 实际拼进 URL 的查询串（'?v=' + 版本串）。
        themeCacheBust = if ($script:ThemeCacheBustMode -ne 'on') { $null } else { $script:ThemeCacheBustVersion }
        themeCacheBustQuery = if ($null -eq $script:ThemeCacheBustPlan) { $null } else { $script:ThemeCacheBustPlan.VersionValue }
        themeCacheBustSource = if ($null -eq $script:ThemeCacheBustPlan) { $null } else {
            [ordered]@{
                mode      = $script:ThemeCacheBustMode
                version   = $script:ThemeCacheBustPlan.VersionValue
                previousVersion = $script:ThemeCacheBustPlan.OldVersionValue
                algorithm = 'sha256(renderer 树**单份**合成后主题 CSS) 前 16 位（共 16 位十六进制；工单 21 起单主题）'
                constant  = $script:ThemeCacheBustPlan.ConstantName
                file      = $script:ThemeCacheBustPlan.Path
                relPath   = $script:ThemeCacheBustPlan.Rel
                action    = $script:ThemeCacheBustPlan.Action
                state     = $script:ThemeCacheBustPlan.State
                siteCount = $script:ThemeCacheBustPlan.SiteCount
                sites     = @($script:ThemeCacheBustSites | ForEach-Object {
                        [ordered]@{ name = $_.Name; before = $_.Before; after = $_.After }
                    })
                registryCssPathUntouched = $true
                versionedCssPathCount = 0
                cssPathProbeBefore  = $script:ThemeCacheBustPlan.CssPathProbeBefore
                cssPathProbeAfter   = $script:ThemeCacheBustPlan.CssPathProbeAfter
                composedSha256 = @($cssPlans | Where-Object { $_.Tree -eq 'renderer' } | ForEach-Object {
                        [ordered]@{
                            themeId  = $_.ThemeId
                            sha256   = $_.SourceSha
                            prefix16 = ([string]$_.SourceSha).Substring(0, 16)
                        }
                    })
                note      = '只在 lib/theme.js 里给主题 CSS 的 URL 加 ?v=<版本串> 以绕过渲染器 HTTP 缓存；注册表三处 cssPath 一律不改（assets/CardShell-*.js 打印依赖）'
            }
        }
        # 独立文档的主题 <link>（工单 36-B）：browser-viewer.html / viewer-window.html。
        # 记录目标 href（含 ?v= 的同源版本串）与逐文件 sha256，check.ps1 据此核对落盘内容。
        themeLinks = @($script:ThemeLinkPlans | ForEach-Object {
                [ordered]@{
                    relPath        = $_.Rel
                    display        = $_.Display
                    file           = $_.Path
                    action         = $_.Action
                    state          = $_.State
                    targetHref     = $_.TargetHref
                    targetLink     = $_.TargetLink
                    cacheBustQuery = $_.CacheBust
                    anchorPattern  = $script:ThemeLinkPattern
                    regexHitsBefore = $_.RegexBefore
                    warmPaperHitsBefore = $_.WarmCountBefore
                    warmPaperHitsAfter  = $_.WarmCountAfter
                    themeSheetIdHitsBefore = $_.SheetIdBefore
                    themeSheetIdHitsAfter  = $_.SheetIdAfter
                    sha256Before   = $_.Sha256Before
                    sha256After    = $_.Sha256After
                    bytesBefore    = $_.BytesBefore
                    bytesAfter     = $_.BytesAfter
                    note           = '两个独立文档原本加载写死的 assets/warm-paper-<hash>.css（作用域 [data-theme=warm-paper],:root:not([data-theme])，与文档 data-theme=hana-moonlit-court 不匹配 -> 变量全空）；改为当前主题 link 并加 id=themeSheet，使 lib/theme.js 能接管（与其它 7 个 html 同构）。锚点用通配匹配 assets/warm-paper-*.css，不写死构建哈希。'
                }
            })
        themes        = @($script:ThemeDefs | ForEach-Object {
                $themeDef = $_
                # 落盘后的目标 sha256 从本次实际写盘记录里取（材质合成后与配色源不同），
                # 不重算也不复用源哈希——skin.json 要如实反映"装进去的是什么"。
                $rendererRecord = @($fileRecords | Where-Object { $_.Tree -eq 'renderer' -and $_.RelPath -eq "themes/$($themeDef.File)" })
                $serverRecord = @($fileRecords | Where-Object { $_.Tree -eq 'server' -and $_.RelPath -eq "desktop/dist-renderer/themes/$($themeDef.File)" })
                [ordered]@{
                    id      = $themeDef.Id
                    cssPath = "themes/$($themeDef.File)"
                    source  = "src/$($themeDef.File)"
                    sha256  = $themeDef.SourceSha256
                    material = if ($rendererRecord.Count -gt 0) { $rendererRecord[0].Material } else { 'none' }
                    background = if ($rendererRecord.Count -gt 0) { $rendererRecord[0].Background } else { 'none' }
                    appSurface = if ($serverRecord.Count -gt 0) { $serverRecord[0].AppSurface } else { 'none' }
                    # 两棵树的 sha256 都是**落盘实测**值（server 树那份是"配色源 + App 面材质源"合成后的
                    # 哈希，不是配色源哈希）—— 与盘上 Get-FileHash 一致，别改成源哈希。
                    rendererSha256 = if ($rendererRecord.Count -gt 0) { $rendererRecord[0].Sha256 } else { $null }
                    serverSha256   = if ($serverRecord.Count -gt 0) { $serverRecord[0].Sha256 } else { $null }
                }
            })
        registryAssertions = @($registryPlans | ForEach-Object {
                [ordered]@{
                    label            = $_.Label
                    tree             = $_.Tree
                    file             = $_.Path
                    action           = $_.Action
                    anchorOccurrences = $_.AnchorCount
                    followedByOk     = $_.FollowedByOk
                    beforeContextOk  = $_.BeforeContextOk
                    countBaseline    = $_.CountBefore
                    countAfter       = $_.CountAfter
                    expectedCountAfter = $_.CountAfter
                    newThemeIds      = @($_.NewIds)
                }
            })
        cardPreviewAssertions = @($cardPlans | ForEach-Object {
                [ordered]@{
                    label             = $_.Label
                    tree              = $_.Tree
                    file              = $_.Path
                    relPath           = $_.Rel
                    action            = $_.Action
                    anchorOccurrences = $_.AnchorCount
                    followedByOk      = $_.FollowedByOk
                    globCandidates    = $_.CandidateCount
                    featureMatches    = $_.FeatureMatchCount
                    rulesPerTheme     = 3
                    ruleCountBefore   = $_.RuleCountBefore
                    ruleCountAfter    = $_.RuleCountAfter
                    newThemeIds       = @($_.NewIds)
                }
            })
        cardPaletteAssertions = @(
            [ordered]@{
                label             = $cardPalettePlan.Label
                tree              = $cardPalettePlan.Tree
                file              = $cardPalettePlan.Path
                relPath           = $cardPalettePlan.Rel
                patch             = "patches/$($script:CardPalettePatchFile)"
                action            = $cardPalettePlan.Action
                anchorOccurrences = $cardPalettePlan.AnchorCount
                followedByKind    = $cardPalettePlan.FollowedByKind
                beforeContextOk   = $cardPalettePlan.BeforeContextOk
                paletteCountBefore = $cardPalettePlan.CountBefore
                paletteCountAfter  = $cardPalettePlan.CountAfter
                paletteKeys        = @($cardPalettePlan.PaletteKeys)
                newThemeIds        = @($cardPalettePlan.NewIds)
                note              = 'server bundle 的卡片调色板表（MGr）补三个主题项：folio 幻灯片烧主题时走 nYr() 查这张表，不补则抛 no card palette for theme。'
            }
        )
        localeMerges  = @($localePlans | ForEach-Object {
                [ordered]@{
                    locale        = $_.Locale
                    file          = $_.Path
                    action        = $_.Action
                    addedKeys     = @($_.Added)
                    renamedKeys   = @($_.Renamed)
                    skippedKeys   = @($_.Skipped)
                    appearanceKeys = @($_.OrigNames).Count
                }
            })
        files         = @($fileRecords | ForEach-Object {
                [ordered]@{
                    tree          = $_.Tree
                    relPath       = $_.RelPath
                    action        = $_.Action
                    sha256        = $_.Sha256
                    sha256Before  = $_.Sha256Before
                    bytes         = $_.Bytes
                    material      = $(if ($null -ne (Get-Prop $_ 'Material')) { $_.Material } else { $null })
                    background    = $(if ($null -ne (Get-Prop $_ 'Background')) { $_.Background } else { $null })
                    panelFrame    = $(if ($null -ne (Get-Prop $_ 'PanelFrame')) { $_.PanelFrame } else { $null })
                    appSurface    = $(if ($null -ne (Get-Prop $_ 'AppSurface')) { $_.AppSurface } else { $null })
                    themeLink     = $(if ($null -ne (Get-Prop $_ 'ThemeLink')) { $_.ThemeLink } else { $null })
                }
            })
        backupEntries = @($backupEntries | ForEach-Object {
                [ordered]@{
                    tree          = $_.Tree
                    relPath       = $_.RelPath
                    kind          = $_.Kind
                    existed       = $_.Existed
                    backupRelPath = $_.BackupRelPath
                    sha256Before  = $_.Sha256Before
                }
            })
        restartRequired = $true
        notes         = @(
            '本文件由 scripts/apply.ps1 生成，记录本次贴入的版本目录与各文件改动后 sha256。'
            'skin.json 本身不在安装目录内，回滚请用 scripts/restore.ps1（配合 backupDir / pristineBackupDir）。'
            'defaultTheme / autoLightDefault / autoDarkDefault 未改动（auto 仍指向 warm-paper / midnight）。'
            "材质档位 material = $($script:MaterialTier)；材质源 src/$($script:MaterialDir)/<档位>.css（none 时不贴材质，行为与第一期逐字节等价）。"
            "背景档位 background = $($script:BackgroundTier)；背景源 src/$($script:BackgroundDir)/<档位>.css（none 时不贴背景，行为与现状逐字节等价）。"
            "背景图 src/$($script:BackgroundDir)/$($script:BackgroundDarkAsset) 以 data URI 内联，只进 renderer 树的深色主题文件；server 树不含背景。"
            "App 面材质 appSurface = $(if ($null -eq $script:AppSurfaceSources) { '（未贴）' } else { "on（$($script:AppSurfaceSources.Count) 份）" })；源 src/$($script:AppSurfaceDir)/*.css 只拼进 **server 树**那份主题文件（App 面唯一样式表入口），renderer 树不含；server 树 themes/*.css 的 sha256 是合成后**落盘实测**值。"
            "主题缓存版本 themeCacheBust = $(if ($null -eq $script:ThemeCacheBustVersion) { '（未启用）' } else { $script:ThemeCacheBustVersion })；只在 renderer lib/theme.js 里给主题 CSS 的 URL 加 ?v=<版本串>（绕过 Chromium HTTP 缓存），注册表 cssPath 保持 themes/xxx.css 不带参数（CardShell 打印依赖）。"
            "浮层面板取景框 panelFrame = $(if ($null -eq $script:PanelFramePlan) { '（未贴）' } else { 'on' })；面板 CSS 拼在 renderer 树深色主题末尾，面板 JS 追加到 renderer lib/theme.js 末尾（标记行 '$($script:PanelFrameMarker)' 幂等）。目标：卡片中心 / 能力 / 自动化 三个浮层面板 + 扩展（市场）模态 + 设置模态。"
            "卡片调色板 cardPalette = on（$((@($cardPalettePlan.NewIds)) -join ', ')）；server bundle 的 MGr 表每项 $((@($cardPalettePlan.PaletteKeys)).Count) 个键，只补表、不改任何上游逻辑（改后既有 11 项逐键逐值未变）。没这张表，folio 幻灯片传 theme=<本皮肤 id> 会抛 no card palette for theme。"
            "独立文档主题 link（themeLinks）：$(($script:ThemeLinkPlans | ForEach-Object { "$($_.Rel)=$($_.TargetHref)" }) -join '；')；把写死的 assets/warm-paper-*.css 引用换成当前主题 <link id=`"$($script:ThemeLinkId)`">（锚点用通配匹配，不写死构建哈希），使 lib/theme.js 能接管这两个独立文档。"
        )
    }

    # 2026-10-18：把各主题自己的源与合成结果填进 byThemeId（顶层字段仍保留"首个主题"，旧读法可用）。
    if ($null -ne $skin.materialSource) {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.MaterialSource) { continue }
            $skin.materialSource.byThemeId[$t.Id] = [ordered]@{
                path   = "src/$($t.MaterialDir)/$($script:MaterialTier).css"
                sha256 = $t.MaterialSource.Sha256
            }
        }
    }
    if ($null -ne $skin.backgroundSource) {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.BackgroundSource) { continue }
            $skin.backgroundSource.byThemeId[$t.Id] = [ordered]@{
                path          = "src/$($t.BackgroundDir)/$($script:BackgroundTier).css"
                sha256        = $t.BackgroundSource.Sha256
                asset         = "src/$($t.BackgroundDir)/$($t.BackgroundAsset)"
                assetSha256   = $t.BackgroundSource.AssetSha256
                assetBytes    = $t.BackgroundSource.AssetBytes
                dataUriSha256 = $t.BackgroundSource.DataUriSha256
            }
        }
    }
    if ($null -ne $skin.panelFrameSource) {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.PanelFrameSources) { continue }
            $skin.panelFrameSource.byThemeId[$t.Id] = [ordered]@{
                cssPath     = "src/$($t.PanelFrameDir)/$($script:PanelFrameCssFile)"
                cssSha256   = $t.PanelFrameSources.CssSha256
                jsPath      = "src/$($t.PanelFrameDir)/$($script:PanelFrameSourceFile)"
                jsSha256    = $t.PanelFrameSources.JsSha256
                marker      = $t.PanelFrameSources.Marker
            }
        }
    }

    $skinText = ($skin | ConvertTo-Json -Depth 20) -replace "`r`n", "`n"
    if (-not $skinText.EndsWith("`n")) { $skinText += "`n" }
    Write-Utf8NoBomFile -Path $SkinJson -Text $skinText
    Write-Log "      已写入：$SkinJson"
    Write-Log "      renderer.versionDir = $RendererDir"
    Write-Log "      server.versionDir   = $ServerDir"
    Write-Log "      登记文件 $($fileRecords.Count) 个（各含改动后 sha256）"
    if ($script:MaterialTier -ne 'none') {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.MaterialSource) { continue }
            Write-Log "      材质（$($t.Id)）：material=$($script:MaterialTier)  材质源 sha256=$($t.MaterialSource.Sha256)"
        }
    }
    if ($script:BackgroundTier -ne 'none') {
        foreach ($t in $script:ThemeDefs) {
            if ($null -eq $t.BackgroundSource) { continue }
            Write-Log "      背景（$($t.Id)）：background=$($script:BackgroundTier)  背景源 sha256=$($t.BackgroundSource.Sha256)"
            Write-Log "            背景图 sha256=$($t.BackgroundSource.AssetSha256)  bytes=$($t.BackgroundSource.AssetBytes)"
            $bgSha = @($fileRecords | Where-Object {
                    $_.Tree -eq 'renderer' -and $_.RelPath -eq "themes/$($t.Id).css"
                } | ForEach-Object { $_.Sha256 })
            Write-Log "            合成后 renderer 主题 sha256=$(if ($bgSha.Count -gt 0) { $bgSha[0] } else { '(未登记)' })"
        }
    }
    Write-Log "      其中主题卡片配色 CSS：$(($cardPlans | ForEach-Object { $_.Rel }) -join ', ')"
    if ($null -ne $script:ThemeCacheBustPlan) {
        Write-Log "      themeCacheBust=$($script:ThemeCacheBustPlan.VersionValue)（lib/theme.js 主题 CSS 版本参数，$($script:ThemeCacheBustPlan.Action)）"
    }
    if ($null -ne $script:PanelFramePlan) {
        foreach ($pfc in $script:PanelFramePlans) {
            Write-Log "      panelFrame=on（$($pfc.ThemeId)，面板 CSS + JS，$($pfc.Action)）  面板 JS sha256=$($pfc.JsSha256)"
        }
    }
    foreach ($tlp in $script:ThemeLinkPlans) {
        Write-Log "      themeLink[$($tlp.Rel)]=$($tlp.TargetHref)（$($tlp.Action)）  sha256=$($tlp.Sha256After)"
    }
    $script:Completed.Add("步骤12：写 skin.json -> $SkinJson")

    # ------------------------------------------------------------------
    # 13. 完成
    # ------------------------------------------------------------------
    Write-Head '[步骤 13/13] 完成 —— 需重启 Hana 生效'

    Write-Log '  贴入结果：'
    foreach ($r in $registryPlans) {
        Write-Log "    注册表 $($r.Label)：主题数 $($r.CountAfter)"
    }
    # 两个档位都是 none、且没有 App 面材质源时保持第一期原样输出（不多打一行），
    # 使整轮运行输出与第一期一致。
    if ($script:MaterialTier -eq 'none' -and $script:BackgroundTier -eq 'none' -and $null -eq $script:AppSurfaceSources) {
        Write-Log "    两棵树 CSS：$($cssPlans.Count) 个文件"
    }
    else {
        $tierNote = @()
        if ($script:MaterialTier -ne 'none') { $tierNote += "材质档位：$($script:MaterialTier)" }
        if ($script:BackgroundTier -ne 'none') { $tierNote += "背景档位：$($script:BackgroundTier)" }
        if ($null -ne $script:AppSurfaceSources) { $tierNote += "App 面材质：$($script:AppSurfaceSources.Count) 份（只贴 server 树）" }
        Write-Log "    两棵树 CSS：$($cssPlans.Count) 个文件（$($tierNote -join '；')）"
        foreach ($c in $cssPlans) {
            $parts = [System.Collections.Generic.List[string]]::new()
            $parts.Add('配色源')
            if ($c.MaterialPart -ne 'none') { $parts.Add('材质源') }
            if ($c.BackgroundPart -ne 'none') { $parts.Add('背景源') }
            if ($c.AppSurfacePart -ne 'none') { $parts.Add("App 面材质源 x$($script:AppSurfaceSources.Count)") }
            $note = if ($parts.Count -gt 1) { "$($parts -join ' + ')（合成）" } else { '纯配色源' }
            Write-Log "      [$($c.Tree)] $($c.Rel)  $note  sha256=$($c.SourceSha)"
        }
    }
    foreach ($cp in $cardPlans) {
        Write-Log "    主题卡片配色 $($cp.Tree)：$($cp.Rel)（$($cp.Action)）"
    }
    Write-Log "    卡片调色板：$($cardPalettePlan.Rel)（$($cardPalettePlan.Action)）  项数 $($cardPalettePlan.CountAfter)  新增 $((@($cardPalettePlan.NewIds)) -join ', ')"
    foreach ($tlp in $script:ThemeLinkPlans) {
        Write-Log "    独立文档主题 link：$($tlp.Rel) -> $($tlp.TargetHref)（$($tlp.Action)）"
    }
    if ($null -ne $script:ThemeCacheBustPlan) {
        Write-Log "    主题 CSS 版本参数：lib/theme.js（$($script:ThemeCacheBustPlan.Action)）  版本串 $($script:ThemeCacheBustPlan.VersionValue)  4 处 URL 带 ?v="
    }
    Write-Log "    i18n：$(@($localePlans | Where-Object { $_.Action -in @('merge','merge+rename') }).Count) 个 locale 有新增键；$(@($localePlans | Where-Object { @($_.Renamed).Count -gt 0 }).Count) 个 locale 改名"
    Write-Log ''
    Write-Log '  ** 请重启 Hana 使改动生效 **（渲染器与 server bundle 都是启动时加载）。'
    Write-Log '  重启后在「设置 → 外观」应出现这些主题：'
    foreach ($td in $script:ThemeDefs) {
        Write-Log "    $($td.Id)"
    }
    Write-Log ''
    Write-Log "  备份：$($script:BackupDir)"
    Write-Log "  清单：$SkinJson"
    Write-Log '  回滚：pwsh -File scripts\restore.ps1 -BackupDir "<上方的 pristineBackupDir>" -Apply'
}
catch {
    Write-FailureReport -Message ($_.Exception.Message + $(if ($env:HANA_SKIN_TRACE) { "$([Environment]::NewLine)STACK:$([Environment]::NewLine)$($_.ScriptStackTrace)" } else { '' }))
    exit 1
}
