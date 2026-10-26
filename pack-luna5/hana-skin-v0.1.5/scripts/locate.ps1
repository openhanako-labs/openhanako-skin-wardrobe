<#
.SYNOPSIS
    从 Hana 的 desktop-target.json 定位 renderer 与 server 两个版本目录，并校验必需路径就位。

.DESCRIPTION
    渲染器 / 服务端目录名带构建哈希与随机后缀（形如 1.0.6-beta-win32-x64-<sha16>-g<rand>），
    跨构建即变，因此**禁止硬编码**。本脚本每次都从 desktop-target.json 的
    current.renderer.versionDir 与 current.server.versionDir 现读，是后续 apply.ps1 /
    restore.ps1 的公共底座。

    只读操作：不写入、不修改 Hana 安装目录中的任何文件。

    校验项：
      renderer 树：themes/ 目录、lib/theme.js 文件、assets/ 目录、locales/ 目录
      server   树：bundle/index.js 文件、desktop/dist-renderer/themes/ 目录

    任一必需项缺失、JSON 无法解析、字段缺失或 versionDir 不是绝对路径/目录不存在，
    均以非零退出码报错退出，绝不静默继续。

.PARAMETER TargetJson
    desktop-target.json 的路径。默认取 $env:HANA_HOME\artifacts\desktop-target.json，
    HANA_HOME 未设时退到 %USERPROFILE%\.hanako\artifacts\desktop-target.json。

.PARAMETER AsJson
    以 JSON 文本输出结果（stdout 只含 JSON，便于其他脚本或测试断言）。
    默认输出 PSCustomObject，便于 PowerShell 侧直接取属性。

.OUTPUTS
    PSCustomObject（或 -AsJson 时的 JSON 文本），字段：
        rendererVersionDir  —— 与 desktop-target.json 的 current.renderer.versionDir 逐字符一致
        serverVersionDir    —— 与 current.server.versionDir 逐字符一致
        rendererVersion     —— current.renderer.version（仅作参考，定位不依赖它）
        serverVersion       —— current.server.version（仅作参考，定位不依赖它）
        targetJson          —— 实际使用的 desktop-target.json 绝对路径

.NOTES
    调用方式：用 `& .\locate.ps1` 或 `$t = & .\locate.ps1`（子作用域）调用。
    不要用 `. .\locate.ps1` 点源——脚本在失败路径上 exit 非零码，点源会终止调用方会话。

.EXAMPLE
    $t = & .\scripts\locate.ps1
    $t.rendererVersionDir

.EXAMPLE
    & .\scripts\locate.ps1 -TargetJson C:\tmp\not-here.json   # 预期：非零退出码 + 报错
#>
[CmdletBinding()]
param(
    [string]$TargetJson = $(if ($env:HANA_HOME) { Join-Path $env:HANA_HOME 'artifacts\desktop-target.json' } else { Join-Path $env:USERPROFILE '.hanako\artifacts\desktop-target.json' }),
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# 失败即报错并以非零码退出，绝不静默继续。
function Stop-Fail {
    param([Parameter(Mandatory)][string]$Message)
    [Console]::Error.WriteLine("locate.ps1: ERROR: $Message")
    exit 1
}

# 安全读属性：字段不存在或值为 $null 都返回 $null（StrictMode 下不抛异常）。
function Get-ChildValue {
    param(
        $Object,
        [Parameter(Mandatory)][string]$Name
    )
    if ($null -eq $Object) { return $null }
    $prop = $Object.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

# ---------- 1. 读取 desktop-target.json ----------
$jsonPath = $TargetJson
if ([string]::IsNullOrWhiteSpace($jsonPath)) {
    Stop-Fail "-TargetJson 为空：请提供 desktop-target.json 的路径"
}

if (-not (Test-Path -LiteralPath $jsonPath -PathType Leaf)) {
    Stop-Fail "找不到 desktop-target.json：'$jsonPath'（文件缺失或不是文件）"
}

$raw = $null
try {
    $raw = Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8
}
catch {
    Stop-Fail "读取 desktop-target.json 失败：'$jsonPath' —— $($_.Exception.Message)"
}

if ([string]::IsNullOrWhiteSpace($raw)) {
    Stop-Fail "desktop-target.json 为空文件：'$jsonPath'"
}

$json = $null
try {
    $json = $raw | ConvertFrom-Json
}
catch {
    Stop-Fail "desktop-target.json JSON 解析失败：'$jsonPath' —— $($_.Exception.Message)"
}

# ---------- 2. 必需字段校验 ----------
$current = Get-ChildValue $json 'current'
if ($null -eq $current) {
    Stop-Fail "desktop-target.json 缺少必需字段 'current'：'$jsonPath'"
}

$versionDirs = @{}
foreach ($kind in @('renderer', 'server')) {
    $label = "current.$kind"

    $node = Get-ChildValue $current $kind
    if ($null -eq $node) {
        Stop-Fail "desktop-target.json 缺少必需字段 '$label'：'$jsonPath'"
    }

    if ($null -eq $node.PSObject.Properties['versionDir']) {
        Stop-Fail "desktop-target.json 缺少必需字段 '$label.versionDir'：'$jsonPath'"
    }

    $vd = [string](Get-ChildValue $node 'versionDir')
    if ([string]::IsNullOrWhiteSpace($vd)) {
        Stop-Fail "字段 '$label.versionDir' 为空：'$jsonPath'"
    }
    if (-not [System.IO.Path]::IsPathRooted($vd)) {
        Stop-Fail "字段 '$label.versionDir' 不是绝对路径（实际值：'$vd'）：'$jsonPath'"
    }
    if (-not (Test-Path -LiteralPath $vd -PathType Container)) {
        Stop-Fail "'$label.versionDir' 指向的目录不存在：'$vd'"
    }

    $versionDirs[$kind] = $vd
}

$rendererDir = $versionDirs['renderer']
$serverDir = $versionDirs['server']

# ---------- 3. 关键路径校验 ----------
# 逐棵树列出必需项；缺失项一次性全部报出，便于排查。
$required = @(
    [pscustomobject]@{ Tree = 'renderer'; Rel = 'themes';                   Type = 'Container'; Display = 'themes/ 目录' }
    [pscustomobject]@{ Tree = 'renderer'; Rel = 'lib/theme.js';             Type = 'Leaf';      Display = 'lib/theme.js 文件' }
    [pscustomobject]@{ Tree = 'renderer'; Rel = 'assets';                   Type = 'Container'; Display = 'assets/ 目录' }
    [pscustomobject]@{ Tree = 'renderer'; Rel = 'locales';                  Type = 'Container'; Display = 'locales/ 目录' }
    [pscustomobject]@{ Tree = 'server';   Rel = 'bundle/index.js';          Type = 'Leaf';      Display = 'bundle/index.js 文件' }
    [pscustomobject]@{ Tree = 'server';   Rel = 'desktop/dist-renderer/themes'; Type = 'Container'; Display = 'desktop/dist-renderer/themes/ 目录' }
)

$missing = @()
foreach ($item in $required) {
    $base = if ($item.Tree -eq 'renderer') { $rendererDir } else { $serverDir }
    $full = Join-Path $base ($item.Rel -replace '/', '\')
    if (-not (Test-Path -LiteralPath $full -PathType $item.Type)) {
        $missing += "$($item.Tree) 树缺少 $($item.Display)（期望路径：'$full'）"
    }
}

if ($missing.Count -gt 0) {
    $detail = ($missing | ForEach-Object { "  - $_" }) -join [Environment]::NewLine
    Stop-Fail ("版本目录关键路径校验失败，共 $($missing.Count) 项缺失：$([Environment]::NewLine)$detail")
}

# ---------- 4. 结构化输出 ----------
# version 字段仅作参考输出；定位逻辑不依赖它，因此缺失时输出空串而非报错。
$rendererVersion = [string](Get-ChildValue (Get-ChildValue $current 'renderer') 'version')
$serverVersion = [string](Get-ChildValue (Get-ChildValue $current 'server') 'version')

$result = [pscustomobject][ordered]@{
    rendererVersionDir = $rendererDir
    serverVersionDir   = $serverDir
    rendererVersion    = $rendererVersion
    serverVersion      = $serverVersion
    targetJson         = (Resolve-Path -LiteralPath $jsonPath).Path
}

if ($AsJson) {
    # stdout 只输出 JSON，便于外部捕获/断言
    $result | ConvertTo-Json -Depth 4
}
else {
    Write-Host "renderer versionDir = $rendererDir"
    Write-Host "server   versionDir = $serverDir"
    Write-Host "desktop-target.json = $($result.targetJson)"
    Write-Host "校验通过：renderer（themes/、lib/theme.js、assets/、locales/）+ server（bundle/index.js、desktop/dist-renderer/themes/）"
    $result
}
