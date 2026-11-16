# GVS ERP - daily launcher (the "GVS ERP" desktop icon runs this via GvsERP.bat).
# Starts Docker Desktop and the app if they aren't running, waits until the
# app answers, then opens it in an app window.

. (Join-Path $PSScriptRoot 'common.ps1')

try {
    if (-not (Test-AppHealthy)) {
        Write-Host 'Starting GVS ERP, please wait...'
        Start-DockerDesktop -TimeoutSeconds 300
        Invoke-Compose up -d
        if (-not (Wait-AppHealthy -TimeoutSeconds 240)) {
            Stop-WithError 'GVS ERP did not start. Restart the PC; if it happens again, use "GVS ERP Tools" > "Collect logs".'
        }
    }
    Open-App
} catch {
    Add-Type -AssemblyName PresentationFramework
    [void][Windows.MessageBox]::Show("GVS ERP could not start.`n`n$($_.Exception.Message)", 'GVS ERP', 'OK', 'Error')
    exit 1
}
