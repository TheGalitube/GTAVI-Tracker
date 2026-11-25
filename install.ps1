$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if (-not $winget) {
    Write-Host 'Node.js was not found, and winget is not available.' -ForegroundColor Yellow
    Write-Host 'Install the Node.js LTS version from https://nodejs.org/, reopen your terminal, and run install.bat again.'
    exit 1
  }

  Write-Host 'Node.js was not found. Installing the Node.js LTS version with winget...'
  & $winget.Source install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Node.js installation failed (winget exit code $LASTEXITCODE). Install Node.js LTS from https://nodejs.org/ and run this installer again."
    exit $LASTEXITCODE
  }

  # winget updates the persistent PATH, but this PowerShell process keeps the
  # PATH it inherited before installation. Refresh it so setup can continue.
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js was installed, but is not available in this terminal yet.' -ForegroundColor Yellow
  Write-Host 'Close this terminal, open a new one, and run install.bat again.'
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'npm was not found. Reinstall Node.js LTS from https://nodejs.org/ and make sure npm is included.' -ForegroundColor Yellow
  exit 1
}

$installer = Join-Path $PSScriptRoot 'scripts\install.mjs'
& node $installer
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
