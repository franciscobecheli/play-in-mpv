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

function launchCurrentVideo() {
  if (isLoading) return;

  const url = window.location.href;
  const path = window.location.pathname;
  if (!path.startsWith('/watch') && !path.startsWith('/shorts')) {
    console.log('[Play in MPV] Shortcut ignored: Not on a watch or shorts page.');
    return;
  }

  const btn = document.getElementById(BUTTON_ID);

  try {
    // Auto-pause if configured
    handleAutoPauseIfCurrent(url);

    chrome.storage.local.get({ forceWindow: true }, (settings) => {
      const showSpinner = !settings.forceWindow;

      if (showSpinner && btn) {
        isLoading = true;
        btn.classList.add('loading');
        btn.style.cursor = 'not-allowed';
      }

      const startTime = Date.now();

      chrome.runtime.sendMessage({ type: 'PLAY_IN_MPV', url }, (response) => {
        if (showSpinner && btn) {
          const elapsed = Date.now() - startTime;
          const minDuration = 3500; // 3.5s minimum spinner show time
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
    console.error('[Play in MPV] launchCurrentVideo threw:', err);
    isLoading = false;
    if (btn) {
      btn.classList.remove('loading');
      btn.style.cursor = '';
    }
  }
}

function onButtonClick() {
  launchCurrentVideo();
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



// ---------------------------------------------------------------------------
// Keyboard shortcut handling
// ---------------------------------------------------------------------------
let shortcutEnabled = true;
let shortcutKey = 'Alt+P';

function updateSettingsFromStorage() {
  chrome.storage.local.get({
    shortcutEnabled: true,
    shortcutKey: 'Alt+P'
  }, (settings) => {
    shortcutEnabled = settings.shortcutEnabled;
    shortcutKey = settings.shortcutKey;
  });
}

updateSettingsFromStorage();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes.shortcutEnabled) {
    shortcutEnabled = changes.shortcutEnabled.newValue;
  }
  if (changes.shortcutKey) {
    shortcutKey = changes.shortcutKey.newValue;
  }
});

function matchShortcut(e, shortcutStr) {
  if (!shortcutStr) return false;

  const parts = shortcutStr.split('+');
  let targetKey = parts[parts.length - 1];

  if (targetKey === '' && parts.length > 1) {
    targetKey = '+';
  }

  const hasCtrl = parts.includes('Ctrl');
  const hasAlt = parts.includes('Alt');
  const hasShift = parts.includes('Shift');
  const hasMeta = parts.includes('Meta');

  if (e.ctrlKey !== hasCtrl) return false;
  if (e.altKey !== hasAlt) return false;
  if (e.shiftKey !== hasShift) return false;
  if (e.metaKey !== hasMeta) return false;

  const eventKey = e.key;
  if (targetKey === 'Space') {
    return eventKey === ' ';
  }

  return eventKey.toUpperCase() === targetKey.toUpperCase();
}

function handleKeyDown(e) {
  if (!shortcutEnabled) return;

  const activeEl = document.activeElement;
  if (activeEl) {
    const tagName = activeEl.tagName.toLowerCase();
    const isInput = tagName === 'input' || 
                    tagName === 'textarea' || 
                    activeEl.isContentEditable || 
                    activeEl.getAttribute('contenteditable') === 'true';
    if (isInput) return;
  }

  if (matchShortcut(e, shortcutKey)) {
    e.preventDefault();
    e.stopPropagation();
    launchCurrentVideo();
  }
}

window.addEventListener('keydown', handleKeyDown, { capture: true });
