#!/usr/bin/env python3
"""
Robot AI Quick Installer
This script downloads and installs the Robot AI Web Dashboard

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import requests
import argparse
import webbrowser
from pathlib import Path

DASHBOARD_URL = "https://raw.githubusercontent.com/USERNAME/robot-ai/main/dashboard.html"
LOCAL_DASHBOARD_PATH = "robot-ai-dashboard.html"
ROBOT_IP = "192.168.4.31"
ROBOT_PORT = 8090

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Quick Installer")
    print("=" * 60)
    print("This script will download and install the Robot AI Web Dashboard.")
    print("Version: 1.0.0")
    print("=" * 60)

def download_dashboard():
    """Download the dashboard file"""
    print(f"Downloading Robot AI Dashboard from local package...")
    
    dashboard_html = None
    
    # Try to find dashboard in current directory or in robot-ai-package
    local_paths = [
        "dashboard.html",
        "robot-ai-dashboard.html",
        "robot-ai-web-interface.html",
        "robot-ai-package/dashboard.html",
        "robot-ai-package/dist/dashboard.html"
    ]
    
    for path in local_paths:
        if os.path.exists(path):
            print(f"Found dashboard at: {path}")
            with open(path, "r") as f:
                dashboard_html = f.read()
            break
    
    # If not found locally, try downloading from web
    if dashboard_html is None:
        try:
            if not DASHBOARD_URL.startswith("https://raw.githubusercontent.com/USERNAME/"):
                print(f"Downloading dashboard from: {DASHBOARD_URL}")
                response = requests.get(DASHBOARD_URL)
                response.raise_for_status()
                dashboard_html = response.text
            else:
                print("Error: No dashboard found locally and no valid remote URL configured.")
                print("Please extract the dashboard.html file from the robot-ai-v1.0.0.zip package.")
                return False
        except Exception as e:
            print(f"Error downloading dashboard: {e}")
            return False
    
    # Save the dashboard file
    try:
        with open(LOCAL_DASHBOARD_PATH, "w") as f:
            f.write(dashboard_html)
        print(f"Dashboard saved to: {LOCAL_DASHBOARD_PATH}")
        return True
    except Exception as e:
        print(f"Error saving dashboard: {e}")
        return False

def test_robot_connection(ip, port):
    """Test connection to the robot"""
    print(f"Testing connection to robot at {ip}:{port}...")
    
    try:
        url = f"http://{ip}:{port}/device/info"
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print("Successfully connected to robot!")
            return True
        else:
            print(f"Error connecting to robot: HTTP {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"Could not connect to robot at {ip}:{port}")
        return False
    except Exception as e:
        print(f"Error testing robot connection: {e}")
        return False

def open_dashboard():
    """Open the dashboard in the default web browser"""
    dashboard_path = os.path.abspath(LOCAL_DASHBOARD_PATH)
    print(f"Opening dashboard in web browser: {dashboard_path}")
    
    try:
        webbrowser.open(f"file://{dashboard_path}")
        return True
    except Exception as e:
        print(f"Error opening dashboard: {e}")
        print(f"Please open the file manually: {dashboard_path}")
        return False

def main():
    """Main installation function"""
    parser = argparse.ArgumentParser(description="Robot AI Quick Installer")
    parser.add_argument("--robot-ip", default=ROBOT_IP, help=f"Robot IP address (default: {ROBOT_IP})")
    parser.add_argument("--robot-port", type=int, default=ROBOT_PORT, help=f"Robot port (default: {ROBOT_PORT})")
    parser.add_argument("--no-browser", action="store_true", help="Don't open the dashboard in browser")
    args = parser.parse_args()
    
    print_banner()
    
    # Download dashboard
    if not download_dashboard():
        print("Installation failed.")
        return False
    
    # Test robot connection
    test_robot_connection(args.robot_ip, args.robot_port)
    
    # Open dashboard
    if not args.no_browser:
        open_dashboard()
    
    print("\nInstallation completed successfully!")
    print(f"Dashboard installed at: {os.path.abspath(LOCAL_DASHBOARD_PATH)}")
    print(f"\nTo use the dashboard, open the file in your web browser:")
    print(f"  {os.path.abspath(LOCAL_DASHBOARD_PATH)}")
    print(f"\nWhen the dashboard opens, enter your robot's IP address ({args.robot_ip})")
    print("and click 'Connect' to start controlling your robot.")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Unhandled exception: {e}")
        sys.exit(1)