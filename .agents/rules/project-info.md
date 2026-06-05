---
trigger: always_on
description: "Core specification and design guidelines for the Play in MPV Chrome extension."
---

# Play in MPV

We are building a modern Chrome extension called **Play in MPV** to quickly play videos you are watching/browsing on YouTube inside `mpv`.

## Project Goal
To seamlessly launch the local `mpv` player from YouTube with user-configured quality, hardware acceleration, playback controls, session syncing (YouTube history), and position resuming.
## Tech Stack
- **Frontend (Chrome Extension)**: Vanilla HTML, Vanilla CSS (glassmorphic dark design system), Vanilla JavaScript (ES6+), Chrome Extensions API (Manifest V3, Native Messaging, Cookies).
- **Backend (Native Host)**: Python 3 (standard library only), Bash/Python installer.
- **External Dependencies**: `mpv` media player, `yt-dlp` (integration engine).

## Architecture

### 1. Chrome Extension (Frontend)
- **Design System**: Rich aesthetics, sleek dark mode, HSL tailored colors, responsive layouts, glassmorphism UI.
- **Settings & Options Page**:
  - `mpv` binary path (e.g. `/usr/bin/mpv`).
  - Custom command-line flags (editable textarea).
  - Video quality presets (Best, ..., 1440p, 1080p, 720p, Audio Only) mapped to `yt-dlp` format settings.
  - Auto-pause YouTube video option (pauses the web player when launching in `mpv`).
  - Hardware acceleration options (e.g., `--hwdec` setting).
  - Resume playback checkbox (appends `--save-position-on-quit` to save progress).
  - YouTube history sync checkbox (extracts YouTube cookies via `chrome.cookies` and passes them).
- **YouTube UI Integration**:
  - **Player Control Bar**: A custom button injected into the `.ytp-right-controls` container (to the left of the Autoplay toggle) that mimics the native YouTube player buttons (using the `ytp-button` class and a `viewBox="0 0 36 36"` SVG icon) to open the currently playing video in `mpv`. Handles YouTube SPA navigation using the `yt-navigate-finish` event.
  - **Thumbnail Overlays**: A custom overlay button injected into the inline preview overlay on video thumbnails (homepage, sidebar recommendations, search results) positioned directly below the native audio/mute and CC buttons. Implemented using a `MutationObserver` to handle dynamic/lazy-loaded grid additions.
  - **Context Menu Fallback**: A native browser context menu item (`chrome.contextMenus`) labeled "Open Link in MPV" to act as a resilient fallback for right-clicking video thumbnails and links, bypassing UI/DOM changes.
  - **Graceful Error Handling**: All frontend features relying on the YouTube UI must handle layout changes and execution errors gracefully. DOM queries and button injections must be encapsulated in try-catch blocks. If selectors fail, injection should fail silently (or log a simple warning) without throwing unhandled exceptions that could crash the script or affect YouTube's native operations, relying on the Context Menu Fallback as a recovery path.
- **Communication**: Uses Chrome Native Messaging API (`chrome.runtime.sendNativeMessage`) to talk to the local Python host.

### 2. Native Messaging Host (Backend)
- **Language**: Python (requires no compilation, standard library execution).
- **Functionality**:
  - Receives JSON messages containing the video URL, user-defined `mpv` flags, and YouTube session cookies.
  - If cookies are supplied, writes them to a secure temporary Netscape cookie format file.
  - Executes `mpv` as a separate detached subprocess passing the video URL and calculated flags (including `--cookies=<temp_file>` if cookies are used).
  - Safely deletes the temporary cookie file after `mpv` initializes.
  - Standard input/output communication formatted according to the Chrome Native Messaging protocol.
- **Installer Script**:
  - A helper script (Bash/Python) to register the native messaging host manifest JSON in the correct browser configuration directory (e.g. `~/.config/google-chrome/NativeMessagingHosts/` or `~/.config/chromium/NativeMessagingHosts/`).