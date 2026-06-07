const fs = require('fs');
const path = require('path');

describe('Popup Settings UI', () => {
  let checkUrl;

  beforeEach(() => {
    jest.clearAllMocks();

    // Load HTML layout
    const html = fs.readFileSync(path.resolve(__dirname, '../extension/popup.html'), 'utf8');
    document.documentElement.innerHTML = html;

    // Mock Chrome APIs
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((keys, cb) => {
            const defaults = typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
            if (typeof cb === 'function') cb(defaults);
            return Promise.resolve(defaults);
          }),
          set: jest.fn((data, cb) => {
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          })
        }
      },
      tabs: {
        query: jest.fn((queryInfo, cb) => {
          const tabs = [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }];
          if (typeof cb === 'function') cb(tabs);
          return Promise.resolve(tabs);
        })
      },
      runtime: {
        sendMessage: jest.fn((payload, cb) => {
          const response = { ok: true };
          if (typeof cb === 'function') cb(response);
          return Promise.resolve(response);
        }),
        lastError: null
      }
    };

    // Load and execute popup.js in local scope, extracting functions
    const popupScript = fs.readFileSync(path.resolve(__dirname, '../extension/popup.js'), 'utf8');
    const runPopup = new Function(
      popupScript + '\nreturn { checkUrl };'
    );
    const exports = runPopup();
    checkUrl = exports.checkUrl;
  });

  describe('checkUrl validation rules', () => {
    it('should allow valid http and https URLs', () => {
      const result = checkUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(result.status).toBe('valid');
      expect(result.hostname).toBe('www.youtube.com');
    });

    it('should reject non-http/https internal schemes', () => {
      const result = checkUrl('chrome://extensions');
      expect(result.status).toBe('invalid');
      expect(result.message).toContain('Cannot play on internal browser pages');
    });

    it('should reject DRM-protected domains', () => {
      const resultNetflix = checkUrl('https://www.netflix.com/watch/123');
      expect(resultNetflix.status).toBe('drm');
      expect(resultNetflix.message).toContain('DRM protected stream — Netflix');

      const resultDisney = checkUrl('https://www.disneyplus.com/video/123');
      expect(resultDisney.status).toBe('drm');
      expect(resultDisney.message).toContain('DRM protected');
    });
  });

  describe('Settings load and save binding', () => {
    it('should load settings from storage and populate form fields', async () => {
      const mockSettings = {
        qualityCap: '1080p',
        hwdec: 'disabled',
        savePosition: false,
        autoPause: true,
        alwaysOnTop: true,
        borderless: true,
        fullscreen: false,
        forceWindow: true,
        mpvPath: '/usr/bin/mpv',
        customFlags: '--volume=90',
        shortcutEnabled: true,
        shortcutKey: 'Ctrl+Shift+Y'
      };

      chrome.storage.local.get.mockImplementation((keys, cb) => {
        const res = { ...keys, ...mockSettings };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      // Dispatch DOMContentLoaded to trigger initial load
      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      expect(document.getElementById('qualityCap').value).toBe('1080p');
      expect(document.getElementById('hwdec').value).toBe('disabled');
      expect(document.getElementById('savePosition').checked).toBe(false);
      expect(document.getElementById('alwaysOnTop').checked).toBe(true);
      expect(document.getElementById('mpvPath').value).toBe('/usr/bin/mpv');
      expect(document.getElementById('customFlags').value).toBe('--volume=90');
      expect(document.getElementById('shortcutKeyBtn').textContent).toBe('Ctrl+Shift+Y');
      expect(document.getElementById('shortcutKeyRow').classList.contains('disabled')).toBe(false);
    });

    it('should call chrome.storage.local.set immediately when simple settings change', () => {
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const qualityCap = document.getElementById('qualityCap');
      qualityCap.value = '720p';
      qualityCap.dispatchEvent(new Event('change'));

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ qualityCap: '720p' })
      );
    });

    it('should debounce input saves for text fields (mpvPath, customFlags)', () => {
      jest.useFakeTimers();
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const mpvPath = document.getElementById('mpvPath');
      mpvPath.value = '/opt/mpv';
      mpvPath.dispatchEvent(new Event('input'));

      // Should not save immediately due to 350ms debounce
      expect(chrome.storage.local.set).not.toHaveBeenCalled();

      // Fast-forward by 350ms
      jest.advanceTimersByTime(350);

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ mpvPath: '/opt/mpv' })
      );
      jest.useRealTimers();
    });
  });

  describe('Active Tab detection and Play button behavior', () => {
    it('should enable play button if active tab is playable', async () => {
      chrome.tabs.query.mockImplementation((info, cb) => {
        const tabs = [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }];
        if (typeof cb === 'function') cb(tabs);
        return Promise.resolve(tabs);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const playBtn = document.getElementById('playCurrentTabBtn');
      const btnText = document.getElementById('playBtnText');
      const warning = document.getElementById('playWarning');

      expect(playBtn.disabled).toBe(false);
      expect(btnText.textContent).toBe('Play youtube.com in MPV');
      expect(warning.classList.contains('hidden')).toBe(true);
    });

    it('should disable play button and show warning for DRM domains', async () => {
      chrome.tabs.query.mockImplementation((info, cb) => {
        const tabs = [{ url: 'https://www.netflix.com/watch/123' }];
        if (typeof cb === 'function') cb(tabs);
        return Promise.resolve(tabs);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const playBtn = document.getElementById('playCurrentTabBtn');
      const btnText = document.getElementById('playBtnText');
      const warning = document.getElementById('playWarning');
      const warningText = document.getElementById('warningText');

      expect(playBtn.disabled).toBe(true);
      expect(btnText.textContent).toBe('Play netflix.com in MPV');
      expect(warning.classList.contains('hidden')).toBe(false);
      expect(warningText.textContent).toContain('DRM protected');
    });

    it('should launch current tab in MPV when clicking the Play button', async () => {
      chrome.tabs.query.mockImplementation((info, cb) => {
        const tabs = [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }];
        if (typeof cb === 'function') cb(tabs);
        return Promise.resolve(tabs);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const playBtn = document.getElementById('playCurrentTabBtn');
      playBtn.dispatchEvent(new Event('click'));

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'PLAY_IN_MPV', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        expect.any(Function)
      );

      // Verify loader spinner class is added
      expect(playBtn.classList.contains('loading')).toBe(true);
    });
  });

  describe('Keyboard shortcut recorder', () => {
    it('should toggle recording state on shortcut button click', () => {
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const btn = document.getElementById('shortcutKeyBtn');
      expect(btn.classList.contains('recording')).toBe(false);

      btn.dispatchEvent(new Event('click'));

      expect(btn.classList.contains('recording')).toBe(true);
      expect(btn.textContent).toBe('Press keys...');
    });

    it('should record key combinations and save settings', () => {
      document.dispatchEvent(new Event('DOMContentLoaded'));

      const btn = document.getElementById('shortcutKeyBtn');
      btn.dispatchEvent(new Event('click')); // start recording

      // Dispatch 'keydown' event for Ctrl
      let event = new KeyboardEvent('keydown', { key: 'Control', ctrlKey: true, bubbles: true });
      document.dispatchEvent(event);
      expect(btn.textContent).toBe('Ctrl+...');

      // Dispatch 'keydown' event for L key
      event = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true });
      document.dispatchEvent(event);

      expect(btn.classList.contains('recording')).toBe(false);
      expect(btn.textContent).toBe('Ctrl+L');
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ shortcutKey: 'Ctrl+L' })
      );
    });

    it('should revert key mapping if recording is cancelled via Escape', () => {
      chrome.storage.local.get.mockImplementation((keys, cb) => {
        const res = { ...keys, shortcutKey: 'Alt+P' };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));

      const btn = document.getElementById('shortcutKeyBtn');
      btn.dispatchEvent(new Event('click')); // start recording

      // Dispatch Escape
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      document.dispatchEvent(event);

      expect(btn.classList.contains('recording')).toBe(false);
      expect(btn.textContent).toBe('Alt+P'); // restored
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('System status check on popup open', () => {
    it('should show banner and mention both if both mpv and yt-dlp are missing', async () => {
      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        if (payload.type === 'CHECK_STATUS') {
          const res = { ok: true, response: { ytdl_missing: true, mpv_missing: true } };
          if (typeof cb === 'function') cb(res);
          return Promise.resolve(res);
        }
        const res = { ok: true };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const banner = document.getElementById('ytdlWarningBanner');
      const text = document.getElementById('warningBannerText');
      expect(banner.classList.contains('hidden')).toBe(false);
      expect(text.innerHTML).toContain('Both <code>mpv</code> and <code>yt-dlp</code>');
    });

    it('should show banner and mention yt-dlp if only yt-dlp is missing', async () => {
      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        if (payload.type === 'CHECK_STATUS') {
          const res = { ok: true, response: { ytdl_missing: true, mpv_missing: false } };
          if (typeof cb === 'function') cb(res);
          return Promise.resolve(res);
        }
        const res = { ok: true };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const banner = document.getElementById('ytdlWarningBanner');
      const text = document.getElementById('warningBannerText');
      expect(banner.classList.contains('hidden')).toBe(false);
      expect(text.innerHTML).toContain('<code>yt-dlp</code> was not found');
      expect(text.innerHTML).not.toContain('Both <code>mpv</code>');
    });

    it('should show banner and mention mpv if only mpv is missing', async () => {
      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        if (payload.type === 'CHECK_STATUS') {
          const res = { ok: true, response: { ytdl_missing: false, mpv_missing: true } };
          if (typeof cb === 'function') cb(res);
          return Promise.resolve(res);
        }
        const res = { ok: true };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const banner = document.getElementById('ytdlWarningBanner');
      const text = document.getElementById('warningBannerText');
      expect(banner.classList.contains('hidden')).toBe(false);
      expect(text.innerHTML).toContain('<code>mpv</code> was not found');
      expect(text.innerHTML).not.toContain('Both <code>mpv</code>');
    });

    it('should hide banner if neither is missing', async () => {
      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        if (payload.type === 'CHECK_STATUS') {
          const res = { ok: true, response: { ytdl_missing: false, mpv_missing: false } };
          if (typeof cb === 'function') cb(res);
          return Promise.resolve(res);
        }
        const res = { ok: true };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      const banner = document.getElementById('ytdlWarningBanner');
      banner.classList.remove('hidden');

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should show host missing banner if native connection fails', async () => {
      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        if (payload.type === 'CHECK_STATUS') {
          chrome.runtime.lastError = { message: 'Specified native messaging host not found.' };
          if (typeof cb === 'function') cb(null);
          return Promise.resolve(null);
        }
        const res = { ok: true };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await new Promise(process.nextTick);

      const banner = document.getElementById('ytdlWarningBanner');
      const text = document.getElementById('warningBannerText');
      expect(banner.classList.contains('hidden')).toBe(false);
      expect(text.innerHTML).toContain('Native Host Not Connected');
      expect(text.innerHTML).toContain('href="https://franciscobecheli.github.io/play-in-mpv/"');

      chrome.runtime.lastError = null;
    });
  });
});
