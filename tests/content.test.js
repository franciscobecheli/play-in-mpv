const fs = require('fs');
const path = require('path');

describe('Content Script', () => {
  let matchShortcut;
  let handleAutoPauseIfCurrent;
  let attemptInjection;
  let launchCurrentVideo;
  let storageOnChangedListener;

  let originalAddEventListener;
  let originalDocAddEventListener;
  let windowListeners = [];
  let documentListeners = [];
  let OriginalMutationObserver;
  let observers = [];

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    // Redefine location so we can modify it
    delete window.location;
    window.location = new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Reset document DOM
    document.head.innerHTML = '';
    document.body.innerHTML = '';

    // Save originals and mock addEventListener to capture registrations for cleanup
    originalAddEventListener = window.addEventListener;
    originalDocAddEventListener = document.addEventListener;
    windowListeners = [];
    documentListeners = [];

    window.addEventListener = jest.fn((type, listener, options) => {
      windowListeners.push({ type, listener, options });
      originalAddEventListener.call(window, type, listener, options);
    });

    document.addEventListener = jest.fn((type, listener, options) => {
      documentListeners.push({ type, listener, options });
      originalDocAddEventListener.call(document, type, listener, options);
    });

    // Capture MutationObservers to disconnect them after each test
    OriginalMutationObserver = global.MutationObserver;
    observers = [];
    global.MutationObserver = class {
      constructor(callback) {
        this.observer = new OriginalMutationObserver(callback);
        observers.push(this.observer);
      }
      observe(target, options) {
        this.observer.observe(target, options);
      }
      disconnect() {
        this.observer.disconnect();
      }
    };

    // Mock chrome APIs
    global.chrome = {
      storage: {
        local: {
          get: jest.fn((defaults, cb) => cb(defaults)),
          set: jest.fn((data, cb) => cb && cb())
        },
        onChanged: {
          addListener: jest.fn((listener) => {
            storageOnChangedListener = listener;
          })
        }
      },
      runtime: {
        sendMessage: jest.fn((payload, cb) => {
          cb({ ok: true });
        }),
        lastError: null
      }
    };

    // Load content.js and extract helper functions
    const contentScript = fs.readFileSync(path.resolve(__dirname, '../extension/content.js'), 'utf8');
    const runContent = new Function(
      contentScript + '\nreturn { matchShortcut, handleAutoPauseIfCurrent, attemptInjection, launchCurrentVideo };'
    );
    const exports = runContent();
    matchShortcut = exports.matchShortcut;
    handleAutoPauseIfCurrent = exports.handleAutoPauseIfCurrent;
    attemptInjection = exports.attemptInjection;
    launchCurrentVideo = exports.launchCurrentVideo;
  });

  afterEach(() => {
    jest.useRealTimers();

    // Remove event listeners registered during this test
    windowListeners.forEach(({ type, listener, options }) => {
      window.removeEventListener(type, listener, options);
    });
    documentListeners.forEach(({ type, listener, options }) => {
      document.removeEventListener(type, listener, options);
    });

    // Restore original listener functions
    window.addEventListener = originalAddEventListener;
    document.addEventListener = originalDocAddEventListener;

    // Disconnect and cleanup MutationObservers
    observers.forEach(obs => obs.disconnect());
    global.MutationObserver = OriginalMutationObserver;
  });

  describe('attemptInjection', () => {
    it('should retry after 300ms if .ytp-right-controls is not present', () => {
      attemptInjection();
      expect(document.getElementById('play-in-mpv-player-button')).toBeNull();

      // Setup container
      const controls = document.createElement('div');
      controls.className = 'ytp-right-controls';
      document.body.appendChild(controls);

      // Fast-forward 300ms
      jest.advanceTimersByTime(300);

      expect(document.getElementById('play-in-mpv-player-button')).not.toBeNull();
    });

    it('should inject button immediately if container is present', () => {
      const controls = document.createElement('div');
      controls.className = 'ytp-right-controls';
      document.body.appendChild(controls);

      attemptInjection();

      const btn = document.getElementById('play-in-mpv-player-button');
      expect(btn).not.toBeNull();
      expect(btn.className).toContain('ytp-button');
      expect(btn.title).toBe('Play in MPV');
    });

    it('should not inject duplicate buttons', () => {
      const controls = document.createElement('div');
      controls.className = 'ytp-right-controls';
      document.body.appendChild(controls);

      attemptInjection();
      attemptInjection();

      const buttons = document.querySelectorAll('#play-in-mpv-player-button');
      expect(buttons.length).toBe(1);
    });
  });

  describe('handleAutoPauseIfCurrent', () => {
    it('should pause video if autoPause is enabled and URL video ID matches', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ autoPause: true }));

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      video.pause = jest.fn();
      // Simulate playing
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      document.body.appendChild(video);

      handleAutoPauseIfCurrent('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(video.pause).toHaveBeenCalled();
    });

    it('should not pause video if autoPause is disabled', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ autoPause: false }));

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      video.pause = jest.fn();
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      document.body.appendChild(video);

      handleAutoPauseIfCurrent('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

      expect(video.pause).not.toHaveBeenCalled();
    });

    it('should not pause video if video IDs do not match', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ autoPause: true }));

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      video.pause = jest.fn();
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      document.body.appendChild(video);

      // Current is dQw4w9WgXcQ, target is different
      handleAutoPauseIfCurrent('https://www.youtube.com/watch?v=differentID');

      expect(video.pause).not.toHaveBeenCalled();
    });
  });

  describe('launchCurrentVideo', () => {
    it('should send PLAY_IN_MPV message to background', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ forceWindow: true }));

      launchCurrentVideo();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'PLAY_IN_MPV', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        expect.any(Function)
      );
    });

    it('should trigger auto-pause check', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ autoPause: true, forceWindow: true }));

      const video = document.createElement('video');
      video.className = 'html5-main-video';
      video.pause = jest.fn();
      Object.defineProperty(video, 'paused', { value: false, writable: true });
      document.body.appendChild(video);

      launchCurrentVideo();

      expect(video.pause).toHaveBeenCalled();
    });

    it('should not launch if not on watch or shorts page', () => {
      window.location = new URL('https://www.youtube.com/feed/subscriptions');
      launchCurrentVideo();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should show spinner with loading class if forceWindow is false', () => {
      chrome.storage.local.get.mockImplementation((defaults, cb) => {
        if ('forceWindow' in defaults) {
          cb({ forceWindow: false });
        } else {
          cb(defaults);
        }
      });

      // Inject controls and button first so launchCurrentVideo can update the DOM
      const controls = document.createElement('div');
      controls.className = 'ytp-right-controls';
      document.body.appendChild(controls);
      attemptInjection();

      const btn = document.getElementById('play-in-mpv-player-button');
      expect(btn.classList.contains('loading')).toBe(false);

      chrome.runtime.sendMessage.mockImplementation((payload, cb) => {
        // Hold response to check spinner is shown
        setTimeout(() => cb({ ok: true }), 5000);
      });

      launchCurrentVideo();

      expect(btn.classList.contains('loading')).toBe(true);
      expect(btn.style.cursor).toBe('not-allowed');

      // Fast-forward timer to clear loading (3500ms minimum)
      jest.advanceTimersByTime(3500);
      expect(btn.classList.contains('loading')).toBe(true);

      // Fast-forward remaining response time
      jest.advanceTimersByTime(1500);
      jest.runOnlyPendingTimers();
      expect(btn.classList.contains('loading')).toBe(false);
      expect(btn.style.cursor).toBe('');
    });
  });



  describe('Keyboard Shortcuts', () => {
    describe('matchShortcut', () => {
      it('should match Alt+P correctly', () => {
        const e = { key: 'p', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false };
        expect(matchShortcut(e, 'Alt+P')).toBe(true);
      });

      it('should match Ctrl+Alt+Key combinations', () => {
        const e = { key: 'm', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false };
        expect(matchShortcut(e, 'Ctrl+Alt+M')).toBe(true);
      });

      it('should match Space key correctly', () => {
        const e = { key: ' ', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false };
        expect(matchShortcut(e, 'Alt+Space')).toBe(true);
      });

      it('should match Shift modifier correctly', () => {
        const e = { key: 'P', ctrlKey: false, altKey: true, shiftKey: true, metaKey: false };
        expect(matchShortcut(e, 'Alt+Shift+P')).toBe(true);
      });

      it('should perform case-insensitive key checks', () => {
        const e = { key: 'x', ctrlKey: false, altKey: true, shiftKey: false, metaKey: false };
        expect(matchShortcut(e, 'Alt+X')).toBe(true);
        expect(matchShortcut(e, 'Alt+x')).toBe(true);
      });

      it('should fail to match if modifier is missing', () => {
        const e = { key: 'p', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
        expect(matchShortcut(e, 'Alt+P')).toBe(false);
      });
    });

    describe('keydown trigger event', () => {
      it('should trigger launchCurrentVideo if shortcut matches', () => {
        chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ shortcutEnabled: true, shortcutKey: 'Alt+P', forceWindow: true }));

        // Send keydown on window
        const event = new KeyboardEvent('keydown', {
          key: 'p',
          altKey: true,
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
          { type: 'PLAY_IN_MPV', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          expect.any(Function)
        );
      });

      it('should not trigger if shortcut is disabled', () => {
        // Change storage settings
        storageOnChangedListener({
          shortcutEnabled: { newValue: false }
        }, 'local');

        const event = new KeyboardEvent('keydown', {
          key: 'p',
          altKey: true,
          bubbles: true,
          cancelable: true
        });
        window.dispatchEvent(event);

        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });

      it('should not trigger if focus is on input element', () => {
        chrome.storage.local.get.mockImplementation((defaults, cb) => cb({ shortcutEnabled: true, shortcutKey: 'Alt+P', forceWindow: true }));

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        const event = new KeyboardEvent('keydown', {
          key: 'p',
          altKey: true,
          bubbles: true,
          cancelable: true
        });
        input.dispatchEvent(event);

        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
      });
    });
  });
});
