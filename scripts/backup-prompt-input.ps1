# Local input helpers. Never start a process, read files or access the network.
function Save-BudBackupPromptInput {
    param($Form, $Fields, $State)
    # Closing a modal form can dispose its text controls. Capture before it closes.
    $State.Payload = @{ password=$Fields[0].Text; passphrase=$Fields[1].Text }
    $Form.DialogResult = 'OK'
    $Form.Close()
}

function Send-BudBackupPromptInput {
    param($Process, $Payload)
    $inputBytes = $null
    try {
        # .NET Framework (Windows PowerShell 5.1) lacks StandardInputEncoding.
        # Write BOM-free UTF-8 directly, independent of the console code page.
        $inputBytes = [Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Compress))
        $Process.StandardInput.BaseStream.Write($inputBytes, 0, $inputBytes.Length)
        $Process.StandardInput.BaseStream.Flush()
    } finally {
        if ($null -ne $inputBytes) { [Array]::Clear($inputBytes, 0, $inputBytes.Length) }
        $Process.StandardInput.Close()
    }
}
