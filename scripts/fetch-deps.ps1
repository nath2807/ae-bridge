$targetDir = Join-Path $PSScriptRoot "..\cep-panel\lib"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}
$url = "https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/CEP_11.x/CSInterface.js"
$output = Join-Path $targetDir "CSInterface.js"
Write-Host "Downloading CSInterface.js..."
Invoke-WebRequest -Uri $url -OutFile $output
Write-Host "Downloaded CSInterface.js to $output"
