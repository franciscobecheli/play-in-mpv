const fs = require('fs');
const path = require('path');

describe('Background Service Worker', () => {
  let cleanYoutubeUrl;
  let launchMpv;
  let DEFAULT_SETTINGS;
  let messageListener;
  let installedListener;
  let contextMenuListener;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup chrome mocks
    global.chrome = {
      storage: {
        local: {
          get: jest.fn()
        }
      },
      runtime: {
        sendNativeMessage: jest.fn(),
        onMessage: {
          addListener: jest.fn((listener) => {
            messageListener = listener;
          })
        },
        onInstalled: {
          addListener: jest.fn((listener) => {
            installedListener = listener;
          })
        },
        lastError: null
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn((listener) => {
            contextMenuListener = listener;
          })
        }
      }
    };

    // Load and execute background.js in local scope
    const bgScript = fs.readFileSync(path.resolve(__dirname, '../extension/background.js'), 'utf8');
    const runBackground = new Function(
      bgScript + '\nreturn { cleanYoutubeUrl, launchMpv, DEFAULT_SETTINGS };'
    );
    const exports = runBackground();
    cleanYoutubeUrl = exports.cleanYoutubeUrl;
    launchMpv = exports.launchMpv;
    DEFAULT_SETTINGS = exports.DEFAULT_SETTINGS;
  });

  describe('cleanYoutubeUrl', () => {
    it('should extract video ID and strip other query params for watch URLs', () => {
      const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=WL';
      const expected = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(cleanYoutubeUrl(input)).toBe(expected);
    });

    it('should return watch URL unchanged if no other query params', () => {
      const input = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(cleanYoutubeUrl(input)).toBe(input);
    });

    it('should return shorts URL unchanged', () => {
      const input = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
      expect(cleanYoutubeUrl(input)).toBe(input);
    });

    it('should return non-YouTube URLs unchanged', () => {
      const input = 'https://example.com/video';
      expect(cleanYoutubeUrl(input)).toBe(input);
    });

    it('should handle malformed URLs gracefully', () => {
      const input = 'not-a-valid-url';
      expect(cleanYoutubeUrl(input)).toBe(input);
    });
  });

  describe('launchMpv', () => {
    it('should fetch settings with DEFAULT_SETTINGS', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb(defaults);
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ ok: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(chrome.storage.local.get).toHaveBeenCalledWith(DEFAULT_SETTINGS, expect.any(Function));
    });

    it('should pass correct default flags to sendNativeMessage', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb(defaults); // default settings
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      await launchMpv(url);

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalledWith(
        'com.playinmpv.host',
        {
          url: url,
          mpv_path: null,
          flags: [
            '--hwdec=auto',
            '--save-position-on-quit',
            '--force-window=immediate'
          ],
          custom_flags: ''
        },
        expect.any(Function)
      );
    });

    it('should configure quality format flag for qualityCap settings', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          qualityCap: '1080p'
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.flags).toContain('--ytdl-format=bestvideo[height<=1080]+bestaudio/best[height<=1080]');
    });

    it('should configure audio-only settings correctly', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          qualityCap: 'audio'
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.flags).toContain('--ytdl-format=bestaudio/best');
      expect(payload.flags).toContain('--force-window=immediate');
    });

    it('should map hardware decoding settings correctly', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          hwdec: 'disabled'
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.flags).toContain('--hwdec=no');
    });

    it('should build toggle flag settings (ontop, borderless, fullscreen)', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          alwaysOnTop: true,
          borderless: true,
          fullscreen: true
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.flags).toContain('--ontop');
      expect(payload.flags).toContain('--border=no');
      expect(payload.flags).toContain('--fs');
    });

    it('should pass custom flags as a raw string in custom_flags payload field', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          customFlags: '--volume=80\n--mute=yes   --no-keepaspect'
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.custom_flags).toBe('--volume=80\n--mute=yes   --no-keepaspect');
      expect(payload.flags).not.toContain('--volume=80');
    });

    it('should include custom mpv path if specified', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb({
          ...defaults,
          mpvPath: '/usr/local/bin/mpv'
        });
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      await launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      const payload = chrome.runtime.sendNativeMessage.mock.calls[0][1];
      expect(payload.mpv_path).toBe('/usr/local/bin/mpv');
    });

    it('should reject when sendNativeMessage returns chrome.runtime.lastError', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        cb(defaults);
      });
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        chrome.runtime.lastError = { message: 'Native host not found' };
        cb(null);
      });

      await expect(launchMpv('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).rejects.toThrow(
        'Native host not found'
      );
    });

    it('should reject URLs with invalid schemes (non-http/https)', async () => {
      await expect(launchMpv('chrome://extensions')).rejects.toThrow(
        'Invalid or unsupported URL'
      );
      expect(chrome.runtime.sendNativeMessage).not.toHaveBeenCalled();
    });

    it('should reject URLs on DRM-protected domains', async () => {
      await expect(launchMpv('https://www.netflix.com/watch/123')).rejects.toThrow(
        'Invalid or unsupported URL'
      );
      expect(chrome.runtime.sendNativeMessage).not.toHaveBeenCalled();
    });
  });

  describe('onMessage Listener', () => {
    it('should return false if message type is not PLAY_IN_MPV', () => {
      const mockSendResponse = jest.fn();
      const result = messageListener({ type: 'OTHER_MESSAGE' }, {}, mockSendResponse);
      expect(result).toBe(false);
      expect(mockSendResponse).not.toHaveBeenCalled();
    });

    it('should return true and route message to launchMpv', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb(defaults));
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        cb({ success: true });
      });

      const mockSendResponse = jest.fn();
      const result = messageListener(
        { type: 'PLAY_IN_MPV', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        {},
        mockSendResponse
      );

      expect(result).toBe(true); // indicates async response

      // Wait for promise resolution internally
      await new Promise(process.nextTick);

      expect(mockSendResponse).toHaveBeenCalledWith({
        ok: true,
        response: { success: true }
      });
    });

    it('should call sendResponse with ok: false if launchMpv fails', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb(defaults));
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => {
        chrome.runtime.lastError = { message: 'Failed to launch host process' };
        cb(null);
      });

      const mockSendResponse = jest.fn();
      messageListener(
        { type: 'PLAY_IN_MPV', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        {},
        mockSendResponse
      );

      await new Promise(process.nextTick);

      expect(mockSendResponse).toHaveBeenCalledWith({
        ok: false,
        error: 'Failed to launch host process'
      });
    });
  });

  describe('Context Menu Options', () => {
    it('should create context menu item on install', () => {
      expect(installedListener).toBeDefined();
      installedListener();
      expect(chrome.contextMenus.create).toHaveBeenCalledWith({
        id: 'play-in-mpv-context',
        title: 'Open Link in MPV',
        contexts: ['link'],
        targetUrlPatterns: [
          '*://*.youtube.com/watch*',
          '*://*.youtube.com/shorts*',
          '*://youtube.com/watch*',
          '*://youtube.com/shorts*'
        ]
      });
    });

    it('should call launchMpv when context menu item clicked with valid linkUrl', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb(defaults));
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => cb({ success: true }));

      expect(contextMenuListener).toBeDefined();
      await contextMenuListener(
        { menuItemId: 'play-in-mpv-context', linkUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        {}
      );

      expect(chrome.runtime.sendNativeMessage).toHaveBeenCalled();
    });

    it('should not call launchMpv if menuItemId does not match', async () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb(defaults));
      chrome.runtime.sendNativeMessage.mockImplementation((host, payload, cb) => cb({ success: true }));

      expect(contextMenuListener).toBeDefined();
      await contextMenuListener(
        { menuItemId: 'other-context', linkUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        {}
      );

      expect(chrome.runtime.sendNativeMessage).not.toHaveBeenCalled();
    });
  });
});
