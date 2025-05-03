#!/usr/bin/env python3
"""
Simple Robot AI Installer
A direct tool for installing the Robot AI package on the robot
"""
import os
import sys
import time
import base64
import json
import requests
import io
import zipfile
from urllib.parse import urljoin

# Disable SSL warnings
try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    pass

# Configuration
ROBOT_IP = "192.168.4.31"
ROBOT_PORT = 8090
ROBOT_SN = "L382502104987ir"
INSTALL_DIR = "/home/robot/robot-ai"

# Get the secret from environment or prompt user
ROBOT_SECRET = os.environ.get("ROBOT_SECRET")

# Headers for API requests
HEADERS = {
    "Content-Type": "application/json"
}

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = time.strftime("%H:%M:%S", time.localtime())
    print(f"[{timestamp}] {message}")

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

def create_package():
    """Create the Robot AI package files"""
    print_status("Creating Robot AI package...")
    
    package = {}
    
    # Create directories
    package["modules/"] = ""
    package["logs/"] = ""
    
    # Create a simple core module
    package["modules/core.py"] = """
# Robot AI Core Module
import os
import json
import time
import logging
import requests

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

class RobotAI:
    \"\"\"Main Robot AI class\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Robot AI\"\"\"
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
                        logger.info("Using local robot authentication")
        except Exception as e:
            logger.warning(f"Could not load local auth data: {e}")
    
    def get_robot_status(self):
        \"\"\"Get the current status of the robot\"\"\"
        try:
            response = self.session.get(f"{self.base_url}/device/info")
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Failed to get robot status: {response.status_code}")
                return {"error": f"Status code: {response.status_code}"}
        except Exception as e:
            logger.error(f"Error getting robot status: {e}")
            return {"error": str(e)}

# Global robot_ai instance
robot_ai = None

def get_robot_ai(robot_ip="127.0.0.1", robot_port=8090):
    \"\"\"Get or create the RobotAI instance\"\"\"
    global robot_ai
    
    if robot_ai is None:
        robot_ai = RobotAI(robot_ip, robot_port)
    
    return robot_ai
"""
    
    # Create the camera module
    package["modules/camera.py"] = """
# Robot AI Camera Module
import os
import json
import time
import logging
import requests

# Configure logging
logger = logging.getLogger("robot-ai-camera")

class CameraModule:
    \"\"\"Camera module for Robot AI\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Camera Module\"\"\"
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
                        logger.info("Using local robot authentication")
        except Exception as e:
            logger.warning(f"Could not load local auth data: {e}")
    
    def get_camera_frame(self, camera="front"):
        \"\"\"Get the latest frame from a camera\"\"\"
        try:
            # Get a single frame from the camera
            camera_path = f"/rgb_cameras/{camera}"
            response = self.session.get(f"{self.base_url}{camera_path}/image")
            
            if response.status_code != 200:
                logger.error(f"Failed to get camera frame: {response.status_code}")
                return None
            
            # Return the frame data
            return response.content
        except Exception as e:
            logger.error(f"Error getting camera frame: {e}")
            return None
"""
    
    # Create other modules (simplified versions)
    package["modules/map.py"] = """
# Robot AI Map Module
import logging

logger = logging.getLogger("robot-ai-map")

class MapModule:
    \"\"\"Map module for Robot AI\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Map Module\"\"\"
        logger.info("Map Module initialized")
"""
    
    package["modules/door.py"] = """
# Robot AI Door Module
import logging

logger = logging.getLogger("robot-ai-door")

class DoorModule:
    \"\"\"Door module for Robot AI\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Door Module\"\"\"
        logger.info("Door Module initialized")
"""
    
    package["modules/elevator.py"] = """
# Robot AI Elevator Module
import logging

logger = logging.getLogger("robot-ai-elevator")

class ElevatorModule:
    \"\"\"Elevator module for Robot AI\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Elevator Module\"\"\"
        logger.info("Elevator Module initialized")
"""
    
    package["modules/task_queue.py"] = """
# Robot AI Task Queue Module
import logging

logger = logging.getLogger("robot-ai-task-queue")

class TaskQueueModule:
    \"\"\"Task Queue module for Robot AI\"\"\"
    
    def __init__(self, robot_ip="127.0.0.1", robot_port=8090):
        \"\"\"Initialize the Task Queue Module\"\"\"
        logger.info("Task Queue Module initialized")
"""
    
    # Create a simple initialization module
    package["modules/__init__.py"] = """
# Robot AI Package
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/robot_ai.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai")

# Import modules
from .core import RobotAI, get_robot_ai
from .map import MapModule
from .camera import CameraModule
from .door import DoorModule
from .elevator import ElevatorModule
from .task_queue import TaskQueueModule

logger.info("Robot AI package initialized")
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
            robotSn: "L382502104987ir",
            robotIp: "192.168.4.31",
            robotPort: 8090
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

def create_package_zip(package):
    """Create a ZIP file with the package contents"""
    print_status("Creating package ZIP file...")
    
    # Create ZIP file in memory
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, 'w') as zipf:
        for filename, content in package.items():
            zipf.writestr(filename, content)
    
    bio.seek(0)
    return bio.read()

def upload_file(package_zip):
    """Upload the package to the robot"""
    print_status(f"Uploading files directly to robot at {ROBOT_IP}...")
    
    global HEADERS
    if ROBOT_SECRET:
        HEADERS["Authorization"] = f"Secret {ROBOT_SECRET}"
    
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
                file_content = zipf.read(filename).decode('utf-8', errors='ignore')
                
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
    
    global HEADERS
    if ROBOT_SECRET:
        HEADERS["Authorization"] = f"Secret {ROBOT_SECRET}"
    
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

def check_requirements():
    """Check if required packages are installed"""
    required_packages = ["requests"]
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print_status("Missing required packages: " + ", ".join(missing_packages))
        print_status("Please install them using: pip install " + " ".join(missing_packages))
        return False
    
    return True

def main():
    """Main function"""
    global ROBOT_SECRET
    
    print_status("Robot AI Uploader - Direct Installation")
    print_status(f"Target robot: {ROBOT_SN} at {ROBOT_IP}:{ROBOT_PORT}")
    
    # Check if we have the robot secret
    if not ROBOT_SECRET:
        print("\nYou will need the robot's secret key for authentication.")
        print("This is typically provided by the robot manufacturer.")
        ROBOT_SECRET = input("Please enter the robot secret key: ")
        if not ROBOT_SECRET:
            print_status("No secret key provided. Installation cannot continue.")
            return False
    
    # Update headers with the secret
    global HEADERS
    HEADERS["Authorization"] = f"Secret {ROBOT_SECRET}"
    
    # Test connection
    if not test_connection():
        print_status("Aborting installation due to connection issues")
        return False
    
    # Create package
    package = create_package()
    
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
        print("=" * 60)
        print("Simple Robot AI Installer")
        print("=" * 60)
        print("This tool will install the Robot AI package on your robot.")
        print(f"Target robot: {ROBOT_SN} at {ROBOT_IP}:{ROBOT_PORT}")
        print("=" * 60)
        
        # Check requirements first
        if not check_requirements():
            print("\nPlease install the required packages and try again.")
            print("You can run: pip install requests")
            input("\nPress Enter to exit...")
            sys.exit(1)
        
        # Run the installer
        success = main()
        if not success:
            print_status("Installation failed.")
            input("\nPress Enter to exit...")
            sys.exit(1)
    except KeyboardInterrupt:
        print_status("\nInstallation cancelled by user.")
        input("\nPress Enter to exit...")
        sys.exit(1)
    except Exception as e:
        print_status(f"Unexpected error: {e}")
        print("\nDetailed error information:")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    print("\nInstallation completed successfully!")
    print("You can access the Robot AI dashboard at:")
    print(f"http://{ROBOT_IP}:8080")
    input("\nPress Enter to exit...")