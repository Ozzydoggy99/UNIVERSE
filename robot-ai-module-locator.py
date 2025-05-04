#!/usr/bin/env python3
"""
Robot AI Module Locator
This script scans the robot filesystem to locate existing AI modules
and report their locations and versions.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def find_files_by_name(name_patterns, root_dirs=None):
    """
    Find files by name pattern
    
    Args:
        name_patterns: List of filename patterns to search for
        root_dirs: List of root directories to search in, defaults to ['/']
    
    Returns:
        Dictionary of found files with paths and basic info
    """
    if root_dirs is None:
        root_dirs = ['/']
    
    found_files = {}
    
    for root_dir in root_dirs:
        print_status(f"Searching in {root_dir} for {', '.join(name_patterns)}")
        
        # Use find command to locate files
        pattern_args = []
        for pattern in name_patterns:
            pattern_args.extend(['-o', '-name', pattern])
        
        # Remove the first '-o'
        if pattern_args:
            pattern_args = pattern_args[1:]
        
        try:
            cmd = ['find', root_dir, '-type', 'f'] + pattern_args
            print_status(f"Executing: {' '.join(cmd)}")
            
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(timeout=30)
            
            if stderr:
                print_status(f"Warning: {stderr}")
            
            for line in stdout.splitlines():
                file_path = line.strip()
                if file_path:
                    try:
                        file_stat = os.stat(file_path)
                        file_size = file_stat.st_size
                        mod_time = datetime.fromtimestamp(file_stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                        
                        # Read first 100 bytes to check for shebang and basic info
                        with open(file_path, 'r', errors='ignore') as f:
                            header = f.read(500)
                        
                        # Extract version if available
                        version = "Unknown"
                        for line in header.splitlines():
                            if "version" in line.lower():
                                version = line.strip()
                                break
                        
                        found_files[file_path] = {
                            "size": file_size,
                            "modified": mod_time,
                            "version": version,
                            "header": header[:100] + "..." if len(header) > 100 else header
                        }
                        
                        print_status(f"Found: {file_path} (Size: {file_size} bytes, Modified: {mod_time})")
                    except Exception as e:
                        print_status(f"Error accessing {file_path}: {str(e)}")
        
        except subprocess.TimeoutExpired:
            print_status(f"Timeout searching in {root_dir}")
        except Exception as e:
            print_status(f"Error searching in {root_dir}: {str(e)}")
    
    return found_files

def find_python_files():
    """Find Python files that might be robot AI modules"""
    python_patterns = ["*.py"]
    
    # Common locations to search
    search_dirs = [
        "/",
        "/tmp",
        "/home",
        "/opt",
        "/var",
        "/usr/local",
        "/data",
        "/robot",
        "/app",
        "/bin"
    ]
    
    print_status("Searching for Python files...")
    python_files = find_files_by_name(python_patterns, search_dirs)
    
    # Filter for likely robot AI files
    robot_files = {}
    keywords = ["robot", "ai", "core", "camera", "map", "door", "elevator", "navigation"]
    
    for path, info in python_files.items():
        file_name = os.path.basename(path).lower()
        
        # Check if any keywords are in the path or header
        is_robot_file = any(keyword in path.lower() for keyword in keywords)
        is_robot_file = is_robot_file or any(keyword in info["header"].lower() for keyword in keywords)
        
        if is_robot_file:
            robot_files[path] = info
            print_status(f"Identified as robot AI file: {path}")
    
    return robot_files

def main():
    """Main function"""
    print_status("Robot AI Module Locator")
    print_status("=====================")
    
    # Create output directory
    output_dir = "/tmp/robot-ai-locator"
    os.makedirs(output_dir, exist_ok=True)
    
    # Find robot AI Python files
    robot_files = find_python_files()
    
    # Write results to a file
    results_path = os.path.join(output_dir, "found_modules.json")
    with open(results_path, "w") as f:
        json.dump(robot_files, f, indent=2)
    
    print_status(f"Found {len(robot_files)} potential robot AI modules")
    print_status(f"Results written to {results_path}")
    
    # Write a summary file
    summary_path = os.path.join(output_dir, "modules_summary.txt")
    with open(summary_path, "w") as f:
        f.write("Robot AI Modules Summary\n")
        f.write("=======================\n\n")
        f.write(f"Search completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Found {len(robot_files)} potential robot AI modules\n\n")
        
        for path, info in robot_files.items():
            f.write(f"File: {path}\n")
            f.write(f"Size: {info['size']} bytes\n")
            f.write(f"Modified: {info['modified']}\n")
            f.write(f"Version: {info['version']}\n")
            f.write("Header snippet:\n")
            f.write(f"{info['header']}\n\n")
            f.write("-" * 50 + "\n\n")
    
    print_status(f"Summary written to {summary_path}")
    return 0

if __name__ == "__main__":
    sys.exit(main())