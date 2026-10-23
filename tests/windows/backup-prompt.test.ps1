# Standalone fixture-only regression test. Does not load or invoke the real backup runner.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
. (Join-Path $PSScriptRoot '../../scripts/backup-prompt-input.ps1')
$fixtureForm = [Windows.Forms.Form]::new()
$fixtureForm.ShowInTaskbar = $false
$fixtureState = @{ Payload=$null }
$fixtureFields = @([Windows.Forms.TextBox]::new(),[Windows.Forms.TextBox]::new())
$fixtureFields[0].Text = 'fixture-only-database-password'
$fixtureFields[1].Text = 'fixture-only-encryption-passphrase'
foreach ($fixtureField in $fixtureFields) { $fixtureForm.Controls.Add($fixtureField) }
$fixtureForm.Add_Shown({ Save-BudBackupPromptInput $fixtureForm $fixtureFields $fixtureState })
$fixtureDialogResult = $fixtureForm.ShowDialog()
# Force disposal before serialization, matching the reported failure boundary.
$fixtureForm.Dispose()
$fixtureRoundtrip = ($fixtureState.Payload | ConvertTo-Json -Compress) | ConvertFrom-Json
if ($fixtureDialogResult -ne 'OK' -or $fixtureRoundtrip.password -cne 'fixture-only-database-password' -or $fixtureRoundtrip.passphrase -cne 'fixture-only-encryption-passphrase') {
    throw 'PROMPT_INPUT_SELF_TEST_FAILED'
}
$fixtureState.Payload.Clear()
Write-Output 'PROMPT_INPUT_SELF_TEST_PASSED'
