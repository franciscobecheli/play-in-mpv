#!/usr/bin/env python3
"""
Play in MPV — Cross-Platform Native Messaging Host Installer

Registers the native messaging host manifest in the browser configuration.
Supports Windows (Registry) and Linux/macOS (Config directories).
"""

import os
import sys
import json
import re

# Default Chrome Web Store extension ID (replace this placeholder when published)
DEFAULT_EXTENSION_ID = "YOUR_CHROME_WEB_STORE_ID_HERE"


def main():
    # 1. Get Extension ID
    extension_id = ""
    if len(sys.argv) > 1:
        extension_id = sys.argv[1].strip()
    else:
        print("Play in MPV Native Messaging Host Installer")
        print("------------------------------------------")
        
        has_default = (DEFAULT_EXTENSION_ID and 
                       DEFAULT_EXTENSION_ID != "YOUR_CHROME_WEB_STORE_ID_HERE" and 
                       re.match(r'^[a-z]{32}$', DEFAULT_EXTENSION_ID))
        
        prompt = "Enter your Chrome Extension ID: "
        if has_default:
            prompt = f"Enter your Chrome Extension ID [default: {DEFAULT_EXTENSION_ID}]: "
            
        try:
            user_input = input(prompt).strip()
            if not user_input and has_default:
                extension_id = DEFAULT_EXTENSION_ID
            else:
                extension_id = user_input
        except (KeyboardInterrupt, EOFError):
            print("\nInstallation cancelled.")
            sys.exit(1)

    # Validate Extension ID (32 lowercase letters)
    if not re.match(r'^[a-z]{32}$', extension_id):
        print(f"Error: '{extension_id}' is not a valid Chrome Extension ID.")
        print("It must be exactly 32 lowercase alphabetical characters.")
        sys.exit(1)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    host_script = os.path.join(script_dir, 'host.py')

    if not os.path.isfile(host_script):
        print(f"Error: host.py not found at '{host_script}'")
        sys.exit(1)

    manifest_name = "com.playinmpv.host"
    
    # 2. Determine target path and prepare wrapper if on Windows
    if sys.platform == 'win32':
        # Create host.bat wrapper because Chrome on Windows cannot execute .py directly
        host_bat = os.path.join(script_dir, 'host.bat')
        # Use sys.executable to run host.py with the same Python environment that ran the installer
        # Double quotes protect path spaces
        with open(host_bat, 'w', newline='\r\n') as f:
            f.write(f'@echo off\n"{sys.executable}" "%~dp0host.py" %*\n')
        
        print(f"Created Windows batch wrapper: {host_bat}")
        host_path = host_bat
        
        # Output resolved manifest file path in the host directory
        manifest_dest = os.path.join(script_dir, f'{manifest_name}.json')
    else:
        # On Unix, we can run host.py directly (it has the shebang line)
        try:
            os.chmod(host_script, 0o755)
            print(f"Set executable permissions on: {host_script}")
        except Exception as e:
            print(f"Warning: Failed to set executable permissions: {e}")
        host_path = host_script
        manifest_dest = None # Will be installed to browser paths

    # 3. Create manifest dictionary
    manifest_data = {
        "name": manifest_name,
        "description": "Play in MPV — native messaging host",
        "path": host_path,
        "type": "stdio",
        "allowed_origins": [
            f"chrome-extension://{extension_id}/"
        ]
    }

    # 4. Perform installation
    if sys.platform == 'win32':
        # Write the manifest file locally
        with open(manifest_dest, 'w') as f:
            json.dump(manifest_data, f, indent=2)
        print(f"Wrote host manifest: {manifest_dest}")
        
        # Register in Windows Registry (HKCU) for Chrome, Edge, and Chromium
        import winreg
        registry_paths = [
            r"Software\Google\Chrome\NativeMessagingHosts\com.playinmpv.host",
            r"Software\Microsoft\Edge\NativeMessagingHosts\com.playinmpv.host",
            r"Software\Chromium\NativeMessagingHosts\com.playinmpv.host"
        ]
        
        for reg_path in registry_paths:
            try:
                key = winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, reg_path, 0, winreg.KEY_SET_VALUE)
                winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_dest)
                winreg.CloseKey(key)
                print(f"Registered HKCU\\{reg_path}")
            except Exception as e:
                print(f"Error writing registry path {reg_path}: {e}")
    else:
        # Unix installation (write directly to browser config dirs)
        home = os.path.expanduser('~')
        browser_dirs = [
            # Linux
            os.path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'chromium', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'google-chrome-beta', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'google-chrome-unstable', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'BraveSoftware', 'Brave-Browser-Beta', 'NativeMessagingHosts'),
            os.path.join(home, '.config', 'BraveSoftware', 'Brave-Browser-Nightly', 'NativeMessagingHosts'),
            # macOS
            os.path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
            os.path.join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
            os.path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts')
        ]
        
        installed_count = 0
        for d in browser_dirs:
            parent = os.path.dirname(d)
            if os.path.isdir(parent):
                os.makedirs(d, exist_ok=True)
                dest = os.path.join(d, f'{manifest_name}.json')
                with open(dest, 'w') as f:
                    json.dump(manifest_data, f, indent=2)
                print(f"Installed -> {dest}")
                installed_count += 1
                
        if installed_count == 0:
            print("Warning: No existing Chrome/Chromium/Brave config directory found.")
            print("Please run Chrome once or manually create the directories, then run this installer again.")
            
    print("\n✅ Native messaging host installed successfully.")
    print(f"Extension ID: {extension_id}")


if __name__ == '__main__':
    main()
