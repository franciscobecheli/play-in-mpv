/**
 * Play in MPV — content script
 *
 * Injects a native-styled "Play in MPV" button into the YouTube player
 * control bar. Handles SPA navigation via the yt-navigate-finish event.
 */

console.log('[Play in MPV] Content script initialized on:', window.location.href);

const BUTTON_ID  = 'play-in-mpv-player-button';
const STYLES_ID  = 'play-in-mpv-styles';

// ---------------------------------------------------------------------------
// SVG icon — widescreen monitor + play triangle
// No explicit width/height attributes: CSS drives the actual rendered size
// so the icon scales correctly in every player size (including fullscreen).
// ---------------------------------------------------------------------------
const MPV_ICON_SVG = `
<svg class="mpv-btn-icon" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
  <!-- Widescreen monitor outline, centred with breathing room on all sides -->
  <rect x="6" y="9" width="24" height="15" rx="2"
        fill="none" stroke="currentColor" stroke-width="1.8"/>
  <!-- Play triangle centred inside the screen -->
  <polygon points="14,13 14,20 23,16.5" fill="currentColor"/>
  <!-- Small base/stand below the screen -->
  <line x1="18" y1="24" x2="18" y2="27" stroke="currentColor" stroke-width="1.8"/>
  <line x1="13" y1="27" x2="23" y2="27" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
</svg>`.trim();

const MPV_SPINNER_SVG = `
<svg class="mpv-btn-spinner" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
  <!-- Spinner base track -->
  <circle cx="18" cy="18" r="12" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
  <!-- Rotating arc -->
  <circle cx="18" cy="18" r="12" fill="none" stroke="currentColor" stroke-width="3"
          stroke-dasharray="75.4" stroke-dashoffset="55" stroke-linecap="round"/>
</svg>`.trim();

// ---------------------------------------------------------------------------
// Inject a one-time <style> block so the SVG sizes itself via CSS instead of
// relying on guessed pixel values. height:100% makes it fill the control bar;
// width:auto preserves the square viewBox aspect ratio. This works at every
// player size, including theater mode and fullscreen.
// ---------------------------------------------------------------------------
function injectStyles() {
  if (document.getElementById(STYLES_ID)) return;
  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = `
    #${BUTTON_ID} {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 46px !important;
      height: 100% !important;
      padding: 0 !important;
      margin: 0 !important;
      border: none !important;
      background: transparent !important;
      position: relative !important;
    }
    #${BUTTON_ID} svg {
      display: block !important;
      position: static !important;
      width: 36px !important;
      height: 36px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #${BUTTON_ID} svg.mpv-btn-icon {
      transform: none !important;
    }
    #${BUTTON_ID} .mpv-btn-spinner {
      display: none !important;
    }
    #${BUTTON_ID}.loading .mpv-btn-icon {
      display: none !important;
    }
    #${BUTTON_ID}.loading .mpv-btn-spinner {
      display: block !important;
      transform-origin: center !important;
      animation: play-in-mpv-spin 1s linear infinite !important;
    }
    @keyframes play-in-mpv-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Button injection
// ---------------------------------------------------------------------------

let isLoading = false;

function createButton() {
  const btn = document.createElement('button');
  btn.id        = BUTTON_ID;
  btn.className = 'ytp-button play-in-mpv-btn';
  btn.title     = 'Play in MPV';
  btn.setAttribute('aria-label', 'Play in MPV');
  btn.innerHTML = MPV_ICON_SVG + MPV_SPINNER_SVG;
  btn.addEventListener('click', onButtonClick);
  return btn;
}

function injectButton(controls) {
  injectStyles();
  const btn = createButton();
  // Prepend so it sits to the left of the Autoplay toggle
  controls.prepend(btn);
}

function attemptInjection() {
  try {
    // Don't add a duplicate button
    if (document.getElementById(BUTTON_ID)) return;

    const controls = document.querySelector('.ytp-right-controls');
    if (controls) {
      injectButton(controls);
    } else {
      // DOM not ready yet — retry
      setTimeout(attemptInjection, 300);
    }
  } catch (err) {
    // Fail silently; the context menu fallback remains available
    console.warn('[Play in MPV] Button injection failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Auto-Pause Helper
// ---------------------------------------------------------------------------
function handleAutoPauseIfCurrent(targetUrl) {
  try {
    chrome.storage.local.get({ autoPause: true }, (settings) => {
      if (!settings.autoPause) return;

      const currentUrlObj = new URL(window.location.href);
      let targetUrlObj;
      try {
        targetUrlObj = new URL(targetUrl);
      } catch (e) {
        return;
      }
      
      const currentId = currentUrlObj.searchParams.get('v');
      const targetId = targetUrlObj.searchParams.get('v');

      if (currentId && targetId && currentId === targetId) {
        const video = document.querySelector('.html5-main-video') || document.querySelector('video');
        if (video && !video.paused) {
          video.pause();
          console.log('[Play in MPV] Auto-paused YouTube video player');
        }
      }
    });
  } catch (err) {
    console.warn('[Play in MPV] Auto-pause check failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Click handler — send native message to launch mpv
// ---------------------------------------------------------------------------

function onButtonClick() {
  if (isLoading) return;

  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  try {
    const url = window.location.href;
    
    // Auto-pause if configured
    handleAutoPauseIfCurrent(url);

    // Read settings to check if we should display the spinner
    chrome.storage.local.get({ forceWindow: true }, (settings) => {
      const showSpinner = !settings.forceWindow;

      if (showSpinner) {
        isLoading = true;
        btn.classList.add('loading');
        btn.style.cursor = 'not-allowed';
      }

      const startTime = Date.now();

      // Content scripts cannot call sendNativeMessage directly — relay via the
      // background service worker which has access to the native messaging API.
      chrome.runtime.sendMessage({ type: 'PLAY_IN_MPV', url }, (response) => {
        if (showSpinner) {
          const elapsed = Date.now() - startTime;
          const minDuration = 3500; // 3.5s minimum spinner show time (additional 2s)
          const delay = Math.max(0, minDuration - elapsed);

          setTimeout(() => {
            isLoading = false;
            btn.classList.remove('loading');
            btn.style.cursor = '';

            if (chrome.runtime.lastError) {
              console.error('[Play in MPV] Message relay error:',
                            chrome.runtime.lastError.message);
              return;
            }
            if (response && !response.ok) {
              console.error('[Play in MPV] Host error:', response.error);
            }
          }, delay);
        } else {
          // If no spinner was shown, still log errors if any
          if (chrome.runtime.lastError) {
            console.error('[Play in MPV] Message relay error:',
                          chrome.runtime.lastError.message);
          } else if (response && !response.ok) {
            console.error('[Play in MPV] Host error:', response.error);
          }
        }
      });
    });
  } catch (err) {
    console.error('[Play in MPV] sendMessage threw:', err);
    // Reset immediately on crash/synchronous throw
    isLoading = false;
    btn.classList.remove('loading');
    btn.style.cursor = '';
  }
}

// ---------------------------------------------------------------------------
// Three-dot context menu option
// ---------------------------------------------------------------------------

let lastClickedMenuVideoUrl = null;

function findVideoUrlFromAnchor(anchor) {
  let href = anchor.getAttribute('href');
  if (href) {
    return new URL(href, window.location.origin).href;
  }

  // Fallback: search the parent card container for any watch/shorts link
  const parentCard = anchor.closest('ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer') || anchor.parentElement;
  if (parentCard) {
    const fallbackAnchor = parentCard.querySelector('a[href*="/watch"], a[href*="/shorts"]');
    if (fallbackAnchor) {
      href = fallbackAnchor.getAttribute('href');
      if (href) {
        return new URL(href, window.location.origin).href;
      }
    }
  }

  return null;
}

// Capture three-dot menu clicks (mousedown & click) to cache the video URL
function handleMenuTrigger(e) {
  try {
    const menuBtn = e.target.closest('ytd-menu-renderer yt-icon-button, ytd-menu-renderer button, yt-icon-button.ytd-menu-renderer, #menu-button');
    if (menuBtn) {
      lastClickedMenuVideoUrl = null;

      const parentCard = menuBtn.closest('ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-playlist-video-renderer, ytd-reel-item-renderer') || menuBtn.parentElement;
      if (parentCard) {
        const anchor = parentCard.querySelector('a#thumbnail') || parentCard.querySelector('a');
        if (anchor) {
          lastClickedMenuVideoUrl = findVideoUrlFromAnchor(anchor);
          console.log('[Play in MPV] Resolved URL for three-dot menu on event:', e.type, '->', lastClickedMenuVideoUrl);
        }
      }
    }
  } catch (err) {
    console.warn('[Play in MPV] Error capturing three-dot menu click:', err);
  }
}

document.addEventListener('mousedown', handleMenuTrigger, { capture: true, passive: true });
document.addEventListener('click', handleMenuTrigger, { capture: true, passive: true });

function launchVideoFromMenu(url) {
  try {
    console.log('[Play in MPV] Launching video from menu:', url);
    
    // Auto-pause if configured
    handleAutoPauseIfCurrent(url);

    chrome.runtime.sendMessage({ type: 'PLAY_IN_MPV', url }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('[Play in MPV] Message relay error:', chrome.runtime.lastError.message);
        return;
      }
      if (response && !response.ok) {
        console.error('[Play in MPV] Host error:', response.error);
      }
    });
  } catch (err) {
    console.error('[Play in MPV] sendMessage threw:', err);
  }
}

function createMenuItem(url) {
  const item = document.createElement('ytd-menu-service-item-renderer');
  item.className = 'style-scope ytd-menu-popup-renderer play-in-mpv-menu-item';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('use-icons', '');

  item.innerHTML = `
    <tp-yt-paper-item class="style-scope ytd-menu-service-item-renderer" role="option" style="cursor: pointer; display: flex; align-items: center; padding: 0 16px; height: 40px; color: var(--yt-spec-text-primary, #fff); font-size: 1.4rem;">
      <yt-icon class="style-scope ytd-menu-service-item-renderer" style="width: 24px; height: 24px; margin-right: 16px; display: flex; align-items: center; justify-content: center; fill: currentColor; stroke: currentColor;">
        ${MPV_ICON_SVG}
      </yt-icon>
      <yt-formatted-string class="style-scope ytd-menu-service-item-renderer">Play in MPV</yt-formatted-string>
    </tp-yt-paper-item>
  `.trim();

  item.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Close the dropdown menu
    const popup = item.closest('ytd-menu-popup-renderer');
    if (popup) {
      const dropdown = popup.closest('tp-yt-iron-dropdown');
      if (dropdown) {
        if (typeof dropdown.close === 'function') {
          dropdown.close();
        } else {
          dropdown.style.display = 'none';
          dropdown.removeAttribute('opened');
        }
      }
    }

    launchVideoFromMenu(url);
  });

  return item;
}

function injectIntoThreeDotMenu(popup) {
  try {
    console.log('[Play in MPV] Menu popup detected in DOM:', popup);

    if (popup.querySelector('.play-in-mpv-menu-item')) {
      console.log('[Play in MPV] Custom menu item already exists in this popup.');
      return;
    }

    console.log('[Play in MPV] Current cached URL for injection:', lastClickedMenuVideoUrl);
    if (!lastClickedMenuVideoUrl) {
      console.warn('[Play in MPV] No cached URL available for this menu popup.');
      return;
    }

    const listbox = popup.querySelector('tp-yt-paper-listbox, #items');
    if (!listbox) {
      console.warn('[Play in MPV] Could not find items container (listbox) inside popup menu', popup);
      return;
    }

    const menuItem = createMenuItem(lastClickedMenuVideoUrl);
    listbox.insertBefore(menuItem, listbox.firstChild);
    console.log('[Play in MPV] Successfully prepended Play in MPV option to dropdown listbox.');
  } catch (err) {
    console.warn('[Play in MPV] Three-dot menu injection failed:', err);
  }
}

function setupMenuObserver() {
  const observer = new MutationObserver((mutations) => {
    try {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const popup = node.querySelector('ytd-menu-popup-renderer');
          if (popup) {
            injectIntoThreeDotMenu(popup);
          } else if (node.tagName === 'YTD-MENU-POPUP-RENDERER') {
            injectIntoThreeDotMenu(node);
          }
        }
      }
    } catch (err) {
      console.warn('[Play in MPV] MutationObserver failed:', err);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ---------------------------------------------------------------------------
// SPA navigation — YouTube fires yt-navigate-finish on every "page" change
// ---------------------------------------------------------------------------

function handleNavigation() {
  if (window.location.pathname.startsWith('/watch')) {
    attemptInjection();
  }
}

window.addEventListener('yt-navigate-finish', handleNavigation);

// Also attempt injection on initial load (in case we land directly on /watch)
handleNavigation();

// Set up MutationObserver for three-dot menu dropdowns
setupMenuObserver();
