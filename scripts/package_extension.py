#!/usr/bin/env python3
"""
Play in MPV — Extension Package Creator
Packages all files in the extension/ folder into a ZIP ready for Chrome Web Store upload.
"""

import os
import zipfile

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    ext_dir = os.path.join(project_root, 'extension')
    
    # Target archive
    zip_name = 'play-in-mpv-extension.zip'
    zip_path = os.path.join(project_root, zip_name)
    
    print("Packaging extension files for Chrome Web Store...")
    print(f"Source directory: {ext_dir}")
    print(f"Output archive: {zip_path}\n")
    
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(ext_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Get relative path from ext_dir to keep directory structure but exclude 'extension/' prefix
                    rel_path = os.path.relpath(file_path, ext_dir)
                    zipf.write(file_path, rel_path)
                    print(f"  + Added: {rel_path}")
                    
        print(f"\n✅ Successfully created {zip_name}")
    except Exception as e:
        print(f"\n❌ Error creating zip file: {e}")

if __name__ == '__main__':
    main()
