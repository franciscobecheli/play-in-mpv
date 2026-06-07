/**
 * Play in MPV — Popup Script
 * 
 * Handles loading configuration settings from local storage, updating form values,
 * registering listeners to auto-save values, and showing saving toast feedback.
 */

// Default settings definitions
const DEFAULT_SETTINGS = {
  qualityCap: 'best',
  hwdec: 'auto',
  savePosition: true,
  autoPause: true,
  alwaysOnTop: false,
  borderless: false,
  fullscreen: false,
  forceWindow: true,
  mpvPath: '',
  customFlags: '',
  shortcutEnabled: true,
  shortcutKey: 'Alt+P'
};

// UI Element selectors
const elements = {
  qualityCap: document.getElementById('qualityCap'),
  hwdec: document.getElementById('hwdec'),
  savePosition: document.getElementById('savePosition'),
  autoPause: document.getElementById('autoPause'),
  alwaysOnTop: document.getElementById('alwaysOnTop'),
  borderless: document.getElementById('borderless'),
  fullscreen: document.getElementById('fullscreen'),
  forceWindow: document.getElementById('forceWindow'),
  mpvPath: document.getElementById('mpvPath'),
  customFlags: document.getElementById('customFlags'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toastText'),
  toastSuccessIcon: document.getElementById('toastSuccessIcon'),
  toastErrorIcon: document.getElementById('toastErrorIcon'),
  playCurrentTabBtn: document.getElementById('playCurrentTabBtn'),
  playBtnText: document.getElementById('playBtnText'),
  playWarning: document.getElementById('playWarning'),
  warningText: document.getElementById('warningText'),
  spinnerContainer: document.querySelector('.spinner-container'),
  shortcutEnabled: document.getElementById('shortcutEnabled'),
  shortcutKeyBtn: document.getElementById('shortcutKeyBtn'),
  shortcutKeyRow: document.getElementById('shortcutKeyRow'),
  ytdlWarningBanner: document.getElementById('ytdlWarningBanner'),
  warningBannerText: document.getElementById('warningBannerText')
};

let toastTimeout = null;
let saveDebounceTimer = null;
let currentTabUrl = '';

// DRM Domain validation lists
const DRM_RULES = [
  { name: 'Netflix', pattern: /netflix\.com/i },
  { name: 'Prime Video', pattern: /(primevideo\.com|amazon\.[a-z\.]+\/(gp\/video|show|video))/i },
  { name: 'Disney+', pattern: /disneyplus\.com/i },
  { name: 'Max', pattern: /max\.com/i },
  { name: 'Hulu', pattern: /hulu\.com/i },
  { name: 'Apple TV', pattern: /(tv\.apple\.com|apple\.com\/apple-tv-plus)/i },
  { name: 'Paramount+', pattern: /paramountplus\.com/i },
  { name: 'Peacock', pattern: /peacocktv\.com/i }
];

/**
 * Show confirmation or error toast feedback.
 * Debounces calls to prevent blinking on rapid updates.
 */
function showToast(message, isError = false, autoDismiss = true) {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  
  elements.toastText.textContent = message;
  
  if (isError) {
    elements.toastSuccessIcon.classList.add('hidden');
    elements.toastErrorIcon.classList.remove('hidden');
  } else {
    elements.toastSuccessIcon.classList.remove('hidden');
    elements.toastErrorIcon.classList.add('hidden');
  }
  
  elements.toast.classList.add('show');
  
  if (autoDismiss) {
    toastTimeout = setTimeout(() => {
      elements.toast.classList.remove('show');
    }, isError ? 3000 : 1500);
  }
}

/**
 * Verify URL playability and DRM status.
 */
function checkUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { status: 'invalid', message: 'Cannot play on internal browser pages.' };
    }
    
    for (const rule of DRM_RULES) {
      if (rule.pattern.test(urlStr)) {
        return { status: 'drm', message: `DRM protected stream — ${rule.name} is not supported.` };
      }
    }
    
    return { status: 'valid', hostname: url.hostname };
  } catch (e) {
    return { status: 'invalid', message: 'Invalid active tab URL.' };
  }
}

/**
 * Detect active tab and set up Play button state.
 */
async function initPlayCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      elements.playBtnText.textContent = 'No active tab found';
      elements.playCurrentTabBtn.disabled = true;
      return;
    }
    
    const tab = tabs[0];
    currentTabUrl = tab.url || '';
    
    const check = checkUrl(currentTabUrl);
    
    if (check.status === 'invalid') {
      elements.playBtnText.textContent = 'Cannot play current tab';
      elements.playCurrentTabBtn.disabled = true;
      elements.playWarning.classList.remove('hidden');
      elements.warningText.textContent = check.message;
    } else if (check.status === 'drm') {
      let displayHost = '';
      try {
        displayHost = new URL(currentTabUrl).hostname.replace('www.', '');
      } catch (e) {
        displayHost = 'current page';
      }
      elements.playBtnText.textContent = `Play ${displayHost} in MPV`;
      elements.playCurrentTabBtn.disabled = true;
      elements.playWarning.classList.remove('hidden');
      elements.warningText.textContent = check.message;
    } else {
      const displayHost = check.hostname.replace('www.', '');
      elements.playBtnText.textContent = `Play ${displayHost} in MPV`;
      elements.playCurrentTabBtn.disabled = false;
      elements.playWarning.classList.add('hidden');
    }
  } catch (err) {
    console.error('[Play in MPV] Error loading current tab:', err);
    elements.playBtnText.textContent = 'Error loading tab info';
    elements.playCurrentTabBtn.disabled = true;
  }
}

/**
 * Helper to update the system warning banner content and visibility based on requirements check.
 */
function updateWarningBanner(ytdlMissing, mpvMissing, hostMissing = false) {
  if (hostMissing) {
    elements.ytdlWarningBanner.classList.remove('hidden');
    elements.warningBannerText.innerHTML = '<strong>Native Host Not Connected:</strong> The local bridge is missing or failed to connect. <a href="https://franciscobecheli.github.io/play-in-mpv/" target="_blank" style="color: #60a5fa; text-decoration: underline; font-weight: 500;">Download & Install Setup Guide</a>';
  } else if (ytdlMissing || mpvMissing) {
    elements.ytdlWarningBanner.classList.remove('hidden');
    if (ytdlMissing && mpvMissing) {
      elements.warningBannerText.innerHTML = '<strong>System Warning:</strong> Both <code>mpv</code> and <code>yt-dlp</code> were not found on your system. Web playback will fail. Please install them.';
    } else if (ytdlMissing) {
      elements.warningBannerText.innerHTML = '<strong>System Warning:</strong> <code>yt-dlp</code> was not found on your system. Web playback will fail. Please install it.';
    } else {
      elements.warningBannerText.innerHTML = '<strong>System Warning:</strong> <code>mpv</code> was not found on your system. Web playback will fail. Please install it.';
    }
  } else {
    elements.ytdlWarningBanner.classList.add('hidden');
  }
}

/**
 * Query the background script to check if yt-dlp or mpv are missing.
 */
async function checkSystemStatus() {
  try {
    const res = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
    });
    if (res && res.ok && res.response) {
      updateWarningBanner(!!res.response.ytdl_missing, !!res.response.mpv_missing, false);
    } else if (res && !res.ok) {
      updateWarningBanner(false, false, true);
    } else {
      updateWarningBanner(false, false, false);
    }
  } catch (err) {
    console.error('[Play in MPV] Failed to check system status:', err);
    updateWarningBanner(false, false, true);
  }
}

/**
 * Read settings from storage and populate the inputs.
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
    
    elements.qualityCap.value = settings.qualityCap;
    elements.hwdec.value = settings.hwdec;
    elements.savePosition.checked = settings.savePosition;
    elements.autoPause.checked = settings.autoPause;
    elements.alwaysOnTop.checked = settings.alwaysOnTop;
    elements.borderless.checked = settings.borderless;
    elements.fullscreen.checked = settings.fullscreen;
    elements.forceWindow.checked = settings.forceWindow;
    elements.mpvPath.value = settings.mpvPath;
    elements.customFlags.value = settings.customFlags;
    elements.shortcutEnabled.checked = settings.shortcutEnabled;
    elements.shortcutKeyBtn.textContent = settings.shortcutKey;
    
    if (settings.shortcutEnabled) {
      elements.shortcutKeyRow.classList.remove('disabled');
      elements.shortcutKeyBtn.disabled = false;
    } else {
      elements.shortcutKeyRow.classList.add('disabled');
      elements.shortcutKeyBtn.disabled = true;
    }
  } catch (err) {
    console.error('[Play in MPV] Failed to load settings:', err);
  }
}

/**
 * Gather form values and save them to storage.
 */
async function saveSettings() {
  const updatedSettings = {
    qualityCap: elements.qualityCap.value,
    hwdec: elements.hwdec.value,
    savePosition: elements.savePosition.checked,
    autoPause: elements.autoPause.checked,
    alwaysOnTop: elements.alwaysOnTop.checked,
    borderless: elements.borderless.checked,
    fullscreen: elements.fullscreen.checked,
    forceWindow: elements.forceWindow.checked,
    mpvPath: elements.mpvPath.value.trim(),
    customFlags: elements.customFlags.value,
    shortcutEnabled: elements.shortcutEnabled.checked,
    shortcutKey: elements.shortcutKeyBtn.textContent
  };

  try {
    await chrome.storage.local.set(updatedSettings);
    showToast('Settings saved');
  } catch (err) {
    console.error('[Play in MPV] Failed to save settings:', err);
  }
}

let isRecording = false;

function startRecording() {
  if (isRecording) return;
  isRecording = true;
  elements.shortcutKeyBtn.classList.add('recording');
  elements.shortcutKeyBtn.textContent = 'Press keys...';
  document.addEventListener('keydown', handleShortcutRecord, true);
}

function stopRecording(cancelled = false, newShortcut = '') {
  if (!isRecording) return;
  isRecording = false;
  elements.shortcutKeyBtn.classList.remove('recording');
  document.removeEventListener('keydown', handleShortcutRecord, true);

  if (!cancelled && newShortcut) {
    elements.shortcutKeyBtn.textContent = newShortcut;
    saveSettings();
  } else {
    chrome.storage.local.get({ shortcutKey: 'Alt+P' }, (settings) => {
      elements.shortcutKeyBtn.textContent = settings.shortcutKey;
    });
  }
}

function handleShortcutRecord(e) {
  e.preventDefault();
  e.stopPropagation();

  const key = e.key;

  if (key === 'Escape') {
    stopRecording(true);
    return;
  }

  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    let parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    parts.push('...');
    elements.shortcutKeyBtn.textContent = parts.join('+');
    return;
  }

  let parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let keyName = key;
  if (key === ' ') {
    keyName = 'Space';
  } else if (key.length === 1) {
    keyName = key.toUpperCase();
  }

  parts.push(keyName);
  const newShortcut = parts.join('+');
  stopRecording(false, newShortcut);
}

/**
 * Setup event listeners for inputs
 */
function setupListeners() {
  // Dismiss toast on click
  elements.toast.addEventListener('click', () => {
    elements.toast.classList.remove('show');
    if (toastTimeout) {
      clearTimeout(toastTimeout);
      toastTimeout = null;
    }
  });

  // No close option for ytdlWarningBanner as per requirements

  // Save immediately on changes to options/dropdowns/switches
  const immediateSaveList = [
    elements.qualityCap,
    elements.hwdec,
    elements.savePosition,
    elements.autoPause,
    elements.alwaysOnTop,
    elements.borderless,
    elements.fullscreen,
    elements.forceWindow,
    elements.shortcutEnabled
  ];

  immediateSaveList.forEach(input => {
    input.addEventListener('change', () => {
      saveSettings();
    });
  });

  elements.shortcutEnabled.addEventListener('change', () => {
    const enabled = elements.shortcutEnabled.checked;
    if (enabled) {
      elements.shortcutKeyRow.classList.remove('disabled');
      elements.shortcutKeyBtn.disabled = false;
    } else {
      elements.shortcutKeyRow.classList.add('disabled');
      elements.shortcutKeyBtn.disabled = true;
      stopRecording(true);
    }
  });

  elements.shortcutKeyBtn.addEventListener('click', () => {
    startRecording();
  });

  // Debounce saves for keyboard input fields to prevent excessive storage writes
  const debouncedSaveList = [
    elements.mpvPath,
    elements.customFlags
  ];

  debouncedSaveList.forEach(input => {
    input.addEventListener('input', () => {
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
      }
      saveDebounceTimer = setTimeout(() => {
        saveSettings();
      }, 350);
    });
  });

  // Listener for the "Play Current Tab" button
  elements.playCurrentTabBtn.addEventListener('click', async () => {
    if (!currentTabUrl) return;

    elements.playCurrentTabBtn.disabled = true;
    elements.playCurrentTabBtn.classList.add('loading');
    elements.spinnerContainer.classList.remove('hidden');

    try {
      const res = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'PLAY_IN_MPV', url: currentTabUrl }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (res && !res.ok) {
            reject(new Error(res.error || 'Failed to open video in MPV'));
          } else {
            resolve(res);
          }
        });
      });
      showToast('Launching MPV...');
    } catch (err) {
      console.error('[Play in MPV] Play current tab error:', err);
      showToast(err.message || 'Failed to launch MPV', true);
    } finally {
      elements.playCurrentTabBtn.classList.remove('loading');
      elements.spinnerContainer.classList.add('hidden');
      initPlayCurrentTab();
    }
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupListeners();
  initPlayCurrentTab();
  checkSystemStatus();
});
