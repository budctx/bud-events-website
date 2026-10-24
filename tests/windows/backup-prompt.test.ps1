# Standalone fixture-only regression test. Does not load or invoke the real backup runner.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
. (Join-Path $PSScriptRoot '../../scripts/backup-prompt-input.ps1')
$fixtureForm = [Windows.Forms.Form]::new()
$fixtureForm.ShowInTaskbar = $false
$fixtureState = @{ Payload=$null }
$fixtureFields = @([Windows.Forms.TextBox]::new(),[Windows.Forms.TextBox]::new())
$fixturePassword = 'fixture-only-database-password' + [char]0x0628 + [char]0x00E9
$fixturePassphrase = 'fixture-only-encryption-passphrase' + [char]0x0639
$fixtureFields[0].Text = $fixturePassword
$fixtureFields[1].Text = $fixturePassphrase
foreach ($fixtureField in $fixtureFields) { $fixtureForm.Controls.Add($fixtureField) }
$fixtureForm.Add_Shown({ Save-BudBackupPromptInput $fixtureForm $fixtureFields $fixtureState })
$fixtureDialogResult = $fixtureForm.ShowDialog()
# Force disposal before serialization, matching the reported failure boundary.
$fixtureForm.Dispose()
$fixtureRoundtrip = ($fixtureState.Payload | ConvertTo-Json -Compress) | ConvertFrom-Json
if ($fixtureDialogResult -ne 'OK' -or $fixtureRoundtrip.password -cne $fixturePassword -or $fixtureRoundtrip.passphrase -cne $fixturePassphrase) {
    throw 'PROMPT_INPUT_SELF_TEST_FAILED'
}
# Only launches a fixture consumer: no backup module, credentials or network.
$fixtureInfo = [Diagnostics.ProcessStartInfo]::new()
$fixtureInfo.FileName = (Get-Command node.exe -ErrorAction Stop).Source
$fixtureInfo.Arguments = '"' + (Join-Path $PSScriptRoot 'backup-input-fixture.mjs') + '"'
$fixtureInfo.UseShellExecute = $false
$fixtureInfo.CreateNoWindow = $true
$fixtureInfo.RedirectStandardInput = $true
$fixtureInfo.RedirectStandardOutput = $true
$fixtureInfo.RedirectStandardError = $true
$fixtureProcess = [Diagnostics.Process]::Start($fixtureInfo)
Send-BudBackupPromptInput $fixtureProcess $fixtureState.Payload
$fixtureOutput = $fixtureProcess.StandardOutput.ReadToEnd()
$fixtureProcess.WaitForExit()
if ($fixtureProcess.ExitCode -ne 0 -or $fixtureOutput.Trim() -cne 'FIXTURE_UTF8_INPUT_PASSED') {
    throw 'PROMPT_PIPE_SELF_TEST_FAILED'
}
$fixtureProcess.Dispose()
$fixtureState.Payload.Clear()
Write-Output 'PROMPT_INPUT_SELF_TEST_PASSED'
