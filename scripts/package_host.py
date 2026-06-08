#!/usr/bin/env python3
"""
Play in MPV — Host Package Creator
Packages only the files needed for the native host into a clean distribution ZIP.
"""

import os
import zipfile

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    host_dir = os.path.join(project_root, 'host')
    
    # Target archive
    zip_name = 'play-in-mpv-host.zip'
    zip_path = os.path.join(project_root, zip_name)
    
    # Files to include in the package
    files_to_pack = [
        'host.py',
        'install.py',
        'uninstall.py',
        'install.bat'
    ]
    
    print("Packaging native host files...")
    print(f"Source directory: {host_dir}")
    print(f"Output archive: {zip_path}\n")
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for filename in files_to_pack:
                src_file = os.path.join(host_dir, filename)
                if not os.path.isfile(src_file):
                    print(f"Error: Required file not found: {src_file}")
                    return
                
                # We nest the files inside a folder named 'play-in-mpv-host' inside the ZIP
                arcname = os.path.join('play-in-mpv-host', filename)
                zipf.write(src_file, arcname)
                print(f"  + Added: {filename} -> {arcname}")
                
        print(f"\n✅ Successfully created {zip_name}")
    except Exception as e:
        print(f"\n❌ Error creating zip file: {e}")

if __name__ == '__main__':
    main()
