# 生成 Claude · 陶土主题的背景图：暖象牙纸面 + 陶土微光 + 稀疏颗粒
# 输出：src/background-claude/assets/clay-paper.png（1600x900, 24bpp，与既有主题同规格）
# 纯 System.Drawing，不编译 C#（PS7 的 Add-Type -ReferencedAssemblies 会顶掉默认程序集，坑）。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$out = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src\background-claude\assets\clay-paper.png'))
$dir = Split-Path -Parent $out
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

$w = 1600; $h = 900
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

function New-Glow([single]$cx, [single]$cy, [single]$r, [int]$cr, [int]$cg, [int]$cb, [int]$ca, [int]$layers = 48) {
    # 同心椭圆叠加：从外到内逐层加深，把单层 PathGradientBrush 的硬边磨成光滑的雾
    for ($i = $layers; $i -ge 1; $i--) {
        $t = $i / $layers                      # 1 = 最外层
        $rr = $r * $t
        $a = [int]($ca * [math]::Pow(1.0 - $t, 1.6) / 3.0)
        if ($a -le 0) { continue }
        $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($a, $cr, $cg, $cb))
        $g.FillEllipse($brush, ($cx - $rr), ($cy - $rr), ($rr * 2), ($rr * 2))
        $brush.Dispose()
    }
}

# 1) 基底：自上而下的暖象牙渐变 #FDFCF9 -> #F9F7F0 -> #F2EEE4
$baseRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$lg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($baseRect,
        [System.Drawing.Color]::FromArgb(253, 252, 249),
        [System.Drawing.Color]::FromArgb(242, 238, 228), 90.0)
$cb = New-Object System.Drawing.Drawing2D.ColorBlend(3)
$cb.Colors = @(
    [System.Drawing.Color]::FromArgb(253, 252, 249),
    [System.Drawing.Color]::FromArgb(249, 247, 240),
    [System.Drawing.Color]::FromArgb(242, 238, 228)
)
$cb.Positions = [single[]]@(0.0, 0.55, 1.0)
$lg.InterpolationColors = $cb
$g.FillRectangle($lg, $baseRect)
$lg.Dispose()

# 2) 陶土微光：右上角一团极淡的 Clay 暖光
New-Glow ($w * 0.74) ($h * 0.10) ($w * 1.02) 217 119 87 60
# 3) 左下角更暖的一抹余晖，避免整张纸显平
New-Glow ($w * 0.10) ($h * 0.92) ($w * 0.92) 224 176 130 38
# 4) 左上角纸面的受光高光（极轻，只让左上比右下暧一丝）
New-Glow ($w * 0.16) ($h * 0.06) ($w * 0.70) 255 255 253 46

# 5) 暗角：四周一圈暖灰，把视线收进中间（透明度极低，只是一层空气）
$band = [int]($h * 0.34)
$tint = [System.Drawing.Color]::FromArgb(24, 140, 122, 104)
$clear = [System.Drawing.Color]::FromArgb(0, 140, 122, 104)
$r1 = New-Object System.Drawing.Rectangle(0, 0, $w, ($band + 1))
$v = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r1, $tint, $clear, 90.0)
$g.FillRectangle($v, 0, 0, $w, $band); $v.Dispose()
$r2 = New-Object System.Drawing.Rectangle(0, ($h - $band - 1), $w, ($band + 1))
$v = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r2, $clear, $tint, 90.0)
$g.FillRectangle($v, 0, ($h - $band), $w, $band); $v.Dispose()
$r3 = New-Object System.Drawing.Rectangle(0, 0, ($band + 1), $h)
$v = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r3, $tint, $clear, 0.0)
$g.FillRectangle($v, 0, 0, $band, $h); $v.Dispose()
$r4 = New-Object System.Drawing.Rectangle(($w - $band - 1), 0, ($band + 1), $h)
$v = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r4, $clear, $tint, 0.0)
$g.FillRectangle($v, ($w - $band), 0, $band, $h); $v.Dispose()

# 6) 纸纹颗粒：稀疏的深浅小点（每点 1px、透明度 6~14），只做质感不做噪点
$rnd = New-Object System.Random(20261025)
$darkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(10, 120, 104, 88))
$lightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, 255, 255, 252))
for ($i = 0; $i -lt 26000; $i++) {
    $x = $rnd.Next(0, $w); $y = $rnd.Next(0, $h)
    $b = if ($rnd.Next(0, 2) -eq 0) { $darkBrush } else { $lightBrush }
    $g.FillRectangle($b, $x, $y, 1, 1)
}
$darkBrush.Dispose(); $lightBrush.Dispose()
$g.Dispose()

$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

$f = Get-Item -LiteralPath $out
"written: $($f.FullName)  $([math]::Round($f.Length / 1KB, 1)) KB"