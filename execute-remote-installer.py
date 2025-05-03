#!/usr/bin/env python3
"""
Execute Remote Robot AI Installer
This script executes the Robot AI installer that was already uploaded to the robot.

Author: AI Assistant
Version: 1.0.0
"""

import sys
import requests
import argparse
import time

# Default robot connection details
DEFAULT_ROBOT_IP = "192.168.4.31"
DEFAULT_ROBOT_PORT = 8090
DEFAULT_ROBOT_SECRET = "H3MN33L33E2CKNM37WQRZMR2KLAQECDD"

def print_banner():
    """Print banner"""
    print("=" * 60)
    print("Execute Remote Robot AI Installer")
    print("=" * 60)
    print("This script will execute the Robot AI installer on your robot.")
    print("=" * 60)

def execute_installer(robot_ip, robot_port, robot_secret, installer_path):
    """Execute the installer on the robot"""
    print(f"Connecting to robot at {robot_ip}:{robot_port}")
    
    # First let's check if we can reach the robot
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            robot_info = response.json()
            print(f"Connected to robot: {robot_info.get('serial', 'Unknown')}")
        else:
            print(f"Failed to connect to robot: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"Failed to connect to robot: {e}")
        return False
    
    print("\nMaking installer executable...")
    try:
        url = f"http://{robot_ip}:{robot_port}/services/execute"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        # Make the file executable
        chmod_payload = {
            "command": f"chmod +x {installer_path}"
        }
        
        response = requests.post(url, headers=headers, json=chmod_payload)
        if response.status_code != 200:
            print(f"Failed to make installer executable: HTTP {response.status_code}")
            return False
        else:
            print("Successfully made installer executable")
    except Exception as e:
        print(f"Failed to make installer executable: {e}")
        return False
    
    print("\nExecuting installer...")
    try:
        # Execute the installer
        execute_payload = {
            "command": f"python3 {installer_path}"
        }
        
        response = requests.post(url, headers=headers, json=execute_payload)
        if response.status_code == 200:
            execution_result = response.json()
            print("\nInstaller execution started successfully!")
            print(f"Stdout: {execution_result.get('stdout', '')}")
            print(f"Stderr: {execution_result.get('stderr', '')}")
            return True
        else:
            print(f"Failed to execute installer: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"Failed to execute installer: {e}")
        return False

def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Execute Robot AI installer remotely")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", default=DEFAULT_ROBOT_SECRET, help="Robot API secret key")
    parser.add_argument("--path", default="/tmp/robot-ai-minimal-installer.py", help="Path to the installer on the robot")
    
    args = parser.parse_args()
    
    print_banner()
    
    # Execute the installer
    success = execute_installer(args.ip, args.port, args.secret, args.path)
    
    if success:
        print("\nInstallation process started on the robot!")
        print("The Robot AI package is being installed to: /home/robot/robot-ai")
        
        # Wait for a bit to allow the installation to complete
        print("\nWaiting 10 seconds for installation to complete...")
        time.sleep(10)
        
        # Check if the web interface is accessible
        try:
            url = f"http://{args.ip}:8080/"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print("\nRobot AI web interface is up and running!")
                print(f"You can access it at: http://{args.ip}:8080/")
            else:
                print("\nRobot AI web interface is not yet accessible.")
                print("The installation may still be in progress.")
                print(f"Try accessing it manually at: http://{args.ip}:8080/")
        except Exception as e:
            print("\nRobot AI web interface is not yet accessible.")
            print("The installation may still be in progress.")
            print(f"Try accessing it manually at: http://{args.ip}:8080/")
    else:
        print("\nFailed to start the installation process.")
        print("Please check the robot's logs for more information.")
    
    return success

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Unhandled exception: {e}")
        sys.exit(1)