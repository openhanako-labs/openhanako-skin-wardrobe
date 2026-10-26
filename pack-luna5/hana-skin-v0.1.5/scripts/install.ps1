<#
.SYNOPSIS
    一键入口：把这套皮肤（月满庭 · 极光 · Deepsleep 三个主题）贴到本机 Hana 上。默认 dry-run，不写任何文件。

.DESCRIPTION
    这个脚本只做「编排 + 前置检查」，真正的贴入逻辑全在 apply.ps1 里：

        1. 读 share.json（本包的版本与档位声明）
        2. 调 locate.ps1 定位 renderer / server 两个版本目录（从 desktop-target.json 现读）
        3. 版本闸门：Hana 版本必须在 share.json 的 verifiedHanaVersions 里
           （皮肤的注册表补丁是按具体构建的锚点定位的，换构建可能失配）
        4. 跑 apply.ps1 的 dry-run：全量定位 + 断言 + 合成，只在内存里做，不落盘
        5. 传 -Apply 时：真贴入 -> 再跑 check.ps1 自检 -> 打印备份目录与回滚命令

    为什么默认 dry-run：贴入会改 Hana 安装目录里 16 个文件（renderer 树 13 个、
    server 树 3 个）。先 dry-run 一遍能看到「能不能贴、会改哪些」，确认后再贴。

.PARAMETER Apply
    真的写入。不加就是 dry-run。

.PARAMETER Material
    材质档位，默认 bold（本包发布时的档位）。可选 none / subtle / bold。

.PARAMETER Background
    背景档位，默认 dark（本包发布时的档位）。可选 none / dark。

.PARAMETER TargetJson
    desktop-target.json 路径。默认取 $env:HANA_HOME\artifacts\desktop-target.json，
    HANA_HOME 未设时退到 %USERPROFILE%\.hanako\artifacts\desktop-target.json。

.PARAMETER SkipVersionCheck
    跳过版本闸门（只在明知版本不同、仍想试 dry-run 时用；真贴入失败率很高）。

.EXAMPLE
    pwsh -File .\scripts\install.ps1
    只做 dry-run，看会改哪些文件。

.EXAMPLE
    pwsh -File .\scripts\install.ps1 -Apply
    贴入并自检。贴完重启 Hana 生效。
#>
[CmdletBinding()]
param(
    [switch]$Apply,
    [ValidateSet('none', 'subtle', 'bold')][string]$Material = 'bold',
    [ValidateSet('none', 'dark')][string]$Background = 'dark',
    [string]$TargetJson = $(if ($env:HANA_HOME) { Join-Path $env:HANA_HOME 'artifacts\desktop-target.json' } else { Join-Path $env:USERPROFILE '.hanako\artifacts\desktop-target.json' }),
    [switch]$SkipVersionCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# StrictMode 下 $LASTEXITCODE 未设置过时读取会抛错；而 PowerShell 脚本成功返回时
# 不会刷新它（只有 exit N 或外部命令才会写），所以每次调子脚本前都手动重置。
$LASTEXITCODE = 0

function Stop-Fail {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host ''
    Write-Host "install.ps1: 失败 —— $Message" -ForegroundColor Red
    exit 1
}
function Say { param([string]$Msg, [string]$Color = 'Gray') Write-Host $Msg -ForegroundColor $Color }

$scriptsDir = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptsDir)) { Stop-Fail '取不到脚本所在目录（$PSScriptRoot 为空）' }
$root = Split-Path -Parent $scriptsDir

$sharePath = Join-Path $root 'share.json'
if (-not (Test-Path -LiteralPath $sharePath -PathType Leaf)) {
    Stop-Fail "包不完整：缺少 share.json（$sharePath）"
}
$share = Get-Content -LiteralPath $sharePath -Raw -Encoding UTF8 | ConvertFrom-Json
$skinName = [string]$share.displayName
$skinVersion = [string]$share.skinVersion
# 包版本（VERSION / share.json 的 version）：StrictMode 下不能直接读可能不存在的键
$pkgVersion = ''
if ($share.PSObject.Properties.Name -contains 'version') { $pkgVersion = [string]$share.version }
$pkgVersionTag = if ([string]::IsNullOrWhiteSpace($pkgVersion)) { '(未声明包版本)' } else { "v$pkgVersion" }

Say ''
Say "── $skinName $pkgVersionTag（皮肤版本 $skinVersion）──" 'Cyan'
Say "包内声明：材质 $($share.material) / 背景 $($share.background) / 已验证 Hana 版本：$([string]::Join('、', @($share.verifiedHanaVersions)))"

# ── 1. 定位 ────────────────────────────────────────────────────────────────
Say ''
Say '[1/4] 定位 Hana 的 renderer / server 版本目录'
$locateScript = Join-Path $scriptsDir 'locate.ps1'
$LASTEXITCODE = 0
$locateOut = & $locateScript -TargetJson $TargetJson -AsJson
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($locateOut | Out-String))) {
    Stop-Fail "定位失败。确认 Hana 桌面版已安装并至少启动过一次（desktop-target.json 存在）"
}
$loc = ($locateOut | Out-String) | ConvertFrom-Json
Say "      renderer：$($loc.rendererVersionDir)" 'DarkGray'
Say "      server  ：$($loc.serverVersionDir)" 'DarkGray'

# ── 2. 版本闸门 ───────────────────────────────────────────────────────────
Say ''
Say '[2/4] 版本闸门'
$hanaVersion = [string]$loc.rendererVersion
$verified = @($share.verifiedHanaVersions)
if ($verified -notcontains $hanaVersion) {
    # 2026-10-21 改：版本不对不再拦人。上游小跳版本时锚点往往仍然成立，直接拦等于逼用户等包更新；
    # 而真失配也不惨 —— apply.ps1 的断言全在写盘前跑完，锚点没中就中途停、一个字节不写。
    # 所以闸门从“拦人”降成“提醒”：已验证→通过；未验证→告知并照跑全量断言。
    Say "      本机 Hana：$hanaVersion" 'Yellow'
    Say "      包里只验证过：$([string]::Join('、', $verified))。未验证版本不拦，先跑全量断言：" 'Yellow'
    Say '        锚点全中 → 照贴；有锚点失配 → 中途停下（不写任何文件），按 REPAIR.md 修锚点后重跑。' 'Yellow'
    Say '        皮肤是往构建产物里写补丁的，锚点随构建变化；真失配也不会写坏（断言全在写盘前跑完）。' 'DarkGray'
}
else {
    Say "      通过（已验证）：Hana $hanaVersion" 'Green'
}

# ── 3. dry-run ────────────────────────────────────────────────────────────
Say ''
Say '[3/4] dry-run（全量定位 + 断言 + 合成，不写任何文件）'
$applyScript = Join-Path $scriptsDir 'apply.ps1'
# 用 hashtable splatting（按名字传）。数组 splatting 只按位置传，'-Material' 这类字符串
# 不会被当成参数名 —— 会得到「找不到路径 dark」这种看上去很难懂的错。
$common = @{ Material = $Material; Background = $Background; TargetJson = $TargetJson }
$LASTEXITCODE = 0
& $applyScript @common
if ($LASTEXITCODE -ne 0) {
    Stop-Fail ('dry-run 没过（没有写入任何文件）。这是「锚点失配」：上游构建变了，皮肤描述的位置对不上。' + [Environment]::NewLine +
        '          不是坏掉的状态，也不是叫你去手改安装目录 —— 把上面那段输出交给 Hana，' + [Environment]::NewLine +
        '          按 REPAIR.md 里对应那一节重新定位锚点（改的是 patches/，或 scripts/apply.ps1 的 ThemeCacheBustSites），' + [Environment]::NewLine +
        '          然后重跑本脚本。修不了就停在这里，别硬贴。')
}
Say '      dry-run 通过：锚点全中，合成结果可生成。' 'Green'

if (-not $Apply) {
    Say ''
    Say '以上均未执行（dry-run）。确认无误后加 -Apply 真正贴入：' 'Yellow'
    Say '    pwsh -File .\scripts\install.ps1 -Apply' 'Yellow'
    exit 0
}

# ── 4. 真贴入 + 自检 ──────────────────────────────────────────────────────
Say ''
Say '[4/4] 贴入'
$LASTEXITCODE = 0
& $applyScript @common -Apply
if ($LASTEXITCODE -ne 0) {
    Stop-Fail '贴入失败。apply.ps1 是两阶段执行：落盘前会先证明全部锚点可改，所以半途失败通常没写进任何文件；但仍建议跑一次 restore 或 check 确认。'
}

$skinJson = Join-Path $root 'skin.json'
$backupDir = '(skin.json 里没记到备份目录，请手动查看 backups/)'
if (Test-Path -LiteralPath $skinJson -PathType Leaf) {
    try {
        $skin = Get-Content -LiteralPath $skinJson -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($skin.PSObject.Properties['pristineBackupDir'] -and $skin.pristineBackupDir) { $backupDir = [string]$skin.pristineBackupDir }
    }
    catch { }
}

Say ''
Say '自检（check.ps1）'
$LASTEXITCODE = 0
& (Join-Path $scriptsDir 'check.ps1') -TargetJson $TargetJson
$checkCode = $LASTEXITCODE

Say ''
Say '────────────────────────────────────────────' 'Cyan'
Say "皮肤已贴入：$skinName（材质 $Material / 背景 $Background）" 'Green'
Say ''
Say '生效方式：完全退出 Hana，再重新启动（渲染器与 server bundle 都是启动时加载的）。'
Say '验证：设置 → 界面 → 主题，应能看到「月满庭 / 极光 / Deepsleep」；选中任一，整套换肤生效。'
Say ''
Say '回滚（贴完不满意 / 想还原）：'
Say "    pwsh -File .\scripts\restore.ps1 -BackupDir `"$backupDir`" -Apply" 'DarkGray'
Say ''
if ($checkCode -ne 0) {
    Say "⚠ check.ps1 返回 $checkCode，与 skin.json 记录不完全吻合。把它的输出原样发出来再决定要不要回滚。" 'Yellow'
    exit $checkCode
}
Say 'check.ps1：全部文件与 skin.json 记录逐一吻合。' 'Green'
exit 0
