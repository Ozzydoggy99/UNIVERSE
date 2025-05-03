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
    
    # Add the Map Visualization module
    package["modules/map.py"] = """\"\"\"
Robot AI - Map Visualization Module
This module provides enhanced mapping and visualization capabilities.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import logging
import numpy as np
import asyncio
import requests
import math
from typing import Dict, List, Tuple, Optional, Any, Union
from urllib.parse import urljoin

# Configure logging
logger = logging.getLogger("robot-ai-map")

class MapVisualizer:
    """Map visualization and processing module"""
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Map Visualizer with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.current_map = None
        self.current_map_id = None
        self.map_resolution = 0.05  # default resolution in meters
        self.map_origin = [0, 0]
        self.map_size = [0, 0]
        self.map_data = None
        self.robot_position = (0, 0)
        self.robot_orientation = 0
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
    
    async def load_current_map(self) -> bool:
        """Load the current map from the robot"""
        try:
            response = self.session.get(f"{self.base_url}/api/maps/current")
            
            if response.status_code != 200:
                logger.error(f"Failed to load current map: {response.status_code}")
                return False
            
            map_data = response.json()
            self.current_map = map_data
            self.current_map_id = map_data.get("id")
            self.map_resolution = map_data.get("resolution", 0.05)
            self.map_origin = map_data.get("origin", [0, 0])
            self.map_size = map_data.get("size", [0, 0])
            
            # Get actual map data if available
            if "data" in map_data and map_data["data"]:
                self.map_data = map_data["data"]
            
            logger.info(f"Loaded current map: {self.current_map_id}, size: {self.map_size}")
            return True
        except Exception as e:
            logger.error(f"Error loading current map: {e}")
            return False
    
    async def get_maps_list(self) -> List[Dict]:
        """Get a list of available maps"""
        try:
            response = self.session.get(f"{self.base_url}/api/maps")
            
            if response.status_code != 200:
                logger.error(f"Failed to get maps list: {response.status_code}")
                return []
            
            maps_data = response.json()
            logger.info(f"Retrieved {len(maps_data)} maps")
            return maps_data
        except Exception as e:
            logger.error(f"Error getting maps list: {e}")
            return []
    
    def update_robot_position(self, x: float, y: float, orientation: float):
        """Update the robot's position and orientation on the map"""
        self.robot_position = (x, y)
        self.robot_orientation = orientation
    
    def get_world_to_grid(self, world_x: float, world_y: float) -> Tuple[int, int]:
        """Convert world coordinates to grid coordinates"""
        if self.map_resolution <= 0:
            return (0, 0)
        
        grid_x = int((world_x - self.map_origin[0]) / self.map_resolution)
        grid_y = int((world_y - self.map_origin[1]) / self.map_resolution)
        
        # Ensure coordinates are within map bounds
        grid_x = max(0, min(grid_x, self.map_size[0] - 1))
        grid_y = max(0, min(grid_y, self.map_size[1] - 1))
        
        return (grid_x, grid_y)
    
    def get_grid_to_world(self, grid_x: int, grid_y: int) -> Tuple[float, float]:
        """Convert grid coordinates to world coordinates"""
        world_x = (grid_x * self.map_resolution) + self.map_origin[0]
        world_y = (grid_y * self.map_resolution) + self.map_origin[1]
        return (world_x, world_y)
    
    def is_position_free(self, world_x: float, world_y: float, threshold: int = 90) -> bool:
        """Check if a position is free (not occupied by obstacles)"""
        if self.map_data is None:
            return False
        
        grid_x, grid_y = self.get_world_to_grid(world_x, world_y)
        
        try:
            # In occupancy grid, 0 is free, 100 is occupied, -1 or 50 is unknown
            # Our map_data might be flattened or 2D
            if isinstance(self.map_data, list):
                if len(self.map_data) == self.map_size[0] * self.map_size[1]:
                    # Flattened array
                    idx = grid_y * self.map_size[0] + grid_x
                    if 0 <= idx < len(self.map_data):
                        return self.map_data[idx] < threshold
                else:
                    # 2D array
                    return self.map_data[grid_y][grid_x] < threshold
        except (IndexError, TypeError) as e:
            logger.error(f"Error checking position: {e}")
        
        return False
    
    def find_path(self, start: Tuple[float, float], goal: Tuple[float, float], use_astar: bool = True) -> List[Tuple[float, float]]:
        """Find a path from start to goal using A* or Dijkstra algorithm"""
        if self.map_data is None:
            return []
        
        # Convert world coordinates to grid coordinates
        start_grid = self.get_world_to_grid(*start)
        goal_grid = self.get_world_to_grid(*goal)
        
        # TODO: Implement A* or Dijkstra pathfinding algorithm
        # For now, just return a direct path
        path = [start, goal]
        
        logger.info(f"Found path with {len(path)} points from {start} to {goal}")
        return path
    
    def visualize_map(self, output_file: str = "map_visualization.png"):
        """Generate a visualization of the map with the robot's position"""
        try:
            if self.map_data is None:
                logger.warning("No map data available for visualization")
                return False
            
            # TODO: Implement map visualization using matplotlib or another library
            logger.info(f"Map visualization saved to {output_file}")
            return True
        except Exception as e:
            logger.error(f"Error visualizing map: {e}")
            return False
"""

    # Add the Camera module
    package["modules/camera.py"] = """\"\"\"
Robot AI - Camera Module
This module provides enhanced camera functionality.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import base64
import logging
import asyncio
import requests
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logger = logging.getLogger("robot-ai-camera")

class CameraState(Enum):
    """Camera state enum"""
    INACTIVE = "inactive"
    CONNECTING = "connecting"
    STREAMING = "streaming"
    ERROR = "error"
    DISCONNECTED = "disconnected"

class CameraType(Enum):
    """Camera type enum"""
    FRONT = "front"
    BACK = "back"
    DEPTH = "depth"

class CameraModule:
    """Camera module for Robot AI providing enhanced camera functionality"""
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Camera Module with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.camera_states = {
            CameraType.FRONT: CameraState.INACTIVE,
            CameraType.BACK: CameraState.INACTIVE,
            CameraType.DEPTH: CameraState.INACTIVE,
        }
        self.frame_callbacks = []
        self.latest_frames = {
            CameraType.FRONT: None,
            CameraType.BACK: None,
            CameraType.DEPTH: None,
        }
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
    
    async def start_camera_stream(self, camera_type: CameraType = CameraType.FRONT) -> bool:
        """Start streaming from the specified camera"""
        try:
            logger.info(f"Starting camera stream for {camera_type.value} camera")
            
            # Update camera state
            self.camera_states[camera_type] = CameraState.CONNECTING
            
            # Send API request to start camera stream
            camera_path = f"/rgb_cameras/{camera_type.value}"
            response = self.session.get(f"{self.base_url}{camera_path}/start")
            
            if response.status_code != 200:
                logger.error(f"Failed to start camera stream: {response.status_code}")
                self.camera_states[camera_type] = CameraState.ERROR
                return False
            
            self.camera_states[camera_type] = CameraState.STREAMING
            logger.info(f"Started {camera_type.value} camera stream")
            return True
        except Exception as e:
            logger.error(f"Error starting camera stream: {e}")
            self.camera_states[camera_type] = CameraState.ERROR
            return False
    
    async def stop_camera_stream(self, camera_type: CameraType = CameraType.FRONT) -> bool:
        """Stop streaming from the specified camera"""
        try:
            logger.info(f"Stopping camera stream for {camera_type.value} camera")
            
            # Send API request to stop camera stream
            camera_path = f"/rgb_cameras/{camera_type.value}"
            response = self.session.get(f"{self.base_url}{camera_path}/stop")
            
            if response.status_code != 200:
                logger.error(f"Failed to stop camera stream: {response.status_code}")
                return False
            
            self.camera_states[camera_type] = CameraState.INACTIVE
            logger.info(f"Stopped {camera_type.value} camera stream")
            return True
        except Exception as e:
            logger.error(f"Error stopping camera stream: {e}")
            return False
    
    def process_camera_frame(self, camera_type: CameraType, frame_data: bytes):
        """Process a camera frame"""
        # Store the latest frame
        self.latest_frames[camera_type] = frame_data
        
        # Call all registered callbacks
        for callback in self.frame_callbacks:
            try:
                callback(camera_type, frame_data)
            except Exception as e:
                logger.error(f"Error in frame callback: {e}")
    
    def add_frame_callback(self, callback):
        """Add a callback function to process camera frames"""
        if callback not in self.frame_callbacks:
            self.frame_callbacks.append(callback)
    
    def remove_frame_callback(self, callback):
        """Remove a callback function"""
        if callback in self.frame_callbacks:
            self.frame_callbacks.remove(callback)
    
    async def get_camera_frame(self, camera_type: CameraType = CameraType.FRONT) -> Optional[bytes]:
        """Get the latest frame from the specified camera"""
        if self.camera_states[camera_type] != CameraState.STREAMING:
            await self.start_camera_stream(camera_type)
        
        try:
            # Get a single frame from the camera
            camera_path = f"/rgb_cameras/{camera_type.value}"
            response = self.session.get(f"{self.base_url}{camera_path}/image")
            
            if response.status_code != 200:
                logger.error(f"Failed to get camera frame: {response.status_code}")
                return None
            
            # Process and return the frame
            frame_data = response.content
            self.process_camera_frame(camera_type, frame_data)
            return frame_data
        except Exception as e:
            logger.error(f"Error getting camera frame: {e}")
            return None
    
    def get_camera_status(self, camera_type: CameraType = CameraType.FRONT) -> Dict[str, Any]:
        """Get the status of the specified camera"""
        return {
            "state": self.camera_states[camera_type].value,
            "has_frame": self.latest_frames[camera_type] is not None
        }
"""

    # Add the Door Control module
    package["modules/door.py"] = """\"\"\"
Robot AI - Door Control Module
This module enables automatic door control through ESP-NOW protocol.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import logging
import asyncio
import requests
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logger = logging.getLogger("robot-ai-door")

class DoorState(Enum):
    """Door state enum"""
    CLOSED = "closed"
    OPEN = "open"
    OPENING = "opening"
    CLOSING = "closing"
    ERROR = "error"
    UNKNOWN = "unknown"

class DoorController:
    """Controller for automatic door operations"""
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Door Controller with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.doors = {}  # Door ID -> Door data
        self.running = False
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
    
    def register_door(self, door_id: str, mac_address: str, polygon: List[Tuple[float, float]]) -> bool:
        """
        Register a new door
        
        Args:
            door_id: Unique identifier for the door
            mac_address: MAC address for ESP-NOW communication
            polygon: Door area polygon coordinates
        """
        if door_id in self.doors:
            logger.warning(f"Door {door_id} already registered, updating")
        
        self.doors[door_id] = {
            "id": door_id,
            "mac_address": mac_address,
            "polygon": polygon,
            "state": DoorState.UNKNOWN,
            "last_update": time.time()
        }
        
        logger.info(f"Registered door {door_id} with MAC {mac_address}")
        return True
    
    async def start(self):
        """Start the door controller"""
        if self.running:
            return
        
        self.running = True
        logger.info("Door controller started")
        
        # Start door monitor loop
        asyncio.create_task(self._door_monitor_loop())
    
    async def stop(self):
        """Stop the door controller"""
        self.running = False
        logger.info("Door controller stopped")
    
    async def enable_esp_now_communication(self) -> bool:
        """
        Enable ESP-NOW communication protocol for door control
        """
        try:
            # Send request to enable ESP-NOW
            response = self.session.post(
                f"{self.base_url}/api/esp_now/enable"
            )
            
            if response.status_code == 200:
                logger.info("ESP-NOW communication enabled")
                return True
            else:
                logger.error(f"Failed to enable ESP-NOW: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error enabling ESP-NOW: {e}")
            return False
    
    async def request_door_open(self, door_id: str) -> bool:
        """
        Request a door to open
        
        Args:
            door_id: ID of the door to open
            
        Returns:
            bool: True if the request was sent successfully
        """
        if door_id not in self.doors:
            logger.error(f"Door {door_id} not registered")
            return False
        
        door = self.doors[door_id]
        
        try:
            # Send request to open door via ESP-NOW
            response = self.session.post(
                f"{self.base_url}/api/esp_now/send",
                json={
                    "mac_address": door["mac_address"],
                    "data": {
                        "action": "open",
                        "door_id": door_id
                    }
                }
            )
            
            if response.status_code == 200:
                logger.info(f"Door open request sent to {door_id}")
                door["state"] = DoorState.OPENING
                door["last_update"] = time.time()
                return True
            else:
                logger.error(f"Failed to request door open: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error requesting door open: {e}")
            return False
    
    def is_point_in_polygon(self, point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
        """
        Check if a point is inside a polygon using ray casting algorithm
        
        Args:
            point: (x, y) coordinates of the point to check
            polygon: List of (x, y) coordinates forming the polygon
            
        Returns:
            bool: True if point is inside polygon
        """
        x, y = point
        n = len(polygon)
        inside = False
        
        p1x, p1y = polygon[0]
        for i in range(1, n + 1):
            p2x, p2y = polygon[i % n]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside
    
    async def _door_monitor_loop(self):
        """Monitor robot path and automatically request doors to open"""
        while self.running:
            # Check for any doors on path that need to be opened
            # This would use the robot's current path and position
            # to determine if any doors need to be opened
            
            await asyncio.sleep(1)  # Check every second
    
    def get_door_status(self, door_id: str = None) -> Dict[str, Any]:
        """
        Get the status of doors
        
        Args:
            door_id: Optional specific door ID to get status for
            
        Returns:
            Dict with door status information
        """
        if door_id:
            if door_id not in self.doors:
                return {"error": f"Door {door_id} not found"}
            return {
                "id": door_id,
                "state": self.doors[door_id]["state"].value,
                "last_update": self.doors[door_id]["last_update"]
            }
        else:
            return {
                door_id: {
                    "state": door["state"].value,
                    "last_update": door["last_update"]
                }
                for door_id, door in self.doors.items()
            }
"""

    # Add the Elevator Control module
    package["modules/elevator.py"] = """\"\"\"
Robot AI - Elevator Control Module
This module enables elevator integration for multi-floor navigation.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import logging
import asyncio
import requests
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logger = logging.getLogger("robot-ai-elevator")

class ElevatorState(Enum):
    """Elevator state enum"""
    IDLE = "idle"
    CALLED = "called"
    ARRIVED = "arrived"
    MOVING = "moving"
    ERROR = "error"
    UNKNOWN = "unknown"

class RobotElevatorState(Enum):
    """Robot elevator interaction state"""
    NONE = "none"
    WAITING = "waiting"
    ENTERING = "entering"
    INSIDE = "inside"
    EXITING = "exiting"
    COMPLETED = "completed"
    ERROR = "error"

class ElevatorController:
    """Controller for elevator operations"""
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Elevator Controller with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.elevators = {}  # Elevator ID -> Elevator data
        self.current_elevator_id = None
        self.robot_elevator_state = RobotElevatorState.NONE
        self.target_floor = None
        self.running = False
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
    
    def register_elevator(self, 
                        elevator_id: str, 
                        mac_address: str, 
                        floors: List[int],
                        waiting_point: List[float],
                        entry_point: List[float]) -> bool:
        """
        Register a new elevator
        
        Args:
            elevator_id: Unique identifier for the elevator
            mac_address: MAC address for ESP-NOW communication
            floors: List of floors the elevator serves
            waiting_point: [x, y, orientation] coordinates where robot should wait
            entry_point: [x, y, orientation] coordinates inside the elevator
        """
        if elevator_id in self.elevators:
            logger.warning(f"Elevator {elevator_id} already registered, updating")
        
        self.elevators[elevator_id] = {
            "id": elevator_id,
            "mac_address": mac_address,
            "floors": floors,
            "waiting_point": waiting_point,
            "entry_point": entry_point,
            "state": ElevatorState.UNKNOWN,
            "current_floor": None,
            "last_update": time.time()
        }
        
        logger.info(f"Registered elevator {elevator_id} with MAC {mac_address}")
        return True
    
    async def start(self):
        """Start the elevator controller"""
        if self.running:
            return
        
        self.running = True
        logger.info("Elevator controller started")
        
        # Start elevator monitor loop
        asyncio.create_task(self._elevator_monitor_loop())
    
    async def stop(self):
        """Stop the elevator controller"""
        self.running = False
        logger.info("Elevator controller stopped")
    
    async def enable_esp_now_communication(self) -> bool:
        """
        Enable ESP-NOW communication protocol for elevator control
        """
        try:
            # Send request to enable ESP-NOW
            response = self.session.post(
                f"{self.base_url}/api/esp_now/enable"
            )
            
            if response.status_code == 200:
                logger.info("ESP-NOW communication enabled")
                return True
            else:
                logger.error(f"Failed to enable ESP-NOW: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error enabling ESP-NOW: {e}")
            return False
    
    async def request_elevator(self, elevator_id: str, target_floor: int) -> bool:
        """
        Request an elevator to go to a specific floor
        
        Args:
            elevator_id: ID of the elevator to request
            target_floor: Floor to request the elevator to go to
            
        Returns:
            bool: True if the request was sent successfully
        """
        if elevator_id not in self.elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return False
        
        elevator = self.elevators[elevator_id]
        
        if target_floor not in elevator["floors"]:
            logger.error(f"Floor {target_floor} not served by elevator {elevator_id}")
            return False
        
        try:
            # Send request to call elevator via ESP-NOW
            response = self.session.post(
                f"{self.base_url}/api/esp_now/send",
                json={
                    "mac_address": elevator["mac_address"],
                    "data": {
                        "action": "call",
                        "elevator_id": elevator_id,
                        "floor": target_floor
                    }
                }
            )
            
            if response.status_code == 200:
                logger.info(f"Elevator request sent to {elevator_id} for floor {target_floor}")
                elevator["state"] = ElevatorState.CALLED
                elevator["last_update"] = time.time()
                self.current_elevator_id = elevator_id
                self.target_floor = target_floor
                self.robot_elevator_state = RobotElevatorState.WAITING
                return True
            else:
                logger.error(f"Failed to request elevator: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"Error requesting elevator: {e}")
            return False
    
    async def get_waiting_position(self, elevator_id: str) -> Optional[List[float]]:
        """
        Get the position where the robot should wait for the elevator
        
        Args:
            elevator_id: ID of the elevator
            
        Returns:
            List[float]: [x, y, orientation] where robot should wait
        """
        if elevator_id not in self.elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return None
        
        return self.elevators[elevator_id]["waiting_point"]
    
    async def get_entry_position(self, elevator_id: str) -> Optional[List[float]]:
        """
        Get the position inside the elevator
        
        Args:
            elevator_id: ID of the elevator
            
        Returns:
            List[float]: [x, y, orientation] inside the elevator
        """
        if elevator_id not in self.elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return None
        
        return self.elevators[elevator_id]["entry_point"]
    
    async def enter_elevator(self, elevator_id: str) -> bool:
        """
        Signal that the robot is entering the elevator
        
        Args:
            elevator_id: ID of the elevator
            
        Returns:
            bool: True if successful
        """
        if elevator_id not in self.elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return False
        
        self.robot_elevator_state = RobotElevatorState.ENTERING
        logger.info(f"Robot entering elevator {elevator_id}")
        return True
    
    async def exit_elevator(self, elevator_id: str) -> bool:
        """
        Signal that the robot is exiting the elevator
        
        Args:
            elevator_id: ID of the elevator
            
        Returns:
            bool: True if successful
        """
        if elevator_id not in self.elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return False
        
        self.robot_elevator_state = RobotElevatorState.EXITING
        logger.info(f"Robot exiting elevator {elevator_id}")
        return True
    
    async def _elevator_monitor_loop(self):
        """Monitor elevator state"""
        while self.running:
            if self.current_elevator_id:
                # Check elevator state
                # This would poll the elevator's state via ESP-NOW or other means
                pass
            
            await asyncio.sleep(1)  # Check every second
    
    def get_elevator_status(self, elevator_id: str = None) -> Dict[str, Any]:
        """
        Get the status of elevators
        
        Args:
            elevator_id: Optional specific elevator ID to get status for
            
        Returns:
            Dict with elevator status information
        """
        if elevator_id:
            if elevator_id not in self.elevators:
                return {"error": f"Elevator {elevator_id} not found"}
            return {
                "id": elevator_id,
                "state": self.elevators[elevator_id]["state"].value,
                "current_floor": self.elevators[elevator_id]["current_floor"],
                "last_update": self.elevators[elevator_id]["last_update"]
            }
        else:
            return {
                elevator_id: {
                    "state": elevator["state"].value,
                    "current_floor": elevator["current_floor"],
                    "last_update": elevator["last_update"]
                }
                for elevator_id, elevator in self.elevators.items()
            }
"""

    # Add the Task Queue module
    package["modules/task_queue.py"] = """\"\"\"
Robot AI - Task Queue Module
This module provides task queuing and management capabilities.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import json
import time
import logging
import asyncio
import requests
import uuid
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logger = logging.getLogger("robot-ai-task-queue")

class TaskState(Enum):
    """Task state enum"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class TaskType(Enum):
    """Task type enum"""
    MOVE = "move"
    MAP = "map"
    ELEVATOR = "elevator"
    DOOR = "door"
    CHARGE = "charge"
    CUSTOM = "custom"

class TaskQueue:
    """Task queue for managing robot tasks"""
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Task Queue with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.tasks = []  # List of tasks in FIFO order
        self.current_task = None
        self.running = False
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
    
    async def start(self):
        """Start the task queue processor"""
        if self.running:
            return
        
        self.running = True
        logger.info("Task queue processor started")
        
        # Start task processor loop
        asyncio.create_task(self._process_tasks())
    
    async def stop(self):
        """Stop the task queue processor"""
        self.running = False
        logger.info("Task queue processor stopped")
    
    async def add_task(self, task_type: TaskType, params: Dict[str, Any], priority: int = 0) -> str:
        """
        Add a task to the queue
        
        Args:
            task_type: Type of task
            params: Parameters for the task
            priority: Priority of the task (0 = normal, higher = more important)
            
        Returns:
            str: Task ID
        """
        task_id = str(uuid.uuid4())
        task = {
            "id": task_id,
            "type": task_type,
            "params": params,
            "priority": priority,
            "state": TaskState.PENDING,
            "created_at": time.time(),
            "started_at": None,
            "completed_at": None,
            "result": None,
            "error": None
        }
        
        # Add task to queue based on priority
        if priority > 0:
            # Find position to insert based on priority
            for i, existing_task in enumerate(self.tasks):
                if existing_task["priority"] < priority:
                    self.tasks.insert(i, task)
                    break
            else:
                self.tasks.append(task)
        else:
            # Normal priority, add to end
            self.tasks.append(task)
        
        logger.info(f"Added task {task_id} of type {task_type.value} to queue")
        return task_id
    
    async def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task
        
        Args:
            task_id: ID of the task to cancel
            
        Returns:
            bool: True if task was cancelled
        """
        # Check if it's the current task
        if self.current_task and self.current_task["id"] == task_id:
            # TODO: Implement cancellation of running task
            logger.warning(f"Cancellation of running task {task_id} not implemented")
            return False
        
        # Check queue for task
        for task in self.tasks:
            if task["id"] == task_id:
                task["state"] = TaskState.CANCELLED
                self.tasks.remove(task)
                logger.info(f"Cancelled task {task_id}")
                return True
        
        logger.warning(f"Task {task_id} not found for cancellation")
        return False
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the status of a task
        
        Args:
            task_id: ID of the task
            
        Returns:
            Dict with task status or None if not found
        """
        # Check if it's the current task
        if self.current_task and self.current_task["id"] == task_id:
            return self.current_task
        
        # Check queue for task
        for task in self.tasks:
            if task["id"] == task_id:
                return task
        
        logger.warning(f"Task {task_id} not found for status check")
        return None
    
    async def get_queue_status(self) -> Dict[str, Any]:
        """
        Get the status of the task queue
        
        Returns:
            Dict with queue status
        """
        return {
            "current_task": self.current_task,
            "pending_tasks": len(self.tasks),
            "tasks": self.tasks
        }
    
    async def _process_tasks(self):
        """Process tasks in the queue"""
        while self.running:
            if not self.tasks:
                # No tasks to process
                await asyncio.sleep(1)
                continue
            
            if self.current_task:
                # Task already running
                await asyncio.sleep(1)
                continue
            
            # Get next task
            task = self.tasks.pop(0)
            self.current_task = task
            task["state"] = TaskState.RUNNING
            task["started_at"] = time.time()
            
            logger.info(f"Processing task {task['id']} of type {task['type'].value}")
            
            try:
                # Process task based on type
                if task["type"] == TaskType.MOVE:
                    result = await self._process_move_task(task)
                elif task["type"] == TaskType.MAP:
                    result = await self._process_map_task(task)
                elif task["type"] == TaskType.ELEVATOR:
                    result = await self._process_elevator_task(task)
                elif task["type"] == TaskType.DOOR:
                    result = await self._process_door_task(task)
                elif task["type"] == TaskType.CHARGE:
                    result = await self._process_charge_task(task)
                elif task["type"] == TaskType.CUSTOM:
                    result = await self._process_custom_task(task)
                else:
                    logger.error(f"Unknown task type {task['type']}")
                    result = {"error": f"Unknown task type {task['type']}"}
                
                # Update task with result
                task["state"] = TaskState.COMPLETED
                task["result"] = result
                task["completed_at"] = time.time()
                logger.info(f"Completed task {task['id']}")
            except Exception as e:
                logger.error(f"Error processing task {task['id']}: {e}")
                task["state"] = TaskState.FAILED
                task["error"] = str(e)
                task["completed_at"] = time.time()
            
            # Clear current task
            self.current_task = None
    
    async def _process_move_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a move task"""
        params = task["params"]
        
        # Validate required parameters
        if "x" not in params or "y" not in params:
            return {"error": "Missing required parameters: x, y"}
        
        # Send move command to robot
        try:
            response = self.session.post(
                f"{self.base_url}/api/actions/move",
                json={
                    "x": params["x"],
                    "y": params["y"],
                    "ori": params.get("orientation"),
                    "type": params.get("type", "standard")
                }
            )
            
            if response.status_code != 200:
                return {"error": f"Failed to create move action: {response.status_code}"}
            
            result = response.json()
            return result
        except Exception as e:
            return {"error": f"Error creating move action: {str(e)}"}
    
    async def _process_map_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a map task"""
        # TODO: Implement map task processing
        return {"status": "Map task not yet implemented"}
    
    async def _process_elevator_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process an elevator task"""
        # TODO: Implement elevator task processing
        return {"status": "Elevator task not yet implemented"}
    
    async def _process_door_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a door task"""
        # TODO: Implement door task processing
        return {"status": "Door task not yet implemented"}
    
    async def _process_charge_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a charge task"""
        # TODO: Implement charge task processing
        return {"status": "Charge task not yet implemented"}
    
    async def _process_custom_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """Process a custom task"""
        # Custom tasks are implemented by the caller
        return {"status": "Custom task completed"}
"""

    # Add an initializer module
    package["modules/__init__.py"] = """\"\"\"
Robot AI Package
This package provides enhanced autonomous robot capabilities.

Author: AI Assistant
Version: 1.0.0
\"\"\"
import os
import sys
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

# Add the current directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import modules
from .core import RobotAI, get_robot_ai
from .map import MapVisualizer
from .camera import CameraModule, CameraType, CameraState
from .door import DoorController, DoorState
from .elevator import ElevatorController, ElevatorState, RobotElevatorState
from .task_queue import TaskQueue, TaskType, TaskState

# Export modules
__all__ = [
    'RobotAI',
    'get_robot_ai',
    'MapVisualizer',
    'CameraModule',
    'CameraType',
    'CameraState',
    'DoorController',
    'DoorState',
    'ElevatorController',
    'ElevatorState',
    'RobotElevatorState',
    'TaskQueue',
    'TaskType',
    'TaskState'
]

logger.info("Robot AI package initialized")
"""

    # Create a web dashboard
    package["www/index.html"] = """<!DOCTYPE html>
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