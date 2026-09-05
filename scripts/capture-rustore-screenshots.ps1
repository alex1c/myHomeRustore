#Requires -Version 5.1
<#
.SYNOPSIS
  Capture / normalize / validate RuStore screenshots for «Мой дом».

.PARAMETER Serial
  Optional adb serial. When omitted, uses the default device.

.PARAMETER SkipCapture
  Only validate / convert existing raw PNGs in release-assets/screenshots/raw.

.PARAMETER Interactive
  Pause between screens so you can navigate manually (recommended).
#>
param(
  [string]$Serial = '',
  [switch]$SkipCapture,
  [switch]$Interactive = $true,
  [string]$Package = 'com.calculatorplatform.myhome'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'release-assets\screenshots'
$rawDir = Join-Path $outDir 'raw'
New-Item -ItemType Directory -Force -Path $outDir, $rawDir | Out-Null

$shots = @(
  @{ File = '01-today.png'; Purpose = 'Smart Today attention + summary' },
  @{ File = '02-inventory.png'; Purpose = 'Inventory list with items/locations' },
  @{ File = '03-item-detail.png'; Purpose = 'Робот-пылесос Dreame L20 Ultra detail' },
  @{ File = '04-documents.png'; Purpose = 'Documents archive + add CTA' },
  @{ File = '05-maintenance.png'; Purpose = 'ТО list overdue/upcoming + add CTA' },
  @{ File = '06-consumables.png'; Purpose = 'Consumables stock + add CTA' },
  @{ File = '07-backup-export.png'; Purpose = 'Backup / restore / export entry points' }
)

$adbArgs = @()
if ($Serial) { $adbArgs = @('-s', $Serial) }

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Cmd)
  & adb @adbArgs @Cmd
  if ($LASTEXITCODE -ne 0) { throw "adb failed: $($Cmd -join ' ')" }
}

if (-not $SkipCapture) {
  Write-Host "Checking package $Package ..."
  $pkg = Invoke-Adb shell pm path $Package
  if (-not ($pkg -match $Package)) {
    throw "Package $Package is not installed on this device"
  }

  foreach ($shot in $shots) {
    Write-Host ""
    Write-Host "=== Prepare UI for $($shot.File) ==="
    Write-Host $shot.Purpose
    if ($Interactive) {
      Read-Host 'Navigate to the screen (no keyboard / dialogs), then press Enter'
    }
    $rawPath = Join-Path $rawDir $shot.File
    $remote = '/sdcard/myhome-screenshot.png'
    Invoke-Adb shell screencap -p $remote
    Invoke-Adb pull $remote $rawPath | Out-Null
    Invoke-Adb shell rm $remote
    Write-Host "Saved raw: $rawPath"
  }
}

Write-Host ''
Write-Host 'Normalizing to 1080x1920 and validating...'
Push-Location $root
try {
  node .\scripts\normalize-rustore-screenshots.mjs
} finally {
  Pop-Location
}
