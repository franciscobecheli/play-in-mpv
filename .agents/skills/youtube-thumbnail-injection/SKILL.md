---
name: youtube-thumbnail-injection
description: Instructions and guidelines for injecting a custom "Play in MPV" button into YouTube's video thumbnails and hover/preview overlays. Includes DOM navigation strategies, MutationObserver setup for lazy-loaded content, styling rules to match inline controls (audio/CC), and context menu fallbacks.
---

# YouTube Thumbnail UI Injection Guide

This skill provides guidelines and patterns for injecting the "Play in MPV" button into YouTube video thumbnails, focusing on inline preview overlays and context-menu fallbacks.

## 1. Targeting Inline Preview Overlays

When a user hovers over a thumbnail, YouTube displays an inline video preview containing circular control buttons in the top-right corner (typically a mute/audio toggle and a Closed Captions (CC) toggle).

To inject a "Play in MPV" button below these controls:

- **Target Element**: Locate the inline preview overlay container inside the active `<ytd-thumbnail>` (commonly inside `<ytd-moving-thumbnail-renderer>` or `#inline-preview-controls`).
- **Button Styling**:
  - Mimic the native circular buttons: translucent black background, circular border-radius (`50%`), white SVG icon, and smooth scale-up hover animations.
  - Match the height and width of the sibling audio/CC buttons (usually around `28px` to `32px`).
- **Insertion**: Append the button to the vertical controls container so it naturally aligns below the CC button.

---

## 2. MutationObserver for Lazy-Loaded Thumbnails

YouTube loads thumbnails dynamically via infinite scrolling (lazy-loading). A standard load-time injector will miss newly rendered videos.

Use a `MutationObserver` on the main page wrapper (e.g., `ytd-app` or `ytd-browse`) to detect when new `<ytd-thumbnail>` elements are added to the DOM:

```javascript
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      
      // Target thumbnails in search feed, grid, or sidebar
      const thumbnails = node.querySelectorAll('ytd-thumbnail:not([data-mpv-injected])');
      thumbnails.forEach(injectThumbnailOverlay);
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function injectThumbnailOverlay(thumbnail) {
  thumbnail.setAttribute('data-mpv-injected', 'true');
  
  // Set up event listeners or append the overlay buttons container
  // Extract video URL from the thumbnail's anchor tag href (thumbnail.querySelector('a#thumbnail'))
}
```

---

## 3. Context Menu Fallback (Zero Maintenance Route)

To ensure the extension remains functional even if YouTube completely changes its DOM/CSS structure, always implement a context menu fallback using Chrome's background service worker.

### Service Worker Context Menu Registration (`background.js`)
```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "play-in-mpv-context",
    title: "Open Link in MPV",
    contexts: ["link"],
    targetUrlPatterns: ["*://*.youtube.com/watch*", "*://*.youtube.com/shorts*"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "play-in-mpv-context" && info.linkUrl) {
    // Forward info.linkUrl to the Python Native Host
    launchMpv(info.linkUrl);
  }
});
```
This requires no DOM selection or CSS class tracking, serving as a robust fallback.

---

## 4. Graceful Degradation & Error Handling

Because thumbnail markup and preview players on YouTube are extremely complex and subject to continuous changes:
- **Wrap Dynamic Queries in Try-Catch**: Always wrap queries inside `MutationObserver` logic and target overlay resolution in `try-catch` blocks.
- **Fail Silently**: If the layout elements cannot be selected, simply suppress the button creation/injection for that element and log a debug message. Never crash the observer or throw unhandled exceptions.
- **Do Not Block User Interactions**: Make sure any failed injection attempt does not block native click, hover, or video playback functions on YouTube.
- **Rely on Context Menu**: Rely on the context menu fallback as a resilient path if the visual UI integration stops working.
