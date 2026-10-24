# Local operator prompt. Never send these fields to chat or write them to a config file.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'backup-prompt-input.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$backupProjectRoot = Split-Path -Parent $PSScriptRoot
$backupPrivateRoot = Join-Path $backupProjectRoot 'supabase/.temp/secure-backups'
New-Item -ItemType Directory -Force -Path $backupPrivateRoot | Out-Null
$backupSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $backupPrivateRoot /inheritance:r /grant:r "*${backupSid}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'BACKUP_FOLDER_ACL_FAILED' }
$backupNodePath = (Get-Command node.exe -ErrorAction Stop).Source
$backupTlsOutput = & $backupNodePath (Join-Path $PSScriptRoot 'database-backup.mjs') --check-tls
if ($LASTEXITCODE -ne 0) {
    [IO.File]::WriteAllText((Join-Path $backupPrivateRoot 'last-result.json'),($backupTlsOutput -join "`n"))
    [void][Windows.Forms.MessageBox]::Show('Secure connection check failed before requesting credentials. Return to the chat. No production changes were made.','BUD backup needs attention')
    exit 1
}
$backupForm = [Windows.Forms.Form]::new()
$backupForm.Text = 'BUD - Secure database backup'
$backupForm.Size = [Drawing.Size]::new(620,440)
$backupForm.StartPosition = 'CenterScreen'
$backupForm.TopMost = $true
$backupForm.ShowInTaskbar = $true
$backupForm.FormBorderStyle = 'FixedDialog'
$backupForm.MaximizeBox = $false
$backupForm.Font = [Drawing.Font]::new('Segoe UI',11)
$backupIntro = [Windows.Forms.Label]::new()
$backupIntro.Text = "Local encrypted backup of BU'D only. No billing or production changes.`r`nKeep the backup passphrase in your password manager; it cannot be recovered."
$backupIntro.SetBounds(20,18,570,65)
$backupForm.Controls.Add($backupIntro)
$backupFields = @()
$backupInputState = @{ Payload=$null }
foreach ($backupItem in @(@('Existing Supabase DATABASE password',95),@('New backup passphrase (16+ characters)',165),@('Confirm backup passphrase',235))) {
    $backupLabel = [Windows.Forms.Label]::new(); $backupLabel.Text = $backupItem[0]; $backupLabel.SetBounds(20,$backupItem[1],560,25)
    $backupField = [Windows.Forms.TextBox]::new(); $backupField.UseSystemPasswordChar = $true; $backupField.SetBounds(20,($backupItem[1]+27),560,30)
    $backupForm.Controls.Add($backupLabel); $backupForm.Controls.Add($backupField); $backupFields += $backupField
}
$backupButton = [Windows.Forms.Button]::new(); $backupButton.Text = 'Create encrypted backup'; $backupButton.SetBounds(290,320,290,40)
$backupCancel = [Windows.Forms.Button]::new(); $backupCancel.Text = 'Cancel'; $backupCancel.SetBounds(20,320,120,40)
$backupCancel.DialogResult = 'Cancel'; $backupForm.CancelButton = $backupCancel
$backupButton.Add_Click({
    if ([string]::IsNullOrWhiteSpace($backupFields[0].Text) -or $backupFields[1].Text.Length -lt 16 -or $backupFields[1].Text -cne $backupFields[2].Text) {
        [void][Windows.Forms.MessageBox]::Show('Enter the existing database password and matching backup passphrases of at least 16 characters.'); return
    }
    Save-BudBackupPromptInput $backupForm $backupFields $backupInputState
})
$backupForm.Controls.Add($backupButton); $backupForm.Controls.Add($backupCancel)
$backupForm.Add_Shown({ $backupForm.Activate(); [IO.File]::WriteAllText((Join-Path $backupPrivateRoot 'prompt-status.json'),'{"status":"WAITING_FOR_LOCAL_INPUT"}') })
if ($backupForm.ShowDialog() -ne 'OK') { exit 0 }
try {
    $backupNodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $backupProcessInfo = [Diagnostics.ProcessStartInfo]::new()
    $backupProcessInfo.FileName = $backupNodePath
    $backupProcessInfo.Arguments = '"' + (Join-Path $PSScriptRoot 'database-backup.mjs') + '" --run'
    $backupProcessInfo.UseShellExecute = $false; $backupProcessInfo.CreateNoWindow = $true
    $backupProcessInfo.RedirectStandardInput = $true; $backupProcessInfo.RedirectStandardOutput = $true; $backupProcessInfo.RedirectStandardError = $true
    $backupProcess = [Diagnostics.Process]::Start($backupProcessInfo)
    Send-BudBackupPromptInput $backupProcess $backupInputState.Payload
    $backupInputState.Payload.Clear()
    foreach ($backupField in $backupFields) { $backupField.Clear() }
    $backupOutput = $backupProcess.StandardOutput.ReadToEnd(); $backupErrors = $backupProcess.StandardError.ReadToEnd()
    $backupProcess.WaitForExit()
    $backupResult = $backupOutput | ConvertFrom-Json
    [IO.File]::WriteAllText((Join-Path $backupPrivateRoot 'last-result.json'),($backupResult | ConvertTo-Json -Depth 5))
    if ($backupProcess.ExitCode -eq 0) {
        [void][Windows.Forms.MessageBox]::Show("Encrypted backup and local account/application restore passed.`r`nKeep your passphrase safe. Return to the chat to continue.",'BUD backup completed')
    } else {
        [void][Windows.Forms.MessageBox]::Show(('Backup was not verified. No production changes were made. Return to the chat with this code: ' + $backupResult.status),'BUD backup needs attention')
    }
} catch {
    [IO.File]::WriteAllText((Join-Path $backupPrivateRoot 'last-result.json'),'{"status":"LOCAL_PROMPT_FAILED","verified":false}')
    [void][Windows.Forms.MessageBox]::Show('The local backup could not complete. Return to the chat. No production changes were made.')
} finally {
    if ($backupInputState.Payload) { $backupInputState.Payload.Clear() }
    foreach ($backupField in $backupFields) { $backupField.Clear() }
    $backupForm.Dispose()
}
