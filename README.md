# Play in MPV

Play in MPV is a modern Chrome and Chromium-based browser extension that allows you to seamlessly launch your local `mpv` player directly from YouTube. Watch videos with custom quality caps, hardware acceleration, playback resume, and session syncing—all outside the browser.

Official Setup Guide: [Setup & Installation Guide](https://franciscobecheli.github.io/play-in-mpv/docs/)

---

## Features

- **YouTube UI Integration**: Custom native-style MPV button injected directly into the YouTube player control bar.
- **Thumbnail Overlays**: Quick-play overlay buttons on YouTube video thumbnails (home, sidebar, search).
- **Context Menu Fallback**: Right-click any video link or thumbnail and select "Open Link in MPV" to bypass any YouTube UI layout updates.
- **Customizable Shortcut**: Trigger playback instantly using keyboard shortcuts (default: `Alt+P`).
- **Sleek Options UI**: Vibrant glassmorphic configuration panel to cap video resolution, enable hardware decoding (`--hwdec`), auto-pause the YouTube player, toggle window modes (fullscreen, always-on-top, borderless), and pass custom command-line flags.

---

## Prerequisites

To play stream links, the extension uses a local Python bridge (native host) that communicates with your system's media player. You must have the following applications installed on your system:

1. **MPV**: The media player.
2. **yt-dlp**: The media extraction engine (used by MPV to stream YouTube videos).
3. **Python 3**: Used to run the native messaging bridge.

---

## Installation

Follow these steps to install the browser extension and set up the local native messaging bridge.

### Step 1: Install the Extension

Until the extension is published on the Chrome Web Store, you can load it as a developer extension:

1. Download or clone this repository to a permanent folder on your system.
2. Open Chrome and navigate to `chrome://extensions`.
3. In the top-right corner, toggle **Developer mode** on.
4. Click **Load unpacked** in the top-left and select the `extension` folder inside this repository.
5. Once loaded, copy the 32-character **Extension ID** (e.g., `oblgkefhflpldmjdbmpol...`). You will need this ID in **Step 3**.

### Step 2: Install System Requirements

Install `mpv`, `yt-dlp`, and `python` on your system.

#### Windows
Run the following command in Command Prompt or PowerShell (uses Windows Package Manager):
```cmd
winget install python3 shinchiro.mpv yt-dlp.yt-dlp
```

After installing, open a **new** terminal and verify each tool is on your PATH:
```cmd
mpv --version
yt-dlp --version
python --version
```

If any command is not found, add its folder to your **System PATH** manually:
1. Open **Start → System → Advanced system settings → Environment Variables**.
2. Under **System variables**, select `Path` and click **Edit**.
3. Add the folder containing the missing executable (e.g. `C:\Program Files\mpv`).
4. Click **OK** on all dialogs, then open a new terminal to verify.

> ⚠️ **Chrome restart required** — Chrome reads PATH only at launch time. If you installed or modified PATH while Chrome was running, you must **fully close Chrome** (including from the system tray) and reopen it before the extension can detect the tools.

#### macOS (Homebrew)
```bash
brew install mpv yt-dlp python
```

#### Linux (Debian / Ubuntu)
```bash
sudo apt update && sudo apt install mpv yt-dlp python3
```

---
 
### Step 3: Install the Native Host Bridge
 
To connect the browser extension to your local `mpv` player, register the bridge script.
 
#### 1. Download the Host Package
Instead of downloading the entire repository, you can download the lightweight host-only zip file containing only the installer and host bridge:
- **Download**: [play-in-mpv-host.zip](https://github.com/franciscobecheli/play-in-mpv/releases/latest/download/play-in-mpv-host.zip)
- Extract the ZIP archive to a permanent directory on your machine (e.g. `C:\Users\YourName\play-in-mpv` or `~/play-in-mpv-host`). Do not move this folder after installing, as the browser executes the scripts directly from it.
 
#### 2. Run the Installer
 
##### Windows
1. Open the extracted folder, navigate to the `play-in-mpv-host` directory, and double-click **`install.bat`**.
2. A command prompt will open. If you installed the extension via the Chrome Web Store, simply press **Enter** to register using the default ID. (If using a local unpacked developer version, paste your 32-character Extension ID and press Enter).
 
##### macOS & Linux
1. Open a terminal in the extracted `play-in-mpv-host` directory.
2. Run the installer script:
   ```bash
   python3 install.py
   ```
   *(If you are using a local developer version, specify the ID as an argument: `python3 install.py <YOUR_EXTENSION_ID>`)*
3. Press **Enter** at the prompt to confirm setup with the default Web Store ID.
 
---

### Step 4: Verification & Playback

1. Return to `chrome://extensions` and click the **Reload** icon on the Play in MPV card (or restart your browser).
2. Open or refresh any YouTube page.
3. Click the MPV icon next to the autoplay controls inside the YouTube player, right-click any thumbnail, or press `Alt+P` to launch the video in MPV.

---

## Uninstallation

If you wish to remove the native host registration and temporary files from your system, run the uninstaller:

#### Windows
Run Command Prompt or PowerShell as administrator, navigate to the `host` directory, and run:
```cmd
python uninstall.py
```

#### macOS & Linux
```bash
cd host
python3 uninstall.py
```

Finally, go to `chrome://extensions` and click **Remove** on the extension card.

---

## License

This project is open-source and available under the [MIT License](LICENSE).
