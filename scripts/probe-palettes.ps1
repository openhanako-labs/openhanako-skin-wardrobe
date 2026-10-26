# 探针：palettes 字段在宿主两侧 bundle 里的实现情况
$ErrorActionPreference = 'Stop'
$targets = @(
  @{ n = 'server';  p = (Get-ChildItem (Join-Path $env:USERPROFILE '.hanako\artifacts\server')   -Directory | Sort-Object Name | Select-Object -Last 1).FullName + '\bundle\index.js' },
  @{ n = 'renderer'; p = (Get-ChildItem (Join-Path $env:USERPROFILE '.hanako\artifacts\renderer') -Directory | Sort-Object Name | Select-Object -Last 1).FullName + '\dist-renderer' }
)

function Count-Hits([string]$text, [string]$needle) {
  $i = 0; $c = 0
  while (($i = $text.IndexOf($needle, $i)) -ge 0) { $c++; $i += $needle.Length }
  return $c
}

foreach ($t in $targets) {
  if ($t.n -eq 'server') {
    $raw = [System.IO.File]::ReadAllText($t.p)
    "server bundle ($($raw.Length) bytes)"
    foreach ($k in @('palettes', 'cssUrl', 'getSnapshot', 'app/themes', 'custom-theme')) {
      "  {0,-14} {1}" -f $k, (Count-Hits $raw $k)
    }
  } else {
    $files = Get-ChildItem $t.p -Recurse -Include *.js -ErrorAction SilentlyContinue
    "renderer dir ($($files.Count) js files)"
    $agg = @{}
    foreach ($k in @('palettes', 'cssUrl', 'themes.custom')) { $agg[$k] = 0 }
    foreach ($f in $files) {
      $tx = [System.IO.File]::ReadAllText($f.FullName)
      foreach ($k in @('palettes', 'cssUrl', 'themes.custom')) { $agg[$k] += (Count-Hits $tx $k) }
    }
    foreach ($k in $agg.Keys) { "  {0,-14} {1}" -f $k, $agg[$k] }
  }
}
