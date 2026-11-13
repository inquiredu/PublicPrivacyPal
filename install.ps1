# Windows PowerShell 5+; no execution-policy or system-setting changes.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue)) {
    Write-Host 'PrivacyPal needs Node 24. Install/select Node 24, then run this installer again.'
    Write-Host 'Instructions: INSTALL.md'
    exit 1
}
$PrivacyPalNodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or "$PrivacyPalNodeVersion" -notmatch '^v24[.]') {
    Write-Host "PrivacyPal needs Node 24; found $PrivacyPalNodeVersion. Select Node 24 and try again."
    exit 1
}
$PrivacyPalNpm = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $PrivacyPalNpm) {
    Write-Host 'PrivacyPal needs npm, supplied with Node 24. Select that installation and try again.'
    exit 1
}
& $PrivacyPalNpm.Source run deploy:wizard -- @args
exit $LASTEXITCODE
