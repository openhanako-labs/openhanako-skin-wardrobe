# 探针2：renderer 真实路径 + app SDK 客户端里 palettes 的实现
$ErrorActionPreference = 'Stop'
$srv = (Get-ChildItem (Join-Path $env:USERPROFILE '.hanako\artifacts\server') -Directory |
        Sort-Object Name | Select-Object -Last 1).FullName
$dr = Join-Path $srv 'desktop\dist-renderer'

function Count-Hits([string]$t, [string]$n) { $i=0;$c=0; while (($i=$t.IndexOf($n,$i)) -ge 0){$c++;$i+=$n.Length}; return $c }

"renderer root exists: $(Test-Path $dr)"
$js = Get-ChildItem $dr -Recurse -Include *.js -ErrorAction SilentlyContinue
"js files: $($js.Count)"

$hitP = @(); $hitC = @()
foreach ($f in $js) {
  $t = [System.IO.File]::ReadAllText($f.FullName)
  $p = Count-Hits $t 'palettes'
  if ($p -gt 0) { $hitP += "{0}  palettes={1}" -f $f.FullName.Substring($dr.Length), $p }
  if ((Count-Hits $t 'cssUrl') -gt 0) { $hitC += $f.FullName.Substring($dr.Length) }
}
"--- palettes in renderer ---"
if ($hitP.Count) { $hitP } else { "(none)" }
"--- cssUrl in renderer (files) ---"
if ($hitC.Count) { $hitC | Select-Object -First 12 } else { "(none)" }

"--- 随包 app SDK 客户端 (ui/assets/sdk.js) ---"
$sk = 'W:\Games\Hanako\Work\projects\hana-skin-app\skin-wardrobe\ui\assets\sdk.js'
if (Test-Path $sk) {
  $t = [System.IO.File]::ReadAllText($sk)
  "bytes: $($t.Length)"
  foreach ($k in @('palettes','cssUrl','appearance','themes','custom')) { "  {0,-10} {1}" -f $k, (Count-Hits $t $k) }
}
