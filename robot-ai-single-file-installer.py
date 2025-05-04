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
# Module Code
# ============================
# Complete collection of Robot AI modules
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

# Camera module for video streaming and processing
CAMERA_MODULE_CODE = """#!/usr/bin/env python3
\"\"\"
Robot AI Camera Module
This module provides enhanced camera functionality for the robot.

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
from typing import List, Dict, Optional, Any, Union, Callable

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class CameraState(Enum):
    INACTIVE = "inactive"
    CONNECTING = "connecting"
    STREAMING = "streaming"
    ERROR = "error"
    DISCONNECTED = "disconnected"

class CameraModule:
    \"\"\"Camera module for Robot AI\"\"\"
    
    def __init__(self, robot_ip: str = "localhost", robot_port: int = 8090):
        \"\"\"Initialize the Camera Module\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.ws_url = f"ws://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"http://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        self.camera_state = CameraState.INACTIVE
        self.frame_callbacks = []
        self.latest_frame = None
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Camera Module initialized for {self.robot_ip}:{self.robot_port}")
    
    async def connect(self):
        \"\"\"Connect to robot WebSocket\"\"\"
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.camera_state = CameraState.CONNECTING
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot WebSocket")
            
            # Subscribe to camera topics
            await self.subscribe_camera_topics()
            
            # Start listening for camera updates
            await self.listen_for_camera_updates()
        except Exception as e:
            logger.error(f"Camera connection error: {e}")
            self.connected = False
            self.camera_state = CameraState.ERROR
    
    async def subscribe_camera_topics(self):
        \"\"\"Subscribe to camera-related topics\"\"\"
        if not self.connected:
            logger.error("Cannot subscribe: not connected")
            return
            
        try:
            # Subscribe to camera topics
            topics = ["/camera/front/compressed", "/camera/status"]
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Subscribed to camera topics: {topics}")
            self.camera_state = CameraState.STREAMING
        except Exception as e:
            logger.error(f"Camera subscribe error: {e}")
            self.camera_state = CameraState.ERROR
    
    async def listen_for_camera_updates(self):
        \"\"\"Listen for camera updates\"\"\"
        if not self.connected:
            logger.error("Cannot listen: not connected")
            return
            
        try:
            async for message in self.websocket:
                await self.process_camera_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("Camera WebSocket connection closed")
            self.connected = False
            self.camera_state = CameraState.DISCONNECTED
        except Exception as e:
            logger.error(f"Camera listen error: {e}")
            self.connected = False
            self.camera_state = CameraState.ERROR
    
    async def process_camera_message(self, message: str):
        \"\"\"Process camera-related messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/camera/front/compressed":
                # Process camera frame
                frame_data = data.get("data", "")
                timestamp = data.get("timestamp", "")
                logger.debug(f"Received camera frame at {timestamp}")
                
                # Store latest frame
                self.latest_frame = {
                    "data": frame_data,
                    "timestamp": timestamp
                }
                
                # Call frame callbacks
                for callback in self.frame_callbacks:
                    try:
                        callback(self.latest_frame)
                    except Exception as e:
                        logger.error(f"Frame callback error: {e}")
            
            elif topic == "/camera/status":
                # Process camera status update
                enabled = data.get("enabled", False)
                status = "enabled" if enabled else "disabled"
                logger.info(f"Camera status: {status}")
                
                if enabled and self.camera_state != CameraState.STREAMING:
                    self.camera_state = CameraState.STREAMING
                elif not enabled and self.camera_state == CameraState.STREAMING:
                    self.camera_state = CameraState.INACTIVE
        
        except Exception as e:
            logger.error(f"Process camera message error: {e}")
    
    def add_frame_callback(self, callback: Callable):
        \"\"\"Add a callback function to process camera frames\"\"\"
        self.frame_callbacks.append(callback)
        logger.info(f"Added frame callback, total callbacks: {len(self.frame_callbacks)}")
    
    def remove_frame_callback(self, callback: Callable):
        \"\"\"Remove a callback function\"\"\"
        if callback in self.frame_callbacks:
            self.frame_callbacks.remove(callback)
            logger.info(f"Removed frame callback, remaining callbacks: {len(self.frame_callbacks)}")
    
    async def get_camera_status(self) -> Dict[str, Any]:
        \"\"\"Get the current status of the camera\"\"\"
        try:
            url = f"{self.rest_url}/camera/status"
            headers = {"Authorization": f"Secret {self.robot_secret}"}
            
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                status_data = response.json()
                logger.info(f"Camera status: {status_data}")
                return status_data
            else:
                logger.error(f"Failed to get camera status: HTTP {response.status_code}")
                return {"error": f"HTTP {response.status_code}"}
        except Exception as e:
            logger.error(f"Error getting camera status: {e}")
            return {"error": str(e)}
    
    async def enable_camera(self, enable: bool = True) -> bool:
        \"\"\"Enable or disable the camera\"\"\"
        try:
            url = f"{self.rest_url}/camera/{'enable' if enable else 'disable'}"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            response = requests.post(url, headers=headers)
            if response.status_code == 200:
                action = "enabled" if enable else "disabled"
                logger.info(f"Camera {action} successfully")
                return True
            else:
                logger.error(f"Failed to {'enable' if enable else 'disable'} camera: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error {'enabling' if enable else 'disabling'} camera: {e}")
            return False
    
    async def close(self):
        \"\"\"Close the camera module\"\"\"
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            self.camera_state = CameraState.DISCONNECTED
            logger.info("Camera module disconnected")

async def main():
    \"\"\"Main entry point for the Camera Module\"\"\"
    # Use localhost since we're running on the robot
    robot_ip = os.environ.get("ROBOT_IP", "localhost")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    camera_module = CameraModule(robot_ip, robot_port)
    
    # Simple frame callback for demonstration
    def log_frame(frame):
        logger.debug(f"Frame received at {frame['timestamp']}")
    
    camera_module.add_frame_callback(log_frame)
    
    try:
        await camera_module.connect()
        
        # Enable the camera
        await camera_module.enable_camera(True)
        
        # Keep running
        while True:
            if not camera_module.connected:
                await camera_module.connect()
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Camera module shutting down...")
    finally:
        await camera_module.close()
        logger.info("Camera module shutdown complete")

if __name__ == "__main__":
    logger.info("Starting Robot AI Camera Module")
    asyncio.run(main())
"""

# Map module for navigation and mapping
MAP_MODULE_CODE = """#!/usr/bin/env python3
\"\"\"
Robot AI Map Module
This module provides enhanced mapping and navigation capabilities.

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
from typing import List, Dict, Optional, Any, Union

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class MapState(Enum):
    IDLE = "idle"
    LOADING = "loading"
    MAPPING = "mapping"
    NAVIGATING = "navigating"
    ERROR = "error"

class MapModule:
    \"\"\"Map module for Robot AI\"\"\"
    
    def __init__(self, robot_ip: str = "localhost", robot_port: int = 8090):
        \"\"\"Initialize the Map Module\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.ws_url = f"ws://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"http://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        self.map_state = MapState.IDLE
        self.current_map = None
        self.position = {"x": 0, "y": 0, "orientation": 0}
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Map Module initialized for {self.robot_ip}:{self.robot_port}")
    
    async def connect(self):
        \"\"\"Connect to robot WebSocket\"\"\"
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot WebSocket")
            
            # Subscribe to map-related topics
            await self.subscribe_map_topics()
            
            # Start listening for map updates
            await self.listen_for_map_updates()
        except Exception as e:
            logger.error(f"Map connection error: {e}")
            self.connected = False
    
    async def subscribe_map_topics(self):
        \"\"\"Subscribe to map-related topics\"\"\"
        if not self.connected:
            logger.error("Cannot subscribe: not connected")
            return
            
        try:
            # Subscribe to map-related topics
            topics = ["/tracked_pose", "/map"]
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Subscribed to map topics: {topics}")
        except Exception as e:
            logger.error(f"Map subscribe error: {e}")
    
    async def listen_for_map_updates(self):
        \"\"\"Listen for map updates\"\"\"
        if not self.connected:
            logger.error("Cannot listen: not connected")
            return
            
        try:
            async for message in self.websocket:
                await self.process_map_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("Map WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Map listen error: {e}")
            self.connected = False
    
    async def process_map_message(self, message: str):
        \"\"\"Process map-related messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/tracked_pose":
                # Process position update
                pos = data.get("pos", [0, 0])
                orientation = data.get("ori", 0)
                self.position = {
                    "x": pos[0],
                    "y": pos[1],
                    "orientation": orientation
                }
                logger.debug(f"Position update: x={pos[0]}, y={pos[1]}, orientation={orientation}")
            
            elif topic == "/map":
                # Process map update
                map_data = data.get("data", {})
                logger.debug(f"Map update received")
                self.current_map = map_data
        
        except Exception as e:
            logger.error(f"Process map message error: {e}")
    
    async def get_available_maps(self) -> List[Dict[str, Any]]:
        \"\"\"Get list of available maps\"\"\"
        try:
            url = f"{self.rest_url}/maps"
            headers = {"Authorization": f"Secret {self.robot_secret}"}
            
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                maps_data = response.json()
                logger.info(f"Retrieved {len(maps_data)} maps")
                return maps_data
            else:
                logger.error(f"Failed to get maps: HTTP {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"Error getting maps: {e}")
            return []
    
    async def set_current_map(self, map_id: str) -> bool:
        \"\"\"Set the current map\"\"\"
        try:
            url = f"{self.rest_url}/maps/set_current"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            payload = {"map_id": map_id}
            
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                logger.info(f"Set current map to {map_id}")
                return True
            else:
                logger.error(f"Failed to set map: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error setting map: {e}")
            return False
    
    async def navigate_to_position(self, x: float, y: float, orientation: float = None) -> bool:
        \"\"\"Navigate to a position on the map\"\"\"
        try:
            url = f"{self.rest_url}/move"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            payload = {"x": x, "y": y}
            if orientation is not None:
                payload["orientation"] = orientation
            
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                logger.info(f"Navigating to position: x={x}, y={y}")
                self.map_state = MapState.NAVIGATING
                return True
            else:
                logger.error(f"Failed to navigate: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error navigating: {e}")
            return False
    
    async def cancel_navigation(self) -> bool:
        \"\"\"Cancel current navigation\"\"\"
        try:
            url = f"{self.rest_url}/cancel"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            response = requests.post(url, headers=headers)
            if response.status_code == 200:
                logger.info(f"Navigation cancelled")
                self.map_state = MapState.IDLE
                return True
            else:
                logger.error(f"Failed to cancel navigation: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error cancelling navigation: {e}")
            return False
    
    async def start_mapping(self) -> bool:
        \"\"\"Start mapping\"\"\"
        try:
            url = f"{self.rest_url}/mapping/start"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            response = requests.post(url, headers=headers)
            if response.status_code == 200:
                logger.info(f"Mapping started")
                self.map_state = MapState.MAPPING
                return True
            else:
                logger.error(f"Failed to start mapping: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error starting mapping: {e}")
            return False
    
    async def finish_mapping(self, map_name: str = None) -> bool:
        \"\"\"Finish mapping\"\"\"
        try:
            url = f"{self.rest_url}/mapping/finish"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            payload = {}
            if map_name:
                payload["name"] = map_name
            
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code == 200:
                logger.info(f"Mapping finished")
                self.map_state = MapState.IDLE
                return True
            else:
                logger.error(f"Failed to finish mapping: HTTP {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error finishing mapping: {e}")
            return False
    
    async def get_position(self) -> Dict[str, Any]:
        \"\"\"Get current position\"\"\"
        try:
            url = f"{self.rest_url}/pose"
            headers = {"Authorization": f"Secret {self.robot_secret}"}
            
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                position_data = response.json()
                logger.info(f"Current position: {position_data}")
                self.position = position_data
                return position_data
            else:
                logger.error(f"Failed to get position: HTTP {response.status_code}")
                return {}
        except Exception as e:
            logger.error(f"Error getting position: {e}")
            return {}
    
    async def close(self):
        \"\"\"Close the map module\"\"\"
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Map module disconnected")

async def main():
    \"\"\"Main entry point for the Map Module\"\"\"
    # Use localhost since we're running on the robot
    robot_ip = os.environ.get("ROBOT_IP", "localhost")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    map_module = MapModule(robot_ip, robot_port)
    
    try:
        await map_module.connect()
        
        # Get available maps
        maps = await map_module.get_available_maps()
        if maps:
            logger.info(f"Available maps: {len(maps)}")
            # Set the first map as current
            if len(maps) > 0:
                await map_module.set_current_map(maps[0]["id"])
        
        # Keep running
        while True:
            if not map_module.connected:
                await map_module.connect()
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Map module shutting down...")
    finally:
        await map_module.close()
        logger.info("Map module shutdown complete")

if __name__ == "__main__":
    logger.info("Starting Robot AI Map Module")
    asyncio.run(main())
"""

# Updater module for remote updates without manual intervention
UPDATER_MODULE_CODE = """#!/usr/bin/env python3
\"\"\"
Robot AI Updater Module
This module adds self-updating capabilities to the Robot AI system.

Author: AI Assistant
Version: 1.0.0
\"\"\"

import os
import sys
import json
import time
import base64
import hashlib
import asyncio
import logging
import tempfile
import websockets
import requests
from enum import Enum
from typing import List, Dict, Optional, Any, Union

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class UpdateState(Enum):
    IDLE = "idle"
    CHECKING = "checking"
    DOWNLOADING = "downloading"
    UPDATING = "updating"
    RESTARTING = "restarting"
    ERROR = "error"

class UpdaterModule:
    \"\"\"Updater module for Robot AI with self-updating capabilities\"\"\"
    
    def __init__(self, robot_ip: str = "localhost", robot_port: int = 8090):
        \"\"\"Initialize the Updater Module\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.ws_url = f"ws://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"http://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        self.update_state = UpdateState.IDLE
        self.modules_dir = self._find_modules_directory()
        self.versions = {}
        self.update_server_url = os.environ.get("UPDATE_SERVER_URL", "http://47.180.91.99:3000/api/updates")
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Updater Module initialized for {self.robot_ip}:{self.robot_port}")
        logger.info(f"Using modules directory: {self.modules_dir}")
        
        # Initialize versions information
        self._load_versions()
    
    def _find_modules_directory(self) -> str:
        \"\"\"Find the modules directory where Robot AI modules are installed\"\"\"
        # Try common Android storage locations
        possible_dirs = [
            "/storage/emulated/0/Documents/modules",
            "/sdcard/Documents/modules",
            "/data/local/tmp"
        ]
        
        # Check if this script is in one of those directories
        script_dir = os.path.dirname(os.path.realpath(__file__))
        if os.path.exists(script_dir) and os.access(script_dir, os.W_OK):
            logger.info(f"Using current script directory: {script_dir}")
            return script_dir
        
        # Otherwise check possible locations
        for directory in possible_dirs:
            if os.path.exists(directory) and os.access(directory, os.W_OK):
                logger.info(f"Found writable modules directory: {directory}")
                return directory
        
        # Fallback to temporary directory
        logger.warning("No suitable modules directory found, using temporary directory")
        return tempfile.gettempdir()
    
    def _load_versions(self):
        \"\"\"Load current module versions\"\"\"
        try:
            self.versions = {}
            # Check all Python files in the modules directory
            if os.path.exists(self.modules_dir):
                for filename in os.listdir(self.modules_dir):
                    if filename.endswith('.py') and 'robot-ai-' in filename:
                        file_path = os.path.join(self.modules_dir, filename)
                        with open(file_path, 'r') as f:
                            content = f.read()
                            # Extract version information
                            try:
                                # Look for Version: X.Y.Z pattern
                                version_info = None
                                for line in content.split('\\n')[:20]:  # Look in first 20 lines
                                    if 'Version:' in line:
                                        version_info = line.split('Version:')[1].strip()
                                        break
                                
                                module_name = filename.replace('.py', '')
                                self.versions[module_name] = {
                                    'path': file_path,
                                    'version': version_info or '0.0.0',
                                    'hash': hashlib.md5(content.encode()).hexdigest()
                                }
                            except Exception as e:
                                logger.error(f"Error parsing version info for {filename}: {e}")
            
            logger.info(f"Loaded versions for {len(self.versions)} modules: {', '.join(self.versions.keys())}")
            
        except Exception as e:
            logger.error(f"Error loading module versions: {e}")
    
    async def connect(self):
        \"\"\"Connect to robot WebSocket\"\"\"
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot WebSocket")
            
            # Subscribe to update-related topics
            await self.subscribe_topics()
            
            # Start listening for updates
            await self.listen_for_updates()
        except Exception as e:
            logger.error(f"Updater connection error: {e}")
            self.connected = False
    
    async def subscribe_topics(self):
        \"\"\"Subscribe to update-related topics\"\"\"
        if not self.connected:
            logger.error("Cannot subscribe: not connected")
            return
            
        try:
            # Subscribe to topics for receiving update commands
            topics = ["/updates/command"]
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Subscribed to topics: {topics}")
        except Exception as e:
            logger.error(f"Subscribe error: {e}")
    
    async def listen_for_updates(self):
        \"\"\"Listen for update commands\"\"\"
        if not self.connected:
            logger.error("Cannot listen: not connected")
            return
            
        try:
            async for message in self.websocket:
                await self.process_update_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Listen error: {e}")
            self.connected = False
    
    async def process_update_message(self, message: str):
        \"\"\"Process update-related messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/updates/command":
                command = data.get("command", "")
                
                if command == "check_updates":
                    logger.info("Received check_updates command")
                    await self.check_for_updates()
                
                elif command == "update":
                    logger.info("Received update command")
                    module = data.get("module")
                    version = data.get("version")
                    if module and version:
                        await self.update_module(module, version)
                    else:
                        # Update all modules
                        await self.update_all_modules()
                
                elif command == "restart":
                    logger.info("Received restart command")
                    service_name = data.get("service", "robot-ai")
                    await self.restart_service(service_name)
                
                elif command == "status":
                    logger.info("Received status command")
                    await self.send_status()
        
        except Exception as e:
            logger.error(f"Process update message error: {e}")
    
    async def check_for_updates(self) -> Dict[str, Any]:
        \"\"\"Check for available updates from the update server\"\"\"
        try:
            self.update_state = UpdateState.CHECKING
            logger.info(f"Checking for updates from {self.update_server_url}")
            
            # Prepare current versions information
            self._load_versions()  # Refresh versions info
            
            payload = {
                "robot_id": os.environ.get("ROBOT_ID", "unknown"),
                "modules": self.versions
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            response = requests.post(
                f"{self.update_server_url}/check", 
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                updates = response.json()
                logger.info(f"Found {len(updates)} available updates")
                
                # Broadcast update information
                await self.broadcast_update_status({
                    "status": "updates_available",
                    "updates": updates
                })
                
                self.update_state = UpdateState.IDLE
                return updates
            else:
                logger.error(f"Error checking for updates: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return {}
                
        except Exception as e:
            logger.error(f"Error checking for updates: {e}")
            self.update_state = UpdateState.ERROR
            return {}
    
    async def update_module(self, module_name: str, version: str) -> bool:
        \"\"\"Update a specific module to the specified version\"\"\"
        try:
            self.update_state = UpdateState.DOWNLOADING
            logger.info(f"Updating module {module_name} to version {version}")
            
            # Broadcast update status
            await self.broadcast_update_status({
                "status": "updating",
                "module": module_name,
                "version": version
            })
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            # Request module update from update server
            payload = {
                "robot_id": os.environ.get("ROBOT_ID", "unknown"),
                "module": module_name,
                "version": version
            }
            
            response = requests.post(
                f"{self.update_server_url}/download", 
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                update_data = response.json()
                module_code = update_data.get("code")
                module_version = update_data.get("version")
                
                if not module_code:
                    logger.error("No module code received in update response")
                    self.update_state = UpdateState.ERROR
                    return False
                
                # Determine module filename
                module_filename = f"{module_name}.py"
                if not module_filename.startswith("robot-ai-"):
                    module_filename = f"robot-ai-{module_filename}"
                
                # Save backup of current module
                module_path = os.path.join(self.modules_dir, module_filename)
                if os.path.exists(module_path):
                    backup_path = f"{module_path}.bak"
                    try:
                        with open(module_path, 'r') as src, open(backup_path, 'w') as dst:
                            dst.write(src.read())
                        logger.info(f"Created backup at {backup_path}")
                    except Exception as e:
                        logger.error(f"Failed to create backup: {e}")
                
                # Write new module version
                try:
                    self.update_state = UpdateState.UPDATING
                    with open(module_path, 'w') as f:
                        f.write(module_code)
                    
                    # Make executable
                    os.chmod(module_path, 0o755)
                    
                    logger.info(f"Successfully updated {module_filename} to version {module_version}")
                    
                    # Update versions information
                    self._load_versions()
                    
                    # Broadcast successful update
                    await self.broadcast_update_status({
                        "status": "updated",
                        "module": module_name,
                        "version": module_version
                    })
                    
                    self.update_state = UpdateState.IDLE
                    return True
                    
                except Exception as e:
                    logger.error(f"Failed to write updated module: {e}")
                    self.update_state = UpdateState.ERROR
                    
                    # Try to restore from backup
                    if os.path.exists(backup_path):
                        try:
                            with open(backup_path, 'r') as src, open(module_path, 'w') as dst:
                                dst.write(src.read())
                            logger.info(f"Restored from backup")
                        except Exception as e2:
                            logger.error(f"Failed to restore from backup: {e2}")
                    
                    return False
            else:
                logger.error(f"Error downloading update: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return False
                
        except Exception as e:
            logger.error(f"Error updating module: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def update_all_modules(self) -> bool:
        \"\"\"Update all modules that have updates available\"\"\"
        try:
            # Check for available updates
            updates = await self.check_for_updates()
            
            if not updates:
                logger.info("No updates available")
                return True
            
            # Update each module that has an update available
            success = True
            for module_info in updates:
                module_name = module_info.get("module")
                version = module_info.get("version")
                
                if module_name and version:
                    module_success = await self.update_module(module_name, version)
                    if not module_success:
                        logger.warning(f"Failed to update {module_name} to version {version}")
                        success = False
            
            # If all updates were successful, restart the service
            if success:
                logger.info("All modules updated successfully, restarting service")
                await self.restart_service("robot-ai")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating all modules: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def broadcast_update_status(self, status: Dict[str, Any]):
        \"\"\"Broadcast update status through WebSocket\"\"\"
        try:
            if self.connected and self.websocket:
                message = json.dumps({
                    "topic": "/updates/status",
                    "data": status
                })
                await self.websocket.send(message)
                logger.debug(f"Broadcasted update status: {status['status']}")
        except Exception as e:
            logger.error(f"Error broadcasting update status: {e}")
    
    async def restart_service(self, service_name: str = "robot-ai") -> bool:
        \"\"\"Restart a system service\"\"\"
        try:
            self.update_state = UpdateState.RESTARTING
            logger.info(f"Restarting service {service_name}")
            
            # Broadcast service restart
            await self.broadcast_update_status({
                "status": "restarting",
                "service": service_name
            })
            
            url = f"{self.rest_url}/services/restart"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            payload = {
                "name": service_name
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Successfully restarted service {service_name}")
                self.update_state = UpdateState.IDLE
                return True
            else:
                logger.error(f"Failed to restart service: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return False
                
        except Exception as e:
            logger.error(f"Error restarting service: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def send_status(self):
        \"\"\"Send current status information\"\"\"
        try:
            # Prepare status information
            status = {
                "update_state": self.update_state.value,
                "modules": self.versions,
                "modules_dir": self.modules_dir,
                "update_server": self.update_server_url
            }
            
            # Broadcast status
            await self.broadcast_update_status({
                "status": "status",
                "data": status
            })
            
            logger.info(f"Sent status information")
            return status
            
        except Exception as e:
            logger.error(f"Error sending status: {e}")
            return None
    
    async def check_update_schedule(self):
        \"\"\"Check for updates on a schedule\"\"\"
        try:
            # Check for updates once a day
            while True:
                await asyncio.sleep(24 * 60 * 60)  # 24 hours
                logger.info("Performing scheduled update check")
                await self.check_for_updates()
        except Exception as e:
            logger.error(f"Error in update schedule: {e}")
    
    async def close(self):
        \"\"\"Close the updater module\"\"\"
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Updater module disconnected")

async def main():
    \"\"\"Main entry point for the Updater Module\"\"\"
    # Use localhost since we're running on the robot
    robot_ip = os.environ.get("ROBOT_IP", "localhost")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    updater_module = UpdaterModule(robot_ip, robot_port)
    
    try:
        # Start the scheduled update checker
        update_checker_task = asyncio.create_task(updater_module.check_update_schedule())
        
        # Connect to the robot
        await updater_module.connect()
        
        # Check for updates on startup
        await updater_module.check_for_updates()
        
        # Keep running
        while True:
            if not updater_module.connected:
                await updater_module.connect()
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Updater module shutting down...")
    finally:
        await updater_module.close()
        logger.info("Updater module shutdown complete")

if __name__ == "__main__":
    logger.info("Starting Robot AI Updater Module")
    asyncio.run(main())
"""

def install_modules(modules_path: str) -> List[str]:
    """Install all Robot AI modules"""
    installed_modules = []
    
    # Install core module
    core_path = f"{modules_path}/robot-ai-core.py"
    try:
        with open(core_path, 'w') as f:
            f.write(CORE_MODULE_CODE)
        os.chmod(core_path, 0o755)  # Make executable
        print_status(f"✅ Installed core module at {core_path}")
        installed_modules.append(core_path)
    except Exception as e:
        print_status(f"❌ Error installing core module: {e}")
    
    # Install camera module
    camera_path = f"{modules_path}/robot-ai-camera.py"
    try:
        with open(camera_path, 'w') as f:
            f.write(CAMERA_MODULE_CODE)
        os.chmod(camera_path, 0o755)  # Make executable
        print_status(f"✅ Installed camera module at {camera_path}")
        installed_modules.append(camera_path)
    except Exception as e:
        print_status(f"❌ Error installing camera module: {e}")
    
    # Install map module
    map_path = f"{modules_path}/robot-ai-map.py"
    try:
        with open(map_path, 'w') as f:
            f.write(MAP_MODULE_CODE)
        os.chmod(map_path, 0o755)  # Make executable
        print_status(f"✅ Installed map module at {map_path}")
        installed_modules.append(map_path)
    except Exception as e:
        print_status(f"❌ Error installing map module: {e}")
    
    # Install updater module
    updater_path = f"{modules_path}/robot-ai-updater.py"
    try:
        with open(updater_path, 'w') as f:
            f.write(UPDATER_MODULE_CODE)
        os.chmod(updater_path, 0o755)  # Make executable
        print_status(f"✅ Installed updater module at {updater_path}")
        installed_modules.append(updater_path)
    except Exception as e:
        print_status(f"❌ Error installing updater module: {e}")
    
    return installed_modules

def create_launcher_script(robot_secret: str, module_paths: List[str]) -> str:
    """Create a launcher script that sets environment variables and launches all modules"""
    launcher_path = "/data/local/tmp/robot-ai-launcher.sh"
    
    # Start with the shebang and comments
    launcher_code = """#!/bin/sh
# Robot AI Launcher
# This script sets environment variables and starts all Robot AI modules

# Export environment variables
"""
    
    # Add environment variables
    launcher_code += f"""export ROBOT_IP="localhost"
export ROBOT_PORT="8090"
export ROBOT_SECRET="{robot_secret}"

# Create log directory if it doesn't exist
mkdir -p /data/local/tmp/robot-ai-logs

# Log startup
echo "$(date): Starting Robot AI modules" >> /data/local/tmp/robot-ai-logs/startup.log

"""
    
    # Add module launch commands
    for i, module_path in enumerate(module_paths):
        module_name = os.path.basename(module_path).replace(".py", "")
        launcher_code += f"""
# Launch {module_name}
echo "Starting {module_name}..."
python3 {module_path} >> /data/local/tmp/robot-ai-logs/{module_name}.log 2>&1 &
MODULE_{i}_PID=$!
echo "{module_name} started with PID $MODULE_{i}_PID"
echo "{module_name}:$MODULE_{i}_PID" >> /data/local/tmp/robot-ai-logs/pids.log
sleep 2  # Small delay between module starts
"""
    
    # Add final message
    launcher_code += """
echo "All Robot AI modules started successfully"
echo "$(date): All modules started" >> /data/local/tmp/robot-ai-logs/startup.log
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
        
        # 4. Install all modules
        installed_modules = install_modules(modules_path)
        if not installed_modules:
            print_status("❌ Failed to install any modules")
            return False
        
        print_status(f"✅ Successfully installed {len(installed_modules)} modules")
        
        # 5. Create launcher script for all modules
        launcher_path = create_launcher_script(robot_secret, installed_modules)
        if not launcher_path:
            return False
        
        # 6. Register service
        if not register_service(robot_port, robot_secret, launcher_path):
            return False
        
        # 7. Start service
        if not start_service(robot_port, robot_secret):
            return False
        
        print_status("✅ Installation completed successfully")
        print_status(f"✅ Installed {len(installed_modules)} modules:")
        for i, module in enumerate(installed_modules, 1):
            module_name = os.path.basename(module)
            print_status(f"  {i}. {module_name}")
        
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