#Requires -Version 5.1
<#
.SYNOPSIS
  Apply DEVELOPMENT-ONLY RuStore demo SQLite to Expo's real DB path.

.DESCRIPTION
  Expo SQLite stores the DB at files/SQLite/my_home.db (NOT databases/).
  Prefers run-as (debuggable builds). Falls back to adb root when available.
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

# Expo SQLite path — never write to databases/my_home.db
$sqliteRelDir = 'files/SQLite'
$dbFileName = 'my_home.db'
$absoluteDbDir = "/data/data/$Package/$sqliteRelDir"
$absoluteDbPath = "$absoluteDbDir/$dbFileName"

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

function Test-RemoteFile {
  param([Parameter(Mandatory = $true)][string]$RemotePath)
  $out = & adb @serialArgs shell "ls -l $RemotePath" 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { return $false }
  if ($out -match 'No such file') { return $false }
  return $true
}

Invoke-AdbShell "am force-stop $Package"

$tmpHost = Join-Path $env:TEMP 'my_home_demo.db'
Copy-Item $DbSource $tmpHost -Force
$tmpDevice = '/data/local/tmp/my_home_demo.db'
Invoke-Adb push $tmpHost $tmpDevice | Out-Null

$applied = $false

try {
  # Relative paths inside run-as cwd (= app data root).
  Invoke-AdbShell "run-as $Package mkdir -p $sqliteRelDir"
  Invoke-AdbShell "run-as $Package cp $tmpDevice $sqliteRelDir/$dbFileName"
  Invoke-AdbShell "run-as $Package sh -c 'rm -f $sqliteRelDir/$dbFileName-wal $sqliteRelDir/$dbFileName-shm'"
  if (-not (Test-RemoteFile "$absoluteDbPath")) {
    # run-as ls may need package-relative check:
    $check = & adb @serialArgs shell "run-as $Package ls -l $sqliteRelDir/$dbFileName" 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $check -match 'No such file') {
      throw "Target missing after run-as copy: $sqliteRelDir/$dbFileName"
    }
  }
  $applied = $true
  Write-Host "Applied demo DB via run-as -> $sqliteRelDir/$dbFileName"
} catch {
  Write-Host "run-as failed: $($_.Exception.Message)"
}

if (-not $applied) {
  try {
    & adb @serialArgs root | Out-Null
    Start-Sleep -Seconds 2
    Invoke-AdbShell "mkdir -p $absoluteDbDir"
    Invoke-AdbShell "cp $tmpDevice $absoluteDbPath"
    Invoke-AdbShell "rm -f $absoluteDbPath-wal $absoluteDbPath-shm"
    Invoke-AdbShell "chmod 666 $absoluteDbPath"
    if (-not (Test-RemoteFile $absoluteDbPath)) {
      throw "Target missing after root copy: $absoluteDbPath"
    }
    $applied = $true
    Write-Host "Applied demo DB via adb root -> $absoluteDbPath"
  } catch {
    Write-Host "root fallback failed: $($_.Exception.Message)"
  }
}

try { Invoke-AdbShell "rm -f $tmpDevice" } catch { }

# Clean stale wrong-path copy if present from older scripts.
try {
  Invoke-AdbShell "run-as $Package rm -f databases/my_home.db databases/my_home.db-wal databases/my_home.db-shm"
} catch { }

if (-not $applied) {
  throw 'Could not write demo DB. Use a debuggable APK or a rooted emulator image.'
}

Invoke-AdbShell "monkey -p $Package -c android.intent.category.LAUNCHER 1"
Write-Host "Demo DB applied to $Package ($sqliteRelDir/$dbFileName)"
