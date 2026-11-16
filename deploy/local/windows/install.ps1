# GVS ERP Local Edition - installer AND updater (Windows PowerShell 5.1).
#
# Run via Install.bat from the release package:
#   <package>\Install.bat  ->  <package>\app\windows\install.ps1
#
# Fresh PC : checks the PC, enables WSL2, installs Docker Desktop, copies the
#            app to C:\GvsERP, creates per-install secrets, loads the images,
#            starts everything and adds the "GVS ERP" desktop icon.
# Existing : (C:\GvsERP\.env exists) UPDATE - backup first, new files and
#            images, start, and roll back automatically if the new version
#            does not come up.
#
# The PC may need to restart once (WSL / Docker Desktop); setup continues
# automatically after signing in again.

param(
    [string]$InstallDir = 'C:\GvsERP',
    [switch]$Resume
)

$ErrorActionPreference = 'Stop'
$PackageAppDir = Split-Path -Parent $PSScriptRoot          # <package>\app
$PackageDir = Split-Path -Parent $PackageAppDir             # <package>
$Version = (Get-Content (Join-Path $PackageAppDir 'VERSION') -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $Version) { $Version = 'dev' }
$Version = $Version.Trim()

# ---- elevate ----
$isAdmin = (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-InstallDir', "`"$InstallDir`"")
    if ($Resume) { $a += '-Resume' }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $a | Out-Null
    exit 0
}

New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'logs') | Out-Null
$logFile = Join-Path $InstallDir ("logs\install-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Start-Transcript -Path $logFile -Append | Out-Null

function Write-Step([string]$m) { Write-Host ''; Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host "    $m" -ForegroundColor Green }
function Write-Warn([string]$m) { Write-Host "    $m" -ForegroundColor Yellow }
function Fail([string]$m) {
    Write-Host ''
    Write-Host "SETUP STOPPED: $m" -ForegroundColor Red
    Write-Host "Log file: $logFile"
    Stop-Transcript | Out-Null
    Read-Host 'Press Enter to close'
    exit 1
}

# Continue this setup automatically after the next sign-in.
function Register-Resume {
    $cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -InstallDir `"$InstallDir`" -Resume"
    New-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'GvsErpSetup' -Value $cmd -PropertyType String -Force | Out-Null
}

function Request-Restart([string]$why) {
    Register-Resume
    Write-Host ''
    Write-Host $why -ForegroundColor Yellow
    Write-Host 'Setup will continue automatically after you sign in again.' -ForegroundColor Yellow
    Stop-Transcript | Out-Null
    $answer = Read-Host 'Restart the PC now? (Y/N)'
    if ($answer -match '^[Yy]') { Restart-Computer -Force }
    exit 0
}

Write-Host "GVS ERP Local Edition - setup (version $Version)" -ForegroundColor White
$isUpdate = Test-Path (Join-Path $InstallDir '.env')
if ($isUpdate) { Write-Host 'Existing installation found: this will UPDATE it. Your data is backed up first.' }

# ---------------------------------------------------------------- 1. checks
Write-Step 'Checking this PC'
if (-not [Environment]::Is64BitOperatingSystem) { Fail 'A 64-bit Windows is required.' }
$build = [int](Get-CimInstance Win32_OperatingSystem).BuildNumber
if ($build -lt 19045) { Fail "Windows 10 22H2 (build 19045) or Windows 11 is required. This PC has build $build. Run Windows Update first." }
$ramGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
if ($ramGb -lt 6) { Fail "At least 8 GB of RAM is required (this PC has $ramGb GB)." }
if ($ramGb -lt 8) { Write-Warn "This PC has $ramGb GB of RAM; 8 GB or more is recommended." }
$drive = (Get-Item $InstallDir).PSDrive
$freeGb = [math]::Round($drive.Free / 1GB, 1)
if ($freeGb -lt 15) { Fail "At least 15 GB of free disk space is needed on $($drive.Name): (free: $freeGb GB)." }
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if (-not $cs.HypervisorPresent -and -not $cpu.VirtualizationFirmwareEnabled) {
    Fail 'Virtualization is turned off in this PC''s BIOS/UEFI. Turn on "Intel VT-x" / "AMD-V" (SVM) in the BIOS settings, then run setup again.'
}
Write-Ok "Windows build $build, $ramGb GB RAM, $freeGb GB free"

# ---------------------------------------------------------------- 2. WSL2
Write-Step 'Checking WSL2 (Windows Subsystem for Linux)'
& wsl.exe --status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host '    Installing WSL2...'
    & wsl.exe --install --no-distribution
    if ($LASTEXITCODE -ne 0) { Fail 'Could not install WSL2. Run Windows Update, then run setup again.' }
    Request-Restart 'WSL2 was installed. Windows needs to restart.'
}
& wsl.exe --update *> $null
Write-Ok 'WSL2 is ready'

# ---------------------------------------------------------------- 3. Docker Desktop
$dockerExe = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
Write-Step 'Checking Docker Desktop'
if (-not (Test-Path $dockerExe)) {
    $installer = Join-Path $PackageDir 'installers\Docker Desktop Installer.exe'
    if (-not (Test-Path $installer)) {
        $installer = Join-Path $env:TEMP 'DockerDesktopInstaller.exe'
        Write-Host '    Downloading Docker Desktop (about 500 MB)...'
        try {
            Invoke-WebRequest -UseBasicParsing -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile $installer
        } catch {
            Fail 'Could not download Docker Desktop. Check the internet connection, or put "Docker Desktop Installer.exe" in the package''s installers folder.'
        }
    }
    Write-Host '    Installing Docker Desktop (several minutes)...'
    $p = Start-Process -FilePath $installer -ArgumentList 'install', '--quiet', '--accept-license', '--backend=wsl-2' -Wait -PassThru
    if ($p.ExitCode -ne 0) { Fail "Docker Desktop installation failed (code $($p.ExitCode))." }
    try { Add-LocalGroupMember -Group 'docker-users' -Member "$env:USERDOMAIN\$env:USERNAME" -ErrorAction Stop } catch { }
    Request-Restart 'Docker Desktop was installed. Windows needs to restart.'
}
Write-Ok 'Docker Desktop is installed'

# Start with Windows, don't open the dashboard window, cap WSL memory.
foreach ($f in @('settings-store.json', 'settings.json')) {
    $path = Join-Path $env:APPDATA "Docker\$f"
    if (Test-Path $path) {
        try {
            $json = Get-Content $path -Raw | ConvertFrom-Json
            foreach ($k in @('AutoStart', 'autoStart')) { if ($json.PSObject.Properties.Name -contains $k) { $json.$k = $true } }
            if (-not ($json.PSObject.Properties.Name -contains 'AutoStart') -and $f -eq 'settings-store.json') { $json | Add-Member -NotePropertyName 'AutoStart' -NotePropertyValue $true }
            if ($json.PSObject.Properties.Name -contains 'OpenUIOnStartupDisabled') { $json.OpenUIOnStartupDisabled = $true } elseif ($f -eq 'settings-store.json') { $json | Add-Member -NotePropertyName 'OpenUIOnStartupDisabled' -NotePropertyValue $true }
            $json | ConvertTo-Json -Depth 20 | Set-Content -Path $path -Encoding UTF8
        } catch { Write-Warn "Could not update $f ($_)" }
    }
}
$wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
if (-not (Test-Path $wslConfig)) {
    $mem = [math]::Max(2, [math]::Min(4, [math]::Floor($ramGb / 2)))
    Set-Content -Path $wslConfig -Value "[wsl2]`r`nmemory=${mem}GB`r`n" -Encoding ASCII
}

# Startup shortcut too, in case Docker's own auto-start setting is missing.
$startup = [Environment]::GetFolderPath('Startup')
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut((Join-Path $startup 'Docker Desktop.lnk'))
$sc.TargetPath = $dockerExe
$sc.Save()

# From here on the app's own helpers are used.
. (Join-Path $PSScriptRoot 'common.ps1')
$Script:AppDir = $InstallDir
$Script:ComposeFile = Join-Path $InstallDir 'docker-compose.yml'
$Script:EnvFile = Join-Path $InstallDir '.env'

Write-Step 'Starting Docker'
try { Start-DockerDesktop -TimeoutSeconds 420 } catch { Fail $_.Exception.Message }
Write-Ok "Docker $(& docker version --format '{{.Server.Version}}')"

# ---------------------------------------------------------------- 4. pre-update backup
$previousVersion = $null
$previousFiles = Join-Path $InstallDir 'previous'
if ($isUpdate) {
    $previousVersion = Get-EnvValue 'GVS_VERSION'
    Write-Step "Backing up your data before updating ($previousVersion -> $Version)"
    try {
        Invoke-Compose up -d db backup
        Start-Sleep -Seconds 5
        Invoke-BackupNow 'pre-update'
    } catch { Fail "The backup before updating failed, so nothing was changed. ($_)" }
    $preUpdateBackup = (Get-Backups | Where-Object { $_ -like '*-pre-update' } | Select-Object -First 1)
    Write-Ok "Backup: $preUpdateBackup"
    if (Test-Path $previousFiles) { Remove-Item -Recurse -Force $previousFiles }
    New-Item -ItemType Directory -Path $previousFiles | Out-Null
    foreach ($item in @('docker-compose.yml', 'backup', 'db', 'gateway', 'scripts', 'windows', 'GvsERP.bat', 'VERSION')) {
        $src = Join-Path $InstallDir $item
        if (Test-Path $src) { Copy-Item -Recurse -Force $src $previousFiles }
    }
}

# ---------------------------------------------------------------- 5. files
Write-Step "Copying the application to $InstallDir"
foreach ($item in Get-ChildItem -Path $PackageAppDir) {
    Copy-Item -Recurse -Force -Path $item.FullName -Destination $InstallDir
}
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir 'backups') | Out-Null
Write-Ok 'Files copied'

# ---------------------------------------------------------------- 6. images
Write-Step 'Loading the application images'
$imagesDir = Join-Path $PackageDir 'images'
if (Test-Path $imagesDir) {
    foreach ($tar in Get-ChildItem -Path $imagesDir -Filter '*.tar') {
        Write-Host "    $($tar.Name)"
        & docker load -i $tar.FullName | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "Could not load $($tar.Name)." }
    }
}

# ---------------------------------------------------------------- 7. settings (.env)
if (-not $isUpdate) {
    Write-Step 'Creating this installation''s private settings'
    $apiImage = "ghcr.io/hossamsharif/gvs-api:$Version"
    $reg = Get-EnvValue 'GVS_REGISTRY'
    if ($reg) { $apiImage = "$reg/gvs-api:$Version" }
    # generate-env.mjs needs Node: run it with the Node inside the API image.
    & docker run --rm --user root -v "${InstallDir}:/w" --entrypoint node $apiImage /w/scripts/generate-env.mjs
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Script:EnvFile)) { Fail 'Could not create the settings file.' }
    $guid = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid).MachineGuid
    Set-EnvValue 'GVS_MACHINE_ID' $guid
    Write-Ok 'Settings created'
}
Set-EnvValue 'GVS_VERSION' $Version

# ---------------------------------------------------------------- 8. start
Write-Step 'Starting GVS ERP (first start downloads about 1.5 GB if the images are not in the package)'
$started = $true
try {
    Invoke-Compose up -d --remove-orphans
} catch { $started = $false }
if ($started) { $started = Wait-AppHealthy -TimeoutSeconds 300 }

if (-not $started) {
    if (-not $isUpdate) { Fail 'GVS ERP did not start. Run "Collect logs" from the GVS ERP Tools shortcut and send the file to support.' }

    Write-Host ''
    Write-Host 'The new version did not start. Rolling back to the previous version...' -ForegroundColor Yellow
    foreach ($item in Get-ChildItem -Path $previousFiles) { Copy-Item -Recurse -Force -Path $item.FullName -Destination $InstallDir }
    Set-EnvValue 'GVS_VERSION' $previousVersion
    try {
        Invoke-Compose up -d --remove-orphans
        if ($preUpdateBackup) { Invoke-Restore $preUpdateBackup }
    } catch { Write-Warn "Rollback step failed: $_" }
    if (Wait-AppHealthy -TimeoutSeconds 300) {
        Fail "The update failed and version $previousVersion was restored with your data from before the update."
    }
    Fail 'The update failed and the rollback did not finish. Do not use the PC for sales; contact support.'
}
Write-Ok 'GVS ERP is running'

# ---------------------------------------------------------------- 9. shortcuts
Write-Step 'Creating shortcuts'
$icon = Join-Path $InstallDir 'windows\gvs-erp.ico'
$targets = @(
    @{ Name = 'GVS ERP'; Target = (Join-Path $InstallDir 'GvsERP.bat'); Args = '' },
    @{ Name = 'GVS ERP Tools'; Target = 'powershell.exe'; Args = "-NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\windows\tools.ps1`"" }
)
$folders = @([Environment]::GetFolderPath('CommonDesktopDirectory'), (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'GVS ERP'))
New-Item -ItemType Directory -Force -Path $folders[1] | Out-Null
foreach ($folder in $folders) {
    foreach ($t in $targets) {
        $s = $ws.CreateShortcut((Join-Path $folder "$($t.Name).lnk"))
        $s.TargetPath = $t.Target
        $s.Arguments = $t.Args
        $s.WorkingDirectory = $InstallDir
        $s.IconLocation = $icon
        $s.WindowStyle = 7  # minimized
        if ($t.Name -eq 'GVS ERP Tools') { $s.WindowStyle = 1 }
        $s.Save()
    }
}
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'GvsErpSetup' -ErrorAction SilentlyContinue
Write-Ok 'Desktop icons: "GVS ERP" and "GVS ERP Tools"'

Write-Host ''
if ($isUpdate) {
    Write-Host "GVS ERP was updated to version $Version." -ForegroundColor Green
} else {
    Write-Host 'GVS ERP is installed. The setup page opens now: create your company and the owner account.' -ForegroundColor Green
    Write-Host 'Daily use: double-click "GVS ERP" on the desktop.'
}
Open-App
Stop-Transcript | Out-Null
Read-Host 'Press Enter to close'
