#!/usr/bin/env python3
"""
Android File Finder for Robot AI Modules
This script helps find Python files on Android-based systems, focusing on content URIs
"""

import os
import sys
import glob
import json
import re
from pathlib import Path
import subprocess
try:
    from android.storage import app_storage_path
    ANDROID_AVAILABLE = True
except ImportError:
    ANDROID_AVAILABLE = False

def find_content_uris():
    """Find content URIs on the system"""
    print("Looking for content URIs...")
    
    # Try using the specific URI mentioned
    specific_uri = "content://com.android.providers.media.documents/document/documents_bucket%3A1823191514"
    print(f"Checking specific URI: {specific_uri}")
    
    # In a real Android environment, we'd use ContentResolver to query this URI
    # Since we're in a more restricted environment, we'll log that we'd check it
    print(f"Would check content URI: {specific_uri}")
    
    return [specific_uri]

def search_document_providers():
    """Search for document providers on the system"""
    print("Searching for document providers...")
    
    # These would be places Android might store documents
    document_locations = [
        "/storage/emulated/0/Documents",
        "/sdcard/Documents",
        "/storage/self/primary/Documents",
        "/data/data/com.termux/files/home/storage/shared/Documents",
        "/storage/emulated/0/Download"
    ]
    
    for location in document_locations:
        try:
            if os.path.exists(location):
                print(f"Checking document location: {location}")
                # Look for a modules directory
                modules_dir = os.path.join(location, "modules")
                if os.path.exists(modules_dir):
                    print(f"Found modules directory: {modules_dir}")
                    # Look for Python files
                    for py_file in glob.glob(os.path.join(modules_dir, "*.py")):
                        print(f"Found Python file: {py_file}")
        except Exception as e:
            print(f"Error checking {location}: {str(e)}")

def find_python_files_in_storage():
    """Find all Python files in Android storage"""
    print("Searching for Python files in storage...")
    
    # Common places to look for files in Android
    search_paths = [
        "/storage/emulated/0",
        "/sdcard",
        "/data/local/tmp",
        "/mnt/sdcard",
        "/storage/self/primary",
        ".",
        os.path.expanduser("~")
    ]
    
    # Expected module names
    module_names = [
        "core.py",
        "camera.py",
        "map.py",
        "door.py",
        "elevator.py",
        "task_queue.py"
    ]
    
    found_files = []
    
    # First, try to find known module names
    for base_path in search_paths:
        try:
            if not os.path.exists(base_path):
                continue
                
            print(f"Searching in {base_path}...")
            
            # Look specifically for our module names
            for module in module_names:
                for root, dirs, files in os.walk(base_path, topdown=True):
                    # Limit directory depth to avoid hanging
                    if root.count(os.sep) - base_path.count(os.sep) > 5:
                        dirs[:] = []  # Don't go deeper
                        continue
                    
                    if module in files:
                        filepath = os.path.join(root, module)
                        try:
                            with open(filepath, 'r', errors='ignore') as f:
                                content = f.read(200)  # Just get a preview
                            
                            found_files.append({
                                "path": filepath,
                                "size": os.path.getsize(filepath),
                                "preview": content[:100] + "..." if len(content) > 100 else content,
                                "is_known_module": True,
                                "module_name": module
                            })
                            print(f"Found module: {filepath}")
                        except Exception as e:
                            print(f"Error reading {filepath}: {str(e)}")
        except Exception as e:
            print(f"Error searching in {base_path}: {str(e)}")
    
    return found_files

def main():
    """
    Main function to find Python files with specific content
    """
    print("Android File Finder for Robot AI Modules")
    print("=======================================")
    print(f"Running in Python {sys.version}")
    print(f"Running in directory: {os.getcwd()}")
    
    # Check if we're running on Android
    if ANDROID_AVAILABLE:
        print("Android libraries available")
    else:
        print("Running in non-Android environment")
    
    # Find content URIs
    content_uris = find_content_uris()
    
    # Search document providers
    search_document_providers()
    
    # Find Python files in storage
    found_files = find_python_files_in_storage()
    
    # Write results to a file
    try:
        results_file = "/tmp/found_modules.json"
        with open(results_file, 'w') as f:
            json.dump({
                "content_uris": content_uris,
                "found_files": found_files
            }, f, indent=2)
        print(f"Found {len(found_files)} potential module files.")
        print(f"Results written to {results_file}")
        
        # Print a summary of found files
        print("\nSummary of found files:")
        for i, file_info in enumerate(found_files):
            print(f"{i+1}. {file_info['path']} ({file_info['size']} bytes)")
            if file_info.get('is_known_module'):
                print(f"   Known module: {file_info['module_name']}")
            print(f"   Preview: {file_info['preview']}")
            print()
    except Exception as e:
        print(f"Error writing results: {str(e)}")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())