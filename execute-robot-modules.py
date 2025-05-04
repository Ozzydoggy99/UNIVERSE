#!/usr/bin/env python3
"""
Execute Robot Modules
This script finds and executes Python modules that are already on the robot.
It's designed to work with existing modules on Android robots where files
are accessed through content:// URIs.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import requests
import argparse
from datetime import datetime

# Default robot connection details
DEFAULT_ROBOT_IP = "192.168.4.31"
DEFAULT_ROBOT_PORT = 8090
DEFAULT_ROBOT_SECRET = None  # Will be provided via command line or environment

def print_banner():
    """Print a banner for the script"""
    print("=" * 60)
    print("Execute Robot Modules")
    print("=" * 60)
    print("This script finds and executes modules already on the robot.")
    print("=" * 60)

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_connection(robot_ip, robot_port, robot_secret):
    """Test the connection to the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            info = response.json()
            print_status(f"Connected to robot: {info.get('serial', 'Unknown')}")
            print_status(f"Robot info: {json.dumps(info, indent=2)}")
            return True
        else:
            print_status(f"Failed to connect to robot: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Failed to connect to robot: {e}")
        return False

def execute_command(robot_ip, robot_port, robot_secret, command):
    """Execute a command on the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/services/execute"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        payload = {"command": command}
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result
        else:
            print_status(f"Command failed: HTTP {response.status_code}")
            print_status(f"Response: {response.text}")
            return None
    except Exception as e:
        print_status(f"Error executing command: {e}")
        return None

def find_modules(robot_ip, robot_port, robot_secret):
    """Find Python modules on the robot"""
    print_status("Searching for Python modules...")
    
    # Common paths to check
    paths_to_check = [
        "/storage/emulated/0/Documents/modules",
        "/sdcard/Documents/modules", 
        "/storage/self/primary/Documents/modules",
        "/data/local/tmp",
        "/tmp"
    ]
    
    # Find files in each path
    all_modules = []
    
    for path in paths_to_check:
        print_status(f"Checking {path}...")
        
        # Use ls to check if the directory exists and list files
        result = execute_command(robot_ip, robot_port, robot_secret, f"ls -la {path} 2>/dev/null || echo 'Directory not found'")
        
        if result and "Directory not found" not in result.get("stdout", ""):
            # Look for Python files
            python_files = execute_command(
                robot_ip, robot_port, robot_secret, 
                f"find {path} -name '*.py' -type f 2>/dev/null || echo 'No Python files found'"
            )
            
            if python_files and "No Python files found" not in python_files.get("stdout", ""):
                files = python_files.get("stdout", "").strip().split("\n")
                for file in files:
                    if file and file.endswith(".py"):
                        all_modules.append(file)
                        print_status(f"Found module: {file}")
    
    # Also check for Android content URIs
    print_status("Note: Cannot directly check Android content URIs. Use the file paths instead.")
    
    return all_modules

def execute_module(robot_ip, robot_port, robot_secret, module_path):
    """Execute a Python module"""
    print_status(f"Executing module: {module_path}")
    
    # First, make sure it's executable
    chmod_result = execute_command(robot_ip, robot_port, robot_secret, f"chmod +x {module_path}")
    if chmod_result is None:
        print_status(f"Failed to make {module_path} executable")
        return False
    
    # Try to execute the module
    result = execute_command(robot_ip, robot_port, robot_secret, f"python3 {module_path}")
    
    if result:
        print_status("Module execution started")
        print_status(f"Stdout: {result.get('stdout', '')}")
        print_status(f"Stderr: {result.get('stderr', '')}")
        return True
    else:
        print_status("Module execution failed")
        return False

def create_module_runner(robot_ip, robot_port, robot_secret, module_paths):
    """Create a runner script that executes all modules"""
    print_status("Creating module runner script...")
    
    # Create a script that runs all modules in sequence
    runner_script = "#!/bin/sh\n\n"
    runner_script += "# Generated module runner\n"
    runner_script += f"# Created at {datetime.now()}\n\n"
    
    for path in module_paths:
        runner_script += f"echo 'Running module: {path}'\n"
        runner_script += f"python3 {path} &\n"
        runner_script += "sleep 1\n\n"
    
    runner_script += "echo 'All modules started'\n"
    
    # Write the script to the robot
    runner_path = "/tmp/run-robot-modules.sh"
    
    # Create the runner script
    script_creation = execute_command(
        robot_ip, robot_port, robot_secret,
        f"cat > {runner_path} << 'EOF'\n{runner_script}\nEOF"
    )
    
    if script_creation is None:
        print_status("Failed to create runner script")
        return None
    
    # Make it executable
    chmod_result = execute_command(robot_ip, robot_port, robot_secret, f"chmod +x {runner_path}")
    if chmod_result is None:
        print_status("Failed to make runner script executable")
        return None
    
    print_status(f"Runner script created at {runner_path}")
    return runner_path

def run_module_runner(robot_ip, robot_port, robot_secret, runner_path):
    """Execute the module runner script"""
    print_status(f"Executing runner script: {runner_path}")
    
    result = execute_command(robot_ip, robot_port, robot_secret, f"sh {runner_path}")
    
    if result:
        print_status("Modules started successfully")
        print_status(f"Stdout: {result.get('stdout', '')}")
        return True
    else:
        print_status("Failed to run modules")
        return False

def check_running_modules(robot_ip, robot_port, robot_secret):
    """Check if the modules are running"""
    print_status("Checking for running module processes...")
    
    result = execute_command(robot_ip, robot_port, robot_secret, "ps | grep python | grep -v grep")
    
    if result and result.get("stdout", ""):
        processes = result.get("stdout", "").strip().split("\n")
        print_status(f"Found {len(processes)} Python processes:")
        for process in processes:
            print_status(f"  {process}")
        return processes
    else:
        print_status("No Python processes found")
        return []

def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Execute modules on the robot")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", default=DEFAULT_ROBOT_SECRET, help="Robot API secret key")
    parser.add_argument("--check", action="store_true", help="Only check for modules without executing them")
    parser.add_argument("--module", help="Execute a specific module path")
    
    args = parser.parse_args()
    
    # Check if the secret is provided as an environment variable
    robot_secret = args.secret or os.environ.get("ROBOT_SECRET")
    if not robot_secret:
        print_status("Error: Robot secret not provided. Please provide it with --secret or set the ROBOT_SECRET environment variable.")
        return False
    
    print_banner()
    
    # Test connection
    if not test_connection(args.ip, args.port, robot_secret):
        print_status("Connection test failed. Please check your robot details.")
        return False
    
    # If a specific module is provided, execute it
    if args.module:
        success = execute_module(args.ip, args.port, robot_secret, args.module)
        return success
    
    # Find modules
    module_paths = find_modules(args.ip, args.port, robot_secret)
    
    if not module_paths:
        print_status("No modules found on the robot")
        return False
    
    print_status(f"Found {len(module_paths)} modules:")
    for i, path in enumerate(module_paths):
        print_status(f"{i+1}. {path}")
    
    # If --check is specified, don't execute modules
    if args.check:
        print_status("Check complete. Use --module <path> to execute a specific module.")
        return True
    
    # Create and run the module runner
    runner_path = create_module_runner(args.ip, args.port, robot_secret, module_paths)
    if not runner_path:
        print_status("Failed to create module runner")
        return False
    
    success = run_module_runner(args.ip, args.port, robot_secret, runner_path)
    if not success:
        print_status("Failed to run modules")
        return False
    
    # Check if modules are running
    time.sleep(2)  # Give processes time to start
    running_processes = check_running_modules(args.ip, args.port, robot_secret)
    
    if running_processes:
        print_status("Modules are running successfully")
        return True
    else:
        print_status("Modules may not have started properly")
        return False

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print_status("Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print_status(f"Unhandled exception: {e}")
        sys.exit(1)