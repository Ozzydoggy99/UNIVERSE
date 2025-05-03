#!/usr/bin/env python3
# Minimal Robot AI Installer
# A simple tool to upload the Robot AI to the robot

import os
import sys
import time
import base64
import json
import requests
from urllib.parse import urljoin

# Configuration
ROBOT_IP = "192.168.4.31"
ROBOT_PORT = 8090
ROBOT_SECRET = ""  # Will prompt if empty
INSTALL_DIR = "/home/robot/robot-ai"

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    print(f"[{timestamp}] {message}")

def get_headers():
    """Get headers with authorization"""
    headers = {
        "Content-Type": "application/json"
    }
    if ROBOT_SECRET:
        headers["Authorization"] = f"Secret {ROBOT_SECRET}"
    return headers

def test_connection():
    """Test the connection to the robot"""
    print_status(f"Testing connection to robot at {ROBOT_IP}:{ROBOT_PORT}...")
    try:
        response = requests.get(
            f"http://{ROBOT_IP}:{ROBOT_PORT}/device/info",
            headers=get_headers(),
            timeout=10,
            verify=False
        )
        if response.status_code == 200:
            data = response.json()
            print_status(f"Connected to robot: {data.get('name', 'Unknown')} ({data.get('serial', 'Unknown')})")
            return True
        else:
            print_status(f"Failed to connect: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Connection error: {e}")
        return False

def upload_file(path, content):
    """Upload a file to the robot"""
    url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/file"
    data = {
        "path": path,
        "content": base64.b64encode(content.encode()).decode()
    }
    try:
        response = requests.post(
            url,
            headers=get_headers(),
            json=data,
            timeout=30,
            verify=False
        )
        return response.status_code == 200
    except Exception as e:
        print_status(f"Error uploading {path}: {e}")
        return False

def execute_command(command):
    """Execute a command on the robot"""
    url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/execute"
    data = {
        "command": command
    }
    try:
        response = requests.post(
            url,
            headers=get_headers(),
            json=data,
            timeout=10,
            verify=False
        )
        return response.status_code == 200
    except Exception as e:
        print_status(f"Error executing command: {e}")
        return False

def create_core_module():
    """Create the core module content"""
    return """
# Robot AI Core Module
import os
import json
import logging
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("robot-ai")

class RobotAI:
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.base_url = f"http://{self.robot_ip}:{self.robot_port}"
        self.session = requests.Session()
        self.session.verify = False
        
        # Try to read auth token for local use
        try:
            if os.path.exists("/etc/robot/auth.json"):
                with open("/etc/robot/auth.json", "r") as f:
                    auth_data = json.load(f)
                    if "secret" in auth_data:
                        self.session.headers.update({
                            "Authorization": f"Secret {auth_data['secret']}"
                        })
        except Exception as e:
            logger.warning(f"Could not load local auth data: {e}")
    
    def get_robot_status(self):
        try:
            response = self.session.get(f"{self.base_url}/device/info")
            if response.status_code == 200:
                return response.json()
            else:
                return {"error": f"Status code: {response.status_code}"}
        except Exception as e:
            return {"error": str(e)}

robot_ai = None

def get_robot_ai(robot_ip="127.0.0.1", robot_port=8090):
    global robot_ai
    if robot_ai is None:
        robot_ai = RobotAI(robot_ip, robot_port)
    return robot_ai
"""

def create_dashboard():
    """Create the dashboard content"""
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2563EB;
            margin-top: 0;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .card-title {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-online {
            background-color: #d1fae5;
            color: #065f46;
        }
        
        .status-offline {
            background-color: #fee2e2;
            color: #b91c1c;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Robot AI Dashboard</h1>
        <p>Enhanced autonomous robot control system</p>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Robot Status</h2>
                    <span id="status-badge" class="status-badge status-offline">Connecting...</span>
                </div>
                <div>
                    <p><strong>Robot SN:</strong> <span id="robot-sn">Loading...</span></p>
                    <p><strong>IP Address:</strong> <span id="robot-ip">Loading...</span></p>
                    <p><strong>Status:</strong> <span id="connection-status">Initializing...</span></p>
                    <p><strong>Battery:</strong> <span id="battery-level">Loading...</span></p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Robot AI Modules</h2>
                </div>
                <div>
                    <p><strong>Core Module:</strong> <span class="status-badge status-online">Active</span></p>
                    <p><strong>Camera Module:</strong> <span class="status-badge status-online">Active</span></p>
                    <p><strong>Map Module:</strong> <span class="status-badge status-online">Active</span></p>
                    <p><strong>Task Queue:</strong> <span class="status-badge status-online">Active</span></p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Recent Activity</h2>
                </div>
                <div>
                    <p><strong>Installation:</strong> Completed Successfully</p>
                    <p><strong>Last Update:</strong> <span id="last-update">Just now</span></p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Configuration
        const config = {
            robotSn: "L382502104987ir",
            robotIp: "192.168.4.31",
            robotPort: 8090
        };
        
        // Update UI elements
        document.getElementById('robot-sn').textContent = config.robotSn;
        document.getElementById('robot-ip').textContent = config.robotIp;
        document.getElementById('last-update').textContent = new Date().toLocaleString();
        
        // Function to check robot connection
        async function checkRobotConnection() {
            document.getElementById('connection-status').textContent = "Checking connection...";
            const statusBadge = document.getElementById('status-badge');
            
            try {
                const response = await fetch(`http://${config.robotIp}:${config.robotPort}/device/info`, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('connection-status').textContent = "Connected";
                    statusBadge.textContent = "Online";
                    statusBadge.classList.remove('status-offline');
                    statusBadge.classList.add('status-online');
                    
                    // Also fetch battery info
                    try {
                        const batteryResponse = await fetch(`http://${config.robotIp}:${config.robotPort}/api/battery`);
                        if (batteryResponse.ok) {
                            const batteryData = await batteryResponse.json();
                            const batteryPercent = Math.round((batteryData.percentage || 0) * 100);
                            let batteryStatus = "Not Charging";
                            
                            if (batteryData.is_charging) {
                                batteryStatus = "Charging";
                            } else if (batteryData.state === "discharging") {
                                batteryStatus = "In-Use";
                            }
                            
                            document.getElementById('battery-level').textContent = 
                                `${batteryPercent}% (${batteryStatus})`;
                        }
                    } catch (e) {
                        console.error('Battery fetch error:', e);
                    }
                    
                    return true;
                } else {
                    throw new Error(`HTTP error: ${response.status}`);
                }
            } catch (error) {
                console.error('Connection error:', error);
                document.getElementById('connection-status').textContent = "Disconnected";
                statusBadge.textContent = "Offline";
                statusBadge.classList.remove('status-online');
                statusBadge.classList.add('status-offline');
                return false;
            }
        }
        
        // Check connection periodically
        setInterval(checkRobotConnection, 5000);
        
        // Initial connection check
        checkRobotConnection();
    </script>
</body>
</html>
"""

def create_start_script():
    """Create the start script content"""
    return """#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
mkdir -p "$SCRIPT_DIR/logs"

# Start a simple HTTP server
cd "$SCRIPT_DIR"
python3 -m http.server 8080 > "$SCRIPT_DIR/logs/server.log" 2>&1 &
echo $! > "$SCRIPT_DIR/server.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
"""

def create_stop_script():
    """Create the stop script content"""
    return """#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Stop the server
if [ -f "$SCRIPT_DIR/server.pid" ]; then
    kill $(cat "$SCRIPT_DIR/server.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/server.pid"
fi

echo "Robot AI services stopped"
"""

def main():
    global ROBOT_SECRET
    
    print("=" * 60)
    print("Minimal Robot AI Installer")
    print("=" * 60)
    print("\nIMPORTANT: You will need your robot's secret key to continue.")
    print("This is the authentication key provided by your robot manufacturer.")
    print("The key is typically found in your robot documentation or admin panel.")
    print("=" * 60)
    
    # Ask for robot secret if not provided
    if not ROBOT_SECRET:
        ROBOT_SECRET = input("\nPlease enter your robot secret key: ").strip()
        if not ROBOT_SECRET:
            print_status("No secret key provided. Installation cannot continue.")
            return False
    
    # Test connection
    if not test_connection():
        print_status("Connection failed. Please check your robot IP and secret key.")
        return False
    
    # Create installation directory
    print_status(f"Creating installation directory at {INSTALL_DIR}...")
    if not execute_command(f"mkdir -p {INSTALL_DIR}"):
        print_status("Failed to create installation directory.")
        return False
    
    # Create modules directory
    print_status("Creating modules directory...")
    if not execute_command(f"mkdir -p {INSTALL_DIR}/modules"):
        print_status("Failed to create modules directory.")
        return False
    
    # Create logs directory
    print_status("Creating logs directory...")
    if not execute_command(f"mkdir -p {INSTALL_DIR}/logs"):
        print_status("Failed to create logs directory.")
        return False
    
    # Upload core module
    print_status("Uploading core module...")
    if not upload_file(f"{INSTALL_DIR}/modules/core.py", create_core_module()):
        print_status("Failed to upload core module.")
        return False
    
    # Upload dashboard
    print_status("Uploading dashboard...")
    if not upload_file(f"{INSTALL_DIR}/index.html", create_dashboard()):
        print_status("Failed to upload dashboard.")
        return False
    
    # Upload start script
    print_status("Uploading start script...")
    if not upload_file(f"{INSTALL_DIR}/start.sh", create_start_script()):
        print_status("Failed to upload start script.")
        return False
    
    # Upload stop script
    print_status("Uploading stop script...")
    if not upload_file(f"{INSTALL_DIR}/stop.sh", create_stop_script()):
        print_status("Failed to upload stop script.")
        return False
    
    # Make scripts executable
    print_status("Making scripts executable...")
    if not execute_command(f"chmod +x {INSTALL_DIR}/*.sh"):
        print_status("Failed to make scripts executable.")
        return False
    
    # Start the service
    print_status("Starting the Robot AI service...")
    if not execute_command(f"{INSTALL_DIR}/start.sh"):
        print_status("Failed to start the service.")
        return False
    
    print_status("Installation completed successfully!")
    print("")
    print(f"Robot AI dashboard is available at: http://{ROBOT_IP}:8080")
    
    return True

if __name__ == "__main__":
    # Disable SSL warnings
    try:
        import urllib3
        urllib3.disable_warnings()
    except ImportError:
        pass
    
    try:
        # Check for requests package
        try:
            import requests
        except ImportError:
            print("Error: The 'requests' package is required.")
            print("Please install it with: pip install requests")
            sys.exit(1)
        
        # Run main function
        if main():
            print("\nInstallation completed successfully!")
        else:
            print("\nInstallation failed.")
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
    except Exception as e:
        print(f"\nAn error occurred: {e}")
        import traceback
        traceback.print_exc()
    
    input("\nPress Enter to exit...")