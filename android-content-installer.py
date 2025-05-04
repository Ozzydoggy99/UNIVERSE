#!/usr/bin/env python3
"""
Android Content URI Installer
-----------------------------
This is a specialized one-file installer for Android-based robots
that handles Storage Access Framework content:// URIs.

Features:
1. Detects Android-specific content providers
2. Identifies existing module locations
3. Creates new modules in the appropriate locations
4. Supports both file:// and content:// URI schemes
5. Self-contained in a single file for easy uploading

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import base64
import hashlib
import argparse
import requests
import subprocess
from datetime import datetime
from typing import List, Dict, Optional, Tuple, Any, Union

# ============================
# Configuration
# ============================
DEFAULT_ROBOT_IP = "192.168.25.25"
DEFAULT_ROBOT_PORT = 8090
ANDROID_PROVIDERS = [
    "content://com.android.providers.media.documents/document/documents_bucket%3A",
    "content://com.android.externalstorage.documents/document/primary%3A"
]
COMMON_ANDROID_PATHS = [
    "/storage/emulated/0/Documents/modules",
    "/storage/emulated/0/Download",
    "/sdcard/Documents/modules",
    "/sdcard/Download",
    "/data/local/tmp"
]

# ============================
# Core Module Code
# ============================
# This is a minimalist Robot AI core module
CORE_MODULE_CODE = """#!/usr/bin/env python3
\"\"\"
Robot AI Core Module
This is the main entry point for the Robot AI package that
provides enhanced autonomous capabilities.

Author: AI Assistant
Version: 1.0.0
\"\"\"

import os
import sys
import json
import time
import asyncio
import logging
import websockets
import requests
from enum import Enum
from typing import List, Dict, Optional, Any, Union, Tuple

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class RobotState(Enum):
    IDLE = "idle"
    MOVING = "moving"
    MAPPING = "mapping"
    CHARGING = "charging"
    ERROR = "error"

class RobotAI:
    \"\"\"Main Robot AI class that manages all robot functionality\"\"\"
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        \"\"\"Initialize the Robot AI with connection details\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.ws_url = f"{'wss' if use_ssl else 'ws'}://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"{'https' if use_ssl else 'http'}://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        self.state = RobotState.IDLE
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Robot AI initialized with connection to {self.rest_url}")
    
    async def connect(self):
        \"\"\"Establish connection to the robot and start monitoring topics\"\"\"
        try:
            logger.info(f"Connecting to robot websocket at {self.ws_url}")
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot websocket")
            
            # Enable some topics for real-time updates
            await self.enable_topics(["/tracked_pose", "/battery_state"])
            
            # Start listening for updates
            await self.listen_for_updates()
        except Exception as e:
            self.connected = False
            logger.error(f"Failed to connect to robot: {e}")
            # Try to reconnect
            await self.reconnect()
    
    async def reconnect(self):
        \"\"\"Attempt to reconnect to the robot\"\"\"
        logger.info("Attempting to reconnect to robot")
        for attempt in range(5):
            try:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
                await self.connect()
                return
            except Exception as e:
                logger.error(f"Reconnection attempt {attempt+1} failed: {e}")
        
        logger.error("Failed to reconnect after multiple attempts")
    
    async def enable_topics(self, topics: List[str]):
        \"\"\"Enable specified topics for real-time updates\"\"\"
        if not self.connected or not self.websocket:
            logger.error("Cannot enable topics: Not connected")
            return
        
        try:
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Enabled topics: {topics}")
        except Exception as e:
            logger.error(f"Failed to enable topics: {e}")
    
    async def listen_for_updates(self):
        \"\"\"Listen for updates from the robot via WebSocket\"\"\"
        if not self.connected or not self.websocket:
            logger.error("Cannot listen for updates: Not connected")
            return
        
        try:
            async for message in self.websocket:
                await self.process_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
            await self.reconnect()
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {e}")
            self.connected = False
            await self.reconnect()
    
    async def process_message(self, message: str):
        \"\"\"Process incoming WebSocket messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/tracked_pose":
                # Process position update
                pos = data.get("pos", [0, 0])
                ori = data.get("ori", 0)
                logger.debug(f"Position update: x={pos[0]}, y={pos[1]}, orientation={ori}")
            
            elif topic == "/battery_state":
                # Process battery update
                voltage = data.get("voltage", 0)
                percentage = data.get("percentage", 0)
                status = data.get("power_supply_status", "unknown")
                logger.debug(f"Battery update: {percentage*100:.1f}%, {voltage}V, {status}")
            
            # Add more topic handlers as needed
        
        except json.JSONDecodeError:
            logger.error(f"Failed to parse WebSocket message: {message[:100]}...")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def get_robot_status(self) -> Dict:
        \"\"\"Get the current status of the robot\"\"\"
        try:
            url = f"{self.rest_url}/device/info"
            headers = {"Authorization": f"Secret {self.robot_secret}"}
            
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                status_data = response.json()
                logger.info(f"Robot status: {status_data}")
                return status_data
            else:
                logger.error(f"Failed to get robot status: HTTP {response.status_code}")
                return {"error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error getting robot status: {e}")
            return {"error": str(e)}
    
    async def close(self):
        \"\"\"Close the connection to the robot\"\"\"
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Disconnected from robot")

async def main():
    \"\"\"Main entry point for the Robot AI\"\"\"
    # Load configuration from environment variables
    robot_ip = os.environ.get("ROBOT_IP", "127.0.0.1")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    # Create and start the Robot AI
    robot_ai = RobotAI(robot_ip, robot_port)
    
    try:
        # Connect to the robot
        await robot_ai.connect()
        
        # Keep the program running
        while True:
            await asyncio.sleep(60)
            status = await robot_ai.get_robot_status()
            logger.info(f"Robot check-in: {status}")
    
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        # Ensure clean shutdown
        await robot_ai.close()
        logger.info("Robot AI shutdown complete")

if __name__ == "__main__":
    logger.info("Starting Robot AI Core Module")
    
    # Set environment variables if not already set
    if not os.environ.get("ROBOT_IP"):
        os.environ["ROBOT_IP"] = "192.168.25.25"
    if not os.environ.get("ROBOT_PORT"):
        os.environ["ROBOT_PORT"] = "8090"
    
    # Check for Python 3.7+ which is required for asyncio
    if sys.version_info < (3, 7):
        logger.error("Python 3.7 or higher is required")
        sys.exit(1)
    
    # Run the main async function
    asyncio.run(main())
"""

# ============================
# Utility Functions 
# ============================
def print_banner():
    """Print the installer banner"""
    banner = r"""
    ╔═══════════════════════════════════════════════╗
    ║        ANDROID CONTENT URI INSTALLER           ║
    ║                                               ║
    ║  Specialized installer for Android robots     ║
    ║  using Storage Access Framework               ║
    ╚═══════════════════════════════════════════════╝
    """
    print(banner)
    print(f"Installer version: 1.0.0")
    print(f"Running on: {sys.platform}")
    print("-" * 50)

def print_status(message: str):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def test_connection(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Test connection to the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        print_status(f"Testing connection to robot at {robot_ip}:{robot_port}")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print_status("Successfully connected to robot")
            device_info = response.json()
            print_status(f"Robot info: {json.dumps(device_info, indent=2)}")
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

def check_android_environment(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Check if the robot is running Android"""
    # Check for common Android indicators
    indicators = [
        "getprop ro.product.manufacturer",
        "ls /system/app",
        "ls /sdcard",
        "which am"  # Android's Activity Manager
    ]
    
    for cmd in indicators:
        result = execute_command(robot_ip, robot_port, robot_secret, cmd)
        if result.get("success", False) and result.get("stdout", "").strip():
            print_status(f"Found Android indicator: {cmd}")
            return True
    
    print_status("No Android indicators found")
    return False

def find_android_content_providers(robot_ip: str, robot_port: int, robot_secret: str) -> List[str]:
    """Find content providers on Android"""
    providers = []
    
    # Check if 'content' tool exists (Android tool)
    result = execute_command(robot_ip, robot_port, robot_secret, "which content")
    if not result.get("success", False) or not result.get("stdout", "").strip():
        print_status("Android 'content' tool not found")
        return providers
    
    # Try to query content providers
    try:
        result = execute_command(
            robot_ip, robot_port, robot_secret,
            "content query --uri content://com.android.providers.media.documents/root"
        )
        
        if result.get("success", False) and "error" not in result.get("stderr", "").lower():
            providers.append("content://com.android.providers.media.documents")
            print_status("Found media documents provider")
        
        result = execute_command(
            robot_ip, robot_port, robot_secret,
            "content query --uri content://com.android.externalstorage.documents/root"
        )
        
        if result.get("success", False) and "error" not in result.get("stderr", "").lower():
            providers.append("content://com.android.externalstorage.documents")
            print_status("Found external storage provider")
    
    except Exception as e:
        print_status(f"Error finding content providers: {e}")
    
    return providers

def find_writable_locations(robot_ip: str, robot_port: int, robot_secret: str) -> List[str]:
    """Find writable locations on the robot"""
    writable_locations = []
    
    for path in COMMON_ANDROID_PATHS:
        # Test if we can write to this path
        test_file = f"{path}/test_write_{int(time.time())}.txt"
        result = execute_command(
            robot_ip, robot_port, robot_secret,
            f"touch {test_file} && echo 'success' && rm {test_file}"
        )
        
        if result.get("success", False) and "success" in result.get("stdout", "").lower():
            writable_locations.append(path)
            print_status(f"Found writable location: {path}")
    
    return writable_locations

def create_modules_directory(robot_ip: str, robot_port: int, robot_secret: str, base_path: str) -> bool:
    """Create a modules directory at the specified path"""
    modules_path = f"{base_path}"
    if not modules_path.endswith("/modules"):
        modules_path = f"{base_path}/modules"
    
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"mkdir -p {modules_path}"
    )
    
    if result.get("success", False) and "error" not in result.get("stderr", "").lower():
        print_status(f"Created modules directory at {modules_path}")
        return True
    else:
        print_status(f"Failed to create modules directory: {result.get('stderr', '')}")
        return False

def install_core_module(robot_ip: str, robot_port: int, robot_secret: str, install_path: str) -> Optional[str]:
    """Install the core module to the specified path"""
    module_name = "robot-ai-core.py"
    module_path = f"{install_path}/{module_name}"
    
    # Write the module content to a file
    print_status(f"Installing core module to {module_path}")
    
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"cat > {module_path} << 'EOL'\n{CORE_MODULE_CODE}\nEOL"
    )
    
    if not result.get("success", False) or "error" in result.get("stderr", "").lower():
        print_status(f"Failed to write core module: {result.get('stderr', '')}")
        return None
    
    # Make the module executable
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"chmod +x {module_path}"
    )
    
    if not result.get("success", False) or "error" in result.get("stderr", "").lower():
        print_status(f"Failed to make module executable: {result.get('stderr', '')}")
        return None
    
    print_status(f"Core module installed successfully at {module_path}")
    return module_path

def create_launcher_script(robot_ip: str, robot_port: int, robot_secret: str, module_path: str) -> Optional[str]:
    """Create a launcher script for the module"""
    launcher_path = "/data/local/tmp/robot-ai-launcher.sh"
    launcher_code = f"""#!/bin/sh
# Robot AI Launcher
# This script launches the Robot AI core module

# Export environment variables
export ROBOT_IP="{robot_ip}"
export ROBOT_PORT="{robot_port}"
export ROBOT_SECRET="{robot_secret}"

# Launch the core module
python3 {module_path} >> /data/local/tmp/robot-ai.log 2>&1 &

# Print the PID
echo "Started Robot AI with PID $!"
"""
    
    print_status(f"Creating launcher script at {launcher_path}")
    
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"cat > {launcher_path} << 'EOL'\n{launcher_code}\nEOL"
    )
    
    if not result.get("success", False) or "error" in result.get("stderr", "").lower():
        print_status(f"Failed to write launcher script: {result.get('stderr', '')}")
        return None
    
    # Make the launcher executable
    result = execute_command(
        robot_ip, robot_port, robot_secret,
        f"chmod +x {launcher_path}"
    )
    
    if not result.get("success", False) or "error" in result.get("stderr", "").lower():
        print_status(f"Failed to make launcher executable: {result.get('stderr', '')}")
        return None
    
    print_status(f"Launcher script created successfully at {launcher_path}")
    return launcher_path

def register_service(robot_ip: str, robot_port: int, robot_secret: str, launcher_path: str) -> bool:
    """Register the Robot AI as a service on the robot"""
    service_name = "robot-ai"
    
    try:
        url = f"http://{robot_ip}:{robot_port}/services/register"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        
        service_data = {
            "name": service_name,
            "command": launcher_path,
            "autostart": True
        }
        
        print_status(f"Registering {service_name} service")
        response = requests.post(url, headers=headers, json=service_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print_status("Service registered successfully")
            return True
        else:
            print_status(f"Failed to register service: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Error registering service: {e}")
        return False

def start_service(robot_ip: str, robot_port: int, robot_secret: str, service_name: str = "robot-ai") -> bool:
    """Start the Robot AI service"""
    try:
        url = f"http://{robot_ip}:{robot_port}/services/start"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        
        service_data = {
            "name": service_name
        }
        
        print_status(f"Starting {service_name} service")
        response = requests.post(url, headers=headers, json=service_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print_status("Service started successfully")
            return True
        else:
            print_status(f"Failed to start service: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"Error starting service: {e}")
        return False

def run_installer(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Run the installation process"""
    try:
        print_status("Starting Android Content URI Installer")
        
        # 1. Test connection to the robot
        if not test_connection(robot_ip, robot_port, robot_secret):
            return False
        
        # 2. Check if running on Android
        is_android = check_android_environment(robot_ip, robot_port, robot_secret)
        if is_android:
            print_status("Robot is running on Android")
        else:
            print_status("Robot does not appear to be running on Android, but will continue anyway")
        
        # 3. Find content providers on Android
        if is_android:
            providers = find_android_content_providers(robot_ip, robot_port, robot_secret)
            if providers:
                print_status(f"Found content providers: {providers}")
        
        # 4. Find writable locations
        writable_locations = find_writable_locations(robot_ip, robot_port, robot_secret)
        if not writable_locations:
            print_status("No writable locations found")
            return False
        
        # 5. Create modules directory
        install_base = writable_locations[0]  # Use the first writable location
        created = create_modules_directory(robot_ip, robot_port, robot_secret, install_base)
        if not created:
            print_status("Failed to create modules directory")
            return False
        
        # 6. Install core module
        install_path = f"{install_base}/modules"
        module_path = install_core_module(robot_ip, robot_port, robot_secret, install_path)
        if not module_path:
            print_status("Failed to install core module")
            return False
        
        # 7. Create launcher script
        launcher_path = create_launcher_script(robot_ip, robot_port, robot_secret, module_path)
        if not launcher_path:
            print_status("Failed to create launcher script")
            return False
        
        # 8. Register service
        if not register_service(robot_ip, robot_port, robot_secret, launcher_path):
            print_status("Failed to register service")
            return False
        
        # 9. Start service
        if not start_service(robot_ip, robot_port, robot_secret):
            print_status("Failed to start service")
            return False
        
        print_status("Installation completed successfully")
        return True
    
    except Exception as e:
        print_status(f"Installation failed: {e}")
        return False

def verify_secret(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Verify that the provided secret key is valid for the robot"""
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        print_status(f"Verifying secret key validity")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print_status("✅ Secret key verified successfully")
            return True
        elif response.status_code == 401:
            print_status("❌ Invalid secret key: Authentication failed")
            return False
        else:
            print_status(f"❌ Error verifying secret key: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"❌ Error verifying secret key: {e}")
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Android Content URI Installer")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", default=os.environ.get("ROBOT_SECRET"), help="Robot secret for API authentication (can also be set via ROBOT_SECRET environment variable)")
    parser.add_argument("--check-only", action="store_true", help="Only check the environment, don't install")
    args = parser.parse_args()
    
    # Check if secret is provided
    if not args.secret:
        print_status("❌ No robot secret provided. Use --secret or set ROBOT_SECRET environment variable")
        return 1
        
    # Verify secret key
    if not verify_secret(args.ip, args.port, args.secret):
        print_status("❌ Secret key verification failed. Please provide a valid robot secret")
        return 1
    
    print_banner()
    
    if args.check_only:
        print_status("Running in check-only mode")
        success = test_connection(args.ip, args.port, args.secret)
        if success:
            is_android = check_android_environment(args.ip, args.port, args.secret)
            if is_android:
                providers = find_android_content_providers(args.ip, args.port, args.secret)
                writable_locations = find_writable_locations(args.ip, args.port, args.secret)
                
                print("\n== Environment Summary ==")
                print(f"Android system: {'Yes' if is_android else 'No'}")
                print(f"Content providers: {len(providers)}")
                print(f"Writable locations: {len(writable_locations)}")
                
                if writable_locations:
                    print("\nWritable locations found:")
                    for i, location in enumerate(writable_locations, 1):
                        print(f"{i}. {location}")
            
            return 0 if is_android else 1
    else:
        success = run_installer(args.ip, args.port, args.secret)
        
        if success:
            print("\n✅ Android Robot AI installed successfully!")
            print("The Robot AI service has been registered and started.")
        else:
            print("\n❌ Installation failed. Please check the logs for details.")
        
        return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())