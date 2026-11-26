<#
.SYNOPSIS
    Packages the AE Bridge CEP panel into a .zxp extension archive.
.DESCRIPTION
    Stages extension files excluding development artifacts (.git, .debug, logs)
    and compresses into dist/com.aebridge.zxp. Signs with ZXPSignCmd if credentials provided.
#>
[CmdletBinding()]
param(
    [string]$CertFile = $env:CERT_FILE,
    [string]$CertPassword = $env:CERT_PASS
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$panelDir = Join-Path $rootDir "cep-panel"
$distDir = Join-Path $rootDir "dist"
$outputZxp = Join-Path $distDir "com.aebridge.zxp"

Write-Host "=== AE Bridge ZXP Packager ===" -ForegroundColor Cyan
Write-Host "Source directory: $panelDir"

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
}
if (Test-Path $outputZxp) {
    Remove-Item $outputZxp -Force
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ae-zxp-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    Write-Host "Staging clean extension files..." -ForegroundColor Gray
    Get-ChildItem -Path $panelDir -Recurse | ForEach-Object {
        $relPath = $_.FullName.Substring($panelDir.Length).TrimStart("\", "/")
        
        # Exclude unwanted dev/debug files
        if ($relPath -like ".git*" -or
            $relPath -like ".debug*" -or
            $relPath -like "node_modules*" -or
            $relPath -like "*.log" -or
            $relPath -like "*.tmp") {
            return
        }

        $dest = Join-Path $tempDir $relPath
        if ($_.PSIsContainer) {
            if (-not (Test-Path $dest)) {
                New-Item -ItemType Directory -Path $dest -Force | Out-Null
            }
        } else {
            $destParent = Split-Path -Parent $dest
            if (-not (Test-Path $destParent)) {
                New-Item -ItemType Directory -Path $destParent -Force | Out-Null
            }
            Copy-Item $_.FullName -Destination $dest -Force
        }
    }

    $zxpSignCmd = Get-Command ZXPSignCmd -ErrorAction SilentlyContinue
    if ($zxpSignCmd -and $CertFile -and $CertPassword) {
        Write-Host "Signing package with ZXPSignCmd..." -ForegroundColor Yellow
        & ZXPSignCmd.exe -sign $tempDir $outputZxp $CertFile $CertPassword -tsa http://timestamp.digicert.com
        Write-Host "Successfully signed and built: $outputZxp" -ForegroundColor Green
    } else {
        Write-Host "Creating zip-compatible .zxp archive..." -ForegroundColor Gray
        Add-Type -AssemblyName System.IO.Compression.FileSystem -ErrorAction SilentlyContinue
        $tempZip = Join-Path $distDir "temp_package.zip"
        if (Test-Path $tempZip) { Remove-Item $tempZip -Force }
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $tempZip, [System.IO.Compression.CompressionLevel]::Optimal, $false)
        Move-Item $tempZip $outputZxp -Force
        Write-Host "Created extension package: $outputZxp" -ForegroundColor Green
        Write-Host "Note: To sign for marketplace distribution, see docs/packaging.md." -ForegroundColor DarkGray
    }
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Packaging complete." -ForegroundColor Cyan
