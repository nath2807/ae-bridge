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

# 2. Check and run fetch-deps.ps1 if CSInterface.js is missing or corrupt
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path "$scriptDir\..").Path
$csInterfacePath = Join-Path $repoRoot "cep-panel\lib\CSInterface.js"

$expectedHash = "d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263"
$needsFetch = $true
if (Test-Path $csInterfacePath) {
    $currentHash = (Get-FileHash -Path $csInterfacePath -Algorithm SHA256).Hash.ToLower()
    if ($currentHash -eq $expectedHash) {
        $needsFetch = $false
        Write-Host "CSInterface.js verified present and intact in cep-panel\lib\" -ForegroundColor Green
    }
}

if ($needsFetch) {
    Write-Host "Fetching verified CSInterface.js..." -ForegroundColor Yellow
    & "$scriptDir\fetch-deps.ps1"
}

# 3. Create directory junction to CEP extensions folder
$cepExtFolder = "$env:APPDATA\Adobe\CEP\extensions"
if (-not (Test-Path $cepExtFolder)) {
    New-Item -ItemType Directory -Force -Path $cepExtFolder | Out-Null
}

# 3a. Migration: Clean legacy 'ae-bridge' junction if present
$legacyFolder = Join-Path $cepExtFolder "ae-bridge"
if (Test-Path $legacyFolder) {
    Write-Host "Cleaning up legacy extension at $legacyFolder..." -ForegroundColor Yellow
    $item = Get-Item $legacyFolder
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        [System.IO.Directory]::Delete($legacyFolder)
    } else {
        Remove-Item -Recurse -Force -Path $legacyFolder
    }
}

# 3b. Canonical 'com.aebridge' junction
$targetJunction = Join-Path $cepExtFolder "com.aebridge"
$sourcePanel = Join-Path $repoRoot "cep-panel"

if (Test-Path $targetJunction) {
    Write-Host "Updating existing extension link at $targetJunction..." -ForegroundColor Yellow
    $item = Get-Item $targetJunction
    if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
        [System.IO.Directory]::Delete($targetJunction)
    } else {
        Remove-Item -Recurse -Force -Path $targetJunction
    }
}

try {
    New-Item -ItemType Junction -Path $targetJunction -Target $sourcePanel | Out-Null
    Write-Host "Successfully created junction: $targetJunction -> $sourcePanel" -ForegroundColor Green
} catch {
    Write-Host "Junction creation failed; falling back to recursive copy..." -ForegroundColor Yellow
    Write-Warning "Copied extension files instead of creating a junction. File edits in repo will not automatically reflect in After Effects."
    Copy-Item -Path $sourcePanel -Destination $targetJunction -Recurse -Force
    Write-Host "Copied extension to: $targetJunction" -ForegroundColor Green
}

Write-Host "`nAE Bridge installed successfully!" -ForegroundColor Cyan
Write-Host "Restart After Effects and open: Window > Extensions > AE Bridge" -ForegroundColor White
