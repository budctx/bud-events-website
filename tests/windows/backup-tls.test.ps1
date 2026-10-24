# Explicit network integration check; sends no password or SQL.
$ErrorActionPreference = 'Stop'
$backupCheckScript = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'scripts/database-backup.mjs'
$backupCheckNode = (Get-Command node.exe -ErrorAction Stop).Source
foreach ($backupCheckIteration in 1..2) {
    $backupCheckOutput = & $backupCheckNode $backupCheckScript --check-tls
    if ($LASTEXITCODE -ne 0) { throw 'TLS_CHECK_PROCESS_FAILED' }
    $backupCheckResult = $backupCheckOutput | ConvertFrom-Json
    if ($backupCheckResult.status -cne 'POSTGRES_TLS_VERIFIED_WITH_OFFICIAL_CA' -or $backupCheckResult.verified -ne $false) {
        throw 'TLS_CHECK_RESULT_FAILED'
    }
}
Write-Output 'WINDOWS_TLS_CHECK_PASSED_NO_CREDENTIALS_SENT'
