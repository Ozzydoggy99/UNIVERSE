#!/usr/bin/env python3
"""
Robot AI Uploader
A direct tool for installing the Robot AI package on the robot
"""
import os
import sys
import time
import base64
import json
import urllib3
import requests
import zipfile
import io
from urllib3.exceptions import InsecureRequestWarning

# Disable SSL warnings
urllib3.disable_warnings(InsecureRequestWarning)

# Configuration
ROBOT_IP = "192.168.4.31"
ROBOT_PORT = 8090
ROBOT_SN = "L382502104987ir"
INSTALL_DIR = "/home/robot/robot-ai"

# Get the secret from environment or prompt user
ROBOT_SECRET = os.environ.get("ROBOT_SECRET")
if not ROBOT_SECRET:
    ROBOT_SECRET = input("Enter your robot secret key: ")

# Headers for API requests
HEADERS = {
    "Authorization": f"Secret {ROBOT_SECRET}",
    "Content-Type": "application/json"
}

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    print(f"[{timestamp}] {message}")

def create_robot_ai_package():
    """Create the Robot AI package files"""
    print_status("Creating Robot AI package with all modules...")
    
    package = {}
    
    # Create directories for modules
    package["modules/"] = ""
    package["logs/"] = ""
    package["www/"] = ""
    
    # Create the AI core module
    package["modules/core.py"] = """\"\"\"
Robot AI Core Module
This is the main entry point for the Robot AI package that
provides enhanced autonomous capabilities.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import asyncio
import logging
import websockets
import requests
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/robot_ai.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai-core")

class RobotState(Enum):
    IDLE = "idle"
    MOVING = "moving"
    MAPPING = "mapping"
    CHARGING = "charging"
    ERROR = "error"
    RECOVERY = "recovery"
    ALIGNING = "aligning"

class RobotAI:
    \"\"\"Main Robot AI class that manages all robot functionality\"\"\"
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        \"\"\"Initialize the Robot AI with connection details\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        self.ws = None
        self.state = RobotState.IDLE
        self.current_map_id = None
        self.position = {"x": 0, "y": 0, "orientation": 0}
        self.enabled_topics = []
        self.battery_state = {}
        self.wheel_state = {}
        self.maps = []
        self.connected = False
        self.last_connected = 0
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 1  # seconds
        self.topics_callbacks = {}
        self.session = requests.Session()
        self.session.verify = False
        
        # Try to read auth token for local use
        try:
            if os.path.exists("/etc/robot/auth.json"):
                with open("/etc/robot/auth.json", "r") as f:
                    auth_data = json.load(f)
                    if "secret" in auth_data:
                        self.session.headers.update({"Authorization": f"Secret {auth_data['secret']}"})
                        logger.info("Using local robot authentication")
        except Exception as e:
            logger.warning(f"Could not load local auth data: {e}")
    
    async def connect(self):
        \"\"\"Establish connection to the robot and start monitoring topics\"\"\"
        try:
            logger.info(f"Connecting to robot at {self.robot_ip}:{self.robot_port}")
            
            # Test REST API connection
            response = self.session.get(f"{self.base_url}/device/info")
            if response.status_code != 200:
                logger.error(f"Could not connect to robot API: {response.status_code}")
                return False
            
            logger.info("Successfully connected to robot API")
            
            # Connect to WebSocket for real-time updates
            logger.info(f"Connecting to WebSocket at {self.ws_url}")
            
            headers = {}
            if "Authorization" in self.session.headers:
                headers["Authorization"] = self.session.headers["Authorization"]
                
            self.ws = await websockets.connect(
                self.ws_url,
                extra_headers=headers,
                ping_interval=None  # Handle pings manually
            )
            
            logger.info("WebSocket connection established")
            self.connected = True
            self.last_connected = time.time()
            self.reconnect_attempts = 0
            
            # Start the WebSocket listener
            asyncio.create_task(self.listen_for_updates())
            
            # Enable default topics
            default_topics = [
                "/wheel_state",
                "/tracked_pose",
                "/battery_state",
                "/detailed_battery_state",
                "/map",
                "/slam/state"
            ]
            await self.enable_topics(default_topics)
            
            return True
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
    
    async def enable_topics(self, topics: List[str]):
        \"\"\"Enable specified topics for real-time updates\"\"\"
        if not self.connected or self.ws is None:
            logger.warning("Cannot enable topics: not connected")
            return False
        
        logger.info(f"Enabling topics: {topics}")
        
        # Add topics to the list if not already enabled
        for topic in topics:
            if topic not in self.enabled_topics:
                self.enabled_topics.append(topic)
        
        # Send enable_topics command
        try:
            message = {
                "op": "enable_topics",
                "topics": self.enabled_topics
            }
            await self.ws.send(json.dumps(message))
            logger.info(f"Enabled topics: {self.enabled_topics}")
            return True
        except Exception as e:
            logger.error(f"Error enabling topics: {e}")
            return False
    
    async def listen_for_updates(self):
        \"\"\"Listen for updates from the robot via WebSocket\"\"\"
        logger.info("Started WebSocket listener")
        
        try:
            while self.connected and self.ws is not None:
                try:
                    # Receive and process messages with timeout
                    message = await asyncio.wait_for(self.ws.recv(), timeout=1.0)
                    await self.process_message(message)
                except asyncio.TimeoutError:
                    # No message received within timeout, continue
                    continue
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    self.connected = False
                    break
        except Exception as e:
            logger.error(f"WebSocket listener error: {e}")
            self.connected = False
        
        # Try to reconnect if connection was lost
        if not self.connected:
            logger.info("Connection lost, attempting to reconnect")
            asyncio.create_task(self.reconnect())
    
    async def process_message(self, message: str):
        \"\"\"Process incoming WebSocket messages\"\"\"
        try:
            data = json.loads(message)
            
            # Handle topic messages
            if "topic" in data:
                topic = data["topic"]
                
                # Process specific topics
                if topic == "/battery_state":
                    self.battery_state = data
                elif topic == "/wheel_state":
                    self.wheel_state = data
                elif topic == "/tracked_pose":
                    if "pose" in data:
                        self.position = {
                            "x": data["pose"].get("position", {}).get("x", 0),
                            "y": data["pose"].get("position", {}).get("y", 0),
                            "orientation": data["pose"].get("orientation", 0)
                        }
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def get_robot_status(self) -> Dict:
        \"\"\"Get the current status of the robot\"\"\"
        status = {
            "state": self.state.value,
            "connected": self.connected,
            "position": self.position,
            "battery": self.battery_state,
            "wheel_state": self.wheel_state,
            "current_map_id": self.current_map_id
        }
        return status

# Global robot_ai instance
robot_ai = None

async def get_robot_ai():
    \"\"\"Get or create the RobotAI instance\"\"\"
    global robot_ai
    
    if robot_ai is None:
        robot_ai = RobotAI()
        await robot_ai.connect()
    
    return robot_ai
"""
    
    # Create a web dashboard
    package["index.html"] = """<!DOCTYPE html>
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
                    <h2 class="card-title">Navigation</h2>
                </div>
                <div>
                    <p><strong>Current Position:</strong> <span id="position">Loading...</span></p>
                    <p><strong>Current Map:</strong> <span id="current-map">Loading...</span></p>
                    <p><strong>Movement Status:</strong> <span id="movement-status">Loading...</span></p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Camera Feed</h2>
                </div>
                <div>
                    <p>Camera feed is available through the robot's API.</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Task Queue</h2>
                </div>
                <div>
                    <p>No tasks currently in queue.</p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Configuration
        const config = {
            robotSn: "{ROBOT_SN}",
            robotIp: "{ROBOT_IP}",
            robotPort: {ROBOT_PORT}
        };
        
        // Update UI elements
        document.getElementById('robot-sn').textContent = config.robotSn;
        document.getElementById('robot-ip').textContent = config.robotIp;
        
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
        
        console.log("Robot AI Dashboard initialized");
    </script>
</body>
</html>
"""
    
    # Create a start script
    package["start.sh"] = """#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start a simple HTTP server
cd "$SCRIPT_DIR"
python3 -m http.server 8080 > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$SCRIPT_DIR/server.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
"""
    
    # Create a stop script
    package["stop.sh"] = """#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Stop the server
if [ -f "$SCRIPT_DIR/server.pid" ]; then
    kill $(cat "$SCRIPT_DIR/server.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/server.pid"
fi

echo "Robot AI services stopped"
"""
    
    return package

def test_connection():
    """Test connection to the robot"""
    print_status(f"Testing connection to robot at {ROBOT_IP}:{ROBOT_PORT}...")
    
    try:
        response = requests.get(
            f"http://{ROBOT_IP}:{ROBOT_PORT}/device/info",
            headers=HEADERS,
            verify=False,
            timeout=10
        )
        
        if response.status_code != 200:
            print_status(f"Error: Could not connect to robot. Status code: {response.status_code}")
            return False
        
        robot_info = response.json()
        print_status("Successfully connected to robot:")
        print(f"  Name: {robot_info.get('name', 'Unknown')}")
        print(f"  Serial: {robot_info.get('serial', 'Unknown')}")
        print(f"  Version: {robot_info.get('version', 'Unknown')}")
        return True
    except Exception as e:
        print_status(f"Error connecting to robot: {e}")
        return False

def create_package_zip(package):
    """Create a ZIP file with the package contents"""
    print_status("Creating package ZIP file...")
    
    # Create ZIP file in memory
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w') as zipf:
        for filename, content in package.items():
            # Replace placeholders
            content = content.replace("{ROBOT_SN}", ROBOT_SN)
            content = content.replace("{ROBOT_IP}", ROBOT_IP)
            content = content.replace("{ROBOT_PORT}", str(ROBOT_PORT))
            zipf.writestr(filename, content)
    
    bio.seek(0)
    return bio.read()

def upload_file(package_zip):
    """Upload the package to the robot"""
    print_status(f"Uploading files directly to robot at {ROBOT_IP}...")
    
    try:
        # First try to create the installation directory
        mkdir_url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/execute"
        mkdir_payload = {
            "command": f"mkdir -p {INSTALL_DIR}"
        }
        
        response = requests.post(
            mkdir_url,
            headers=HEADERS,
            json=mkdir_payload,
            verify=False,
            timeout=10
        )
        
        if response.status_code != 200:
            print_status(f"Warning: Could not create installation directory. Status code: {response.status_code}")
        
        # Extract the ZIP file on the robot
        with zipfile.ZipFile(io.BytesIO(package_zip), 'r') as zipf:
            for filename in zipf.namelist():
                print_status(f"Uploading {filename}...")
                file_content = zipf.read(filename).decode('utf-8')
                
                # Upload the file
                upload_url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/file"
                upload_payload = {
                    "path": f"{INSTALL_DIR}/{filename}",
                    "content": base64.b64encode(file_content.encode('utf-8')).decode('utf-8')
                }
                
                response = requests.post(
                    upload_url,
                    headers=HEADERS,
                    json=upload_payload,
                    verify=False,
                    timeout=30
                )
                
                if response.status_code != 200:
                    print_status(f"Error uploading {filename}. Status code: {response.status_code}")
                    return False
        
        # Make scripts executable
        chmod_url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/execute"
        chmod_payload = {
            "command": f"chmod +x {INSTALL_DIR}/*.sh"
        }
        
        response = requests.post(
            chmod_url,
            headers=HEADERS,
            json=chmod_payload,
            verify=False,
            timeout=10
        )
        
        if response.status_code != 200:
            print_status(f"Warning: Could not make scripts executable. Status code: {response.status_code}")
        
        print_status("All files uploaded successfully")
        return True
    except Exception as e:
        print_status(f"Error uploading files: {e}")
        return False

def start_service():
    """Start the Robot AI service"""
    print_status("Starting Robot AI service...")
    
    try:
        start_url = f"http://{ROBOT_IP}:{ROBOT_PORT}/api/system/execute"
        start_payload = {
            "command": f"{INSTALL_DIR}/start.sh"
        }
        
        response = requests.post(
            start_url,
            headers=HEADERS,
            json=start_payload,
            verify=False,
            timeout=10
        )
        
        if response.status_code != 200:
            print_status(f"Error starting service. Status code: {response.status_code}")
            return False
        
        print_status("Robot AI service started successfully")
        return True
    except Exception as e:
        print_status(f"Error starting service: {e}")
        return False

def main():
    """Main function"""
    print_status("Robot AI Uploader - Direct Installation")
    print_status(f"Target robot: {ROBOT_SN} at {ROBOT_IP}:{ROBOT_PORT}")
    
    # Test connection
    if not test_connection():
        print_status("Aborting installation due to connection issues")
        return False
    
    # Create package
    package = create_robot_ai_package()
    
    # Create ZIP file
    package_zip = create_package_zip(package)
    
    # Upload package
    if not upload_file(package_zip):
        print_status("Aborting installation due to upload issues")
        return False
    
    # Start service
    if not start_service():
        print_status("Warning: Could not start service automatically")
        print_status(f"Please manually start it by executing: {INSTALL_DIR}/start.sh")
    
    # Installation successful
    print_status("Installation completed successfully!")
    print_status(f"Access the Robot AI dashboard at: http://{ROBOT_IP}:8080")
    print_status(f"Or locally on the robot at: http://localhost:8080")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if not success:
            print_status("Installation failed.")
            sys.exit(1)
    except KeyboardInterrupt:
        print_status("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        print_status(f"Unexpected error: {e}")
        sys.exit(1)
    
    input("\nPress Enter to exit...")