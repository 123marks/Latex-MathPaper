# Windows: Authenticode sign the .msi / .exe / .appx produced by `cargo tauri build`.
# Requirements (run once on the build host):
#   - Windows SDK + signtool.exe in PATH (or at C:\Program Files (x86)\Windows Kits\...)
#   - EV code-signing certificate in the Local Computer / Personal store
#   - A hardware token (USB key) or HSM. Self-signed certs are NOT accepted by SmartScreen.
#   - Set the env vars below (or use Azure Trusted Signing).
#
# Usage (PowerShell):
#   $env:PAPER_OS_CSC_NAME = "Paper OS Code Signing"
#   $env:PAPER_OS_TIMESTAMP_URL = "http://timestamp.digicert.com"
#   .\sign-windows.ps1 -Path ".\Paper OS_0.4.0_x64_en-US.msi"

param(
  [Parameter(Mandatory = $true)][string]$Path
)

$CSC = $env:PAPER_OS_CSC_NAME
if (-not $CSC) { $CSC = "Paper OS Code Signing" }
$TSA = $env:PAPER_OS_TIMESTAMP_URL
if (-not $TSA) { $TSA = "http://timestamp.digicert.com" }

$signtool = (Get-Command signtool.exe -ErrorAction SilentlyContinue).Source
if (-not $signtool) {
  $signtool = "${env:ProgramFiles(x86)}\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
}

if (-not (Test-Path $signtool)) {
  Write-Error "signtool.exe not found. Install Windows SDK or set PATH."
  exit 1
}

$files = Get-ChildItem -Path $Path -Recurse -Include @("*.msi", "*.exe", "*.appx", "*.dll", "*.ocx")
foreach ($f in $files) {
  Write-Host "→ signing $($f.FullName)"
  & $signtool sign /fd sha256 /td sha256 /tr $TSA /sha1 "$($f.FullName)" /n "$CSC" /a
  if ($LASTEXITCODE -ne 0) {
    Write-Error "sign failed for $($f.FullName)"
    exit $LASTEXITCODE
  }
}

# Verify
foreach ($f in $files) {
  & $signtool verify /pa "$($f.FullName)" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "verify failed for $($f.FullName) (may still be accepted after SmartScreen reputation builds up)"
  }
}

Write-Host "✓ signed: $Path"
