#Requires -Version 5.1
<#
.SYNOPSIS
  Capture / normalize / validate RuStore screenshots.

.DESCRIPTION
  Uses a single-string adb shell command so screencap writes a real PNG on device
  (PowerShell must not stream binary PNG through the console).
  ASCII-only prompts for Windows PowerShell 5.1 parser safety.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Serial,

  [switch]$SkipCapture,

  [switch]$Interactive,

  [string]$Package = 'com.calculatorplatform.myhome'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'release-assets\screenshots'
$rawDir = Join-Path $outDir 'raw'
New-Item -ItemType Directory -Force -Path $outDir, $rawDir | Out-Null

if (-not $Serial) {
  throw 'Serial is required. Example: -Serial emulator-5556'
}

$shots = @(
  @{ File = '01-today.png'; Purpose = 'Smart Today attention + summary' },
  @{ File = '02-inventory.png'; Purpose = 'Inventory list with items/locations' },
  @{ File = '03-item-detail.png'; Purpose = 'Robot vacuum item detail' },
  @{ File = '04-documents.png'; Purpose = 'Documents archive + add CTA' },
  @{ File = '05-maintenance.png'; Purpose = 'Maintenance list + add CTA' },
  @{ File = '06-consumables.png'; Purpose = 'Consumables list + add CTA' },
  @{ File = '07-backup-export.png'; Purpose = 'Backup / restore / export entry points' }
)

$serialArgs = @('-s', $Serial)
Write-Host "Using adb serial: $Serial"

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Cmd)
  & adb @serialArgs @Cmd
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed: $($Cmd -join ' ')"
  }
}

function Invoke-AdbShell {
  param([Parameter(Mandatory = $true)][string]$Command)
  # ONE remote argv — critical for screencap -p /path
  & adb @serialArgs shell $Command
  if ($LASTEXITCODE -ne 0) {
    throw "adb shell failed: $Command"
  }
}

if (-not $SkipCapture) {
  Write-Host "Checking package $Package ..."
  $pkg = Invoke-AdbShell "pm path $Package"
  if (-not ($pkg -match [regex]::Escape($Package))) {
    throw "Package $Package is not installed on $Serial"
  }

  foreach ($shot in $shots) {
    Write-Host ''
    Write-Host "=== Prepare UI for $($shot.File) ==="
    Write-Host $shot.Purpose
    if ($Interactive) {
      Read-Host 'Navigate to the screen (no keyboard / dialogs), then press Enter'
    }

    $rawPath = Join-Path $rawDir $shot.File
    $remote = '/sdcard/myhome-screenshot.png'

    # Remove stale remote file, then write PNG on device (not to stdout).
    try { Invoke-AdbShell "rm -f $remote" } catch { }
    Invoke-AdbShell "screencap -p $remote"

    $remoteCheck = & adb @serialArgs shell "ls -l $remote" 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $remoteCheck -match 'No such file') {
      throw "Remote screenshot missing: $remote"
    }

    if (Test-Path $rawPath) {
      Remove-Item -Force $rawPath
    }
    Invoke-Adb pull $remote $rawPath | Out-Null

    if (-not (Test-Path $rawPath)) {
      throw "Host screenshot missing after pull: $rawPath"
    }
    $size = (Get-Item $rawPath).Length
    if ($size -le 0) {
      throw "Host screenshot empty: $rawPath"
    }

    try { Invoke-AdbShell "rm -f $remote" } catch { }
    Write-Host "Saved raw: $rawPath ($size bytes)"
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
