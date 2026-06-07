/**
 * Play in MPV — Service Worker (background)
 *
 * Relays native messaging calls from the content script.
 * Content scripts cannot call chrome.runtime.sendNativeMessage directly;
 * only extension pages / service workers can.
 */

const NATIVE_HOST = 'com.playinmpv.host';

function cleanYoutubeUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v');
      if (videoId) {
        const clean = new URL(url.origin + url.pathname);
        clean.searchParams.set('v', videoId);
        return clean.href;
      }
    }
  } catch (e) {
    // Ignore error
  }
  return urlStr;
}

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

function isValidUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    for (const rule of DRM_RULES) {
      if (rule.pattern.test(urlStr)) {
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

function launchMpv(url) {
  if (!isValidUrl(url)) {
    return Promise.reject(new Error('Invalid or unsupported URL'));
  }
  const cleanUrl = cleanYoutubeUrl(url);
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
      const flags = [];

      // Quality cap
      if (settings.qualityCap && settings.qualityCap !== 'best') {
        let formatStr = '';
        if (settings.qualityCap === 'audio') {
          formatStr = 'bestaudio/best';
          flags.push('--force-window=immediate');
        } else {
          const height = settings.qualityCap.replace('p', '');
          formatStr = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
        }
        flags.push(`--ytdl-format=${formatStr}`);
      }

      // Hardware decoding
      if (settings.hwdec === 'disabled') {
        flags.push('--hwdec=no');
      } else if (settings.hwdec === 'auto' || settings.hwdec === 'auto-safe') {
        flags.push(`--hwdec=${settings.hwdec}`);
      }

      // Save position
      if (settings.savePosition) {
        flags.push('--save-position-on-quit');
      }

      // Always on top
      if (settings.alwaysOnTop) {
        flags.push('--ontop');
      }

      // Borderless
      if (settings.borderless) {
        flags.push('--border=no');
      }

      // Fullscreen
      if (settings.fullscreen) {
        flags.push('--fs');
      }

      // Force immediate window creation
      if (settings.forceWindow && !flags.includes('--force-window=immediate')) {
        flags.push('--force-window=immediate');
      }

      const payload = {
        url: cleanUrl,
        mpv_path: settings.mpvPath || null,
        flags: flags,
        custom_flags: settings.customFlags || ''
      };

      chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
    });
  });
}

// Handle messages from content scripts / popups
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_STATUS') {
    (async () => {
      try {
        chrome.storage.local.get(DEFAULT_SETTINGS, (settings) => {
          const payload = {
            type: 'CHECK_STATUS',
            mpv_path: settings.mpvPath || null
          };
          chrome.runtime.sendNativeMessage(NATIVE_HOST, payload, (res) => {
            if (chrome.runtime.lastError) {
              sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            } else {
              sendResponse({ ok: true, response: res });
            }
          });
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async sendResponse
  }

  if (message.type !== 'PLAY_IN_MPV') return false;

  (async () => {
    try {
      const response = await launchMpv(message.url);
      sendResponse({ ok: true, response });
    } catch (err) {
      console.error('[Play in MPV] Native messaging error:', err.message);
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // Keep message channel open for async sendResponse
});

// Setup context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "play-in-mpv-context",
    title: "Open Link in MPV",
    contexts: ["link"],
    targetUrlPatterns: [
      "*://*.youtube.com/watch*",
      "*://*.youtube.com/shorts*",
      "*://youtube.com/watch*",
      "*://youtube.com/shorts*"
    ]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === "play-in-mpv-context" && info.linkUrl) {
    try {
      await launchMpv(info.linkUrl);
    } catch (err) {
      console.error('[Play in MPV] Context menu launch failed:', err.message);
    }
  }
});
