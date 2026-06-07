# Chrome Web Store Listing — Play in MPV

> Last Updated: 2026-06-07

## Store Listing

**Extension Name** [REQUIRED]
Play in MPV

**Short Description** [REQUIRED]
Play YouTube videos in the local MPV media player with a single click.

**Detailed Description** [REQUIRED]
Play in MPV seamlessly integrates your browser with the local MPV media player, allowing you to instantly play YouTube videos outside the browser. 

Key features:
- Injects a native-looking "Play in MPV" button directly into the YouTube player control bar.
- Fallback context menu option allows right-clicking any YouTube thumbnail or link to play in MPV.
- Rich configuration settings: set video quality format cap (e.g. 1080p, 720p, or Audio Only), select hardware video decoding APIs, resume playback position automatically, auto-pause the browser video, and toggle window options (Always on Top, Borderless, Fullscreen).
- Configure a customizable keyboard shortcut (e.g. Alt+P) to instantly trigger MPV.
- Safe argument and path validation prevents option injection and protects your device.

How to use it:
1. Install the extension and configure your preferred settings (quality, layout, shortcuts) in the options popup.
2. Install the native messaging host on your local machine using the provided installer script.
3. Click the MPV icon in the YouTube player control bar, right-click a video link, or press your custom shortcut to play the video in MPV.

Privacy and Security Note:
This extension communicates only with your local machine using Chrome's Native Messaging API to launch the local MPV player. It does not collect, store, or transmit any personal data, web history, or user activity off your device.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Plays the currently open or clicked YouTube video in the local MPV media player.

**Primary Language** [REQUIRED]
English

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `extension/icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | |
| Marquee Promo Tile | 1400×560 | ⬜ Not created | |

### Screenshot Notes
- **Screenshot 1**: Showing a YouTube watch page with the custom "Play in MPV" icon injected in the bottom-right player controls.
- **Screenshot 2**: Showing the extension's popup configuration UI demonstrating quality caps, window layout controls, and shortcut recorder.

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `nativeMessaging` | permissions | Required to send the video URL and user-defined configuration flags to the local Python host script to launch the local MPV media player. |
| `contextMenus` | permissions | Used to add a right-click fallback option ("Open Link in MPV") on YouTube video links and thumbnails, ensuring robust usability if UI injections are blocked. |
| `storage` | permissions | Required to save and sync user configurations, including video quality format caps, custom flags, window layout settings, and keyboard shortcuts. |
| `activeTab` | permissions | Used to retrieve the URL of the current active tab when the user clicks the "Play current tab" button in the settings popup UI. |
| `https://www.youtube.com/*` | host_permissions | Necessary to inject content scripts to display the in-player control bar button on YouTube watch pages. |

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

## Privacy Policy

**Privacy Policy URL** [RECOMMENDED]
https://github.com/franciscobecheli/play-in-mpv/blob/main/PRIVACY.md

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

## Developer Info

**Publisher Name** [REQUIRED]
Francisco Becheli

**Contact Email** [REQUIRED]
contact@franciscobecheli.dev

**Support URL / Email** [RECOMMENDED]
https://github.com/franciscobecheli/play-in-mpv/issues

**Homepage URL** [RECOMMENDED]
https://github.com/franciscobecheli/play-in-mpv

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 0.1.0 | 2026-06-07 | Initial release. In-player button, context menu integration, settings popup, and custom shortcut. Hardened argument, URL protocol, and executable path validations. | Draft |

## Review Notes

### Known Issues / Limitations
- Relies on the local installation of MPV, yt-dlp, and Python 3. The native host script must be registered using `install.sh`.
