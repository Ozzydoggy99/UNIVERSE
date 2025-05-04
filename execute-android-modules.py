#!/usr/bin/env python3
"""
Execute Android Modules
This script finds and executes Python modules on an Android-based robot.
"""

import os
import sys
import json
import logging
import tempfile
import subprocess
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def print_banner():
    """Print a banner for the script"""
    print("=" * 60)
    print("Android Module Executor")
    print("This script finds and executes Python modules on an Android-based robot")
    print("=" * 60)

def find_android_content_providers():
    """Find content providers on Android"""
    try:
        # Try listing content providers using content:// URIs
        logger.info("Looking for content providers...")
        cmd = ["content", "list"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        logger.info(f"Content providers: {result.stdout}")
        return result.stdout if result.returncode == 0 else None
    except Exception as e:
        logger.error(f"Error finding content providers: {e}")
        return None

def check_android_filesystem():
    """Check if we're running on Android"""
    try:
        android_paths = [
            "/storage/emulated/0",
            "/sdcard",
            "/data/local/tmp",
            "/system",
            "/android_asset"
        ]
        
        for path in android_paths:
            if os.path.exists(path):
                logger.info(f"Found Android path: {path}")
                # Try to list directories
                try:
                    contents = os.listdir(path)
                    logger.info(f"Contents of {path}: {contents[:10]}...")
                except Exception as e:
                    logger.error(f"Could not list {path}: {e}")
                    
        # Look specifically for our modules
        known_modules = [
            "core.py",
            "camera.py",
            "door.py",
            "elevator.py",
            "map.py",
            "task_queue.py"
        ]
        
        for module in known_modules:
            for path in android_paths:
                try:
                    # Try using find command
                    cmd = ["find", path, "-name", module, "-type", "f"]
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=3)
                    if result.stdout.strip():
                        logger.info(f"Found {module} at: {result.stdout.strip()}")
                except Exception as e:
                    logger.debug(f"Error searching for {module} in {path}: {e}")
    except Exception as e:
        logger.error(f"Error checking Android filesystem: {e}")

def execute_module(module_path):
    """Execute a Python module"""
    try:
        logger.info(f"Attempting to execute {module_path}")
        result = subprocess.run([sys.executable, module_path], capture_output=True, text=True)
        logger.info(f"Execution result: {result.returncode}")
        logger.info(f"Output: {result.stdout}")
        if result.stderr:
            logger.error(f"Error: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Error executing module: {e}")
        return False

def search_for_modules_by_content():
    """Search for modules by their content patterns"""
    try:
        logger.info("Searching for modules by content...")
        # Create a temporary file with grep commands to search for module identifiers
        with tempfile.NamedTemporaryFile('w+', suffix='.sh', delete=False) as f:
            f.write('#!/bin/sh\n')
            f.write('find /storage /sdcard /data/local/tmp -type f -name "*.py" -exec grep -l "Robot AI" {} \\;\n')
            f.flush()
            os.chmod(f.name, 0o755)
            
            # Run the script
            result = subprocess.run([f.name], capture_output=True, text=True, timeout=10)
            if result.stdout:
                logger.info(f"Found modules by content: {result.stdout}")
                return result.stdout.splitlines()
            else:
                logger.info("No modules found by content")
                return []
    except Exception as e:
        logger.error(f"Error searching for modules by content: {e}")
        return []
    
def create_module_runner():
    """Create a script that can run modules at a specific content URI"""
    try:
        # Create a script that can access content URIs
        runner_code = """
import sys
import os
import importlib.util
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def run_module_from_uri(uri_or_path):
    try:
        # This is where we would use Android's ContentResolver to get the file
        # But since we can't directly access ContentResolver in a normal Python script,
        # we'll try to use standard file access if it's a file path
        if os.path.exists(uri_or_path):
            logger.info(f"Found file at {uri_or_path}")
            try:
                spec = importlib.util.spec_from_file_location("module", uri_or_path)
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                logger.info(f"Successfully imported module from {uri_or_path}")
                
                # Try to call main() function if it exists
                if hasattr(module, 'main'):
                    logger.info("Found main() function, executing...")
                    result = module.main()
                    logger.info(f"Main function returned: {result}")
                else:
                    logger.warning("No main() function found in module")
                    
                return True
            except Exception as e:
                logger.error(f"Error executing module: {e}")
                return False
        else:
            logger.error(f"File not found: {uri_or_path}")
            return False
    except Exception as e:
        logger.error(f"Error running module from URI: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python runner.py <module_path_or_uri>")
        sys.exit(1)
        
    uri_or_path = sys.argv[1]
    success = run_module_from_uri(uri_or_path)
    sys.exit(0 if success else 1)
"""

        # Write the runner script to a file
        with open("module_runner.py", "w") as f:
            f.write(runner_code)
        logger.info("Created module runner script: module_runner.py")
        
        # Make it executable
        os.chmod("module_runner.py", 0o755)
        return True
    except Exception as e:
        logger.error(f"Error creating module runner: {e}")
        return False

def main():
    """Main function"""
    print_banner()
    logger.info(f"Running Python {sys.version}")
    logger.info(f"Current directory: {os.getcwd()}")
    
    # Check if we're running on Android
    android_paths_exist = any(os.path.exists(p) for p in ["/storage/emulated/0", "/sdcard"])
    logger.info(f"Running on Android: {android_paths_exist}")
    
    # Find Android content providers
    providers = find_android_content_providers()
    
    # Check Android filesystem
    check_android_filesystem()
    
    # Search for modules by content
    found_modules = search_for_modules_by_content()
    
    # Create a module runner
    create_module_runner()
    
    # Try to find and execute known modules
    known_modules = [
        "/storage/emulated/0/Documents/modules/core.py",
        "/sdcard/Documents/modules/core.py",
        "/data/local/tmp/Documents/modules/core.py",
        "/storage/emulated/0/Download/modules/core.py",
        "/sdcard/Download/modules/core.py",
    ]
    
    for module_path in known_modules + found_modules:
        if os.path.exists(module_path):
            logger.info(f"Found module at {module_path}")
            # Try to execute it directly
            success = execute_module(module_path)
            logger.info(f"Direct execution: {'Success' if success else 'Failed'}")
            
            # If direct execution fails, try using our runner
            if not success:
                logger.info(f"Trying execution with module runner")
                runner_result = subprocess.run([sys.executable, "module_runner.py", module_path], capture_output=True, text=True)
                logger.info(f"Runner execution result: {runner_result.returncode}")
                logger.info(f"Output: {runner_result.stdout}")
                if runner_result.stderr:
                    logger.error(f"Error: {runner_result.stderr}")
    
    # Try with the specific content URI
    content_uri = "content://com.android.providers.media.documents/document/documents_bucket%3A1823191514"
    logger.info(f"Trying to access content URI: {content_uri}")
    logger.info("Note: Direct access to content URIs requires Android APIs not available in standard Python")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())