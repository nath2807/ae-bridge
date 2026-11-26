$ErrorActionPreference = "Stop"

$targetDir = Join-Path $PSScriptRoot "..\cep-panel\lib"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

$url = "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/CEP_11.x/CSInterface.js"
$expectedHash = "d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263"
$output = Join-Path $targetDir "CSInterface.js"
$tempOutput = "$output.$([Guid]::NewGuid().ToString('N')).tmp"

Write-Host "Downloading verified CSInterface.js from pinned Adobe-CEP/CEP-Resources commit..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $url -OutFile $tempOutput

$actualHash = (Get-FileHash -Path $tempOutput -Algorithm SHA256).Hash.ToLower()
if ($actualHash -ne $expectedHash) {
    Remove-Item -Force $tempOutput
    throw "SHA256 mismatch for CSInterface.js! Expected: $expectedHash, got: $actualHash"
}

Move-Item -Path $tempOutput -Destination $output -Force
Write-Host "Verified and installed CSInterface.js to $output (SHA-256: $actualHash)" -ForegroundColor Green
