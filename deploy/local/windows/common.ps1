# GVS ERP Local Edition - shared helpers for the Windows scripts.
# Windows PowerShell 5.1 compatible. Dot-source it:  . "$PSScriptRoot\common.ps1"

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Installed layout: C:\GvsERP\docker-compose.yml, C:\GvsERP\windows\*.ps1
$Script:AppDir = Split-Path -Parent $PSScriptRoot
$Script:ComposeFile = Join-Path $Script:AppDir 'docker-compose.yml'
$Script:EnvFile = Join-Path $Script:AppDir '.env'
$Script:DockerDesktopExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'

function Write-Step([string]$Message) {
    Write-Host ''
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) { Write-Host "    $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "    $Message" -ForegroundColor Yellow }

function Stop-WithError([string]$Message) {
    Write-Host ''
    Write-Host "ERROR: $Message" -ForegroundColor Red
    Write-Host 'Send the file created by "Collect logs" to support if you need help.'
    throw $Message
}

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Re-launch the calling script elevated (UAC prompt) and exit this copy.
function Invoke-SelfElevate([string]$ScriptPath, [string[]]$Arguments = @()) {
    if (Test-IsAdmin) { return }
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$ScriptPath`"") + $Arguments
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $argList | Out-Null
    exit 0
}

# ---------- .env ----------

function Get-EnvValue([string]$Name) {
    if (-not (Test-Path $Script:EnvFile)) { return $null }
    foreach ($line in Get-Content -Path $Script:EnvFile) {
        if ($line -match "^\s*$([regex]::Escape($Name))=(.*)$") { return $Matches[1].Trim() }
    }
    return $null
}

function Set-EnvValue([string]$Name, [string]$Value) {
    $lines = @()
    if (Test-Path $Script:EnvFile) { $lines = @(Get-Content -Path $Script:EnvFile) }
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match "^\s*$([regex]::Escape($Name))=") { $found = $true; "$Name=$Value" } else { $line }
    }
    if (-not $found) { $out = @($out) + "$Name=$Value" }
    # UTF-8 without BOM, LF line endings (read by docker compose).
    $text = (($out | ForEach-Object { $_ }) -join "`n") + "`n"
    [IO.File]::WriteAllText($Script:EnvFile, $text, (New-Object Text.UTF8Encoding($false)))
}

function Get-AppPort {
    $p = Get-EnvValue 'GVS_PORT'
    if ($p) { return $p } else { return '8080' }
}

function Get-AppUrl { return "http://localhost:$(Get-AppPort)" }

# Health probes use 127.0.0.1: the port is published on 127.0.0.1 only, and
# "localhost" may resolve to IPv6 (::1) first on some PCs. Users still open
# Get-AppUrl (http://localhost:...), which is the app's origin.
function Get-HealthUrl { return "http://127.0.0.1:$(Get-AppPort)/api/health" }

# ---------- Docker ----------

function Test-DockerReady {
    $null = & docker info --format '{{.ServerVersion}}' 2>$null
    return ($LASTEXITCODE -eq 0)
}

# Start Docker Desktop as the signed-in user (not elevated) and wait for it.
function Start-DockerDesktop([int]$TimeoutSeconds = 300) {
    if (Test-DockerReady) { return }
    if (-not (Test-Path $Script:DockerDesktopExe)) { Stop-WithError 'Docker Desktop is not installed. Run Install.bat again.' }
    Write-Host '    Starting Docker Desktop (this can take a minute)...'
    # explorer.exe starts the program un-elevated even from an elevated script.
    Start-Process -FilePath 'explorer.exe' -ArgumentList "`"$Script:DockerDesktopExe`"" | Out-Null
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        if (Test-DockerReady) { return }
    }
    Stop-WithError "Docker Desktop did not start within $TimeoutSeconds seconds. Restart the PC and try again."
}

# docker compose for the installed app (project name comes from the compose file).
# Deliberately a plain function using $args: an advanced function (param block)
# would treat "-d" as the common parameter -Debug and silently drop it, which
# makes "up -d" run attached and never return.
function Invoke-Compose {
    & docker compose --project-directory $Script:AppDir -f $Script:ComposeFile @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') failed (exit $LASTEXITCODE)" }
}

function Test-AppHealthy {
    try {
        $r = Invoke-WebRequest -Uri (Get-HealthUrl) -UseBasicParsing -TimeoutSec 5
        return ($r.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Wait-AppHealthy([int]$TimeoutSeconds = 180) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-AppHealthy) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

# Open the app in an app-style window (Edge, no address bar), else the default browser.
function Open-App([string]$Path = '') {
    $url = "$(Get-AppUrl)$Path"
    $edge = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
    ) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
    if ($edge) {
        Start-Process -FilePath $edge -ArgumentList "--app=$url" | Out-Null
    } else {
        Start-Process $url | Out-Null
    }
}

# ---------- Backups ----------

function Get-BackupDir { return (Join-Path $Script:AppDir 'backups') }

# Backup set names, newest first (e.g. gvs-20261116-053451, gvs-...-pre-update).
function Get-Backups {
    $dir = Get-BackupDir
    if (-not (Test-Path $dir)) { return @() }
    return @(Get-ChildItem -Path $dir -Filter 'gvs-*.dump' | Sort-Object Name -Descending | ForEach-Object { $_.BaseName })
}

function Invoke-BackupNow([string]$Label = 'manual') {
    Invoke-Compose exec -T backup /bin/sh /opt/gvs/backup.sh now $Label
}

# Stop the app, restore a backup set, start again.
function Invoke-Restore([string]$Name) {
    Invoke-Compose stop api web auth rest storage gateway
    try {
        Invoke-Compose run --rm -T backup restore $Name
    } finally {
        Invoke-Compose up -d
    }
}
