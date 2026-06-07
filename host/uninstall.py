#!/usr/bin/env python3
"""
Play in MPV — Cross-Platform Native Messaging Host Uninstaller

Removes the native messaging host registration and wrappers.
Supports Windows (Registry) and Linux/macOS (Config directories).
"""

import os
import sys


def main():
    print("Play in MPV Native Messaging Host Uninstaller")
    print("--------------------------------------------")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    manifest_name = "com.playinmpv.host"
    
    if sys.platform == 'win32':
        # 1. Clean registry
        import winreg
        registry_paths = [
            r"Software\Google\Chrome\NativeMessagingHosts\com.playinmpv.host",
            r"Software\Microsoft\Edge\NativeMessagingHosts\com.playinmpv.host",
            r"Software\Chromium\NativeMessagingHosts\com.playinmpv.host"
        ]
        
        for reg_path in registry_paths:
            try:
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, reg_path)
                print(f"Deleted registry key: HKCU\\{reg_path}")
            except FileNotFoundError:
                pass
            except Exception as e:
                print(f"Error deleting registry key {reg_path}: {e}")
                
        # 2. Clean files
        host_bat = os.path.join(script_dir, 'host.bat')
        manifest_dest = os.path.join(script_dir, f'{manifest_name}.json')
        
        for path in [host_bat, manifest_dest]:
            if os.path.isfile(path):
                try:
                    os.remove(path)
                    print(f"Removed: {path}")
                except Exception as e:
                    print(f"Error removing {path}: {e}")
    else:
        # Unix cleanup
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
        
        removed_count = 0
        for d in browser_dirs:
            dest = os.path.join(d, f'{manifest_name}.json')
            if os.path.isfile(dest):
                try:
                    os.remove(dest)
                    print(f"Removed: {dest}")
                    removed_count += 1
                except Exception as e:
                    print(f"Error removing {dest}: {e}")
        
        if removed_count == 0:
            print("No native messaging host manifests were found to remove.")
                    
    print("\n✅ Native messaging host uninstalled successfully.")


if __name__ == '__main__':
    main()
