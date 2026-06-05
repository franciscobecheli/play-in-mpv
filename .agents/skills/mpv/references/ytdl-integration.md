# YouTube & Cookie Integration

This reference describes how `mpv` integrates with `yt-dlp` to play streaming video from YouTube, specifically formatting quality settings and handling session cookies.

## Quality Presets
Map the extension's quality options to the `--ytdl-format` command-line argument using the following patterns:

*   **Best Quality** (Default):
    ```bash
    --ytdl-format="bestvideo+bestaudio/best"
    ```
*   **1080p Quality**:
    ```bash
    --ytdl-format="bestvideo[height<=1080]+bestaudio/best[height<=1080]"
    ```
*   **720p Quality**:
    ```bash
    --ytdl-format="bestvideo[height<=720]+bestaudio/best[height<=720]"
    ```
*   **Audio Only**:
    ```bash
    --ytdl-format="bestaudio/best"
    ```

---

## Session Cookies Authentication

To play private, age-restricted, or member-only videos, you must pass YouTube session cookies to both `yt-dlp` (for URL resolution) and `mpv` (for downloading segments). 

### 1. Requirements
*   Cookies must be in **Netscape format**.
*   Pass the cookies file to `yt-dlp` using: `--ytdl-raw-options=cookies=<path>`
*   Pass the cookies file to `mpv` using: `--cookies-file=<path>`
*   Explicitly enable cookies in `mpv` using: `--cookies=yes`

### 2. Python Backend Cookie Writer
Below is the standard helper function to convert Chrome extension JSON cookies (retrieved via `chrome.cookies.getAll`) into a valid Netscape cookie file:

```python
def write_netscape_cookie_file(cookies_list, filepath):
    """
    Writes a list of Chrome cookie dictionaries to a Netscape-formatted cookie file.
    """
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("# Netscape HTTP Cookie File\n")
        f.write("# http://curl.haxx.se/rfc/cookie_spec.html\n")
        f.write("# This is a generated file! Do not edit.\n\n")
        
        for cookie in cookies_list:
            domain = cookie.get('domain', '')
            # Wildcard domains starting with a dot allow subdomains
            include_subdomains = "TRUE" if domain.startswith('.') else "FALSE"
            path = cookie.get('path', '/')
            secure = "TRUE" if cookie.get('secure', False) else "FALSE"
            
            # Use integer UNIX timestamp. Default to far-future epoch if missing/session
            expiration = int(cookie.get('expirationDate', 2147483647))
            
            name = cookie.get('name', '')
            value = cookie.get('value', '')
            
            # Netscape format columns:
            # domain  domain_specified  path  secure  expires  name  value
            f.write(f"{domain}\t{include_subdomains}\t{path}\t{secure}\t{expiration}\t{name}\t{value}\n")
```

### 3. Lifecycle Management
Temporary cookie files containing sensitive authentication tokens must be securely managed:
1.  Write the cookies list to a temporary file (e.g., using Python's `tempfile.NamedTemporaryFile` with `delete=False`).
2.  Launch `mpv` in a detached subprocess passing the path.
3.  Once the process starts and initializes, delete the temporary file from the disk to prevent credential leakage.
