#!/usr/bin/env python3
"""
Android Module Finder
This script is designed to find Python modules on Android-based robots
where files are managed through Android's Storage Access Framework.

It specifically looks for modules in content:// URIs and helps identify
the exact paths needed to execute them.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import argparse
import requests
import subprocess
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

# Constants
DEFAULT_ROBOT_IP = "192.168.25.25"
DEFAULT_ROBOT_PORT = 8090
ANDROID_PROVIDERS = [
    "content://com.android.providers.media.documents/document/documents_bucket%3A",
    "content://com.android.externalstorage.documents/document/primary%3A"
]

def print_banner():
    """Print the finder banner"""
    banner = r"""
    ╔═══════════════════════════════════════════════╗
    ║           ANDROID MODULE FINDER                ║
    ║                                               ║
    ║  Locates Python modules on Android-based      ║
    ║  robots using Storage Access Framework        ║
    ╚═══════════════════════════════════════════════╝
    """
    print(banner)
    print(f"Finder version: 1.0.0")
    print(f"Running on: {sys.platform}")
    print("-" * 50)

def print_status(message: str):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_connection(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Test the connection to the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        print_status(f"Testing connection to robot at {robot_ip}:{robot_port}")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print_status("Successfully connected to robot")
            return True
        else:
            print_status(f"Failed to connect: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Connection error: {e}")
        return False

def execute_command(robot_ip: str, robot_port: int, robot_secret: str, command: str) -> Dict[str, Any]:
    """Execute a command on the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/services/execute"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        payload = {"command": command}
        
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print_status(f"Command execution failed: HTTP {response.status_code}")
            return {"success": False, "stdout": "", "stderr": f"HTTP {response.status_code}"}
    except Exception as e:
        print_status(f"Error executing command: {e}")
        return {"success": False, "stdout": "", "stderr": str(e)}

def find_python_modules(robot_ip: str, robot_port: int, robot_secret: str) -> List[str]:
    """Find Python modules on the robot, focusing on content URIs"""
    modules = []
    
    print_status("Searching for Python modules on the robot...")
    
    # Check if we have Android tools available
    result = execute_command(robot_ip, robot_port, robot_secret, "which content")
    has_content_tool = result.get("stdout", "").strip() != ""
    
    if has_content_tool:
        print_status("Android 'content' tool is available")
        
        # First, try to find Document providers
        result = execute_command(
            robot_ip, robot_port, robot_secret, 
            "content query --uri content://com.android.providers.media.documents/root"
        )
        
        # Examine each known Android provider
        for provider in ANDROID_PROVIDERS:
            print_status(f"Searching in provider: {provider}")
            
            # Look for Python files in common locations
            common_paths = ["Documents/modules", "Download", "Documents"]
            
            for path in common_paths:
                # The actual query would need to be adjusted based on the provider's structure
                base_uri = provider
                if "%3A" in provider:  # If the provider already has a path separator
                    query_uri = f"{base_uri}{path}"
                else:
                    query_uri = f"{base_uri}%3A{path}"
                
                print_status(f"Querying: {query_uri}")
                
                # List files in this location
                result = execute_command(
                    robot_ip, robot_port, robot_secret,
                    f"content query --uri \"{query_uri}\""
                )
                
                if "error" in result.get("stderr", "").lower():
                    print_status(f"Error querying {query_uri}")
                    continue
                
                # Look for Python files in the output
                for line in result.get("stdout", "").splitlines():
                    if ".py" in line:
                        # Extract the full path to the Python file
                        # This is a simplification and would need to be adjusted
                        # based on the actual output format
                        if "document_id=" in line:
                            doc_id = line.split("document_id=")[1].split(" ")[0]
                            full_path = f"{query_uri}/{doc_id}"
                            modules.append(full_path)
                            print_status(f"Found module: {full_path}")
    
    # Also try standard file system search
    print_status("Searching file system for Python modules")
    common_locations = [
        "/storage/emulated/0/Documents/modules",
        "/storage/emulated/0/Download",
        "/sdcard/Documents/modules",
        "/sdcard/Download",
        "/data/local/tmp"
    ]
    
    for location in common_locations:
        result = execute_command(
            robot_ip, robot_port, robot_secret,
            f"find {location} -name '*.py' 2>/dev/null"
        )
        
        for line in result.get("stdout", "").splitlines():
            if line.strip() and line.endswith(".py"):
                modules.append(line.strip())
                print_status(f"Found module: {line.strip()}")
    
    return modules

def check_module_content(robot_ip: str, robot_port: int, robot_secret: str, module_path: str) -> Optional[str]:
    """Check the content of a module to identify its purpose"""
    print_status(f"Examining module: {module_path}")
    
    if module_path.startswith("content://"):
        # Content URI handling would require specific Android APIs
        # This is a simplified approach
        print_status("Module uses content:// URI, cannot examine content directly")
        return None
    else:
        # Regular file
        result = execute_command(
            robot_ip, robot_port, robot_secret,
            f"head -n 20 {module_path} 2>/dev/null"
        )
        
        content = result.get("stdout", "")
        
        if "error" in result.get("stderr", "").lower() or not content:
            print_status(f"Could not read module content")
            return None
        
        # Check for identifying patterns
        if "robot ai" in content.lower():
            if "core" in content.lower():
                return "Robot AI Core Module"
            elif "camera" in content.lower():
                return "Robot AI Camera Module"
            elif "door" in content.lower():
                return "Robot AI Door Module"
            elif "elevator" in content.lower():
                return "Robot AI Elevator Module"
            elif "map" in content.lower():
                return "Robot AI Map Module"
            elif "task" in content.lower():
                return "Robot AI Task Queue Module"
            else:
                return "Robot AI Module (Generic)"
        
        return "Unknown Python Module"

def create_module_runner(robot_ip: str, robot_port: int, robot_secret: str, modules: List[str]) -> bool:
    """Create a script that can run the identified modules"""
    runner_path = "/data/local/tmp/run_modules.py"
    
    runner_code = f"""#!/usr/bin/env python3
\"\"\"
Module Runner
This script runs the identified Robot AI modules
\"\"\"

import os
import sys
import time
import subprocess
import threading

# Modules to run
MODULES = {repr(modules)}

def run_module(module_path):
    \"\"\"Run a module as a separate process\"\"\"
    try:
        subprocess.Popen([sys.executable, module_path])
        print(f"Started {{module_path}}")
    except Exception as e:
        print(f"Error starting {{module_path}}: {{e}}")

def main():
    \"\"\"Main function\"\"\"
    print("Starting modules...")
    
    # Start each module in a separate process
    threads = []
    for module in MODULES:
        t = threading.Thread(target=run_module, args=(module,))
        threads.append(t)
        t.start()
        time.sleep(1)  # Small delay between module starts
    
    # Wait for all threads to complete
    for t in threads:
        t.join()
    
    print("All modules started")

if __name__ == "__main__":
    main()
"""
    
    print_status(f"Creating module runner at {runner_path}")
    
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"cat > {runner_path} << 'EOL'\n{runner_code}\nEOL"
    )
    
    if "error" in result.get("stderr", "").lower():
        print_status(f"Failed to create module runner: {result.get('stderr', '')}")
        return False
    
    # Make the runner executable
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"chmod +x {runner_path}"
    )
    
    if "error" in result.get("stderr", "").lower():
        print_status(f"Failed to make module runner executable: {result.get('stderr', '')}")
        return False
    
    print_status(f"Module runner created successfully at {runner_path}")
    return True

def run_modules(robot_ip: str, robot_port: int, robot_secret: str, modules: List[str]) -> bool:
    """Run the specified modules"""
    if not modules:
        print_status("No modules to run")
        return False
    
    print_status(f"Creating runner for {len(modules)} modules")
    
    # Create a runner script
    if not create_module_runner(robot_ip, robot_port, robot_secret, modules):
        print_status("Failed to create module runner")
        return False
    
    # Execute the runner
    print_status("Executing module runner")
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"python3 /data/local/tmp/run_modules.py &"
    )
    
    if "error" in result.get("stderr", "").lower():
        print_status(f"Failed to execute module runner: {result.get('stderr', '')}")
        return False
    
    print_status("Module runner started successfully")
    return True

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Android Module Finder")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", required=True, help="Robot secret for API authentication")
    parser.add_argument("--run", action="store_true", help="Run found modules")
    parser.add_argument("--verbose", action="store_true", help="Show detailed module information")
    args = parser.parse_args()
    
    print_banner()
    
    # Test connection
    if not test_connection(args.ip, args.port, args.secret):
        return 1
    
    # Find modules
    modules = find_python_modules(args.ip, args.port, args.secret)
    
    if not modules:
        print_status("No Python modules found on the robot")
        return 1
    
    print("\n== Found Modules ==")
    for i, module in enumerate(modules, 1):
        if args.verbose:
            module_type = check_module_content(args.ip, args.port, args.secret, module)
            print(f"{i}. {module} - {module_type or 'Unknown type'}")
        else:
            print(f"{i}. {module}")
    
    # Run modules if requested
    if args.run:
        print("\n== Running Modules ==")
        if run_modules(args.ip, args.port, args.secret, modules):
            print("Modules started successfully")
        else:
            print("Failed to run modules")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())