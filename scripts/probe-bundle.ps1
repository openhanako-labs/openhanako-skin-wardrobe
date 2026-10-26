# 一次性探针：在宿主服务端 bundle 里查 palettes 的真实实现（压缩文件，不能整行输出）
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:USERPROFILE '.hanako\artifacts\server'
$dir = Get-ChildItem $root -Directory | Sort-Object Name | Select-Object -Last 1
$file = Join-Path $dir.FullName 'bundle\index.js'
$raw = [System.IO.File]::ReadAllText($file)
"bundle: $file"
"bytes: $($raw.Length)"
"--- occurrences of palettes ---"
$i = 0; $n = 0
while (($i = $raw.IndexOf('palettes', $i)) -ge 0) {
  $n++
  if ($n -le 12) {
    $s = [Math]::Max(0, $i - 190); $len = [Math]::Min(380, $raw.Length - $s)
    "[$n] " + ($raw.Substring($s, $len) -replace '\s+', ' ')
  }
  $i += 8
}
"total palettes hits: $n"
"--- occurrences of custom-preview ---"
$i = 0; $m = 0
while (($i = $raw.IndexOf('custom-preview', $i)) -ge 0) {
  $m++
  if ($m -le 5) { $s = [Math]::Max(0, $i - 150); "[$m] " + (($raw.Substring($s, 300)) -replace '\s+', ' ') }
  $i += 14
}
"total custom-preview hits: $m"
