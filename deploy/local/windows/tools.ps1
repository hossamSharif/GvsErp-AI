# GVS ERP Tools - maintenance menu (desktop icon "GVS ERP Tools").

. (Join-Path $PSScriptRoot 'common.ps1')

function Show-Status {
    Write-Step 'Status'
    if (-not (Test-DockerReady)) { Write-Warn 'Docker Desktop is not running.'; return }
    Invoke-Compose ps --all --format 'table {{.Service}}\t{{.Status}}'
    if (Test-AppHealthy) { Write-Ok "App: running at $(Get-AppUrl)" } else { Write-Warn 'App: NOT responding' }
    Write-Host "    Version: $(Get-EnvValue 'GVS_VERSION')"
    $b = Get-Backups
    if ($b.Count -gt 0) { Write-Host "    Backups: $($b.Count), newest: $($b[0])" } else { Write-Warn 'Backups: none yet' }
    Write-Host "    Backup folder: $(Get-BackupDir)"
}

function Backup-Now {
    Write-Step 'Backing up now'
    Start-DockerDesktop
    Invoke-BackupNow 'manual'
    Write-Ok "Saved in $(Get-BackupDir). Copy this folder to a USB drive or cloud folder regularly."
}

function Restore-Backup {
    $list = Get-Backups
    if ($list.Count -eq 0) { Write-Warn "No backups found in $(Get-BackupDir)."; return }
    Write-Step 'Restore a backup'
    Write-Warn 'Restoring replaces ALL current data with the backup. A safety backup of the current data is made first.'
    $shown = [math]::Min($list.Count, 20)
    for ($i = 0; $i -lt $shown; $i++) { Write-Host ("    {0,2}. {1}" -f ($i + 1), $list[$i]) }
    $pick = Read-Host 'Number of the backup to restore (Enter to cancel)'
    if (-not $pick) { return }
    $n = 0
    if (-not [int]::TryParse($pick, [ref]$n) -or $n -lt 1 -or $n -gt $shown) { Write-Warn 'Invalid number.'; return }
    $name = $list[$n - 1]
    $confirm = Read-Host "Type YES to restore $name"
    if ($confirm -ne 'YES') { Write-Host '    Cancelled.'; return }
    Start-DockerDesktop
    Invoke-Restore $name
    if (Wait-AppHealthy -TimeoutSeconds 240) { Write-Ok "Restored $name. Everyone must sign in again." } else { Write-Warn 'The app did not come back. Use "Collect logs" and contact support.' }
}

function Save-Logs {
    Write-Step 'Collecting logs for support'
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $work = Join-Path $env:TEMP "gvs-logs-$stamp"
    New-Item -ItemType Directory -Force -Path $work | Out-Null
    try {
        & docker version > (Join-Path $work 'docker-version.txt') 2>&1
        & docker compose --project-directory $Script:AppDir -f $Script:ComposeFile ps --all > (Join-Path $work 'services.txt') 2>&1
        & docker compose --project-directory $Script:AppDir -f $Script:ComposeFile logs --no-color --timestamps --tail 3000 > (Join-Path $work 'logs.txt') 2>&1
    } catch { }
    # Setting NAMES only - never the secret values.
    if (Test-Path $Script:EnvFile) {
        Get-Content $Script:EnvFile | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object { ($_ -split '=')[0] } | Set-Content (Join-Path $work 'settings-names.txt')
    }
    "Version: $(Get-EnvValue 'GVS_VERSION')`r`nWindows: $((Get-CimInstance Win32_OperatingSystem).Caption) $((Get-CimInstance Win32_OperatingSystem).BuildNumber)`r`nBackups: $((Get-Backups) -join ', ')" | Set-Content (Join-Path $work 'summary.txt')
    $logs = Join-Path $Script:AppDir 'logs'
    if (Test-Path $logs) { Copy-Item -Recurse $logs (Join-Path $work 'install-logs') }
    $zip = Join-Path ([Environment]::GetFolderPath('Desktop')) "gvs-logs-$stamp.zip"
    Compress-Archive -Path (Join-Path $work '*') -DestinationPath $zip -Force
    Remove-Item -Recurse -Force $work
    Write-Ok "Saved to your desktop: $zip"
}

function Reset-Password {
    Write-Step 'Set a new password for a user (when nobody can sign in as admin)'
    $email = Read-Host 'User email'
    if (-not $email) { return }
    $secure = Read-Host 'New password (at least 8 characters)' -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    Start-DockerDesktop
    $script = Get-Content -Raw (Join-Path $Script:AppDir 'scripts\reset-password.mjs')
    $script | & docker compose --project-directory $Script:AppDir -f $Script:ComposeFile exec -T api node --input-type=module - $email $plain
    if ($LASTEXITCODE -eq 0) { Write-Ok 'Done. The user can sign in with the new password.' } else { Write-Warn 'The password was not changed.' }
}

function Stop-App {
    Write-Step 'Stopping GVS ERP'
    Invoke-Compose stop
    Write-Ok 'Stopped. Double-click "GVS ERP" to start it again.'
}

while ($true) {
    Write-Host ''
    Write-Host '========== GVS ERP Tools ==========' -ForegroundColor White
    Write-Host '  1. Status'
    Write-Host '  2. Back up now'
    Write-Host '  3. Restore a backup'
    Write-Host '  4. Open the backups folder'
    Write-Host '  5. Collect logs for support'
    Write-Host '  6. Set a new password for a user'
    Write-Host '  7. Stop GVS ERP'
    Write-Host '  0. Exit'
    $choice = Read-Host 'Choose'
    try {
        switch ($choice) {
            '1' { Show-Status }
            '2' { Backup-Now }
            '3' { Restore-Backup }
            '4' { New-Item -ItemType Directory -Force -Path (Get-BackupDir) | Out-Null; Start-Process explorer.exe (Get-BackupDir) }
            '5' { Save-Logs }
            '6' { Reset-Password }
            '7' { Stop-App }
            '0' { exit 0 }
            default { }
        }
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}
