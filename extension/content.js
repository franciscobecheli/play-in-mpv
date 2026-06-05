/**
 * Play in MPV — content script
 *
 * Injects a native-styled "Play in MPV" button into the YouTube player
 * control bar. Handles SPA navigation via the yt-navigate-finish event.
 */

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
        fill="none" stroke="white" stroke-width="1.5"/>
  <!-- Play triangle centred inside the screen -->
  <polygon points="14,13 14,20 23,16.5" fill="white"/>
  <!-- Small base/stand below the screen -->
  <line x1="18" y1="24" x2="18" y2="27" stroke="white" stroke-width="1.5"/>
  <line x1="13" y1="27" x2="23" y2="27" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
</svg>`.trim();

const MPV_SPINNER_SVG = `
<svg class="mpv-btn-spinner" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
  <!-- Spinner base track -->
  <circle cx="18" cy="18" r="12" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="3"/>
  <!-- Rotating arc -->
  <circle cx="18" cy="18" r="12" fill="none" stroke="white" stroke-width="3"
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
// Click handler — send native message to launch mpv
// ---------------------------------------------------------------------------

function onButtonClick() {
  if (isLoading) return;

  const btn = document.getElementById(BUTTON_ID);
  if (!btn) return;

  try {
    const url = window.location.href;

    isLoading = true;
    btn.classList.add('loading');
    btn.style.cursor = 'not-allowed';

    const startTime = Date.now();

    // Content scripts cannot call sendNativeMessage directly — relay via the
    // background service worker which has access to the native messaging API.
    chrome.runtime.sendMessage({ type: 'PLAY_IN_MPV', url }, (response) => {
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
