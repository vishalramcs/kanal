# Run ADAPT locally with the portable Node in tools/node (no system install needed).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$root = Split-Path -Parent $PSScriptRoot
$env:Path = "$root\tools\node;$env:Path"
Set-Location $root
if (-not (Test-Path "node_modules")) { npm install }
npm run dev
