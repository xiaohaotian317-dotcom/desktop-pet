param(
  [string]$InputDirectory = (Join-Path $PSScriptRoot '..\src\renderer\assets\outfits'),
  [string]$OutputFile = (Join-Path $PSScriptRoot '..\release\大款十套穿搭预览.png')
)

Add-Type -AssemblyName System.Drawing
$ids = @('gentleman-red','christmas','sailor','spring-hanfu','gardener','chef','detective','little-wealth-god','blue-white-porcelain','dunhuang')
$cell = 180
$labelHeight = 32
$sheet = [System.Drawing.Bitmap]::new($cell * 5, ($cell + $labelHeight) * 2, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  try {
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 249, 245, 235))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $font = [System.Drawing.Font]::new('Microsoft YaHei UI', 10, [System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 75, 65, 53))
    try {
      for ($i = 0; $i -lt $ids.Count; $i++) {
        $bitmap = [System.Drawing.Bitmap]::FromFile((Join-Path $InputDirectory ($ids[$i] + '.png')))
        try {
          $column = $i % 5; $row = [Math]::Floor($i / 5)
          $x = $column * $cell; $y = $row * ($cell + $labelHeight)
          $src = [System.Drawing.Rectangle]::new(0, 0, [int][Math]::Floor($bitmap.Width / 4), [int][Math]::Floor($bitmap.Height / 8))
          $dest = [System.Drawing.Rectangle]::new($x, $y, $cell, $cell)
          $graphics.DrawImage($bitmap, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
          $graphics.DrawString($ids[$i], $font, $brush, [single]($x + 5), [single]($y + $cell + 7))
        } finally { $bitmap.Dispose() }
      }
    } finally { $font.Dispose(); $brush.Dispose() }
  } finally { $graphics.Dispose() }
  New-Item -ItemType Directory -Force -Path (Split-Path $OutputFile) | Out-Null
  $sheet.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $sheet.Dispose() }
