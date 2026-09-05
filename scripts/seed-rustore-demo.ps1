#Requires -Version 5.1
<#
.SYNOPSIS
  Apply DEVELOPMENT-ONLY RuStore demo SQLite to a specific emulator serial.

.DESCRIPTION
  Prefers run-as (debuggable builds). Falls back to adb root when available.
  Does not touch other adb devices. Never used by production UX.
#>
param(
  [Parameter(Mandatory = $false)]
  [string]$Serial = '',

  [Parameter(Mandatory = $false)]
  [string]$Package = 'com.calculatorplatform.myhome',

  [Parameter(Mandatory = $false)]
  [string]$DbSource = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $DbSource) {
  $DbSource = Join-Path $root 'release-assets\demo\my_home_demo.db'
}

if (-not (Test-Path $DbSource)) {
  Write-Host 'Demo DB missing. Generating via Jest...'
  Push-Location $root
  try {
    npm run seed:demo
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $DbSource)) {
  throw "Demo DB not found: $DbSource"
}

$serialArgs = @()
if ($Serial) {
  $serialArgs = @('-s', $Serial)
  Write-Host "Using adb serial: $Serial"
} else {
  Write-Host 'No -Serial provided; using default adb device'
}

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & adb @serialArgs @Args
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed: adb $($serialArgs -join ' ') $($Args -join ' ')"
  }
}

function Invoke-AdbShell {
  param([Parameter(Mandatory = $true)][string]$Command)
  # Keep the remote command as ONE argv so flags like -p survive.
  & adb @serialArgs shell $Command
  if ($LASTEXITCODE -ne 0) {
    throw "adb shell failed: $Command"
  }
}

Invoke-AdbShell "am force-stop $Package"

$tmpHost = Join-Path $env:TEMP 'my_home_demo.db'
Copy-Item $DbSource $tmpHost -Force
$tmpDevice = '/data/local/tmp/my_home_demo.db'
Invoke-Adb push $tmpHost $tmpDevice | Out-Null

$applied = $false

try {
  Invoke-AdbShell "run-as $Package mkdir -p databases"
  Invoke-AdbShell "run-as $Package cp $tmpDevice databases/my_home.db"
  Invoke-AdbShell "run-as $Package sh -c 'rm -f databases/my_home.db-wal databases/my_home.db-shm'"
  $applied = $true
  Write-Host 'Applied demo DB via run-as'
} catch {
  Write-Host "run-as failed: $($_.Exception.Message)"
}

if (-not $applied) {
  try {
    & adb @serialArgs root | Out-Null
    Start-Sleep -Seconds 2
    $dbDir = "/data/data/$Package/databases"
    Invoke-AdbShell "mkdir -p $dbDir"
    Invoke-AdbShell "cp $tmpDevice $dbDir/my_home.db"
    Invoke-AdbShell "rm -f $dbDir/my_home.db-wal $dbDir/my_home.db-shm"
    Invoke-AdbShell "chmod 666 $dbDir/my_home.db"
    $applied = $true
    Write-Host 'Applied demo DB via adb root'
  } catch {
    Write-Host "root fallback failed: $($_.Exception.Message)"
  }
}

try { Invoke-AdbShell "rm -f $tmpDevice" } catch { }

if (-not $applied) {
  throw 'Could not write demo DB. Use a debuggable APK or a rooted emulator image.'
}

Invoke-AdbShell "monkey -p $Package -c android.intent.category.LAUNCHER 1"
Write-Host "Demo DB applied to $Package"
