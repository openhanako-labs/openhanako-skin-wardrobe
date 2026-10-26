<#
.SYNOPSIS
    check.ps1 —— 自检「中秋 · 月满庭」皮肤是否仍贴在**当前运行的** Hana 版本上（只读）。

.DESCRIPTION
    回答一个问题：Hana 更新之后，我需要重新贴一次吗？

    判据是三重，缺一不可：

      1. 目录身份：desktop-target.json 的 current.renderer / current.server.versionDir
         是否与 skin.json 记录的贴入目标**逐字符相同**。
         Hana 升级会生成一个全新的版本目录并原子切换指针，旧改动留在旧目录里 ——
         两边不等，就是"该重贴"的直接证据。

      2. 内容指纹：skin.json 记录每个被改文件的 sha256，逐个与磁盘现况比对。
         目录没变但文件被官方回写 / 被 restore.ps1 还原过 / 上次贴入半途失败，
         都算不可信，一样要重贴。

      3. 档位一致性：从 skin.json 记的档位反查文件里的**实际内容**——
         background=dark 就必须在深色主题文件里找到那张内联图，themeCacheBust 有版本串
         就必须在 lib/theme.js 里找到那个常量。
         为什么前两条不够：若某次贴入把档位漏了，**记录和内容会一致地错**
         （1.0.16 重贴时记录 background=none、文件也没图，两者自洽），第 2 条照样报 OK。

    第 4 节是参考信息：ota-state.json 里各通道的可用版本、desktop-target.json 的
    pending（已下载待激活）。它不参与判定，只是让你在"要不要现在升级"这件事上心里有数 ——
    因为**每次升级都会让皮肤失效一次**。

    只读：不写入、不修改任何文件（含 Hana 安装目录）。

    退出码：
      0 —— 一致：皮肤贴在当前运行的版本上，不用重贴
      1 —— 版本目录已切换：需重贴
      2 —— 文件缺失 / 内容不符 / 档位与实际内容自相矛盾：需重贴
      3 —— 无法判定：skin.json 或 desktop-target.json 缺失 / 不可解析

.PARAMETER TargetJson
    desktop-target.json 的路径。默认取 $env:HANA_HOME\artifacts\desktop-target.json，
    HANA_HOME 未设时退到 %USERPROFILE%\.hanako\artifacts\desktop-target.json。

.PARAMETER SkinJson
    skin.json 的路径。默认 <RepoRoot>\skin.json。

.PARAMETER RepoRoot
    本仓库根目录（src/ 与 patches/ 所在）。默认取脚本所在目录的父目录。

.PARAMETER AsJson
    以 JSON 文本输出结果（stdout 只含 JSON），便于其他脚本 / 定时任务断言。
    退出码语义不变。

.OUTPUTS
    -AsJson 时输出 JSON 文本，字段：
        verdict   —— current | version-changed | files-mismatch | tier-mismatch | unknown
        exitCode  —— 同上退出码
        reason    —— 一句话结论
        skinJson / targetJson / appliedAtLocal
        installed —— 当前运行版本（desktop-target.json current.renderer.version）
        recorded  —— skin.json 记录的 renderer / server 目录
        target    —— 当前运行的 renderer / server 目录
        versionDirsMatch —— 两个目录是否逐一相同
        files     —— 每个被改文件的 tree / relPath / status / 预期与实测 sha256 与字节数
        counts    —— total / ok / changed / missing / unknown
        tierChecks —— 档位一致性逐项核对（what / ok / detail）
        channels  —— 各通道的 available（当前可安装的新版本，更新完会被消费为空）与
                     verified（该通道最新已核验版本；跨通道版本号不同源，仅陈列不作新旧的判断）
        pendingVersion —— 已下载待激活的版本（无则 $null）

.NOTES
    PowerShell 7+。只读脚本，不需要 node。
    调用方式：用 `pwsh -File scripts/check.ps1`。若要与其他脚本串联，用 `& .\check.ps1`
    （子作用域）——本脚本在失败路径上 exit 非零码，点源会终止调用方会话。

.EXAMPLE
    pwsh -File scripts/check.ps1

.EXAMPLE
    pwsh -File scripts/check.ps1 -AsJson | ConvertFrom-Json
#>
[CmdletBinding()]
param(
    [string]$TargetJson = $(if ($env:HANA_HOME) { Join-Path $env:HANA_HOME 'artifacts\desktop-target.json' } else { Join-Path $env:USERPROFILE '.hanako\artifacts\desktop-target.json' }),
    [string]$SkinJson,
    [string]$RepoRoot,
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---- 退出码约定（与文件头 .DESCRIPTION 一致）--------------------------------
$script:ExitCurrent      = 0
$script:ExitVersionMoved = 1
$script:ExitFilesBad     = 2
$script:ExitUnknown      = 3

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

# 无法判定：打印原因并以退出码 3 结束。绝不把"读不到"当成"没有问题"。
function Stop-Unknown {
    param([Parameter(Mandatory)][string]$Message)
    if ($AsJson) {
        ([pscustomobject][ordered]@{
                verdict  = 'unknown'
                exitCode = $script:ExitUnknown
                reason   = $Message
            }) | ConvertTo-Json -Depth 4
    }
    else {
        Write-Log ''
        Write-Log "无法判定：$Message"
        Write-Log "（自检未完成，退出码 $($script:ExitUnknown)。修好上面这条再跑一次。）"
    }
    [Console]::Error.WriteLine("check.ps1: ERROR: $Message")
    exit $script:ExitUnknown
}

# StrictMode 下安全取属性：字段不存在返回 $null 而不抛异常
function Get-Prop {
    param($Object, [Parameter(Mandatory)][string]$Name)
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function Get-FileSha256 {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

# 逐字（Ordinal）计数：不用正则，避免在 3.9 MB 的主题文件上引入正则开销
function Get-OccurrenceCount {
    param([Parameter(Mandatory)][string]$Text, [Parameter(Mandatory)][string]$Needle)
    if ([string]::IsNullOrEmpty($Needle)) { return 0 }
    $n = 0
    $i = 0
    while (($i = $Text.IndexOf($Needle, $i, [System.StringComparison]::Ordinal)) -ge 0) {
        $n++
        $i += $Needle.Length
    }
    return $n
}

# 读文本：读不到返回 $null（调用方据此报"无法核对"，而不是把读失败当成没命中）
function Get-FileTextSafe {
    param([Parameter(Mandatory)][string]$Path)
    try {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
        return [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
    }
    catch { return $null }
}

# 必需读入：缺失 / 空 / 解析失败一律"无法判定"
function Read-JsonFileRequired {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$What
    )
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        Stop-Unknown "找不到 $What：'$Path'（文件缺失或不是文件）"
    }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
    }
    catch {
        Stop-Unknown "读取 $What 失败：'$Path' —— $($_.Exception.Message)"
    }
    if ([string]::IsNullOrWhiteSpace($raw)) {
        Stop-Unknown "$What 是空文件：'$Path'"
    }
    try {
        return ($raw | ConvertFrom-Json)
    }
    catch {
        Stop-Unknown "$What JSON 解析失败：'$Path' —— $($_.Exception.Message)"
    }
}

# 宽松读入（仅用于参考信息）：不抛异常，返回 @{ Value; Problem }；Problem 为 $null 表示读成功。
# 区分"没有这个文件"与"读到了但没内容"，因为两者该说的话完全不同。
function Read-JsonFileOptional {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Value = $null; Problem = "未找到 '$Path'" }
    }
    try {
        $raw = [System.IO.File]::ReadAllText($Path, [System.Text.UTF8Encoding]::new($false))
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return [pscustomobject]@{ Value = $null; Problem = "'$Path' 是空文件" }
        }
        return [pscustomobject]@{ Value = ($raw | ConvertFrom-Json); Problem = $null }
    }
    catch {
        return [pscustomobject]@{ Value = $null; Problem = "'$Path' 读取/解析失败（若刚更新完，可能正被更新进程占用）：$($_.Exception.Message)" }
    }
}

# 按显示宽度（而非字符数）右侧补空格：中日韩字符占 2 列，直接 PadRight 会让中英混排的列错开。
function Get-DisplayWidth {
    param([Parameter(Mandatory)][string]$Text)
    $w = 0
    foreach ($ch in $Text.ToCharArray()) {
        $c = [int]$ch
        if (($c -ge 0x1100 -and $c -le 0x115F) -or
            ($c -ge 0x2E80 -and $c -le 0xA4CF) -or
            ($c -ge 0xAC00 -and $c -le 0xD7A3) -or
            ($c -ge 0xF900 -and $c -le 0xFAFF) -or
            ($c -ge 0xFE30 -and $c -le 0xFE6F) -or
            ($c -ge 0xFF00 -and $c -le 0xFF60) -or
            ($c -ge 0xFFE0 -and $c -le 0xFFE6) -or
            ($c -ge 0x20000)) { $w += 2 } else { $w += 1 }
    }
    return $w
}

function Format-Pad {
    param([string]$Text = '', [Parameter(Mandatory)][int]$Width)
    $pad = $Width - (Get-DisplayWidth $Text)
    if ($pad -le 0) { return $Text }
    return $Text + (' ' * $pad)
}

# 版本号提取：各地 JSON 的形状不完全一样（且可能随版本演进），按常见位置依次尝试。
# 刻意写得宽松——这里只用于打印参考信息，读不到就返回 $null，绝不因此报错。
function Get-DeepVersion {
    param($Object)
    if ($null -eq $Object) { return $null }
    $v = Get-Prop $Object 'version'
    if ($v) { return [string]$v }
    foreach ($k in @('renderer', 'server', 'manifest', 'target', 'candidate')) {
        $v = Get-Prop (Get-Prop $Object $k) 'version'
        if ($v) { return [string]$v }
    }
    return $null
}

# ============================================================================
# 0. 解析路径
# ============================================================================

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    if ([string]::IsNullOrWhiteSpace($PSScriptRoot)) {
        Stop-Unknown '取不到脚本所在目录（$PSScriptRoot 为空）：请显式传 -RepoRoot'
    }
    $RepoRoot = Split-Path -Parent $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($SkinJson)) {
    $SkinJson = Join-Path $RepoRoot 'skin.json'
}
if ([string]::IsNullOrWhiteSpace($TargetJson)) {
    Stop-Unknown '-TargetJson 为空：请提供 desktop-target.json 的路径'
}

# ============================================================================
# 1. 读入两份记录
# ============================================================================

$skin = Read-JsonFileRequired -Path $SkinJson -What 'skin.json'
$target = Read-JsonFileRequired -Path $TargetJson -What 'desktop-target.json'

$recordedRendererDir = [string](Get-Prop (Get-Prop $skin 'renderer') 'versionDir')
$recordedServerDir = [string](Get-Prop (Get-Prop $skin 'server') 'versionDir')
if ([string]::IsNullOrWhiteSpace($recordedRendererDir) -or [string]::IsNullOrWhiteSpace($recordedServerDir)) {
    Stop-Unknown "skin.json 缺少 renderer/server 的 versionDir 记录：'$SkinJson'（这份记录不完整，无法核对）"
}

$currentRendererDir = [string](Get-Prop (Get-Prop (Get-Prop $target 'current') 'renderer') 'versionDir')
$currentServerDir = [string](Get-Prop (Get-Prop (Get-Prop $target 'current') 'server') 'versionDir')
if ([string]::IsNullOrWhiteSpace($currentRendererDir) -or [string]::IsNullOrWhiteSpace($currentServerDir)) {
    Stop-Unknown "desktop-target.json 缺少 current.renderer/server.versionDir：'$TargetJson'"
}

# 目录身份比对：逐字符（大小写敏感），避免"只差一个字符"被当成一致
$rendererDirMatch = ($recordedRendererDir -ceq $currentRendererDir)
$serverDirMatch = ($recordedServerDir -ceq $currentServerDir)
$versionDirsMatch = ($rendererDirMatch -and $serverDirMatch)

# ============================================================================
# 2. 逐文件比对 sha256
# ============================================================================

# skin.json 的 files 里同一个文件可能出现多条（apply.ps1 分步骤登记，例如 lib/theme.js
# 既有"注册表已贴"又有"加了版本参数"），**最后一条**才是落盘后的真实状态 → 后写覆盖先写。
$expected = [ordered]@{}
$fileEntries = Get-Prop $skin 'files'
if ($null -eq $fileEntries) {
    Stop-Unknown "skin.json 缺少 files 记录：'$SkinJson'（没有任何被改文件的指纹，无法核对）"
}
foreach ($f in @($fileEntries)) {
    $tree = [string](Get-Prop $f 'tree')
    $rel = [string](Get-Prop $f 'relPath')
    if ([string]::IsNullOrWhiteSpace($tree) -or [string]::IsNullOrWhiteSpace($rel)) { continue }
    $expected["$tree|$rel"] = $f
}

$rows = @()
$okCount = 0
$changedCount = 0
$missingCount = 0
$unknownCount = 0

foreach ($key in $expected.Keys) {
    $rec = $expected[$key]
    $tree = [string](Get-Prop $rec 'tree')
    $rel = [string](Get-Prop $rec 'relPath')
    $expSha = [string](Get-Prop $rec 'sha256')
    $expBytesRaw = Get-Prop $rec 'bytes'
    $expBytes = if ($null -eq $expBytesRaw) { $null } else { [int64]$expBytesRaw }

    $base = $null
    if ($tree -ceq 'renderer') { $base = $recordedRendererDir }
    elseif ($tree -ceq 'server') { $base = $recordedServerDir }

    $abs = $null
    $actSha = $null
    $actBytes = $null
    $status = ''

    if ([string]::IsNullOrWhiteSpace($base)) {
        $status = 'UNKNOWN'
    }
    else {
        $abs = Join-Path $base ($rel -replace '/', '\')
        if (-not (Test-Path -LiteralPath $abs -PathType Leaf)) {
            $status = 'MISSING'
        }
        else {
            $actBytes = [int64](Get-Item -LiteralPath $abs).Length
            $actSha = [string](Get-FileSha256 -Path $abs)
            if ($actSha -ceq $expSha) { $status = 'OK' } else { $status = 'CHANGED' }
        }
    }

    switch ($status) {
        'OK' { $okCount++ }
        'CHANGED' { $changedCount++ }
        'MISSING' { $missingCount++ }
        default { $unknownCount++ }
    }

    $rows += [pscustomobject][ordered]@{
        tree          = $tree
        relPath       = $rel
        display       = "$tree/$rel"
        status        = $status
        absPath       = $abs
        expectedSha256 = $expSha
        actualSha256  = $actSha
        expectedBytes = $expBytes
        actualBytes   = $actBytes
    }
}

$totalCount = $rows.Count
$badCount = $changedCount + $missingCount + $unknownCount

# ============================================================================
# 2b. 档位一致性：skin.json 记的档位 vs 文件里的实际内容
# ============================================================================
# 上一层只验"文件内容 == 记录"。若某次贴入把档位漏了，记录与内容会**一致地错**
# （1.0.16 重贴即如此：记录 background=none、文件也没图，两者自洽），上一层照样报 OK。
# 这里反过来问：声明说有，那就必须真的在。
$tierChecks = @()

# 内联背景图的结构标记：只认 url( 里的，不认文件头注释里的叙述文字（注释里也开过"data:image/png"）
$bgMarkerQuoted = 'url("data:image/png;base64,'
$bgMarkerBare = 'url(data:image/png;base64,'
$bgPlaceholder = '__BG_DARK_DATA_URI__'
$bustConstName = 'HANA_SKIN_CSS_V'

$recordedBackground = [string](Get-Prop $skin 'background')
$recordedMaterial = [string](Get-Prop $skin 'material')
$recordedBust = [string](Get-Prop $skin 'themeCacheBust')
$recordedBustQuery = [string](Get-Prop $skin 'themeCacheBustQuery')

$bgBearingCount = 0
$matBearingCount = 0
foreach ($r in @($rows | Where-Object { $_.relPath -like '*.css' -and ($_.status -ceq 'OK' -or $_.status -ceq 'CHANGED') })) {
    $rec = $expected["$($r.tree)|$($r.relPath)"]
    $fileBg = [string](Get-Prop $rec 'background')
    $fileMat = [string](Get-Prop $rec 'material')
    if (-not [string]::IsNullOrWhiteSpace($fileBg) -and $fileBg -cne 'none') { $bgBearingCount++ }
    if (-not [string]::IsNullOrWhiteSpace($fileMat) -and $fileMat -cne 'none') { $matBearingCount++ }

    # 只有带档位声明的 CSS 才核对（主题文件带；SettingsModalShell-*.css 不带）
    if ([string]::IsNullOrWhiteSpace($fileBg)) { continue }

    $text = Get-FileTextSafe -Path $r.absPath
    if ($null -eq $text) {
        $tierChecks += [pscustomobject][ordered]@{ what = $r.display; ok = $false; detail = '读取失败，无法核对档位' }
        continue
    }
    $imgHits = (Get-OccurrenceCount -Text $text -Needle $bgMarkerQuoted) + (Get-OccurrenceCount -Text $text -Needle $bgMarkerBare)
    $leftover = Get-OccurrenceCount -Text $text -Needle $bgPlaceholder

    if ($fileBg -ceq 'dark') {
        $ok = ($imgHits -eq 1) -and ($leftover -eq 0)
        $tierChecks += [pscustomobject][ordered]@{ what = $r.display; ok = $ok; detail = "background=dark：内联背景图 url() 命中 $imgHits 处（期望 1）、占位符残留 $leftover 处（期望 0）" }
    }
    elseif ($fileBg -ceq 'none') {
        $ok = ($imgHits -eq 0)
        $tierChecks += [pscustomobject][ordered]@{ what = $r.display; ok = $ok; detail = "background=none：不应含内联背景图，实际 url() 命中 $imgHits 处（期望 0）" }
    }
}

# 整体档位与逐文件声明不能互相矛盾（例如 skin.json 说 background=dark，却没有任何一份 CSS 记 dark）
if (-not [string]::IsNullOrWhiteSpace($recordedBackground)) {
    $ok = if ($recordedBackground -ceq 'none') { $bgBearingCount -eq 0 } else { $bgBearingCount -ge 1 }
    $tierChecks += [pscustomobject][ordered]@{ what = 'skin.json 整体档位'; ok = $ok; detail = "background=$recordedBackground；逐文件声明里带背景的 CSS $bgBearingCount 份" }
}
if (-not [string]::IsNullOrWhiteSpace($recordedMaterial)) {
    $ok = if ($recordedMaterial -ceq 'none') { $matBearingCount -eq 0 } else { $matBearingCount -ge 1 }
    $tierChecks += [pscustomobject][ordered]@{ what = 'skin.json 整体材质档位'; ok = $ok; detail = "material=$recordedMaterial；逐文件声明里带材质的 CSS $matBearingCount 份" }
}

# 浮层面板取景框（工单 30，工单 31 扩到五个目标）：记录里有 panelFrame=on，就必须在 renderer 主题文件里找到
# 全部目标的选择器、且在 lib/theme.js 里找到标记行。与背景档位同理：记录与内容必须对得上。
$recordedPanelFrame = [string](Get-Prop $skin 'panelFrame')
$panelFrameCssProbes = @(
    '#chalkboardCardCenterPanel > [class*="floatingPanelInner"]',
    '#capabilitiesPanel > [class*="floatingPanelInner"]',
    '#automationHubPanel > [class*="floatingPanelInner"]',
    '[data-testid="market-modal-overlay"] > [class*="container"]',
    ':has(> [data-input-ctx-zone="settings"])'
)
$panelFrameMarker = '/* hana-panel-frame */'
if (-not [string]::IsNullOrWhiteSpace($recordedPanelFrame) -and $recordedPanelFrame -cne 'none') {
    # 面板 CSS 只应在 renderer 树的深色主题文件里
    $pfCssRows = @($rows | Where-Object {
            $_.tree -ceq 'renderer' -and $_.relPath -like 'themes/*.css' -and ($_.status -ceq 'OK' -or $_.status -ceq 'CHANGED')
        })
    $pfCssHits = 0
    foreach ($r in $pfCssRows) {
        $txt = Get-FileTextSafe -Path $r.absPath
        if ($null -eq $txt) { continue }
        $hit = $true
        foreach ($needle in $panelFrameCssProbes) {
            if ((Get-OccurrenceCount -Text $txt -Needle $needle) -lt 1) { $hit = $false; break }
        }
        if ($hit) { $pfCssHits++ }
    }
    $tierChecks += [pscustomobject][ordered]@{
        what   = 'renderer 主题 CSS（面板取景框规则）'
        ok     = ($pfCssHits -ge 1)
        detail = "panelFrame=$recordedPanelFrame；含全部 $($panelFrameCssProbes.Count) 个目标选择器的 renderer 主题 CSS $pfCssHits 份（期望 >=1）"
    }
    # 面板 JS 必须在 lib/theme.js 里（标记行）
    $pfThemeJsRows = @($rows | Where-Object { $_.tree -ceq 'renderer' -and $_.relPath -ceq 'lib/theme.js' })
    if ($pfThemeJsRows.Count -gt 0) {
        $tjText2 = Get-FileTextSafe -Path $pfThemeJsRows[0].absPath
        if ($null -eq $tjText2) {
            $tierChecks += [pscustomobject][ordered]@{ what = 'renderer/lib/theme.js 面板 JS'; ok = $false; detail = '读不到文件内容' }
        }
        else {
            # 2026-10-18：多主题时每个主题一个标记行（基础标记 + 主题 id），
            # 所以不能写死“期望 1 处”。
            # 优先按 skin.json 记录的 markers 逐个核对（每个恰好 1 次）；
            # 旧记录没有 markers 时回退为“>= 1 处”。
            $markers = @()
            if ($null -ne $skin.panelFrameSource) {
                $mk = Get-Prop $skin.panelFrameSource 'markers'
                if ($null -ne $mk) { $markers = @($mk | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' }) }
            }
            if ($markers.Count -gt 0) {
                $bad = @()
                $totalMarkerHits = 0
                foreach ($m in $markers) {
                    $c = Get-OccurrenceCount -Text $tjText2 -Needle $m
                    $totalMarkerHits += $c
                    if ($c -ne 1) { $bad += "$m x$c" }
                }
                # 2026-10-18：每个主题一个标记行；标记互不为前缀（主题 id 写在注释内部），
                # 所以各命中 1 次且总数 == 主题数。
                $ok = ($bad.Count -eq 0) -and ($totalMarkerHits -eq $markers.Count)
                $detail = "panelFrame=$recordedPanelFrame：$($markers.Count) 个主题标记行各自命中 1 处（合计 $totalMarkerHits 处）"
                if ($bad.Count -gt 0) { $detail += "；不符：$($bad -join ', ')" }
                $tierChecks += [pscustomobject][ordered]@{ what = 'renderer/lib/theme.js 面板 JS'; ok = $ok; detail = $detail }

                # 2026-10-19：每段取景框 JS 的「守卫键」必须按主题区分。
                # 各段共用同一个 window 标记时，**后追加的那段一进门就 return、整段永不执行**
                # —— 紫夜主题就是这么一点图都没有的（症状：先贴的主题有背景图，后加的那几个面板全是实色）。
                $guardDecl = Get-OccurrenceCount -Text $tjText2 -Needle '__hanaPanelFrame:'
                $legacyGuard = (Get-OccurrenceCount -Text $tjText2 -Needle 'window.__hanaPanelFrame)') +
                               (Get-OccurrenceCount -Text $tjText2 -Needle 'window.__hanaPanelFrame =')
                $tierChecks += [pscustomobject][ordered]@{
                    what   = 'renderer/lib/theme.js 取景框守卫键'
                    ok     = (($guardDecl -eq $markers.Count) -and ($legacyGuard -eq 0))
                    detail = "__hanaPanelFrame:<主题> 命中 $guardDecl 处（期望 $($markers.Count) = 主题数）；旧共用键命中 $legacyGuard 处（期望 0）"
                }
            }
            else {
                $mkHits = Get-OccurrenceCount -Text $tjText2 -Needle $panelFrameMarker
                $ok = ($mkHits -ge 1)
                $tierChecks += [pscustomobject][ordered]@{
                    what   = 'renderer/lib/theme.js 面板 JS'
                    ok     = $ok
                    detail = "panelFrame=$recordedPanelFrame：标记行命中 $mkHits 处（期望 >=1）"
                }
            }
        }
    }
}

# 缓存版本参数：记录里有版本串，lib/theme.js 里就必须有那行常量声明（1 声明 + 4 处 URL = 至少 5 次）
$themeJsRow = @($rows | Where-Object { $_.tree -ceq 'renderer' -and $_.relPath -ceq 'lib/theme.js' })
if ($themeJsRow.Count -gt 0) {
    $tjRow = $themeJsRow[0]
    $tjText = Get-FileTextSafe -Path $tjRow.absPath
    if ($null -eq $tjText) {
        $tierChecks += [pscustomobject][ordered]@{ what = 'renderer/lib/theme.js 缓存参数'; ok = $false; detail = '读取失败，无法核对' }
    }
    else {
        $cnCount = Get-OccurrenceCount -Text $tjText -Needle $bustConstName
        if (-not [string]::IsNullOrWhiteSpace($recordedBust)) {
            $decl = "const $bustConstName=`"$recordedBustQuery`";"
            $declCount = Get-OccurrenceCount -Text $tjText -Needle $decl
            $ok = ($declCount -eq 1) -and ($cnCount -ge 5)
            $tierChecks += [pscustomobject][ordered]@{ what = 'renderer/lib/theme.js 缓存参数'; ok = $ok; detail = "themeCacheBust=$recordedBust：常量声明命中 $declCount 处（期望 1）；$bustConstName 共 $cnCount 处（期望 ≥5 = 1 声明 + 4 处 URL）" }
        }
        else {
            $ok = ($cnCount -eq 0)
            $tierChecks += [pscustomobject][ordered]@{ what = 'renderer/lib/theme.js 缓存参数'; ok = $ok; detail = "未启用（themeCacheBust 为空）：$bustConstName 命中 $cnCount 处（期望 0）" }
        }
    }
}

# 卡片调色板（工单 73）：skin.json 记录了 cardPaletteAssertions，就必须在 server bundle 的 MGr 表里
# 真的找到那几项（每项 15 个键）。为什么不信文件指纹就够 —— 指纹只能证明「盘上这份 == 记录里那份」，
# 证明不了「记录当初就是对的」：表没补上时，指纹与内容会**一致地错**（与背景 / 面板取景框同一种病）。
$paletteAssertions = @(Get-Prop $skin 'cardPaletteAssertions' | Where-Object { $null -ne $_ })
if ($paletteAssertions.Count -gt 0) {
    $pa = $paletteAssertions[0]
    $paRel = [string](Get-Prop $pa 'relPath')
    $paIds = @(Get-Prop $pa 'newThemeIds' | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
    $paKeys = @(Get-Prop $pa 'paletteKeys' | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
    $paRow = @($rows | Where-Object { $_.tree -ceq 'server' -and $_.relPath -ceq $paRel })
    if ($paRow.Count -eq 0) {
        $tierChecks += [pscustomobject][ordered]@{ what = 'server bundle/index.js 卡片调色板'; ok = $false; detail = "记录里有 cardPalette，但 files 里找不到 server/$paRel" }
    }
    else {
        $paText = Get-FileTextSafe -Path $paRow[0].absPath
        if ($null -eq $paText) {
            $tierChecks += [pscustomobject][ordered]@{ what = 'server bundle/index.js 卡片调色板'; ok = $false; detail = '读取失败，无法核对' }
        }
        else {
            # ① 结构仍在（表在、抛错文案在）；② 每个新 id 的项都以 --bg 开头、精确命中 1 次
            $throwHits = Get-OccurrenceCount -Text $paText -Needle 'no card palette for theme'
            $badIds = @()
            foreach ($id in $paIds) {
                $probe = '"' + $id + '": {' + "`n" + '    "--bg": "'
                $c = Get-OccurrenceCount -Text $paText -Needle $probe
                if ($c -ne 1) { $badIds += "$id x$c" }
            }
            # ③ 键数：每项末尾都是 --radius-chat-card-inner（15 键的最后一项），本皮肤是 12px 口径。
            #   内建 11 项全是 8px，所以“12px 那份的数量 == 新增项数”能揭出“只插了一半”的半改状态。
            $inner12 = Get-OccurrenceCount -Text $paText -Needle '"--radius-chat-card-inner": "max(2px, calc(12px - 2px))"'
            $ok = ($throwHits -eq 1) -and ($badIds.Count -eq 0) -and ($inner12 -eq $paIds.Count)
            $detail = "cardPalette=on：抛错文案 $throwHits 处（期望 1）；" +
                "新增 $($paIds.Count) 项各以 --bg 起头且唯一命中（不符 $($badIds.Count) 项）；" +
                "--radius-chat-card-inner=12px 口径 $inner12 处（期望 $($paIds.Count)）；每项 $($paKeys.Count) 个键"
            if ($badIds.Count -gt 0) { $detail += "；不符：$($badIds -join ', ')" }
            $tierChecks += [pscustomobject][ordered]@{ what = 'server bundle/index.js 卡片调色板'; ok = $ok; detail = $detail }
        }
    }
}

# 注册表项真的在文件里（2026-10-21）-----------------------------------------------------
# 为什么需要：apply.ps1 的四处落盘里有**两个 plan 写同一个文件**（server bundle/index.js：
# 先插主题注册表、再插卡片调色板）。若调色板那份 plan 以磁盘旧文本为基底，落盘时会把
# 注册表插入整段覆盖 —— 文件指纹照样“与记录一致”，因为记录记的就是那个被覆盖后的结果。
# 这是第一起“指纹绿、内容缺”的 bug，故在这里按**注册表项的文本形状**逐 id 核实。
# 形状来自 patches/：renderer 是 `"id":{cssPath:"themes/id.css"`，server 是带空格的 `"id": { cssPath: ...`。
$regAssertions = @(Get-Prop $skin 'registryAssertions' | Where-Object { $null -ne $_ })
foreach ($ra in $regAssertions) {
    $raTree = [string](Get-Prop $ra 'tree')
    $raLabel = [string](Get-Prop $ra 'label')
    if ([string]::IsNullOrWhiteSpace($raLabel)) { $raLabel = "$raTree 主题注册表" }
    $raIds = @(Get-Prop $ra 'newThemeIds' | ForEach-Object { [string]$_ } | Where-Object { $_ -ne '' })
    if ($raIds.Count -eq 0) { continue }
    $raFile = [string](Get-Prop $ra 'file')
    $raRel = if ($raFile) { $raFile } else { '' }
    $raText = if ($raRel -and (Test-Path -LiteralPath $raRel -PathType Leaf)) { Get-FileTextSafe -Path $raRel } else { $null }
    if ($null -eq $raText) {
        $tierChecks += [pscustomobject][ordered]@{ what = "$raLabel 主题条目"; ok = $false; detail = '读取失败或路径缺失，无法核对' }
        continue
    }
    $bad = @()
    foreach ($id in $raIds) {
        $probe = if ($raTree -eq 'server') { '"' + $id + '": { cssPath: "themes/' + $id + '.css"' }
        else { '"' + $id + '":{cssPath:"themes/' + $id + '.css"' }
        $c = Get-OccurrenceCount -Text $raText -Needle $probe
        if ($c -ne 1) { $bad += "$id x$c" }
    }
    $ok = ($bad.Count -eq 0)
    $detail = "$($raIds.Count) 个主题条目各自命中 1 处（不符 $($bad.Count) 个）"
    if ($bad.Count -gt 0) { $detail += "；不符：$($bad -join ', ')" }
    $tierChecks += [pscustomobject][ordered]@{ what = "$raLabel 主题条目"; ok = $ok; detail = $detail }
}

# ---- 源文件体检：CSS 注释必须配对（2026-10-21 教训）------------------------------
# 背景源里多写一个注释结束符时，浏览器把紧跟其后的 `:is(...) { ... }` 当成垃圾一起丢掉：
# 规则**静默失效**、控制台没有任何报错，表现就是“改了但没变”（工作室窗口白板就是这么来的）。
# 判据：每个 src 下的 .css 里 /* 与 */ 计数相等，且不出现连写的 `*/ */`。
$srcCss = @(Get-ChildItem -LiteralPath (Join-Path $RepoRoot 'src') -Recurse -Filter *.css -File -ErrorAction SilentlyContinue)
# 逐字符扫，跟踪“是否在注释内”（不能用 /* 与 */ 计数：注释里引用这两个字面量时计数会失真）：
#   注释外的 `*/` → 游离结束符（就是本次这个 bug，浏览器会把紧跟的整条规则一起丢掉）
#   文件结束时仍在注释内 → 未闭合（会把后面全部规则吃掉）
function Measure-CssComment($text) {
    $i = 0; $n = $text.Length; $inComment = $false; $stray = 0
    while ($i -lt $n) {
        $c = $text[$i]
        $c2 = if ($i + 1 -lt $n) { $text[$i + 1] } else { [char]0 }
        if ($inComment) {
            if ($c -eq '*' -and $c2 -eq '/') { $inComment = $false; $i += 2; continue }
            $i++
        }
        else {
            if ($c -eq '/' -and $c2 -eq '*') { $inComment = $true; $i += 2; continue }
            if ($c -eq '*' -and $c2 -eq '/') { $stray++; $i += 2; continue }
            $i++
        }
    }
    return @{ Stray = $stray; Unclosed = $inComment }
}
$badComment = @()
foreach ($f in $srcCss) {
    $text = Get-Content -LiteralPath $f.FullName -Raw
    $m = Measure-CssComment $text
    if ($m.Stray -gt 0 -or $m.Unclosed) {
        $badComment += "$($f.Directory.Name)/$($f.Name)（游离结束符 $($m.Stray) 个，未闭合 $($m.Unclosed)）"
    }
}
$commentDetail = "扫描 $($srcCss.Count) 个 CSS：注释结构有问题的文件 $($badComment.Count) 个（期望 0）"
if ($badComment.Count -gt 0) { $commentDetail += "：$($badComment -join '; ')" }
$tierChecks += [pscustomobject][ordered]@{ what = 'src/*.css 注释配对'; ok = ($badComment.Count -eq 0); detail = $commentDetail }

$tierFailed = @($tierChecks | Where-Object { -not $_.ok })

# 仓库里到底有没有背景源：只用于把"仓库有、本次没贴"如实说出来，不作判定
$repoHasBgSource = (Test-Path -LiteralPath (Join-Path $RepoRoot 'src\background\dark.css') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $RepoRoot 'src\background\assets\moonlit-night.png') -PathType Leaf)

$verdict = ''
$exitCode = $script:ExitCurrent
$reason = ''

if (-not $versionDirsMatch) {
    $verdict = 'version-changed'
    $exitCode = $script:ExitVersionMoved
    $reason = '版本目录已切换：skin.json 记录的贴入目标不是当前运行的目录（Hana 更新过）'
}
elseif ($badCount -gt 0) {
    $verdict = 'files-mismatch'
    $exitCode = $script:ExitFilesBad
    $reason = "目标目录一致，但有 $badCount 个文件与 skin.json 记录不符 / 缺失"
}
else {
    $verdict = 'current'
    $exitCode = $script:ExitCurrent
    $reason = "皮肤贴在当前运行的版本上，$totalCount 个文件与 skin.json 记录逐一吻合；档位一致性 $($tierChecks.Count) 项全部自洽"
}

# 档位矛盾：单独成一类结论（记录说一套、文件里另一套）
if ($tierFailed.Count -gt 0) {
    if ($verdict -ceq 'current') {
        $verdict = 'tier-mismatch'
        $exitCode = $script:ExitFilesBad
        $reason = "目标目录与文件指纹都一致，但有 $($tierFailed.Count) 项档位与实际内容自相矛盾"
    }
    else {
        $reason += "；另有 $($tierFailed.Count) 项档位自相矛盾"
    }
}

# ============================================================================
# 3. 参考信息：通道可用版本 / 已下载待激活
# ============================================================================

$installedVersion = [string](Get-Prop (Get-Prop (Get-Prop $target 'current') 'renderer') 'version')
if ([string]::IsNullOrWhiteSpace($installedVersion)) {
    $installedVersion = [string](Get-Prop (Get-Prop (Get-Prop $target 'current') 'server') 'version')
}

$channels = @()
$otaPath = Join-Path (Split-Path -Parent $TargetJson) 'ota-state.json'
$otaRead = Read-JsonFileOptional -Path $otaPath
$ota = $otaRead.Value
if ($null -ne $ota) {
    foreach ($p in $ota.PSObject.Properties) {
        $name = [string]$p.Name
        # available = 当前有可安装的新版本（更新完成后会被消费掉，变回空）。
        # 它为空不代表没读到文件，所以不拿它作为"读成功"的证据。
        $avail = Get-DeepVersion (Get-Prop $p.Value 'available')
        # verifiedManifest = 该通道最新已核验版本。跨通道版本号不同源（stable 的 0.412.7 与
        # beta 的 1.0.16-beta 不是同一支线），所以它只作陈列，不做"孰新孰旧"的判断。
        $verified = Get-DeepVersion (Get-Prop $p.Value 'verifiedManifest')
        if ($avail -or $verified) {
            $channels += [pscustomobject][ordered]@{
                channel        = $name
                available      = $avail
                verified       = $verified
                availableIsNew = ($avail -and ($avail -cne $installedVersion))
                verifiedIsSame = ($verified -and ($verified -ceq $installedVersion))
            }
        }
    }
}

$pendingVersion = Get-DeepVersion (Get-Prop $target 'pending')

# ============================================================================
# 4. 输出
# ============================================================================

$result = [pscustomobject][ordered]@{
    verdict           = $verdict
    exitCode          = $exitCode
    reason            = $reason
    skinJson          = (Resolve-Path -LiteralPath $SkinJson).Path
    targetJson        = (Resolve-Path -LiteralPath $TargetJson).Path
    appliedAtLocal    = [string](Get-Prop $skin 'appliedAtLocal')
    installed         = $installedVersion
    recorded          = [pscustomobject][ordered]@{
        rendererVersionDir = $recordedRendererDir
        serverVersionDir   = $recordedServerDir
    }
    target            = [pscustomobject][ordered]@{
        rendererVersionDir = $currentRendererDir
        serverVersionDir   = $currentServerDir
    }
    versionDirsMatch  = $versionDirsMatch
    files             = @($rows)
    counts            = [pscustomobject][ordered]@{
        total   = $totalCount
        ok      = $okCount
        changed = $changedCount
        missing = $missingCount
        unknown = $unknownCount
        bad     = $badCount
    }
    tierChecks        = @($tierChecks)
    channels          = @($channels)
    pendingVersion    = $pendingVersion
}

if ($AsJson) {
    $result | ConvertTo-Json -Depth 6
    exit $exitCode
}

Write-Head 'hana-skin 状态自检（只读）'
Write-Log "skin.json      : $($result.skinJson)"
Write-Log "desktop-target : $($result.targetJson)"
if ([string]::IsNullOrWhiteSpace($result.appliedAtLocal)) {
    Write-Log '上次贴入        : （skin.json 未记录时间）'
}
else {
    Write-Log "上次贴入        : $($result.appliedAtLocal)  [$([string](Get-Prop $skin 'displayName'))]"
}

# ---- 第 1 节：版本目录 ----
Write-Head '[1/4] 版本目录身份'
Write-Log "      renderer 记录 = $recordedRendererDir"
Write-Log "      renderer 当前 = $currentRendererDir"
Write-Log "                     -> $(if ($rendererDirMatch) { '一致' } else { '不一致（已切换）' })"
Write-Log "      server   记录 = $recordedServerDir"
Write-Log "      server   当前 = $currentServerDir"
Write-Log "                     -> $(if ($serverDirMatch) { '一致' } else { '不一致（已切换）' })"

# ---- 第 2 节：文件指纹 ----
Write-Head '[2/4] 文件指纹（按 skin.json 记录的目标目录核对）'
$w = 0
foreach ($r in $rows) { if ($r.display.Length -gt $w) { $w = $r.display.Length } }
Write-Log ("    {0}  {1}  {2}" -f (Format-Pad '状态' 8), (Format-Pad '文件' $w), 'sha256（前 16 位） / 字节数')
foreach ($r in $rows) {
    $shaText = ''
    if ($r.status -eq 'MISSING') {
        $shaText = "缺失（预期 $($r.expectedSha256.Substring(0, 16))…  $($r.expectedBytes) 字节）"
    }
    elseif ($r.status -eq 'UNKNOWN') {
        $shaText = "记录不完整（tree='$($r.tree)' 不是 renderer/server）"
    }
    else {
        $shaText = "$($r.actualSha256.Substring(0, 16))…  $($r.actualBytes) 字节"
        if ($r.status -eq 'CHANGED') {
            $shaText += "   预期 $($r.expectedSha256.Substring(0, 16))…"
            if ($null -ne $r.expectedBytes) { $shaText += " / $($r.expectedBytes) 字节" }
        }
    }

    $tag = switch ($r.status) {
        'OK' { '[ OK ]' }
        'CHANGED' { '[不符]' }
        'MISSING' { '[缺失]' }
        default { '[ ? ]' }
    }

    $line = "    {0}  {1}  {2}" -f (Format-Pad $tag 8), (Format-Pad $r.display $w), $shaText
    $color = switch ($r.status) {
        'OK' { 'Green' }
        'CHANGED' { 'Red' }
        'MISSING' { 'Red' }
        default { 'Yellow' }
    }
    Write-Host $line -ForegroundColor $color
}
Write-Log ''
Write-Log "      合计 $totalCount 项：OK $okCount / 不符 $changedCount / 缺失 $missingCount / 无法核对 $unknownCount"
if (-not $versionDirsMatch) {
    Write-Log '      注：文件是拿"记录里的旧目录"核对的 —— 上表 OK 说明改动还完好地留在旧目录，没被删掉。'
}

# ---- 第 3 节：档位一致性 ----
Write-Head '[3/4] 档位一致性（记录 vs 实际内容）'
$tw = 0
foreach ($c in $tierChecks) {
    $w2 = Get-DisplayWidth $c.what
    if ($w2 -gt $tw) { $tw = $w2 }
}
foreach ($c in $tierChecks) {
    $tag = if ($c.ok) { '[ OK ]' } else { '[矛盾]' }
    $color = if ($c.ok) { 'Green' } else { 'Red' }
    Write-Host ("    {0}  {1}  {2}" -f (Format-Pad $tag 8), (Format-Pad $c.what $tw), $c.detail) -ForegroundColor $color
}
Write-Log ''
if ($tierChecks.Count -eq 0) {
    Write-Log '      合计 0 项：skin.json 未登记任何档位（无法反查，不计入判定）'
}
elseif ($tierFailed.Count -eq 0) {
    Write-Log "      合计 $($tierChecks.Count) 项：全部自洽"
}
else {
    Write-Log "      合计 $($tierChecks.Count) 项：$($tierFailed.Count) 项自相矛盾"
}
if ($repoHasBgSource) {
    $bgDesc = if ($recordedBackground -ceq 'none') { '本次未贴入（记录 background=none）' } else { '已贴入' }
    Write-Log "      仓库背景源：src/background/dark.css + assets/moonlit-night.png 存在；$bgDesc"
}
else {
    Write-Log '      仓库背景源：未找到 src/background/dark.css 或那张图'
}

# ---- 第 4 节：参考信息 ----
Write-Head '[4/4] 版本与更新（参考信息，不参与判定）'
if ([string]::IsNullOrWhiteSpace($installedVersion)) {
    Write-Log '      本地已装版本：desktop-target.json 未记录'
}
else {
    Write-Log "      本地已装版本：$installedVersion"
}
if ($channels.Count -eq 0) {
    if ($otaRead.Problem) {
        Write-Log "      通道可用版本：（$($otaRead.Problem)）"
    }
    else {
        Write-Log '      通道可用版本：（ota-state.json 里没有通道记录）'
    }
}
else {
    foreach ($c in $channels) {
        if ($c.available) {
            $tail = if ($c.availableIsNew) { '  <- 与本地不同，升级后皮肤需重贴' } else { '（与本地相同）' }
            Write-Log "      $(Format-Pad $c.channel 6): 可用 $($c.available)$tail"
        }
        elseif ($c.verified) {
            $tail = if ($c.verifiedIsSame) { '（与本地相同）' } else { '' }
            Write-Log "      $(Format-Pad $c.channel 6): 当前无可用更新；通道最新已核验 $($c.verified)$tail"
        }
    }
}
if ($pendingVersion) {
    Write-Log "      已下载待激活：$pendingVersion  <- 激活（重启）后会换新目录，皮肤将失效"
}
else {
    Write-Log '      已下载待激活：无'
}

# ---- 结论 ----
Write-Host ''
Write-Host ('-' * 72)
switch ($verdict) {
    'current' {
        Write-Host '结论：不用重贴。' -ForegroundColor Green
        Write-Log "      皮肤贴在当前运行的版本上，$totalCount 个文件与 skin.json 记录逐一吻合。"
        Write-Log "      档位一致性 $($tierChecks.Count) 项全部自洽（声明里的背景图 / 缓存版本常量都在文件里找到了）。"
        Write-Log '      无需操作。'
    }
    'version-changed' {
        Write-Host '结论：需要重贴（版本目录已切换）。' -ForegroundColor Yellow
        Write-Log '      Hana 更新会生成新目录并原子切换指针，旧目录里的改动不会跟过去 ——'
        Write-Log '      界面上表现为皮肤消失，但改动（和数据）并未丢失，还留在旧目录里。'
        Write-Log ''
        Write-Log '      下一步：'
        Write-Log '        pwsh -File scripts\apply.ps1           # 先看计划，不写任何文件'
        Write-Log '        pwsh -File scripts\apply.ps1 -Apply    # 真正贴入，然后重启 Hana'
        Write-Log ''
        Write-Log '      若 apply.ps1 报"锚点未命中 / 主题数不符"，说明上游构建变了，'
        Write-Log '      按 README「如果 patches 的锚点因上游构建变化而失效」重建三份 patch。'
    }
    'files-mismatch' {
        Write-Host "结论：需要重贴（$badCount 个文件与记录不符 / 缺失）。" -ForegroundColor Yellow
        Write-Log '      目标目录没变，但文件内容变了 —— 可能是官方回写、被 restore.ps1 还原过、'
        Write-Log '      或上一次贴入没走完。直接重跑一遍即可（apply.ps1 会先备份、幂等处理）。'
        Write-Log ''
        Write-Log '      下一步：'
        Write-Log '        pwsh -File scripts\apply.ps1           # 先看计划，不写任何文件'
        Write-Log '        pwsh -File scripts\apply.ps1 -Apply    # 真正贴入，然后重启 Hana'
    }
    'tier-mismatch' {
        Write-Host "结论：需要重贴（$($tierFailed.Count) 项档位与实际内容自相矛盾）。" -ForegroundColor Yellow
        Write-Log '      文件内容与记录一致，但记录声明的档位在文件里找不到对应内容 ——'
        Write-Log '      典型成因：上次贴入时漏了档位参数（例如 -Background dark 没带），'
        Write-Log '      于是背景图与工作区透明规则被静默抹掉，而记录也跟着写成了 none，两者自洽地错。'
        Write-Log ''
        Write-Log '      下一步（>  不传档位时 apply.ps1 会自动沿用 skin.json 记录；'
        Write-Log '      若记录已被写坏，就显式把档位写回来）：'
        Write-Log '        pwsh -File scripts\apply.ps1 -Background dark          # 先看计划'
        Write-Log '        pwsh -File scripts\apply.ps1 -Background dark -Apply    # 贴入后重启 Hana'
    }
    default {
        Write-Host '结论：无法判定。' -ForegroundColor Yellow
        Write-Log "      $reason"
    }
}
Write-Host ('-' * 72)
Write-Log "（退出码 $exitCode：0=一致 / 1=版本已切换 / 2=文件不符或档位矛盾 / 3=无法判定）"

exit $exitCode
