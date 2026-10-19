Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $PSScriptRoot '..\src\renderer\assets\motion'
$outputRoot = Join-Path $sourceRoot 'normalized'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null

$names = @(
  'zhima-core', 'zhima-actions', 'zhima-care',
  'mantou-core', 'mantou-actions', 'mantou-care', 'mantou-states', 'mantou-can', 'mantou-stretch'
)
$cellSize = 256
$edgeInset = 4
$contentLimit = 224

function Get-FrameBoundaries([System.Drawing.Bitmap]$bitmap, [bool]$horizontal) {
  $length = if ($horizontal) { $bitmap.Width } else { $bitmap.Height }
  $crossLength = if ($horizontal) { $bitmap.Height } else { $bitmap.Width }
  $boundaries = [System.Collections.Generic.List[int]]::new()
  $boundaries.Add(0)
  for ($index = 1; $index -lt 4; $index++) {
    $expected = [int][Math]::Round($index * $length / 4)
    $radius = [int][Math]::Round($length * 0.08)
    $best = $expected; $bestScore = [int]::MaxValue
    for ($offset = -$radius; $offset -le $radius; $offset++) {
      $position = $expected + $offset
      $score = 0
      for ($cross = 0; $cross -lt $crossLength; $cross++) {
        $pixel = if ($horizontal) { $bitmap.GetPixel($position, $cross) } else { $bitmap.GetPixel($cross, $position) }
        if ($pixel.A -gt 8) { $score++ }
      }
      if ($score -lt $bestScore) { $best = $position; $bestScore = $score }
    }
    $minimum = $boundaries[$boundaries.Count - 1] + [int]($length * 0.12)
    if ($best -lt $minimum) { $best = $minimum }
    $boundaries.Add($best)
  }
  $boundaries.Add($length)
  return ,$boundaries.ToArray()
}

foreach ($name in $names) {
  $sourcePath = Join-Path $sourceRoot "$name.png"
  $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
  $sheet = [System.Drawing.Bitmap]::new($cellSize * 4, $cellSize * 4, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $xBounds = Get-FrameBoundaries $source $true
  $yBounds = Get-FrameBoundaries $source $false

  for ($row = 0; $row -lt 4; $row++) {
    for ($col = 0; $col -lt 4; $col++) {
      $left = $xBounds[$col]; $right = $xBounds[$col + 1]
      $top = $yBounds[$row]; $bottom = $yBounds[$row + 1]
      $cell = [System.Drawing.Rectangle]::new($left + $edgeInset, $top + $edgeInset, ($right - $left) - 2 * $edgeInset, ($bottom - $top) - 2 * $edgeInset)

      $minX = $cell.Width; $minY = $cell.Height; $maxX = -1; $maxY = -1
      for ($y = 0; $y -lt $cell.Height; $y++) {
        for ($x = 0; $x -lt $cell.Width; $x++) {
          if ($source.GetPixel($cell.X + $x, $cell.Y + $y).A -gt 8) {
            if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
          }
        }
      }
      if ($maxX -lt $minX -or $maxY -lt $minY) { continue }

      $crop = [System.Drawing.Rectangle]::new($cell.X + $minX, $cell.Y + $minY, $maxX - $minX + 1, $maxY - $minY + 1)
      $scale = [Math]::Min($contentLimit / $crop.Width, $contentLimit / $crop.Height)
      $drawWidth = [int][Math]::Round($crop.Width * $scale)
      $drawHeight = [int][Math]::Round($crop.Height * $scale)
      $destX = $col * $cellSize + [int][Math]::Round(($cellSize - $drawWidth) / 2)
      $destY = ($row + 1) * $cellSize - 18 - $drawHeight
      $destination = [System.Drawing.Rectangle]::new($destX, $destY, $drawWidth, $drawHeight)
      $graphics.DrawImage($source, $destination, $crop, [System.Drawing.GraphicsUnit]::Pixel)
    }
  }

  $destinationPath = Join-Path $outputRoot "$name.png"
  $sheet.Save($destinationPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $sheet.Dispose(); $source.Dispose()
  Write-Output "$name -> $destinationPath"
}

