---
name: youtube-ui-injection
description: Instructions and guidelines for injecting the "Play in MPV" button into the YouTube player interface. Includes techniques for handling YouTube's Single Page Application (SPA) navigation via custom events, mimicking native player button styling, and positioning the button within the player control bar.
---

# YouTube UI Injection Guide

This skill provides guidelines and patterns for injecting a custom button into the YouTube HTML5 video player's controls bar.

## 1. Target Container & Native Styling

To ensure the injected button looks native and blends seamlessly with YouTube's player controls, use the following specifications:

- **Target Container**: `.ytp-right-controls` (inside `#movie_player`).
- **Insertion Point**: Prepend to `.ytp-right-controls` to place it directly to the left of the Autoplay toggle.
- **Class Name**: Apply the `ytp-button` class to the button element. This inherits YouTube's native size, hover, and alignment styles.
- **SVG ViewBox**: The inner SVG icon must have `viewBox="0 0 36 36"` to scale correctly with YouTube's CSS.
- **Button Structure**:
  ```html
  <button class="ytp-button play-in-mpv-btn" id="play-in-mpv-player-button" title="Play in MPV" aria-label="Play in MPV">
    <svg width="100%" height="100%" viewBox="0 0 36 36" version="1.1">
      <!-- SVG path matching the MPV play icon design -->
    </svg>
  </button>
  ```

---

## 2. Handling SPA Navigation (yt-navigate-finish)

Since YouTube is a Single Page Application (SPA), the content script only executes once on initial load. Subsequent video selections do not trigger page reloads.

To handle dynamic navigation:
- Listen to YouTube's custom global event `yt-navigate-finish`.
- Validate the current URL to ensure the user is on a watch page (`/watch`).
- Since elements might render asynchronously, verify that the player controls are available, using a short retry logic or a MutationObserver if necessary.

### Recommended Ingestion Hook
```javascript
window.addEventListener('yt-navigate-finish', handleNavigation);

function handleNavigation() {
  if (window.location.pathname.startsWith('/watch')) {
    attemptInjection();
  }
}

function attemptInjection() {
  // Prevent duplicate buttons
  if (document.getElementById('play-in-mpv-player-button')) return;

  const controls = document.querySelector('.ytp-right-controls');
  if (controls) {
    injectButton(controls);
  } else {
    // Retry if DOM is not ready
    setTimeout(attemptInjection, 300);
  }
}
```

---

## 3. Communication and Action

Upon clicking the button:
1. Extract the current video URL from `window.location.href`.
2. Retrieve relevant user settings (e.g., custom flags, video quality preferences) using `chrome.storage.sync.get()`.
3. If auto-pause is enabled, locate the YouTube HTML5 video element (usually `document.querySelector('video')` or `#movie_player video`) and call `.pause()`.
4. Dispatch the native message via `chrome.runtime.sendNativeMessage`.

---

## 4. Graceful Degradation & Error Handling

YouTube updates its interface regularly. If the class names or player layout changes:
- **Try-Catch Wrapping**: Wrap element querying, structure setup, and placement operations inside `try-catch` blocks.
- **Fail Silently**: If `.ytp-right-controls` is not found, or if appending the button fails, log a warning to the console and abort the injection process. Never allow DOM errors to crash the content script or break the user's browsing experience.
- **Fallbacks**: Ensure the browser context menu remains operational as a zero-maintenance alternative in case visual injection fails.
