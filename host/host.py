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
import shlex
import shutil
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

def is_executable(path: str) -> bool:
    """Check if a path is an executable file."""
    if not os.path.isfile(path):
        return False
    if sys.platform == 'win32':
        return True
    return os.access(path, os.X_OK)


def find_mpv() -> str:
    """Return the path to the mpv binary, preferring common system locations."""
    if sys.platform == 'win32':
        # Check PATH first
        mpv_path = shutil.which('mpv')
        if mpv_path:
            return mpv_path
        
        # Check common Windows paths
        candidates = []
        program_files = os.environ.get('ProgramFiles', 'C:\\Program Files')
        program_files_x86 = os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)')
        userprofile = os.environ.get('USERPROFILE', 'C:\\Users\\default')
        
        candidates.extend([
            os.path.join(program_files, 'mpv', 'mpv.exe'),
            os.path.join(program_files_x86, 'mpv', 'mpv.exe'),
            os.path.join(userprofile, 'scoop', 'apps', 'mpv', 'current', 'mpv.exe'),
            'C:\\mpv\\mpv.exe'
        ])
        for c in candidates:
            if os.path.isfile(c):
                return c
        return 'mpv.exe'   # fallback
    else:
        candidates = ['/usr/bin/mpv', '/usr/local/bin/mpv', 'mpv']
        for c in candidates:
            if is_executable(c):
                return c
        return 'mpv'   # fall back to PATH lookup


def check_mpv_found(mpv_path: str = None) -> bool:
    """Check if mpv binary is found on the system."""
    mpv = mpv_path
    if mpv:
        basename = os.path.basename(mpv).lower()
        if 'mpv' not in basename:
            mpv = find_mpv()
        elif ('/' in mpv or '\\' in mpv) and not is_executable(mpv):
            mpv = find_mpv()
    else:
        mpv = find_mpv()

    if '/' in mpv or '\\' in mpv:
        return is_executable(mpv)
    return bool(shutil.which(mpv))


def launch_mpv(url: str, mpv_path: str = None, flags: list = None, custom_flags: str = None) -> tuple[bool, str]:
    """
    Spawn mpv as a detached subprocess.

    The process is fully detached (new session, all stdio → /dev/null) so
    it continues playing after Chrome terminates the native host.
    """
    if not (url.startswith('http://') or url.startswith('https://')):
        return False, 'Invalid URL protocol'

    mpv = mpv_path
    if mpv:
        # Enforce that the binary name contains 'mpv' to prevent running random commands
        basename = os.path.basename(mpv).lower()
        if 'mpv' not in basename:
            mpv = find_mpv()
        # If they provide a path (has '/' or '\'), verify it exists and is executable.
        elif ('/' in mpv or '\\' in mpv) and not is_executable(mpv):
            mpv = find_mpv()
    else:
        mpv = find_mpv()

    cmd = [mpv]
    if flags and isinstance(flags, list):
        cmd.extend([str(f) for f in flags])
    if custom_flags and isinstance(custom_flags, str):
        try:
            cmd.extend(shlex.split(custom_flags))
        except ValueError as exc:
            return False, f'Malformed custom flags: {exc}'

    # Use double-dash to prevent options injection via malicious URLs
    cmd.append('--')
    cmd.append(url)

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

    # Check status request from popup initialization
    if message.get('type') == 'CHECK_STATUS':
        # Check for yt-dlp or youtube-dl in the system PATH
        ytdl_found = bool(shutil.which('yt-dlp') or shutil.which('youtube-dl'))
        # ytdl_found = False
        # Check for mpv in system PATH
        mpv_found = check_mpv_found(message.get('mpv_path'))
        # mpv_found = False
        send_message({
            'ok': True,
            'ytdl_missing': not ytdl_found,
            'mpv_missing': not mpv_found
        })
        sys.exit(0)

    url = message.get('url', '').strip()
    if not url:
        send_message({'ok': False, 'error': 'No URL provided'})
        sys.exit(1)

    mpv_path = message.get('mpv_path')
    flags = message.get('flags')
    custom_flags = message.get('custom_flags')

    ok, info = launch_mpv(url, mpv_path, flags, custom_flags)
    send_message({
        'ok': ok,
        'info': info
    })


if __name__ == '__main__':
    main()
