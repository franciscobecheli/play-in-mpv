---
name: mpv
description: Skill for interacting with mpv media player, invoking it via command-line, configuring playback quality, cookies for streaming (youtube-dl/yt-dlp), hardware acceleration, session resuming, and spawning mpv as a detached background process from a native messaging host. Use when automating, launching, or configuring mpv playback, particularly for playing online streams like YouTube.
---

# MPV Media Player Skill

This skill provides instructions and patterns for launching and configuring the `mpv` media player, especially for playing YouTube and other network video streams.

## Core Options Reference

Use these essential options when constructing commands to run `mpv`:

| Option | Value/Syntax | Purpose |
| :--- | :--- | :--- |
| **Video Quality** | `--ytdl-format="<format>"` | Set stream format via `yt-dlp` (e.g. `bestvideo[height<=1080]+bestaudio/best`) |
| **Cookies (yt-dlp)** | `--ytdl-raw-options=cookies=<path>` | Pass browser session cookies to `yt-dlp` to bypass logins or age restrictions |
| **Cookies (mpv)** | `--cookies-file=<path>` | Pass cookies to `mpv`'s internal HTTP client to authenticate stream segments |
| **Cookie Support** | `--cookies=yes` | Explicitly enable cookie support in `mpv` |
| **Hardware Decoding** | `--hwdec=<api>` | Specify hardware video decoding API (e.g., `vaapi`, `nvdec`, `videotoolbox`, `auto-copy`) |
| **Save Playback Position** | `--save-position-on-quit` | Save playback progress to resume later |
| **Resume Playback** | `--resume-playback=yes` | Restore playback position on start (enabled by default) |

---

## Detailed References

For specific configuration and implementation details, see the following reference documents:

- **YouTube & Cookie Integration**: See [ytdl-integration.md](references/ytdl-integration.md) for cookie management, quality formatting, and `yt-dlp` configuration.
- **Hardware Acceleration**: See [hardware-acceleration.md](references/hardware-acceleration.md) for platform-specific hardware decoders and configuration options.
- **Subprocess & Execution**: See [process-management.md](references/process-management.md) for spawning `mpv` as a detached subprocess using Python.
