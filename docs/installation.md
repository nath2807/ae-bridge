# AE Bridge Installation Guide

This guide walks through setting up AE Bridge on **Windows** and **macOS**.

---

## Prerequisites

1. **Adobe After Effects 2024 or higher** (v24.0+).
2. **Node.js v20.0.0 or higher** ([Download Node.js](https://nodejs.org/)).
3. **Git** for source management.

---

## 1. Automated Installation (Recommended)

### Step 1: Clone Repository & Build Server
```bash
git clone https://github.com/<your-org>/ae-bridge.git
cd ae-bridge
npm --prefix server install
npm --prefix server run build
```

### Step 2: Install CEP Panel
Run the cross-platform CLI installer:
```bash
node server/dist/cli.js install
```

This performs three essential actions automatically:
1. Enables CEP `PlayerDebugMode` in the user registry or macOS defaults for `CSXS.10` through `CSXS.13`.
2. Downloads `CSInterface.js` from the official Adobe CEP Resources repository into `cep-panel/lib/` if missing.
3. Creates a filesystem link (`junction` on Windows, `symlink` on macOS) from `cep-panel/` into Adobe's shared extensions directory:
   - **Windows:** `%APPDATA%\Adobe\CEP\extensions\com.aebridge`
   - **macOS:** `~/Library/Application Support/Adobe/CEP/extensions/com.aebridge`

### Step 3: Verify with Doctor
```bash
node server/dist/cli.js doctor
```

---

## 2. Manual Installation Steps

If you prefer to install without the CLI tool:

### Windows Manual Setup

1. **Enable Debug Mode in Registry:**
   Open PowerShell as Administrator and run:
   ```powershell
   10..13 | ForEach-Object {
       New-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.$_" -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force
   }
   ```
2. **Download CSInterface.js:**
   Download `CSInterface.js` from Adobe CEP Resources and save it to `<path-to-ae-bridge>/cep-panel/lib/CSInterface.js`.
3. **Link Extension:**
   ```cmd
   mkdir "%APPDATA%\Adobe\CEP\extensions"
   mklink /J "%APPDATA%\Adobe\CEP\extensions\com.aebridge" "<path-to-ae-bridge>\cep-panel"
   ```

### macOS Manual Setup

1. **Enable Debug Mode in Defaults:**
   ```bash
   for ver in 10 11 12 13; do
       defaults write com.adobe.CSXS.${ver} PlayerDebugMode 1
   done
   ```
2. **Download CSInterface.js:**
   ```bash
   mkdir -p "<path-to-ae-bridge>/cep-panel/lib"
   curl -fsSL https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/CEP_11.x/CSInterface.js -o "<path-to-ae-bridge>/cep-panel/lib/CSInterface.js"
   ```
3. **Link Extension:**
   ```bash
   mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"
   ln -s "<path-to-ae-bridge>/cep-panel" "$HOME/Library/Application Support/Adobe/CEP/extensions/com.aebridge"
   ```

---

## 3. Launching After Effects

1. Restart Adobe After Effects completely.
2. In the top menu, navigate to **Window > Extensions > AE Bridge**.
3. A dark utility panel will open displaying connection status and recent commands.
4. When your AI agent starts an MCP session, the status badge will transition to green: `Connected`.
