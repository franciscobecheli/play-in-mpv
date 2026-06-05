/**
 * Play in MPV — Service Worker (background)
 *
 * Relays native messaging calls from the content script.
 * Content scripts cannot call chrome.runtime.sendNativeMessage directly;
 * only extension pages / service workers can.
 */

const NATIVE_HOST = 'com.playinmpv.host';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'PLAY_IN_MPV') return false;

  (async () => {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendNativeMessage(NATIVE_HOST, { url: message.url }, (res) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(res);
          }
        });
      });
      sendResponse({ ok: true, response });
    } catch (err) {
      console.error('[Play in MPV] Native messaging error:', err.message);
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // Keep the message channel open for async sendResponse
});
