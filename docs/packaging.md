# Packaging and Distributing AE Bridge (.ZXP)

This document covers how to package, self-sign, and verify the `com.aebridge` CEP extension for Adobe After Effects.

---

## 1. Overview

An Adobe Extension package (`.zxp`) is a cryptographically signed ZIP archive containing:
- `CSXS/manifest.xml`: Extension bundle configuration and host compatibility.
- `index.html`: Panel interface and WebSocket client.
- `js/`: Client-side logic and event dispatchers.
- `jsx/`: ExtendScript ES3 tool modules and HostScript handlers.
- `css/`: Styling for light and dark Adobe UI themes.

---

## 2. Development Mode (No Signing Required)

During local development, you do **not** need to package or sign a `.zxp`. Simply enable `PlayerDebugMode`:

### Windows
```powershell
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name "PlayerDebugMode" -Value "1"
Set-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.12" -Name "PlayerDebugMode" -Value "1"
```

### macOS
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
killall cfprefsd
```

Then create a junction or symlink from `cep-panel/` to the CEP extensions directory:
- **Windows:** `%APPDATA%\Adobe\CEP\extensions\com.aebridge`
- **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/com.aebridge`

---

## 3. Building the `.zxp` Package

Run the packaging script from the repository root:

### macOS / Linux
```bash
./scripts/build-zxp.sh
```

### Windows
```powershell
.\scripts\build-zxp.ps1
```

The script stages clean extension files (excluding `.git`, `.debug`, temporary files, and logs) and outputs:
```
dist/com.aebridge.zxp
```

---

## 4. Signing with `ZXPSignCmd`

To distribute the extension to other users without requiring `PlayerDebugMode`, sign the `.zxp` with an Adobe-compatible code-signing certificate using `ZXPSignCmd`.

### Step 1: Download ZXPSignCmd
Download `ZXPSignCmd` from [Adobe Developer CEP Resources](https://github.com/Adobe-CEP/CEP-Resources/tree/master/ZXPSignCMD) and place it on your system `PATH`.

### Step 2: Create a Self-Signed Certificate (for testing)
```bash
ZXPSignCmd -selfSignedCert US CA "AE Bridge Dev" "com.aebridge" "YourPassword" cert.p12
```

### Step 3: Sign the Package
```bash
ZXPSignCmd -sign cep-panel/ dist/com.aebridge.zxp cert.p12 "YourPassword" -tsa http://timestamp.digicert.com
```

### Step 4: Verify the Signature
```bash
ZXPSignCmd -verify dist/com.aebridge.zxp
```

---

## 5. Installing the `.zxp` Package

Users can install the signed `.zxp` using standard extension installers:
- **Anastasiy's Extension Manager** (GUI)
- **ZXP Installer** (GUI)
- **ExManCmd** (CLI):
  ```bash
  ExManCmd --install dist/com.aebridge.zxp
  ```
