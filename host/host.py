#!/usr/bin/env python3
"""
Play in MPV — Native Messaging Host

Receives a JSON message from the Chrome extension containing a video URL,
then launches mpv as a completely detached subprocess so it survives after
Chrome closes the native messaging port.

Protocol: Chrome Native Messaging (4-byte little-endian length prefix + JSON)
"""

import json
import os
import struct
import subprocess
import sys


# ---------------------------------------------------------------------------
# Chrome Native Messaging protocol helpers
# ---------------------------------------------------------------------------

def read_message() -> dict:
    """Read one message from stdin using the Native Messaging framing."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        sys.exit(0)                         # Chrome closed the port
    length = struct.unpack('<I', raw_length)[0]
    raw_msg = sys.stdin.buffer.read(length)
    return json.loads(raw_msg.decode('utf-8'))


def send_message(payload: dict) -> None:
    """Write one message to stdout using the Native Messaging framing."""
    encoded = json.dumps(payload).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


# ---------------------------------------------------------------------------
# MPV launcher
# ---------------------------------------------------------------------------

def find_mpv() -> str:
    """Return the path to the mpv binary, preferring common system locations."""
    candidates = ['/usr/bin/mpv', '/usr/local/bin/mpv', 'mpv']
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return 'mpv'   # fall back to PATH lookup


def launch_mpv(url: str) -> tuple[bool, str]:
    """
    Spawn mpv as a detached subprocess.

    The process is fully detached (new session, all stdio → /dev/null) so
    it continues playing after Chrome terminates the native host.
    """
    mpv = find_mpv()
    cmd = [mpv, url]

    popen_kwargs = {
        'stdin':  subprocess.DEVNULL,
        'stdout': subprocess.DEVNULL,
        'stderr': subprocess.DEVNULL,
    }

    if sys.platform != 'win32':
        popen_kwargs['start_new_session'] = True
    else:
        # CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
        popen_kwargs['creationflags'] = 0x00000208

    try:
        subprocess.Popen(cmd, **popen_kwargs)
        return True, 'mpv launched'
    except Exception as exc:
        return False, str(exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    try:
        message = read_message()
    except Exception as exc:
        send_message({'ok': False, 'error': f'Failed to read message: {exc}'})
        sys.exit(1)

    url = message.get('url', '').strip()
    if not url:
        send_message({'ok': False, 'error': 'No URL provided'})
        sys.exit(1)

    ok, info = launch_mpv(url)
    send_message({'ok': ok, 'info': info})


if __name__ == '__main__':
    main()
