# Windows installation script for AE Bridge CEP Extension
$ErrorActionPreference = "Stop"

Write-Host "Setting up AE Bridge for Adobe After Effects on Windows..." -ForegroundColor Cyan

# 1. Set registry PlayerDebugMode for CSXS 10 - 13
$csxsList = @("CSXS.10", "CSXS.11", "CSXS.12", "CSXS.13")
foreach ($ver in $csxsList) {
    $regPath = "HKCU:\Software\Adobe\$ver"
    if (-not (Test-Path $regPath)) {
        New-Item -Path $regPath -Force | Out-Null
    }
    Set-ItemProperty -Path $regPath -Name "PlayerDebugMode" -Value "1" -Type String -Force
    Write-Host "Set PlayerDebugMode = 1 in $regPath" -ForegroundColor Green
}

# 2. Check and run fetch-deps.ps1 if CSInterface.js is missing
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$scriptDir\..").Path
$csInterfacePath = Join-Path $repoRoot "cep-panel\lib\CSInterface.js"

if (-not (Test-Path $csInterfacePath)) {
    Write-Host "CSInterface.js missing. Running fetch-deps.ps1..." -ForegroundColor Yellow
    & "$scriptDir\fetch-deps.ps1"
} else {
    Write-Host "CSInterface.js found in cep-panel\lib\" -ForegroundColor Green
}

# 3. Create directory junction to CEP extensions folder
$cepExtFolder = "$env:APPDATA\Adobe\CEP\extensions"
if (-not (Test-Path $cepExtFolder)) {
    New-Item -ItemType Directory -Force -Path $cepExtFolder | Out-Null
}

$targetJunction = Join-Path $cepExtFolder "ae-bridge"
$sourcePanel = Join-Path $repoRoot "cep-panel"

if (Test-Path $targetJunction) {
    Write-Host "Removing existing extension at $targetJunction..." -ForegroundColor Yellow
    $item = Get-Item $targetJunction
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        [System.IO.Directory]::Delete($targetJunction)
    } else {
        Remove-Item -Recurse -Force -Path $targetJunction
    }
}

New-Item -ItemType Junction -Path $targetJunction -Target $sourcePanel | Out-Null
Write-Host "Successfully created junction: $targetJunction -> $sourcePanel" -ForegroundColor Green

Write-Host "`nAE Bridge installed successfully!" -ForegroundColor Cyan
Write-Host "Restart After Effects and open: Window > Extensions > AE Bridge" -ForegroundColor White
