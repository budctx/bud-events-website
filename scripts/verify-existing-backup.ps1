# Offline-only operator prompt. Never requests the database password or exports again.
param([Parameter(Mandatory=$true)][string]$BackupName)
$ErrorActionPreference = 'Stop'
if ($BackupName -cnotmatch '^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z$') { throw 'BACKUP_SELECTION_INVALID' }
. (Join-Path $PSScriptRoot 'backup-prompt-input.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$recoveryPrivateRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'supabase/.temp/secure-backups'
if (-not (Test-Path -LiteralPath (Join-Path $recoveryPrivateRoot $BackupName) -PathType Container)) { throw 'BACKUP_SELECTION_NOT_FOUND' }
$recoveryForm = [Windows.Forms.Form]::new()
$recoveryForm.Text = 'BUD - Verify existing encrypted backup'
$recoveryForm.Size = [Drawing.Size]::new(620,290)
$recoveryForm.StartPosition = 'CenterScreen'; $recoveryForm.TopMost = $true; $recoveryForm.ShowInTaskbar = $true
$recoveryForm.FormBorderStyle = 'FixedDialog'; $recoveryForm.MaximizeBox = $false
$recoveryForm.Font = [Drawing.Font]::new('Segoe UI',11)
$recoveryLabel = [Windows.Forms.Label]::new()
$recoveryLabel.Text = "Verify the existing encrypted copy locally. No Supabase connection.`r`nEnter the BACKUP passphrase you chose earlier. Not the database password."
$recoveryLabel.SetBounds(20,15,570,70); $recoveryForm.Controls.Add($recoveryLabel)
$recoveryField = [Windows.Forms.TextBox]::new(); $recoveryField.UseSystemPasswordChar = $true
$recoveryField.SetBounds(20,95,560,30); $recoveryForm.Controls.Add($recoveryField)
$recoveryState = @{ Payload=$null }
$recoveryButton = [Windows.Forms.Button]::new(); $recoveryButton.Text = 'Verify existing copy'; $recoveryButton.SetBounds(310,160,270,40)
$recoveryCancel = [Windows.Forms.Button]::new(); $recoveryCancel.Text = 'Cancel'; $recoveryCancel.SetBounds(20,160,120,40)
$recoveryCancel.DialogResult = 'Cancel'; $recoveryForm.CancelButton = $recoveryCancel
$recoveryButton.Add_Click({
    if ($recoveryField.Text.Length -lt 16) { [void][Windows.Forms.MessageBox]::Show('Enter the existing backup passphrase of 16 or more characters.'); return }
    $recoveryState.Payload = @{ passphrase=$recoveryField.Text }
    $recoveryForm.DialogResult = 'OK'; $recoveryForm.Close()
})
$recoveryForm.Controls.Add($recoveryButton); $recoveryForm.Controls.Add($recoveryCancel)
$recoveryForm.Add_Shown({ $recoveryForm.Activate() })
if ($recoveryForm.ShowDialog() -ne 'OK') { $recoveryForm.Dispose(); exit 0 }
try {
    $recoveryProcessInfo = [Diagnostics.ProcessStartInfo]::new()
    $recoveryProcessInfo.FileName = (Get-Command node.exe -ErrorAction Stop).Source
    $recoveryProcessInfo.Arguments = '"' + (Join-Path $PSScriptRoot 'database-backup.mjs') + '" --verify-existing ' + $BackupName
    $recoveryProcessInfo.UseShellExecute=$false; $recoveryProcessInfo.CreateNoWindow=$true
    $recoveryProcessInfo.RedirectStandardInput=$true; $recoveryProcessInfo.RedirectStandardOutput=$true; $recoveryProcessInfo.RedirectStandardError=$true
    $recoveryProcess = [Diagnostics.Process]::Start($recoveryProcessInfo)
    Send-BudBackupPromptInput $recoveryProcess $recoveryState.Payload
    $recoveryState.Payload.Clear(); $recoveryField.Clear()
    $recoveryOutput=$recoveryProcess.StandardOutput.ReadToEnd(); $recoveryErrors=$recoveryProcess.StandardError.ReadToEnd()
    $recoveryProcess.WaitForExit(); $recoveryResult=$recoveryOutput | ConvertFrom-Json
    [IO.File]::WriteAllText((Join-Path $recoveryPrivateRoot 'offline-last-result.json'),($recoveryResult | ConvertTo-Json -Depth 5))
    if ($recoveryProcess.ExitCode -eq 0 -and $recoveryResult.verified -eq $true) {
        [void][Windows.Forms.MessageBox]::Show('The existing encrypted copy passed local account/application restore verification. No production changes were made. Return to the chat.','BUD offline verification passed')
    } else {
        [void][Windows.Forms.MessageBox]::Show(('Verification did not pass. No production changes were made. Return to the chat with this code: ' + $recoveryResult.status),'BUD verification needs review')
    }
} catch {
    [IO.File]::WriteAllText((Join-Path $recoveryPrivateRoot 'offline-last-result.json'),'{"status":"LOCAL_OFFLINE_PROMPT_FAILED","verified":false}')
    [void][Windows.Forms.MessageBox]::Show('Local verification could not complete. No production changes were made. Return to the chat.','BUD verification needs review')
} finally {
    if ($recoveryState.Payload) { $recoveryState.Payload.Clear() }
    $recoveryField.Clear(); $recoveryForm.Dispose()
}
