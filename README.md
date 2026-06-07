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
winget install mpv.mpv yt-dlp.yt-dlp Python.Python.3
```

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

#### Windows
1. Open the repository folder and navigate to the `host` directory.
2. Double-click `install.bat`.
3. A command prompt window will open. Paste your **Extension ID** from **Step 1** and press Enter.

#### macOS & Linux
Run the python installer script from your terminal:
```bash
cd host
python3 install.py <YOUR_EXTENSION_ID>
```
*(Replace `<YOUR_EXTENSION_ID>` with the ID copied in Step 1)*

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
