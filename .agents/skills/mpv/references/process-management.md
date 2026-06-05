# Subprocess & Execution Management

This reference describes how to safely launch and manage `mpv` as a detached subprocess from a Python-based Native Messaging Host.

## The Chrome Native Messaging Sandbox Constraint

In Chrome Native Messaging:
1.  The browser starts the Python host process and communicates via stdin/stdout.
2.  When the browser closes the port or when the Python host finishes sending its response, the Python host exits.
3.  By default, any child processes (like `mpv`) spawned by Python will receive a terminate/hangup signal (`SIGHUP` or `SIGTERM`) or will be killed when the parent process dies.
4.  If `mpv` tries to read/write from stdin/stdout, it can corrupt the JSON protocol communication between Chrome and Python, causing Chrome to terminate the native host due to protocol violations.

**Solution**: You must detach `mpv` completely from the parent session and redirect its standard I/O streams.

---

## Python Detached Execution Pattern

Use the following Python implementation pattern to launch `mpv` safely:

```python
import os
import subprocess
import shlex
import sys

def launch_mpv_detached(mpv_path, video_url, custom_flags_str, cookies_path=None):
    """
    Spawns mpv as a completely detached subprocess, independent of the 
    parent process's lifecycle and standard streams.
    """
    # 1. Start with the binary and target URL
    cmd = [mpv_path, video_url]
    
    # 2. Safely parse custom user flags using shlex (handles quotes and spaces)
    if custom_flags_str:
        try:
            parsed_flags = shlex.split(custom_flags_str)
            cmd.extend(parsed_flags)
        except ValueError as e:
            # Fallback/Log error if flags are malformed
            sys.stderr.write(f"Error parsing custom flags: {e}\n")
            
    # 3. Add cookies flags if a cookie file is provided
    if cookies_path:
        cmd.append("--cookies=yes")
        cmd.append(f"--cookies-file={cookies_path}")
        cmd.append(f"--ytdl-raw-options=cookies={cookies_path}")
        
    # 4. Spawning arguments for detaching the process
    popen_args = {
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "stdin": subprocess.DEVNULL,
    }
    
    if sys.platform != "win32":
        # Unix/Linux: Start in a new session group to survive SIGHUP/parent termination
        popen_args["start_new_session"] = True
    else:
        # Windows: Use process creation flags to detach
        # CREATE_NEW_PROCESS_GROUP = 0x00000200, DETACHED_PROCESS = 0x00000008
        popen_args["creationflags"] = 0x00000208
        
    try:
        # Run subprocess in non-blocking mode
        subprocess.Popen(cmd, **popen_args)
        return True, "mpv launched successfully"
    except Exception as e:
        return False, f"Failed to execute mpv: {str(e)}"
```

---

## Key Rules for Subprocess Execution

1.  **Always use `shlex.split()`**: Never split custom user flags using `flags_str.split(' ')` as it will break option values containing spaces (e.g., `--title="My Video"`).
2.  **Explicitly redirect I/O to `DEVNULL`**: If `stdin`, `stdout`, or `stderr` are left unconfigured, they default to inheriting the parent process's pipes. This will break Chrome Native Messaging and cause the browser to hang or crash the host.
3.  **Use `start_new_session=True` on Unix**: This creates a new process group and sets the child as session leader. When the Python host terminates, the child process does not receive the exit signals.
