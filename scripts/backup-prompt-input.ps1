# Pure local form lifecycle helper. No processes, files or network access.
function Save-BudBackupPromptInput {
    param($Form, $Fields, $State)
    # Closing a modal form can dispose its text controls. Capture before it closes.
    $State.Payload = @{ password=$Fields[0].Text; passphrase=$Fields[1].Text }
    $Form.DialogResult = 'OK'
    $Form.Close()
}
