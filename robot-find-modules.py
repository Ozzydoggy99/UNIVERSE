#!/usr/bin/env python3
"""
Simple script to find robot AI modules
"""
import os
import sys
import subprocess
import json

def main():
    # Search paths to check
    search_paths = [
        "/app",
        "/tmp",
        "/home/robot",
        "/usr/local",
        "/opt",
        "/var",
    ]
    
    print("Searching for robot AI modules...")
    found_files = {}
    
    # Search for python files with relevant names
    for path in search_paths:
        print(f"Searching in {path}...")
        try:
            # Limit execution time to avoid timeouts
            cmd = f"find {path} -type f -name '*.py' | grep -E 'core|camera|map|door|elevator|robot|ai' | head -n 20"
            result = subprocess.run(cmd, shell=True, timeout=10, capture_output=True, text=True)
            
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    if line:
                        found_files[line] = {"path": line}
                        print(f"Found: {line}")
        except subprocess.TimeoutExpired:
            print(f"Search in {path} timed out")
        except Exception as e:
            print(f"Error searching in {path}: {str(e)}")
    
    # Write results
    with open("/tmp/found_modules.json", "w") as f:
        json.dump(found_files, f, indent=2)
    
    print(f"Found {len(found_files)} potential module files")
    print("Results saved to /tmp/found_modules.json")
    
    # Check content of 3 most likely files to confirm they're AI modules
    likely_paths = [
        "/app/core.py", 
        "/app/camera.py",
        "/app/map.py",
        "/tmp/robot-ai-core.py",
        "/home/robot/robot-ai/core.py"
    ]
    
    print("\nChecking content of likely files:")
    
    for path in likely_paths:
        try:
            if os.path.exists(path):
                with open(path, "r", errors="ignore") as f:
                    content = f.read(200)  # Read first 200 chars
                print(f"\nFile: {path}")
                print(f"Content preview: {content[:100]}...")
            else:
                print(f"File not found: {path}")
        except Exception as e:
            print(f"Error reading {path}: {str(e)}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())