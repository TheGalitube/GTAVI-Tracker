$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js 18 or newer is required. Install the current LTS from https://nodejs.org/, then run this installer again.'
  exit 1
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error 'npm was not found. Reinstall Node.js from https://nodejs.org/ and make sure npm is included.'
  exit 1
}

$installer = Join-Path $PSScriptRoot 'scripts\install.mjs'
& node $installer
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
