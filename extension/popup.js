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
  customFlags: ''
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
  toast: document.getElementById('toast')
};

let toastTimeout = null;
let saveDebounceTimer = null;

/**
 * Show a brief "Saved" confirmation toast.
 * Debounces calls to prevent blinking on rapid updates.
 */
function showSavedToast() {
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  
  elements.toast.classList.add('show');
  
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 1200);
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
    customFlags: elements.customFlags.value
  };

  try {
    await chrome.storage.local.set(updatedSettings);
    showSavedToast();
  } catch (err) {
    console.error('[Play in MPV] Failed to save settings:', err);
  }
}

/**
 * Setup event listeners for inputs
 */
function setupListeners() {
  // Save immediately on changes to options/dropdowns/switches
  const immediateSaveList = [
    elements.qualityCap,
    elements.hwdec,
    elements.savePosition,
    elements.autoPause,
    elements.alwaysOnTop,
    elements.borderless,
    elements.fullscreen,
    elements.forceWindow
  ];

  immediateSaveList.forEach(input => {
    input.addEventListener('change', () => {
      saveSettings();
    });
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
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  setupListeners();
});
