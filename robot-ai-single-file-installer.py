#!/usr/bin/env python3
"""
Robot AI Single-File Android Installer
-------------------------------------
This is an ultra-compact one-file installer designed specifically for Android-based robots
using content:// URIs through the Storage Access Framework.

How to use:
1. Upload this single file to your robot using the Web UI
2. Execute with: python3 robot-ai-single-file-installer.py --secret YOUR_ROBOT_SECRET

Features:
- Self-contained in a single file for easy deployment
- Automatically locates writable directories
- Installs all required modules
- Registers the Robot AI as a system service

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
from datetime import datetime
from typing import List, Dict, Optional, Any, Union

# ============================
# Configuration
# ============================
DEFAULT_ROBOT_IP = "localhost"  # Use localhost since we're running on the robot
DEFAULT_ROBOT_PORT = 8090
ANDROID_DIRS = [
    "/storage/emulated/0/Documents/modules",
    "/sdcard/Documents/modules",
    "/data/local/tmp"
]

# ============================
# Core Module Code
# ============================
# Minimalist Robot AI core module
CORE_MODULE_CODE = """#!/usr/bin/env python3
\"\"\"
Robot AI Core Module
This is the main entry point for the Robot AI package.

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
from typing import List, Dict, Any, Optional

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class RobotAI:
    \"\"\"Main Robot AI class\"\"\"
    
    def __init__(self, robot_ip: str = "localhost", robot_port: int = 8090):
        \"\"\"Initialize the Robot AI\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.ws_url = f"ws://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"http://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Robot AI Core initialized on {self.robot_ip}:{self.robot_port}")
    
    async def connect(self):
        \"\"\"Connect to robot WebSocket\"\"\"
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot WebSocket")
            
            # Subscribe to topics
            await self.subscribe_topics()
            
            # Start listening for messages
            await self.listen()
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
    
    async def subscribe_topics(self):
        \"\"\"Subscribe to robot topics\"\"\"
        if not self.connected:
            logger.error("Cannot subscribe: not connected")
            return
            
        try:
            topics = ["/battery_state", "/tracked_pose"]
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Subscribed to topics: {topics}")
        except Exception as e:
            logger.error(f"Subscribe error: {e}")
    
    async def listen(self):
        \"\"\"Listen for messages from robot\"\"\"
        if not self.connected:
            logger.error("Cannot listen: not connected")
            return
            
        try:
            async for message in self.websocket:
                await self.process_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Listen error: {e}")
            self.connected = False
    
    async def process_message(self, message: str):
        \"\"\"Process incoming WebSocket messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/battery_state":
                percentage = data.get("percentage", 0) * 100
                logger.info(f"Battery: {percentage:.1f}%")
            
            elif topic == "/tracked_pose":
                pos = data.get("pos", [0, 0])
                logger.debug(f"Position: ({pos[0]}, {pos[1]})")
                
        except Exception as e:
            logger.error(f"Process message error: {e}")
    
    async def close(self):
        \"\"\"Close connection\"\"\"
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Disconnected from robot")

async def main():
    \"\"\"Main function\"\"\"
    # Use localhost since we're running on the robot
    robot_ip = os.environ.get("ROBOT_IP", "localhost")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    robot_ai = RobotAI(robot_ip, robot_port)
    
    try:
        await robot_ai.connect()
        
        # Keep running
        while True:
            if not robot_ai.connected:
                await robot_ai.connect()
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        await robot_ai.close()

if __name__ == "__main__":
    logger.info("Starting Robot AI Core Module")
    asyncio.run(main())
"""

# ============================
# Utility Functions 
# ============================
def print_status(message: str):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def verify_secret(robot_ip: str, robot_port: int, robot_secret: str) -> bool:
    """Verify the robot secret key is valid"""
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        print_status(f"Verifying secret key")
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print_status("✅ Secret key verified successfully")
            return True
        else:
            print_status(f"❌ Secret key verification failed: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"❌ Error verifying secret key: {e}")
        return False

def find_writable_location() -> Optional[str]:
    """Find a writable location on the robot for module installation"""
    print_status("Searching for writable location...")
    
    for directory in ANDROID_DIRS:
        try:
            # Try to create a test file
            test_file = f"{directory}/test_write_{int(time.time())}.txt"
            try:
                with open(test_file, 'w') as f:
                    f.write("test")
                os.remove(test_file)
                print_status(f"✅ Found writable location: {directory}")
                return directory
            except Exception:
                pass
        except Exception:
            pass
    
    print_status("❌ No writable location found")
    return None

def create_modules_directory(base_path: str) -> str:
    """Create modules directory"""
    modules_path = base_path
    if not os.path.exists(modules_path):
        try:
            os.makedirs(modules_path, exist_ok=True)
            print_status(f"✅ Created modules directory: {modules_path}")
        except Exception as e:
            print_status(f"❌ Error creating modules directory: {e}")
    
    return modules_path

def install_core_module(modules_path: str) -> str:
    """Install the core module"""
    module_path = f"{modules_path}/robot-ai-core.py"
    
    try:
        with open(module_path, 'w') as f:
            f.write(CORE_MODULE_CODE)
        os.chmod(module_path, 0o755)  # Make executable
        print_status(f"✅ Installed core module at {module_path}")
        return module_path
    except Exception as e:
        print_status(f"❌ Error installing core module: {e}")
        return ""

def create_launcher_script(robot_secret: str, module_path: str) -> str:
    """Create a launcher script that sets environment variables"""
    launcher_path = "/data/local/tmp/robot-ai-launcher.sh"
    
    launcher_code = f"""#!/bin/sh
# Robot AI Launcher
# This script sets environment variables and starts the Robot AI

# Export environment variables
export ROBOT_IP="localhost"
export ROBOT_PORT="8090"
export ROBOT_SECRET="{robot_secret}"

# Launch the core module
python3 {module_path} >> /data/local/tmp/robot-ai.log 2>&1 &

# Print the PID
echo "Started Robot AI with PID $!"
"""
    
    try:
        with open(launcher_path, 'w') as f:
            f.write(launcher_code)
        os.chmod(launcher_path, 0o755)  # Make executable
        print_status(f"✅ Created launcher at {launcher_path}")
        return launcher_path
    except Exception as e:
        print_status(f"❌ Error creating launcher: {e}")
        return ""

def register_service(robot_port: int, robot_secret: str, launcher_path: str) -> bool:
    """Register the Robot AI as a service"""
    try:
        url = f"http://localhost:{robot_port}/services/register"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        
        service_data = {
            "name": "robot-ai",
            "command": launcher_path,
            "autostart": True
        }
        
        print_status("Registering Robot AI service")
        response = requests.post(url, headers=headers, json=service_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print_status("✅ Service registered successfully")
            return True
        else:
            print_status(f"❌ Failed to register service: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"❌ Error registering service: {e}")
        return False

def start_service(robot_port: int, robot_secret: str) -> bool:
    """Start the Robot AI service"""
    try:
        url = f"http://localhost:{robot_port}/services/start"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Secret {robot_secret}"
        }
        
        service_data = {
            "name": "robot-ai"
        }
        
        print_status("Starting Robot AI service")
        response = requests.post(url, headers=headers, json=service_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print_status("✅ Service started successfully")
            return True
        else:
            print_status(f"❌ Failed to start service: HTTP {response.status_code}")
            return False
    except Exception as e:
        print_status(f"❌ Error starting service: {e}")
        return False

def run_installer(robot_port: int, robot_secret: str) -> bool:
    """Run the installation process"""
    try:
        # 1. Verify secret
        if not verify_secret("localhost", robot_port, robot_secret):
            return False
        
        # 2. Find writable location
        install_base = find_writable_location()
        if not install_base:
            return False
        
        # 3. Create modules directory
        modules_path = create_modules_directory(install_base)
        if not modules_path:
            return False
        
        # 4. Install core module
        module_path = install_core_module(modules_path)
        if not module_path:
            return False
        
        # 5. Create launcher script
        launcher_path = create_launcher_script(robot_secret, module_path)
        if not launcher_path:
            return False
        
        # 6. Register service
        if not register_service(robot_port, robot_secret, launcher_path):
            return False
        
        # 7. Start service
        if not start_service(robot_port, robot_secret):
            return False
        
        print_status("✅ Installation completed successfully")
        return True
    except Exception as e:
        print_status(f"❌ Installation failed: {e}")
        return False

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Robot AI Single-File Installer")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", default=os.environ.get("ROBOT_SECRET"), help="Robot API secret key (can also be set via ROBOT_SECRET environment variable)")
    args = parser.parse_args()
    
    print("\n" + "=" * 60)
    print(" Robot AI Single-File Installer for Android-based Robots ")
    print("=" * 60 + "\n")
    
    # Check if secret is provided
    if not args.secret:
        print_status("❌ No robot secret provided. Use --secret or set ROBOT_SECRET environment variable")
        return 1
    
    success = run_installer(args.port, args.secret)
    
    if success:
        print("\n" + "=" * 60)
        print(" Robot AI installed successfully! ")
        print(" The service has been registered and started ")
        print("=" * 60 + "\n")
    else:
        print("\n" + "=" * 60)
        print(" Installation failed. See logs above for details ")
        print("=" * 60 + "\n")
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())