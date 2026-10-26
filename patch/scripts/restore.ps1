<#
.SYNOPSIS
    restore.ps1 —— 把 apply.ps1 改过的 Hana 安装目录文件**逐文件还原**到官方原样，并用 sha256 证明还原完整。

.DESCRIPTION
    与 scripts/apply.ps1（工单 05）配对（工单 06）。apply.ps1 在每次贴入前把将被修改的原文件
    备份到 backups/<versionLabel>-<timestamp>/，并写一份 manifest.json 记录最小还原信息集：

        schema              = 1
        versionLabel        = renderer 版本目录名（目录名带构建哈希，跨构建即变）
        rendererVersionDir  = 备份时的 renderer 版本目录绝对路径
        serverVersionDir    = 备份时的 server   版本目录绝对路径
        pristineBackupDir   = 该版本第一次贴入时留下的「原样」备份目录
        entries[]           = 每个被改动目标的：
                                tree / relPath / kind / existed /
                                backupRelPath / sha256Before / bytesBefore

    原文件内容存放在备份目录的 files/<tree>/<relPath> 下。

    还原规则（逐 entry）：
      * existed = true  —— 把 files/<tree>/<relPath> 拷回「目标树 + relPath」；
                            拷回前校验备份副本 sha256 == sha256Before（防备份自身损坏），
                            拷回后再校验目标 sha256 == sha256Before（防写入不完整）。
                            主题卡片预览配色 CSS（kind = card-preview-css，
                            assets/SettingsModalShell-<hash>.css）走的就是这条分支：
                           它们是**已存在的**官方构建产物，apply.ps1 只在其内部插入 6 条
                           卡片规则，故回滚就是整文件拷回，天然被本逻辑覆盖。
      * existed = false —— 该文件是 apply.ps1 **新建**的（两棵树上新增的皮肤 CSS），
                            回滚时必须**删除**；删除后断言目标已不存在。
                            独立文档的主题 <link>（kind = theme-link，
                            renderer 树的 browser-viewer.html / viewer-window.html，工单 36-B）
                            走的是这条分支：这两个 html 都是**已存在的**官方构建产物，apply.ps1
                            只在其内部替换一段 <link> 标签，故回滚就是整文件拷回，天然被本逻辑覆盖。
                            因为它们是 apply 会改的第三方构建产物、且改动是"语义性"的
                            （写死的 warm-paper 引用 <-> 当前主题 link），
                            第 6 节 (c2) 额外做一次**内容复核**，不做静默漏检。

    逐文件校验 sha256 == entry.sha256Before，任何一个不符即计入失败并在结尾汇总，
    以非零退出码结束。**绝不静默跳过**：备份文件缺失、哈希不符、目标无法写入，全部显式报告。

    备份定位优先级（工单 06 第 1 条）：
      1) -BackupDir 显式指定（最高优先级）
      2) skin.json 的 pristineBackupDir（**首选**：多次贴入后，只有第一次的备份才是官方原样）
      3) skin.json 的 backupDir
      4) <RepoRoot>/backups 下**最新**的完整备份（含 manifest.json）
    若第 4 条被用到、或选中的备份不是 pristineBackupDir，脚本会显式警告；在 -Apply 模式下
    还会要求交互确认（-Force 可跳过），因为从「非原样」的备份还原不等于回到官方。

    安全边界（同工单 05）：
      * **默认 dry-run**：不传 -Apply 只打印将要做什么，且完成全部只读校验
        （备份文件存在性 + sha256 对照），不写入任何文件。
      * **写盘需 -Apply**：只有显式传了它才真正拷贝 / 删除。
      * **两阶段执行**：-Apply 时先在内存里完成全部只读校验（备份是否齐全、备份副本哈希
        是否与 manifest 一致），有任何失败即**中止且不写入任何文件**，避免留下半还原状态；
        只有确认能全部成功才落盘。确实只想部分还原时用 -AllowPartial。
      * -RendererDir / -ServerDir 可把目标重定向到任意目录（便于在副本上验证，不碰真实安装）。
      * 不删除 backups/ 本身，不修改 skin.json，不触碰 desktop-target.json 与 .verified。

.PARAMETER BackupDir
    备份目录（须含 manifest.json）。不传时按上述优先级自动定位。

.PARAMETER BackupRoot
    备份根目录，用于第 4 条「最新的完整备份」扫描。优先级：显式传参 > 环境变量
    `HANA_SKIN_BACKUP_ROOT` > 默认 `<RepoRoot>/backups`（与 apply.ps1 同一套规则）。

.PARAMETER SkinJson
    skin.json 路径，用于第 2/3 条定位。默认 <RepoRoot>/skin.json。

.PARAMETER RendererDir
    renderer 目标版本目录（覆盖 manifest 里记录的路径）。
    传了即可把还原指向副本，便于在**不碰真实安装目录**的前提下完整验证。

.PARAMETER ServerDir
    server 目标版本目录。同上。

.PARAMETER TargetJson
    desktop-target.json 路径；仅当 manifest 未记录版本目录且未传 -RendererDir/-ServerDir 时，
    透传给 locate.ps1 现读。默认取 $env:HANA_HOME\artifacts\desktop-target.json，
    HANA_HOME 未设时退到 %USERPROFILE%\.hanako\artifacts\desktop-target.json。

.PARAMETER RepoRoot
    本仓库根目录。默认取脚本所在目录的父目录。

.PARAMETER Apply
    显式确认参数：只有传了它才真正写盘（拷回 / 删除）。不传即 dry-run。

.PARAMETER Force
    跳过「选中的备份不是原样备份」的交互确认（用于无人值守 / 已验证场景）。

.PARAMETER SkipRegistryCheck
    跳过还原后的「三处注册表主题数 == 11」复核（默认执行；仅在 node 或 patches/ 缺失时自动跳过）。

.PARAMETER AllowPartial
    默认行为是「前置校验有任何失败即中止，不写入任何文件」（避免留下半还原状态）。
    传了它才允许在存在失败项时，仍还原其余能还原的项。仅在明知备份不完整、
    且只想尽可能恢复时使用。

.EXAMPLE
    # 只看将要还原什么（默认 dry-run，不写盘）
    pwsh -File scripts/restore.ps1

.EXAMPLE
    # 真正回滚（用 skin.json 记录的 pristineBackupDir）
    pwsh -File scripts/restore.ps1 -Apply

.EXAMPLE
    # 在副本上验证（不碰真实安装）
    pwsh -File scripts/restore.ps1 -BackupDir $tmp\backups\<label> -RendererDir $tmp\r -ServerDir $tmp\s -Apply

.NOTES
    PowerShell 7+。node 在 PATH 中时可额外复核三处注册表的主题数是否回到 11。
#>
[CmdletBinding()]
param(
    [string]$BackupDir,
    [string]$BackupRoot,
    [string]$SkinJson,
    [string]$RendererDir,
    [string]$ServerDir,
    [string]$TargetJson = $(if ($env:HANA_HOME) { Join-Path $env:HANA_HOME 'artifacts\desktop-target.json' } else { Join-Path $env:USERPROFILE '.hanako\artifacts\desktop-target.json' }),
    [string]$RepoRoot,
    [switch]$Apply,
    [switch]$Force,
    [switch]$SkipRegistryCheck,
    [switch]$AllowPartial
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

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

function Write-Warn {
    param([string]$Message)
    Write-Log "      [警告] $Message"
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

# 把相对路径（可能含 / 或 \）拼到基目录下，并断言结果没有跑出基目录（防 manifest 被篡改后穿越）
function Join-RelPath {
    param(
        [Parameter(Mandatory)][string]$Base,
        [Parameter(Mandatory)][string]$Rel,
        [Parameter(Mandatory)][string]$What
    )
    if ([string]::IsNullOrWhiteSpace($Rel)) { Stop-Fail "$What：相对路径为空" }
    $full = [System.IO.Path]::GetFullPath((Join-Path $Base ($Rel -replace '/', '\')))
    $baseFull = [System.IO.Path]::GetFullPath($Base).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    if (-not $full.StartsWith($baseFull, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Fail "$What：相对路径 '$Rel' 解析后跑出了基目录 '$Base'（实际 '$full'）—— 拒绝执行"
    }
    return $full
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$What)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { Stop-Fail "$What 不存在：'$Path'" }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $text = $script:Utf8NoBom.GetString($bytes, 3, $bytes.Length - 3)
    }
    else {
        $text = $script:Utf8NoBom.GetString($bytes)
    }
    try {
        $obj = $text | ConvertFrom-Json
    }
    catch {
        Stop-Fail "$What JSON 解析失败：'$Path' —— $($_.Exception.Message)"
    }
    if ($null -eq $obj) { Stop-Fail "$What 解析结果为空：'$Path'" }
    return $obj
}

# ============================================================================
# 注册表字面量定位 / node 真求值（与 apply.ps1 同一套算法，用于还原后复核主题数）
# ============================================================================

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
    return [pscustomobject]@{ Open = $openIdx; Close = $end; Literal = $Text.Substring($openIdx, $end - $openIdx + 1) }
}

$script:NodeEvalJs = 'let s="";process.stdin.setEncoding("utf8");' +
    'process.stdin.on("data",d=>{s+=d});' +
    'process.stdin.on("end",()=>{' +
    'let o;try{o=new Function("return ("+s+")")()}catch(e){' +
    'process.stdout.write(JSON.stringify({ok:false,error:String(e&&e.message)}));return}' +
    'process.stdout.write(JSON.stringify({ok:true,count:Object.keys(o).length,ids:Object.keys(o)}))});'
$script:NodeEvalArg = "eval(Buffer.from('" +
    [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($script:NodeEvalJs)) +
    "','base64').toString('utf8'))"

function Invoke-NodeLiteralEval {
    param([Parameter(Mandatory)][string]$Literal, [Parameter(Mandatory)][string]$What)
    $out = $Literal | & node -e $script:NodeEvalArg
    $code = $LASTEXITCODE
    if ($code -ne 0) { Stop-Fail "$What：node 求值进程退出码 $code" }
    if ($null -eq $out) { Stop-Fail "$What：node 求值无输出" }
    try { $parsed = ([string]$out).Trim() | ConvertFrom-Json }
    catch { Stop-Fail "$What：node 输出不是合法 JSON —— $($_.Exception.Message)" }
    if (-not (Get-Prop $parsed 'ok')) { Stop-Fail "$What：注册表字面量不是合法 JS 对象 —— $(Get-Prop $parsed 'error')" }
    return $parsed
}

# ============================================================================
# 主流程
# ============================================================================

$isDryRun = -not $Apply
$modeText = if ($isDryRun) { 'DRY-RUN（默认；不写入任何文件。要真正回滚请加 -Apply）' } else { 'APPLY（已显式确认，将拷回 / 删除文件）' }

$failures = [System.Collections.Generic.List[string]]::new()
$plan = [System.Collections.Generic.List[object]]::new()

try {
    Write-Head "hana-moonlit-court restore.ps1 —— $modeText"

    # ------------------------------------------------------------------
    # 0. 路径解析
    # ------------------------------------------------------------------
    if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
    $RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
    # 备份根：显式传参 > 环境变量 > <RepoRoot>/backups（与 apply.ps1 同一套规则，工单 78）
    if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
        if (-not [string]::IsNullOrWhiteSpace($env:HANA_SKIN_BACKUP_ROOT)) { $BackupRoot = $env:HANA_SKIN_BACKUP_ROOT }
        else { $BackupRoot = Join-Path $RepoRoot 'backups' }
    }
    if ([string]::IsNullOrWhiteSpace($SkinJson)) { $SkinJson = Join-Path $RepoRoot 'skin.json' }

    Write-Log "[0] 仓库根   ：$RepoRoot"
    Write-Log "    备份根   ：$BackupRoot"
    Write-Log "    skin.json：$(if (Test-Path -LiteralPath $SkinJson -PathType Leaf) { $SkinJson } else { "$SkinJson（不存在）" })"

    # ------------------------------------------------------------------
    # 1. 定位备份目录
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[1] 定位备份目录'

    $skin = $null
    if (Test-Path -LiteralPath $SkinJson -PathType Leaf) {
        $skin = Read-JsonFile -Path $SkinJson -What 'skin.json'
    }

    $skinPristine = if ($null -ne $skin) { [string](Get-Prop $skin 'pristineBackupDir') } else { '' }
    $skinBackup = if ($null -ne $skin) { [string](Get-Prop $skin 'backupDir') } else { '' }

    # 4) 扫描 backups/ 下所有「完整备份」（含 manifest.json），按目录名倒序 = 最新在前
    $candidates = @()
    if (Test-Path -LiteralPath $BackupRoot -PathType Container) {
        foreach ($d in @(Get-ChildItem -LiteralPath $BackupRoot -Directory)) {
            if (Test-Path -LiteralPath (Join-Path $d.FullName 'manifest.json') -PathType Leaf) {
                $candidates += [pscustomobject]@{ Dir = $d.FullName; Name = $d.Name }
            }
        }
        $candidates = @($candidates | Sort-Object Name -Descending)
    }

    $selectionReason = ''
    if (-not [string]::IsNullOrWhiteSpace($BackupDir)) {
        $selectionReason = '由 -BackupDir 显式指定'
    }
    elseif (-not [string]::IsNullOrWhiteSpace($skinPristine) -and (Test-Path -LiteralPath (Join-Path $skinPristine 'manifest.json') -PathType Leaf)) {
        $BackupDir = $skinPristine
        $selectionReason = 'skin.json 的 pristineBackupDir（首次贴入留下的原样备份）'
    }
    elseif (-not [string]::IsNullOrWhiteSpace($skinPristine)) {
        Write-Warn "skin.json 的 pristineBackupDir 无效或缺少 manifest.json：'$skinPristine'"
        if (-not [string]::IsNullOrWhiteSpace($skinBackup) -and (Test-Path -LiteralPath (Join-Path $skinBackup 'manifest.json') -PathType Leaf)) {
            $BackupDir = $skinBackup
            $selectionReason = 'skin.json 的 backupDir（pristineBackupDir 不可用）'
        }
    }
    if ([string]::IsNullOrWhiteSpace($BackupDir) -and -not [string]::IsNullOrWhiteSpace($skinBackup) -and (Test-Path -LiteralPath (Join-Path $skinBackup 'manifest.json') -PathType Leaf)) {
        $BackupDir = $skinBackup
        $selectionReason = 'skin.json 的 backupDir'
    }
    if ([string]::IsNullOrWhiteSpace($BackupDir)) {
        if ($candidates.Count -eq 0) {
            Stop-Fail ("未指定 -BackupDir，且无法自动定位备份：skin.json 无可用记录，'$BackupRoot' 下也没有任何含 manifest.json 的备份目录。" +
                "请显式传 -BackupDir <备份目录>。")
        }
        $BackupDir = $candidates[0].Dir
        $selectionReason = "backups/ 下最新的完整备份（共 $($candidates.Count) 个候选，取目录名倒序第一个）"
        Write-Warn '正在使用「最新的完整备份」——若曾多次贴入，最新备份里的文件可能已经是改过的版本。'
        Write-Warn '若目标只是回到官方原样，应改用首次贴入留下的 pristineBackupDir。'
    }

    if (-not (Test-Path -LiteralPath $BackupDir -PathType Container)) { Stop-Fail "备份目录不存在：'$BackupDir'" }
    $BackupDir = (Resolve-Path -LiteralPath $BackupDir).Path
    $manifestPath = Join-Path $BackupDir 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        Stop-Fail "备份目录里没有 manifest.json，无法逐文件还原：'$BackupDir'（中途失败的残骸目录不算备份）"
    }
    Write-Log "      选中：$BackupDir"
    Write-Log "      理由：$selectionReason"
    if ($candidates.Count -gt 1) {
        Write-Log "      （backups/ 下共 $($candidates.Count) 个完整备份：$((@($candidates | ForEach-Object { $_.Name })) -join ', ')）"
    }

    # ------------------------------------------------------------------
    # 2. 读 manifest
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[2] 读 manifest.json'

    $manifest = Read-JsonFile -Path $manifestPath -What 'manifest.json'
    $schema = Get-Prop $manifest 'schema'
    if ([int]$schema -ne 1) { Stop-Fail "manifest.json 的 schema 是 '$schema'，本脚本只认 1" }
    $versionLabel = [string](Get-RequiredProp $manifest 'versionLabel' 'manifest.json')
    $mRenderer = [string](Get-Prop $manifest 'rendererVersionDir')
    $mServer = [string](Get-Prop $manifest 'serverVersionDir')
    $mPristine = [string](Get-Prop $manifest 'pristineBackupDir')
    $entries = @(Get-Prop $manifest 'entries')
    if ($entries.Count -eq 0) { Stop-Fail "manifest.json 的 entries 为空，没有可还原的目标" }

    Write-Log "      schema            = $schema"
    Write-Log "      versionLabel      = $versionLabel"
    Write-Log "      createdAt         = $(Get-Prop $manifest 'createdAt')"
    Write-Log "      tool              = $(Get-Prop $manifest 'tool')"
    Write-Log "      rendererVersionDir= $mRenderer"
    Write-Log "      serverVersionDir  = $mServer"
    Write-Log "      pristineBackupDir = $mPristine"
    Write-Log "      entries           = $($entries.Count) 项"

    # --- 选中的备份是否为「原样」备份：不是则显式警告 ---
    $isPristineSelection = $true
    $pristineFull = $mPristine
    if (-not [string]::IsNullOrWhiteSpace($mPristine)) {
        try { $pristineFull = (Resolve-Path -LiteralPath $mPristine).Path } catch { $pristineFull = $mPristine }
        if (-not [string]::Equals($pristineFull, $BackupDir, [StringComparison]::OrdinalIgnoreCase)) {
            $isPristineSelection = $false
            Write-Warn "选中的备份不是 manifest 记录的 pristineBackupDir："
            Write-Warn "  选中   ：$BackupDir"
            Write-Warn "  原样备份：$pristineFull"
            if (Test-Path -LiteralPath (Join-Path $pristineFull 'manifest.json') -PathType Leaf) {
                Write-Warn "  提示：只想到回到官方原样，请改用 -BackupDir `"$pristineFull`""
            }
            else {
                Write-Warn "  注意：pristineBackupDir 已不存在，无法改用；本次还原可能不是官方原样，请自行核对 sha256。"
            }
        }
    }

    # ------------------------------------------------------------------
    # 3. 解析两个目标树
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[3] 解析还原目标目录'

    $redirected = [System.Collections.Generic.List[string]]::new()

    if (-not [string]::IsNullOrWhiteSpace($RendererDir)) {
        if (-not [System.IO.Path]::IsPathRooted($RendererDir)) { Stop-Fail "-RendererDir 不是绝对路径：'$RendererDir'" }
        $redirected.Add('renderer')
    }
    if (-not [string]::IsNullOrWhiteSpace($ServerDir)) {
        if (-not [System.IO.Path]::IsPathRooted($ServerDir)) { Stop-Fail "-ServerDir 不是绝对路径：'$ServerDir'" }
        $redirected.Add('server')
    }

    if ([string]::IsNullOrWhiteSpace($RendererDir)) {
        if (-not [string]::IsNullOrWhiteSpace($mRenderer)) { $RendererDir = $mRenderer }
    }
    if ([string]::IsNullOrWhiteSpace($ServerDir)) {
        if (-not [string]::IsNullOrWhiteSpace($mServer)) { $ServerDir = $mServer }
    }

    # manifest 缺版本目录且未重定向：退回 locate.ps1 现读
    if ([string]::IsNullOrWhiteSpace($RendererDir) -or [string]::IsNullOrWhiteSpace($ServerDir)) {
        $locateScript = Join-Path $PSScriptRoot 'locate.ps1'
        if (-not (Test-Path -LiteralPath $locateScript -PathType Leaf)) {
            Stop-Fail "manifest.json 未记录版本目录，且 locate.ps1 缺失：'$locateScript'（请显式传 -RendererDir / -ServerDir）"
        }
        Write-Log "      manifest 缺版本目录，调用 locate.ps1（TargetJson = $TargetJson）"
        $locateResult = & $locateScript -TargetJson $TargetJson
        if ($null -eq $locateResult) { Stop-Fail 'locate.ps1 未返回结果' }
        if ([string]::IsNullOrWhiteSpace($RendererDir)) { $RendererDir = [string]$locateResult.rendererVersionDir }
        if ([string]::IsNullOrWhiteSpace($ServerDir)) { $ServerDir = [string]$locateResult.serverVersionDir }
    }

    foreach ($pair in @(
            [pscustomobject]@{ Kind = 'renderer'; Dir = $RendererDir }
            [pscustomobject]@{ Kind = 'server'; Dir = $ServerDir }
        )) {
        if ([string]::IsNullOrWhiteSpace($pair.Dir)) { Stop-Fail "$($pair.Kind) 目标目录为空" }
        if (-not [System.IO.Path]::IsPathRooted($pair.Dir)) { Stop-Fail "$($pair.Kind) 目标目录不是绝对路径：'$($pair.Dir)'" }
        if (-not (Test-Path -LiteralPath $pair.Dir -PathType Container)) { Stop-Fail "$($pair.Kind) 目标目录不存在：'$($pair.Dir)'" }
    }
    $RendererDir = (Resolve-Path -LiteralPath $RendererDir).Path
    $ServerDir = (Resolve-Path -LiteralPath $ServerDir).Path
    Write-Log "      renderer = $RendererDir$(if ($redirected -contains 'renderer') { '   [由 -RendererDir 重定向]' } else { '' })"
    Write-Log "      server   = $ServerDir$(if ($redirected -contains 'server') { '   [由 -ServerDir 重定向]' } else { '' })"

    # 版本目录一致性：没重定向时，renderer 目录名必须仍是备份时那个版本
    # （安装包升级会换目录；把旧版本的备份还原进新版本目录是错的，必须显式报错）
    if ($redirected -notcontains 'renderer') {
        $leaf = Split-Path -Leaf $RendererDir
        if ($leaf -cne $versionLabel) {
            Stop-Fail ("renderer 目标目录名 '$leaf' 与备份的 versionLabel '$versionLabel' 不一致：" +
                "安装版本可能已升级（目录名带构建哈希，跨构建即变）。" +
                "把旧版本的备份还原进新版本目录不是正确操作。若确需在副本上验证，请显式传 -RendererDir。")
        }
    }

    # ------------------------------------------------------------------
    # 4. 制定还原计划（只读：同时完成全部前置校验）
    # ------------------------------------------------------------------
    Write-Log ''
    Write-Log '[4] 制定还原计划并做只读前置校验'

    foreach ($e in $entries) {
        $tree = [string](Get-RequiredProp $e 'tree' 'manifest.entry')
        $rel = [string](Get-RequiredProp $e 'relPath' 'manifest.entry')
        $kind = [string](Get-Prop $e 'kind')
        $existed = [bool](Get-Prop $e 'existed')
        $backupRel = [string](Get-Prop $e 'backupRelPath')
        $shaBefore = [string](Get-Prop $e 'sha256Before')
        $bytesBefore = Get-Prop $e 'bytesBefore'
        $what = "entry $tree/$rel"

        if ($tree -ne 'renderer' -and $tree -ne 'server') { Stop-Fail "$what：tree 只能是 renderer / server（实际 '$tree'）" }
        $base = if ($tree -eq 'renderer') { $RendererDir } else { $ServerDir }
        $target = Join-RelPath -Base $base -Rel $rel -What "$what（目标）"

        $row = [pscustomobject]@{
            Tree          = $tree
            RelPath       = $rel
            Kind          = $kind
            Existed       = $existed
            TargetPath    = $target
            BackupPath    = $null
            Sha256Before  = $shaBefore
            BytesBefore   = $bytesBefore
            Action        = ''
            Status        = 'pending'
            Detail        = ''
            TargetSha256  = $null
            BackupSha256  = $null
        }

        if ($existed) {
            # --- 需要从备份拷回 ---
            if ([string]::IsNullOrWhiteSpace($backupRel)) {
                $row.Action = 'restore'
                $row.Status = 'failed'
                $row.Detail = 'existed=true 但 manifest 未记录 backupRelPath —— 备份不完整，无法还原'
                $failures.Add("$what：$($row.Detail)")
                $plan.Add($row)
                continue
            }
            $src = Join-RelPath -Base $BackupDir -Rel $backupRel -What "$what（备份）"
            $row.BackupPath = $src
            $row.Action = 'restore'

            if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
                $row.Status = 'failed'
                $row.Detail = "备份文件缺失：'$src' —— 备份不完整，该项无法还原"
                $failures.Add("$what：$($row.Detail)")
                $plan.Add($row)
                continue
            }
            $row.BackupSha256 = Get-FileSha256 $src
            if ([string]::IsNullOrWhiteSpace($shaBefore)) {
                $row.Status = 'failed'
                $row.Detail = 'existed=true 但 manifest 未记录 sha256Before —— 无法证明还原完整'
                $failures.Add("$what：$($row.Detail)")
                $plan.Add($row)
                continue
            }
            if ($row.BackupSha256 -cne $shaBefore) {
                $row.Status = 'failed'
                $row.Detail = "备份副本自身损坏：sha256=$($row.BackupSha256)，manifest 记录 $shaBefore"
                $failures.Add("$what：$($row.Detail)")
                $plan.Add($row)
                continue
            }

            $targetSha = Get-FileSha256 $target
            if ($targetSha -ceq $shaBefore) {
                $row.Status = 'already-pristine'
                $row.Detail = '目标当前已是原样（sha256 已与备份一致），无需改动'
            }
            else {
                $row.Status = 'ready'
                $row.Detail = if ($null -eq $targetSha) { '目标当前不存在，将创建' } else { "将覆盖（当前 sha256=$targetSha）" }
            }
        }
        else {
            # --- apply 新建的文件：回滚时删除 ---
            $row.Action = 'delete'
            if (Test-Path -LiteralPath $target -PathType Leaf) {
                $row.Status = 'ready'
                $row.Detail = 'apply.ps1 新建的文件，将删除'
            }
            else {
                $row.Status = 'already-pristine'
                $row.Detail = '目标已不存在（此前已删除或从未创建）'
            }
        }
        $plan.Add($row)
    }

    $nRestore = @($plan | Where-Object { $_.Action -eq 'restore' }).Count
    $nDelete = @($plan | Where-Object { $_.Action -eq 'delete' }).Count
    $nReady = @($plan | Where-Object { $_.Status -eq 'ready' }).Count
    $nPristine = @($plan | Where-Object { $_.Status -eq 'already-pristine' }).Count
    $nFailed = @($plan | Where-Object { $_.Status -eq 'failed' }).Count

    Write-Log "      计划：$($plan.Count) 项（拷回 $nRestore / 删除 $nDelete）；其中待执行 $nReady，已是原样 $nPristine，失败 $nFailed"
    foreach ($r in $plan) {
        $mark = switch ($r.Status) {
            'ready' { '待执行' }
            'already-pristine' { '无需改动' }
            'failed' { '失败' }
            default { $r.Status }
        }
        Write-Log ("        [{0}] {1}/{2}  {3}  {4}" -f $mark, $r.Tree, $r.RelPath, $r.Action, $r.Detail)
    }

    # ------------------------------------------------------------------
    # dry-run：打印后退出（不写盘）
    # ------------------------------------------------------------------
    if ($isDryRun) {
        Write-Head 'DRY-RUN：以上为将要执行的操作（本次未写入任何文件）'
        Write-Log "  备份目录：$BackupDir"
        Write-Log "  拷回 $nRestore 项（existed=true），删除 $nDelete 项（existed=false，apply 新建）"
        if ($nPristine -gt 0) { Write-Log "  其中 $nPristine 项已是原样，实际不会改动" }
        if ($failures.Count -gt 0) {
            Write-Log ''
            Write-Log "  前置校验发现 $($failures.Count) 项问题（真实执行时会失败并计入失败汇总）："
            foreach ($f in $failures) { Write-Log "    - $f" }
        }
        Write-Log ''
        Write-Log '  以上均未执行。确认无误后加 -Apply 真正回滚。'
        exit 0
    }

    # ==================================================================
    # 执行阶段（仅 -Apply）
    # ==================================================================

    # --- 前置失败闸门：备份不完整 / 损坏时，先中止，不做任何写入 ---
    # 与 apply.ps1 的「两阶段执行」同一思路：先证明「能全部成功」，再落盘。
    # 否则会留下「一部分已还原、一部分没还原」的半还原状态，比干脆不还原更难排查。
    if ($failures.Count -gt 0 -and -not $AllowPartial) {
        Write-Head '中止：前置校验未通过，未写入任何文件'
        Write-Log "  发现 $($failures.Count) 项问题："
        foreach ($f in $failures) { Write-Log "    - $f" }
        Write-Log ''
        Write-Log '  这些项无法还原（备份不完整或已损坏）。本次**未改动任何文件**。'
        Write-Log '  处理建议：'
        Write-Log '    - 换用完整的备份：-BackupDir "<另一个备份目录>"；或'
        Write-Log '    - 从别处取得缺失的原文件补齐备份后重跑；或'
        Write-Log '    - 明知只能部分还原、仍要还原其余项：加 -AllowPartial'
        exit 1
    }

    # --- 交互确认：从「非原样」备份还原时，必须由用户再确认一次 ---
    # 注意：确认必须发生在**任何写入之前**（此处仍早于步骤 5 的拷回 / 删除）。
    if (-not $isPristineSelection -and -not $Force) {
        $answer = $null
        $promptFailed = $false
        try {
            $answer = Read-Host '选中的备份不是首次贴入留下的原样备份，还原结果可能不等于官方原样。仍要继续？[y/N]'
        }
        catch {
            $promptFailed = $true
        }
        # 非交互会话下 Read-Host 不抛异常，而是返回 $null / 空串。
        # 这种情况按「未确认」处理（fail-closed）：不写入任何文件。
        if ($promptFailed -or [string]::IsNullOrWhiteSpace($answer)) {
            Write-Log ''
            Write-Log '      未获得确认（非交互会话下无法询问，或回答为空）——按「取消」处理，未写入任何文件。'
            Write-Log '      若要继续，请显式表态其一：'
            Write-Log '        - 加 -Force 强制使用当前选中的备份；或'
            Write-Log "        - 改用原样备份：-BackupDir `"$pristineFull`""
            exit 0
        }
        if ($answer -notmatch '^(?i)y(es)?$') {
            Write-Log '      用户取消，退出（未写入任何文件）'
            exit 0
        }
    }

    Write-Head '[5] 逐文件还原'

    $okCount = 0
    foreach ($row in $plan) {
        if ($row.Status -eq 'failed') {
            Write-Log "      [跳过] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
            continue
        }
        if ($row.Status -eq 'already-pristine') {
            Write-Log "      [无需改动] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
            $okCount++
            continue
        }

        if ($row.Action -eq 'restore') {
            try {
                $destDir = Split-Path -Parent $row.TargetPath
                if (-not (Test-Path -LiteralPath $destDir -PathType Container)) {
                    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
                }
                Copy-Item -LiteralPath $row.BackupPath -Destination $row.TargetPath -Force
                $row.TargetSha256 = Get-FileSha256 $row.TargetPath
                if ($row.TargetSha256 -cne $row.Sha256Before) {
                    $row.Status = 'failed'
                    $row.Detail = "拷回后 sha256 校验不符：实际 $($row.TargetSha256)，期望 $($row.Sha256Before)"
                    $failures.Add("$($row.Tree)/$($row.RelPath)：$($row.Detail)")
                    Write-Log "      [失败] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
                    continue
                }
                $row.Status = 'restored'
                $row.Detail = "已还原，sha256=$($row.TargetSha256)（与 manifest.sha256Before 一致）"
                $okCount++
                Write-Log "      [已还原] $($row.Tree)/$($row.RelPath)  sha256=$($row.TargetSha256)"
            }
            catch {
                $row.Status = 'failed'
                $row.Detail = "拷回失败：$($_.Exception.Message)"
                $failures.Add("$($row.Tree)/$($row.RelPath)：$($row.Detail)")
                Write-Log "      [失败] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
            }
            continue
        }

        if ($row.Action -eq 'delete') {
            try {
                Remove-Item -LiteralPath $row.TargetPath -Force
                if (Test-Path -LiteralPath $row.TargetPath) {
                    $row.Status = 'failed'
                    $row.Detail = '删除后目标仍然存在'
                    $failures.Add("$($row.Tree)/$($row.RelPath)：$($row.Detail)")
                    Write-Log "      [失败] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
                    continue
                }
                $row.Status = 'deleted'
                $row.Detail = '已删除（apply.ps1 新建的文件）'
                $okCount++
                Write-Log "      [已删除] $($row.Tree)/$($row.RelPath)"
            }
            catch {
                $row.Status = 'failed'
                $row.Detail = "删除失败：$($_.Exception.Message)"
                $failures.Add("$($row.Tree)/$($row.RelPath)：$($row.Detail)")
                Write-Log "      [失败] $($row.Tree)/$($row.RelPath)：$($row.Detail)"
            }
            continue
        }

        Stop-Fail "内部错误：未知 Action '$($row.Action)'"
    }

    # ------------------------------------------------------------------
    # 6. 还原后逐文件复核（独立回读，不复用上面的内存结果）
    # ------------------------------------------------------------------
    Write-Head '[6] 还原后复核'

    Write-Log '  (a) 逐文件 sha256 对照（期望 = manifest.sha256Before；existed=false 期望「文件不存在」）'
    foreach ($row in $plan) {
        if ($row.Existed) {
            $now = Get-FileSha256 $row.TargetPath
            $ok = ($null -ne $now -and $now -ceq $row.Sha256Before)
            $row.TargetSha256 = $now
            if (-not $ok) {
                $msg = "$($row.Tree)/$($row.RelPath)：复核 sha256 不符（实际 $(if ($null -eq $now) { '<文件不存在>' } else { $now })，期望 $($row.Sha256Before)）"
                if ($failures -notcontains $msg) { $failures.Add($msg) }
                Write-Log "      [不符] $($row.Tree)/$($row.RelPath)"
                Write-Log "             实际 $now"
                Write-Log "             期望 $($row.Sha256Before)"
            }
            else {
                Write-Log "      [一致] $($row.Tree)/$($row.RelPath)  $now"
            }
        }
        else {
            $exists = Test-Path -LiteralPath $row.TargetPath
            if ($exists) {
                $msg = "$($row.Tree)/$($row.RelPath)：existed=false，复核发现文件仍然存在（应被删除）"
                if ($failures -notcontains $msg) { $failures.Add($msg) }
                Write-Log "      [不符] $($row.Tree)/$($row.RelPath)：仍然存在"
            }
            else {
                Write-Log "      [已移除] $($row.Tree)/$($row.RelPath)  （existed=false，确认不存在）"
            }
        }
    }

    # --- (b) 三处注册表主题数复核（node 真求值）---
    Write-Log ''
    Write-Log '  (b) 三处注册表主题数复核（node 真求值，期望回到 countBaseline）'

    $patchDir = Join-Path $RepoRoot 'patches'
    $registryEntryMap = @{
        'renderer|lib/theme.js'          = 'theme-registry-renderer.patch'
        'server|bundle/index.js'         = 'theme-registry-server.patch'
    }
    $bundlePatchName = 'theme-registry-bundle.patch'
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue

    if ($SkipRegistryCheck) {
        Write-Log '      （-SkipRegistryCheck 已指定，跳过）'
    }
    elseif ($null -eq $nodeCmd) {
        Write-Log '      （PATH 中找不到 node，无法真求值，跳过——这是显式跳过，不是静默通过）'
    }
    elseif (-not (Test-Path -LiteralPath $patchDir -PathType Container)) {
        Write-Log "      （patches/ 不存在：'$patchDir'，无法取得锚点，跳过——显式跳过）"
    }
    else {
        foreach ($row in $plan) {
            if ($row.Kind -ne 'registry') {
                # 非 registry 条目在本节**显式跳过**（不是静默漏检）：注册表主题数是
                # registry 类条目独有的判据，其它 kind 各自有对应的复核段：
                #   theme-css / card-preview-css / locale -> 由 (a) 的逐字节 sha256 对照覆盖；
                #   theme-link（工单 36-B）-> 另由 (c2) 做内容复核；
                #   theme-cache-bust / panel-frame-js -> 由 (a) 覆盖（同一份 lib/theme.js）。
                Write-Log "      （$($row.Tree)/$($row.RelPath) kind='$($row.Kind)' 不是注册表条目，本节不适用——显式跳过，由 (a)/对应复核段覆盖）"
                continue
            }
            $patchName = $null
            $key = "$($row.Tree)|$($row.RelPath)"
            if ($registryEntryMap.ContainsKey($key)) { $patchName = $registryEntryMap[$key] }
            elseif ($row.Tree -eq 'renderer' -and $row.RelPath -match '^assets/index-.*\.js$') { $patchName = $bundlePatchName }

            if ($null -eq $patchName) {
                Write-Log "      （$key 找不到对应 patch，跳过——显式跳过）"
                continue
            }
            $patchPath = Join-Path $patchDir $patchName
            if (-not (Test-Path -LiteralPath $patchPath -PathType Leaf)) {
                Write-Log "      （$patchName 缺失，跳过 $key——显式跳过）"
                continue
            }
            $patchObj = Read-JsonFile -Path $patchPath -What "patch $patchName"
            $anchor = [string](Get-Prop $patchObj 'anchor')
            $baseline = [int](Get-Prop $patchObj 'countBaseline')
            if ([string]::IsNullOrWhiteSpace($anchor)) {
                Write-Log "      （$patchName 无 anchor，跳过 $key——显式跳过）"
                continue
            }
            if (-not (Test-Path -LiteralPath $row.TargetPath -PathType Leaf)) {
                $failures.Add("$key：复核注册表主题数时目标文件不存在")
                Write-Log "      [失败] $key：文件不存在，无法复核"
                continue
            }
            $bytes = [System.IO.File]::ReadAllBytes($row.TargetPath)
            $text = $script:Utf8NoBom.GetString($bytes)
            $count = Get-OccurrenceCount -Text $text -Needle $anchor
            if ($count -ne 1) {
                $failures.Add("$key：锚点命中 $count 次（要求 1），无法复核主题数")
                Write-Log "      [失败] $key：锚点命中 $count 次，无法复核"
                continue
            }
            $idx = $text.IndexOf($anchor, [StringComparison]::Ordinal)
            $enc = Get-EnclosingObjectLiteral -Text $text -Pos $idx
            $eval = Invoke-NodeLiteralEval -Literal $enc.Literal -What "$key（复核）"
            if ([int]$eval.count -ne $baseline) {
                $failures.Add("$key：主题数 $($eval.count)，期望 $baseline")
                Write-Log "      [失败] $key：主题数 $([int]$eval.count)，期望 $baseline"
            }
            else {
                Write-Log "      [一致] $key：主题数 $([int]$eval.count)（node 真求值，ids：$((@($eval.ids)) -join ', ')）"
            }
        }
    }

    # --- (c) 主题卡片预览配色 CSS 复核（确认 6 条新规则已随整文件拷回而消失）---
    $cardEntries = @($plan | Where-Object { $_.Kind -eq 'card-preview-css' })
    if ($cardEntries.Count -gt 0) {
        Write-Log ''
        Write-Log '  (c) 主题卡片预览配色 CSS 复核（期望：两个新主题的卡片规则已不存在）'

        $cardPatchPath = Join-Path $RepoRoot 'patches/theme-card-preview.patch'
        $cardNewIds = @()
        if (Test-Path -LiteralPath $cardPatchPath -PathType Leaf) {
            $cardPatchObj = Read-JsonFile -Path $cardPatchPath -What 'patch theme-card-preview'
            $cardNewIds = @(Get-Prop $cardPatchObj 'newThemeIds')
        }
        if ($cardNewIds.Count -eq 0) {
            Write-Log "      （'$cardPatchPath' 缺失或 newThemeIds 为空，无法取得新主题 id，"
            Write-Log '        本节仅依据 (a) 的 sha256 逐字节对照判定——这是显式跳过，不是静默通过）'
        }
        else {
            foreach ($row in $cardEntries) {
                if (-not (Test-Path -LiteralPath $row.TargetPath -PathType Leaf)) {
                    $failures.Add("$($row.Tree)/$($row.RelPath)：卡片配色 CSS 还原后文件不存在")
                    Write-Log "      [失败] $($row.Tree)/$($row.RelPath)：文件不存在"
                    continue
                }
                $bytes = [System.IO.File]::ReadAllBytes($row.TargetPath)
                $text = $script:Utf8NoBom.GetString($bytes)
                $leaks = [System.Collections.Generic.List[string]]::new()
                foreach ($id in $cardNewIds) {
                    if ($text.Contains("[data-theme=$id]")) { $leaks.Add([string]$id) }
                }
                if ($leaks.Count -gt 0) {
                    $msg = "$($row.Tree)/$($row.RelPath)：还原后仍含新主题的卡片规则（$($leaks -join ', ')）"
                    $failures.Add($msg)
                    Write-Log "      [失败] $msg"
                }
                else {
                    Write-Log "      [一致] $($row.Tree)/$($row.RelPath)：新主题卡片规则已不存在"
                }
            }
        }
    }

    # --- (c2) 独立文档主题 <link> 复核（工单 36-B）---
    # 与 (c) 同一思路：还原后必须确认「apply 贴进去的那段语义改动」确实消失了。
    # 判据是**双向**的，缺一不可：
    #   ① 不得再有 id="themeSheet"（apply 加上去的接管锚点）；
    #   ② 必须重新出现官方写死的 assets/warm-paper-*.css 引用（apply 换掉的那段）。
    # 只验 ① 会漏掉「apply 把整段 link 删了、restore 拷回的是另一份」这种情形；
    # 只验 ② 同理。两条一起才等价于「回到了官方原文」。
    # 另外把「还原后是否与该文件的 sha256Before 一致」再说一遍——这一条 (a) 已验，
    # 这里是给人看的汇总，不重复计入失败（避免同一问题报两次）。
    $themeLinkEntries = @($plan | Where-Object { $_.Kind -eq 'theme-link' })
    if ($themeLinkEntries.Count -gt 0) {
        Write-Log ''
        Write-Log '  (c2) 独立文档主题 <link> 复核（browser-viewer.html / viewer-window.html，工单 36-B）'
        Write-Log '       期望：id="themeSheet" 已消失，且写死的 assets/warm-paper-*.css 引用已回来'

        $themeSheetNeedle = 'id="themeSheet"'
        $warmPaperNeedle = 'assets/warm-paper-'
        $warmPaperPattern = '<link\b[^>]*\brel="stylesheet"[^>]*href="\./assets/warm-paper-[^"]*\.css"[^>]*>'
        # apply 贴入的主题 href 前缀**从 skin.json 现读**（不写死主题名）：
        # skin.json 的 themes[].cssPath 就是 "themes/<主题>.css"。读不到时退化为只跑
        # 前三条判据（并打印说明），不猜、也不静默通过。
        $themeCssPaths = @()
        if ($null -ne $skin) {
            foreach ($t in @(Get-Prop $skin 'themes')) {
                $cp = [string](Get-Prop $t 'cssPath')
                if (-not [string]::IsNullOrWhiteSpace($cp)) { $themeCssPaths += ('href="' + $cp) }
            }
        }
        if ($themeCssPaths.Count -eq 0) {
            Write-Log '       （skin.json 未记录 themes[].cssPath，无法核对"apply 贴入的主题 link 是否残留"——'
            Write-Log '         这是显式降级，不是静默通过；其余三条判据照常执行）'
        }

        foreach ($row in $themeLinkEntries) {
            $key = "$($row.Tree)/$($row.RelPath)"
            if (-not (Test-Path -LiteralPath $row.TargetPath -PathType Leaf)) {
                $failures.Add("$key：还原后文件不存在")
                Write-Log "      [失败] $key：文件不存在"
                continue
            }
            $bytes = [System.IO.File]::ReadAllBytes($row.TargetPath)
            $text = $script:Utf8NoBom.GetString($bytes)

            $idHits = Get-OccurrenceCount -Text $text -Needle $themeSheetNeedle
            $warmHits = Get-OccurrenceCount -Text $text -Needle $warmPaperNeedle
            $warmTagHits = [regex]::Matches($text, $warmPaperPattern).Count
            $themeHrefHits = 0
            foreach ($needle in $themeCssPaths) { $themeHrefHits += Get-OccurrenceCount -Text $text -Needle $needle }
            $shaNow = Get-FileSha256 $row.TargetPath
            $shaOk = ($null -ne $shaNow -and $shaNow -ceq $row.Sha256Before)

            $leaks = [System.Collections.Generic.List[string]]::new()
            if ($idHits -ne 0) { $leaks.Add("id=`"themeSheet`" 残留 $idHits 处（期望 0）") }
            if ($warmTagHits -lt 1) { $leaks.Add("整段 warm-paper <link> 未回来（期望 >=1，实际 $warmTagHits）") }
            if ($warmHits -lt 1) { $leaks.Add("裸串 'assets/warm-paper-' 未回来（期望 >=1，实际 $warmHits）") }
            if ($themeHrefHits -ne 0) { $leaks.Add("apply 贴入的主题 link 仍残留 $themeHrefHits 处（期望 0）") }

            if ($leaks.Count -gt 0) {
                $msg = "$key：还原后主题 link 复核不符 —— $($leaks -join '；')"
                $failures.Add($msg)
                Write-Log "      [失败] $msg"
            }
            else {
                $shaNote = if ($shaOk) { 'sha256 与 manifest.sha256Before 一致' } else { "注意：sha256 不一致（实际 $shaNow，期望 $($row.Sha256Before)），已由 (a) 计为失败" }
                Write-Log "      [一致] $key：id=`"themeSheet`" 0 处；整段 warm-paper <link> $warmTagHits 处；$shaNote"
            }
        }
    }

    # ------------------------------------------------------------------
    # 7. 结果报告
    # ------------------------------------------------------------------
    Write-Head '[7] 还原结果'

    Write-Log "  备份目录：$BackupDir"
    Write-Log "  renderer：$RendererDir"
    Write-Log "  server  ：$ServerDir"
    Write-Log ''
    Write-Log ("  {0,-10} {1,-6} {2,-46} {3}" -f '结果', '树', '相对路径', 'sha256')
    foreach ($row in $plan) {
        $label = switch ($row.Status) {
            'restored' { '已还原' }
            'deleted' { '已删除' }
            'already-pristine' { '无需改动' }
            'failed' { '失败' }
            default { $row.Status }
        }
        $sha = if ($row.Existed) { [string]$row.TargetSha256 } else { '(应不存在)' }
        Write-Log ("  {0,-10} {1,-6} {2,-46} {3}" -f $label, $row.Tree, $row.RelPath, $sha)
    }

    $nFail = $failures.Count
    Write-Log ''
    if ($nFail -eq 0) {
        Write-Log "  全部 $($plan.Count) 项还原并校验通过：每个文件的 sha256 均与 manifest.sha256Before 一致。"
        Write-Log '  提示：需重启 Hana 使还原生效（renderer 与 server bundle 都是启动时加载）。'
        Write-Log "  备份目录与 skin.json 均保留（未删除），可继续用于审计。"
        exit 0
    }

    Write-Log "  失败 $nFail 项 —— 未静默跳过，逐条列出："
    foreach ($f in $failures) { Write-Log "    - $f" }
    Write-Log ''
    Write-Log '  还原未完整完成。请检查备份完整性 / 目标目录权限后重跑；'
    Write-Log '  若备份文件本身缺失，本次备份无法完整还原，需要从别处取得原文件。'
    exit 1
}
catch {
    Write-Log ''
    Write-Log ('!' * 72)
    Write-Log '失败：已中止'
    Write-Log ('!' * 72)
    Write-Log "原因：$($_.Exception.Message)"
    Write-Log ''
    Write-Log "备份目录：$(if ($null -ne $BackupDir) { $BackupDir } else { '(尚未确定)' })"
    if ($isDryRun) {
        Write-Log '本次是 DRY-RUN，未写入任何文件。'
    }
    else {
        Write-Log '注意：本次为 -Apply，可能已部分写入。已完成的项见上方输出；重跑本脚本是幂等的。'
    }
    exit 1
}