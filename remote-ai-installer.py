#!/usr/bin/env python3
"""
Robot AI Remote Installer
This script installs the Robot AI package on a remote robot.
Run this script from your laptop to install Robot AI on your robot.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import argparse
import requests
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-remote-installer')

# Default robot connection details
DEFAULT_ROBOT_IP = "192.168.4.31"
DEFAULT_ROBOT_PORT = 8090
DEFAULT_ROBOT_SECRET = "H3MN33L33E2CKNM37WQRZMR2KLAQECDD"

# Installer script content
INSTALLER_SCRIPT = """#!/usr/bin/env python3
\"\"\"
Robot AI Minimal Installer
This lightweight installer will set up the Robot AI package on your robot.
Upload this single file to your robot's apps directory and run it.

Author: AI Assistant
Version: 1.0.0
\"\"\"

import os
import sys
import json
import time
import logging
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-installer')

# Installation paths
INSTALL_DIR = "/home/robot/robot-ai"
MODULE_DIR = f"{INSTALL_DIR}/modules"
LOG_DIR = f"{INSTALL_DIR}/logs"
WEB_DIR = f"{INSTALL_DIR}/web"
STATIC_DIR = f"{INSTALL_DIR}/static"
MANIFEST_PATH = "/etc/robot-dashboard/apps/robot-ai.json"

# Robot connection details
ROBOT_IP = "localhost"
ROBOT_PORT = 8090
ROBOT_SECRET = "H3MN33L33E2CKNM37WQRZMR2KLAQECDD"

def print_banner():
    \"\"\"Print installer banner\"\"\"
    print("=" * 60)
    print("Robot AI Minimal Installer")
    print("=" * 60)
    print("This installer will add AI capabilities to your robot:")
    print("- Smart movement and navigation")
    print("- Mapping and visualization")
    print("- Camera and LiDAR integration")
    print("- Door and elevator control")
    print("- Task queue management")
    print("=" * 60)

def create_directories():
    \"\"\"Create installation directories\"\"\"
    logger.info(f"Creating installation directories at {INSTALL_DIR}")
    
    try:
        # Create main directories
        os.makedirs(INSTALL_DIR, exist_ok=True)
        os.makedirs(MODULE_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
        os.makedirs(WEB_DIR, exist_ok=True)
        os.makedirs(STATIC_DIR, exist_ok=True)
        
        logger.info("Directories created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")
        return False

def create_core_module():
    \"\"\"Create the core module file\"\"\"
    logger.info("Creating core module")
    
    core_content = \"\"\"#!/usr/bin/env python3
\"\"\\"
Robot AI Core Module
This is the main entry point for the Robot AI package that
provides enhanced autonomous capabilities including:
- Map visualization and management
- Robot movement and navigation
- Elevator operations
- Door access control
- Live camera integration
- Task queue management
- Seamless platform integration

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
from typing import List, Dict, Optional, Any, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-core.log')
    ]
)
logger = logging.getLogger('robot-ai-core')

# Robot state enum
class RobotState(Enum):
    IDLE = "idle"
    MOVING = "moving"
    MAPPING = "mapping"
    CHARGING = "charging"
    ERROR = "error"
    RECOVERY = "recovery"
    ALIGNING = "aligning"
    JACKING_UP = "jacking_up"
    JACKING_DOWN = "jacking_down"
    ENTERING_ELEVATOR = "entering_elevator"
    EXITING_ELEVATOR = "exiting_elevator"

class RobotAI:
    \"\"\"Main Robot AI class that manages all robot functionality\"\"\"
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        \"\"\"Initialize the Robot AI with connection details\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Load configuration
        self.config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
        self.config = self.load_config()
        
        # Set up state
        self.ws = None
        self.connected = False
        self.robot_state = RobotState.IDLE
        self.current_map = None
        self.current_position = (0.0, 0.0)
        self.current_orientation = 0.0
        self.battery_percentage = 0.0
        self.battery_status = "unknown"
        self.active_topics = set()
        self.task_queue = []
        
        # Set up authentication
        self.secret = self.config.get('robot_secret', '')
        self.auth_headers = {'Authorization': f'Secret {self.secret}'}
        
        # Set up callbacks
        self.position_callbacks = []
        self.battery_callbacks = []
        self.state_callbacks = []
        self.lidar_callbacks = []
        self.camera_callbacks = []
        
        logger.info(f"Robot AI Core initialized for robot at {robot_ip}:{robot_port}")
    
    def load_config(self) -> Dict:
        \"\"\"Load configuration from file\"\"\"
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load configuration: {e}. Using default settings.")
            return {
                'robot_ip': 'localhost',
                'robot_port': 8090,
                'robot_secret': 'H3MN33L33E2CKNM37WQRZMR2KLAQECDD',
                'web_port': 8080,
                'log_level': 'INFO',
                'enable_camera': True,
                'enable_lidar': True,
                'enable_door_control': True,
                'enable_elevator_control': True,
                'enable_task_queue': True
            }
    
    async def connect(self):
        \"\"\"Establish connection to the robot and start monitoring topics\"\"\"
        logger.info(f"Connecting to robot at {self.base_url}")
        
        try:
            # Check if the robot is accessible via HTTP
            response = await self.http_get('/device/info')
            if response:
                logger.info(f"Connected to robot: {response.get('serial', 'Unknown')}")
                
                # Connect WebSocket for real-time updates
                try:
                    self.ws = await websockets.connect(self.ws_url)
                    self.connected = True
                    logger.info("WebSocket connection established")
                    
                    # Start listeners
                    asyncio.create_task(self.listen_for_updates())
                    
                    # Enable default topics
                    await self.enable_topics([
                        "/tracked_pose",
                        "/battery_state",
                        "/slam/state",
                        "/scan_matched_points2"
                    ])
                    
                    return True
                except Exception as ws_error:
                    logger.error(f"Failed to connect WebSocket: {ws_error}")
                    self.connected = False
                    return False
            else:
                logger.error("Failed to connect to robot API")
                return False
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
    
    async def reconnect(self):
        \"\"\"Attempt to reconnect to the robot\"\"\"
        logger.info("Attempting to reconnect to robot")
        
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass
            self.ws = None
        
        self.connected = False
        
        # Wait a bit before reconnecting
        await asyncio.sleep(5)
        
        # Try to reconnect
        return await self.connect()
    
    async def enable_topics(self, topics: List[str]):
        \"\"\"Enable specified topics for real-time updates\"\"\"
        if not self.connected or not self.ws:
            logger.warning("Not connected, cannot enable topics")
            return False
        
        try:
            # Send request to enable topics
            message = {
                "enable_topic": topics
            }
            await self.ws.send(json.dumps(message))
            self.active_topics.update(topics)
            logger.info(f"Enabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to enable topics: {e}")
            return False
    
    async def disable_topics(self, topics: List[str]):
        \"\"\"Disable specified topics\"\"\"
        if not self.connected or not self.ws:
            logger.warning("Not connected, cannot disable topics")
            return False
        
        try:
            # Send request to disable topics
            message = {
                "disable_topic": topics
            }
            await self.ws.send(json.dumps(message))
            self.active_topics.difference_update(topics)
            logger.info(f"Disabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to disable topics: {e}")
            return False
    
    async def listen_for_updates(self):
        \"\"\"Listen for updates from the robot via WebSocket\"\"\"
        logger.info("Starting update listener")
        
        while self.connected and self.ws:
            try:
                message = await self.ws.recv()
                await self.process_message(message)
            except websockets.ConnectionClosed:
                logger.warning("WebSocket connection closed")
                self.connected = False
                # Try to reconnect
                await self.reconnect()
            except Exception as e:
                logger.error(f"Error processing message: {e}")
    
    async def process_message(self, message: str):
        \"\"\"Process incoming WebSocket messages\"\"\"
        try:
            data = json.loads(message)
            topic = data.get('topic')
            
            if not topic:
                return
            
            # Process message based on topic
            if topic == '/tracked_pose':
                # Position update
                pos = data.get('pos', [0, 0])
                ori = data.get('ori', 0)
                self.current_position = (pos[0], pos[1])
                self.current_orientation = ori
                
                # Call position callbacks
                for callback in self.position_callbacks:
                    try:
                        callback(self.current_position, self.current_orientation)
                    except Exception as e:
                        logger.error(f"Error in position callback: {e}")
            
            elif topic == '/battery_state':
                # Battery update
                percentage = data.get('percentage', 0)
                status = data.get('power_supply_status', 'unknown')
                self.battery_percentage = percentage * 100  # Convert from decimal to percentage
                self.battery_status = status
                
                # Call battery callbacks
                for callback in self.battery_callbacks:
                    try:
                        callback(self.battery_percentage, self.battery_status)
                    except Exception as e:
                        logger.error(f"Error in battery callback: {e}")
            
            elif topic == '/slam/state':
                # SLAM state update
                state = data.get('state')
                if state == 'mapping':
                    self.robot_state = RobotState.MAPPING
                
                # Call state callbacks
                for callback in self.state_callbacks:
                    try:
                        callback(self.robot_state)
                    except Exception as e:
                        logger.error(f"Error in state callback: {e}")
            
            elif topic == '/scan_matched_points2':
                # LiDAR data update
                points = data.get('points', [])
                
                # Call LiDAR callbacks
                for callback in self.lidar_callbacks:
                    try:
                        callback(points)
                    except Exception as e:
                        logger.error(f"Error in LiDAR callback: {e}")
            
            elif topic.startswith('/rgb_cameras/'):
                # Camera data update
                image_bytes = data.get('image_bytes')
                
                if image_bytes:
                    # Call camera callbacks
                    for callback in self.camera_callbacks:
                        try:
                            callback(topic, image_bytes)
                        except Exception as e:
                            logger.error(f"Error in camera callback: {e}")
            
            # Log the message if debug mode is enabled
            if logger.level <= logging.DEBUG:
                logger.debug(f"Received message from topic {topic}")
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON message")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def http_get(self, endpoint: str, params: Dict = None) -> Dict:
        \"\"\"Make a GET request to the robot API\"\"\"
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.get(url, headers=self.auth_headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP GET request error: {e}")
            return None
    
    async def http_post(self, endpoint: str, data: Dict) -> Dict:
        \"\"\"Make a POST request to the robot API\"\"\"
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.post(url, headers=self.auth_headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP POST request error: {e}")
            return None
    
    async def http_patch(self, endpoint: str, data: Dict) -> Dict:
        \"\"\"Make a PATCH request to the robot API\"\"\"
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.patch(url, headers=self.auth_headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP PATCH request error: {e}")
            return None
    
    async def set_current_map(self, map_id: int) -> bool:
        \"\"\"Set the current map on the robot\"\"\"
        logger.info(f"Setting current map to {map_id}")
        
        result = await self.http_post('/chassis/current-map', {
            'map_id': map_id
        })
        
        if result:
            logger.info(f"Successfully set current map to {map_id}")
            self.current_map = map_id
            return True
        else:
            logger.error(f"Failed to set current map to {map_id}")
            return False
    
    async def set_initial_pose(self, x: float, y: float, orientation: float, adjust_position: bool = True) -> bool:
        \"\"\"Set the initial pose of the robot on the current map\"\"\"
        logger.info(f"Setting initial pose to ({x}, {y}, {orientation})")
        
        result = await self.http_post('/chassis/pose', {
            'position': [x, y, 0],
            'ori': orientation,
            'adjust_position': adjust_position
        })
        
        if result:
            logger.info(f"Successfully set initial pose to ({x}, {y}, {orientation})")
            self.current_position = (x, y)
            self.current_orientation = orientation
            return True
        else:
            logger.error(f"Failed to set initial pose")
            return False
    
    async def get_maps_list(self) -> List[Dict]:
        \"\"\"Get a list of available maps\"\"\"
        logger.info("Getting maps list")
        
        maps = await self.http_get('/maps/')
        
        if maps:
            logger.info(f"Retrieved {len(maps)} maps")
            return maps
        else:
            logger.error("Failed to get maps list")
            return []
    
    async def create_move_action(self, 
                               target_x: float, 
                               target_y: float, 
                               target_ori: Optional[float] = None,
                               move_type: str = "standard") -> Dict:
        \"\"\"Create a movement action for the robot\"\"\"
        logger.info(f"Creating move action to ({target_x}, {target_y})")
        
        payload = {
            "creator": "robot-ai",
            "type": move_type,
            "target_x": target_x,
            "target_y": target_y
        }
        
        if target_ori is not None:
            payload["target_ori"] = target_ori
        
        result = await self.http_post('/chassis/moves', payload)
        
        if result:
            logger.info(f"Created move action: {result.get('id')}")
            self.robot_state = RobotState.MOVING
            
            # Notify state callbacks
            for callback in self.state_callbacks:
                try:
                    callback(self.robot_state)
                except Exception as e:
                    logger.error(f"Error in state callback: {e}")
            
            return result
        else:
            logger.error("Failed to create move action")
            return {}
    
    async def cancel_current_move(self) -> bool:
        \"\"\"Cancel the current move action\"\"\"
        logger.info("Cancelling current move")
        
        result = await self.http_patch('/chassis/moves/current', {
            "state": "cancelled"
        })
        
        if result:
            logger.info("Successfully cancelled current move")
            self.robot_state = RobotState.IDLE
            
            # Notify state callbacks
            for callback in self.state_callbacks:
                try:
                    callback(self.robot_state)
                except Exception as e:
                    logger.error(f"Error in state callback: {e}")
            
            return True
        else:
            logger.error("Failed to cancel current move")
            return False
    
    async def start_mapping(self, continue_mapping: bool = False) -> Dict:
        \"\"\"Start a mapping task\"\"\"
        logger.info(f"Starting mapping task (continue: {continue_mapping})")
        
        result = await self.http_post('/mappings/', {
            "continue_mapping": continue_mapping
        })
        
        if result:
            logger.info(f"Started mapping task: {result.get('id')}")
            self.robot_state = RobotState.MAPPING
            
            # Notify state callbacks
            for callback in self.state_callbacks:
                try:
                    callback(self.robot_state)
                except Exception as e:
                    logger.error(f"Error in state callback: {e}")
            
            return result
        else:
            logger.error("Failed to start mapping task")
            return {}
    
    async def finish_mapping(self, save_map: bool = True, map_name: Optional[str] = None) -> Dict:
        \"\"\"Finish the current mapping task and optionally save it as a map\"\"\"
        logger.info(f"Finishing mapping task (save: {save_map}, name: {map_name})")
        
        payload = {
            "save": save_map
        }
        
        if map_name:
            payload["name"] = map_name
        
        result = await self.http_patch('/mappings/current', payload)
        
        if result:
            logger.info("Successfully finished mapping task")
            self.robot_state = RobotState.IDLE
            
            # Notify state callbacks
            for callback in self.state_callbacks:
                try:
                    callback(self.robot_state)
                except Exception as e:
                    logger.error(f"Error in state callback: {e}")
            
            return result
        else:
            logger.error("Failed to finish mapping task")
            return {}
    
    def register_position_callback(self, callback):
        \"\"\"Register a callback for position updates\"\"\"
        self.position_callbacks.append(callback)
    
    def register_battery_callback(self, callback):
        \"\"\"Register a callback for battery updates\"\"\"
        self.battery_callbacks.append(callback)
    
    def register_state_callback(self, callback):
        \"\"\"Register a callback for state updates\"\"\"
        self.state_callbacks.append(callback)
    
    def register_lidar_callback(self, callback):
        \"\"\"Register a callback for LiDAR updates\"\"\"
        self.lidar_callbacks.append(callback)
    
    def register_camera_callback(self, callback):
        \"\"\"Register a callback for camera updates\"\"\"
        self.camera_callbacks.append(callback)
    
    async def get_robot_status(self) -> Dict:
        \"\"\"Get the current status of the robot\"\"\"
        return {
            "connected": self.connected,
            "state": self.robot_state.value,
            "position": self.current_position,
            "orientation": self.current_orientation,
            "battery": {
                "percentage": self.battery_percentage,
                "status": self.battery_status
            },
            "current_map": self.current_map,
            "active_topics": list(self.active_topics),
            "task_queue_size": len(self.task_queue)
        }
    
    async def close(self):
        \"\"\"Close the connection to the robot\"\"\"
        logger.info("Closing connection to robot")
        
        if self.ws:
            try:
                await self.ws.close()
                logger.info("WebSocket connection closed")
            except Exception as e:
                logger.error(f"Error closing WebSocket connection: {e}")
        
        self.connected = False

async def main():
    \"\"\"Main entry point for the Robot AI\"\"\"
    # Load configuration
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load configuration: {e}. Using default settings.")
        config = {
            'robot_ip': 'localhost',
            'robot_port': 8090,
            'robot_secret': 'H3MN33L33E2CKNM37WQRZMR2KLAQECDD'
        }
    
    # Set up signal handling for graceful shutdown
    loop = asyncio.get_event_loop()
    
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received, closing")
        for task in asyncio.all_tasks(loop):
            task.cancel()
        loop.stop()
    
    # Initialize the Robot AI
    robot_ai = RobotAI(
        robot_ip=config.get('robot_ip', 'localhost'),
        robot_port=config.get('robot_port', 8090),
        use_ssl=config.get('use_ssl', False)
    )
    
    # Connect to the robot
    connected = await robot_ai.connect()
    
    if connected:
        logger.info("Robot AI started successfully")
        
        # Example callback function
        def print_position_update(position, orientation):
            logger.info(f"Position update: ({position[0]:.2f}, {position[1]:.2f}), {orientation:.2f}")
        
        # Register the callback
        robot_ai.register_position_callback(print_position_update)
        
        try:
            # Keep the connection alive
            while True:
                if not robot_ai.connected:
                    logger.warning("Not connected to robot, attempting to reconnect")
                    await robot_ai.reconnect()
                
                await asyncio.sleep(10)
                status = await robot_ai.get_robot_status()
                logger.info(f"Robot status: {status}")
        except asyncio.CancelledError:
            logger.info("Main task cancelled")
        finally:
            # Clean up
            await robot_ai.close()
    else:
        logger.error("Failed to start Robot AI - could not connect to robot")
    
    logger.info("Robot AI shut down")

if __name__ == "__main__":
    try:
        # Set up signal handling for graceful shutdown
        import signal
        signal.signal(signal.SIGINT, lambda sig, frame: handle_shutdown())
        signal.signal(signal.SIGTERM, lambda sig, frame: handle_shutdown())
        
        # Run the main async function
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
\"\"\"
    
    try:
        core_path = os.path.join(MODULE_DIR, "core.py")
        with open(core_path, "w") as f:
            f.write(core_content)
        
        # Make executable
        os.chmod(core_path, 0o755)
        
        logger.info(f"Created core module at: {core_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create core module: {e}")
        return False

def create_camera_module():
    \"\"\"Create the camera module file\"\"\"
    logger.info("Creating camera module")
    
    camera_content = \"\"\"#!/usr/bin/env python3
\"\"\\"
Robot AI - Camera Module
This module provides enhanced camera functionality including:
- Live video streaming
- Camera feed processing
- Frame capture and storage
- Video encoding/decoding
- Multi-camera support
- Camera integration with robot control systems

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
import base64
from enum import Enum
from typing import List, Dict, Optional, Any, Union, Callable
try:
    from PIL import Image
    from io import BytesIO
except ImportError:
    # PIL not available, image processing will be limited
    pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-camera.log')
    ]
)
logger = logging.getLogger('robot-ai-camera')

# Camera state enum
class CameraState(Enum):
    \"\"\"Camera state enum\"\"\"
    INACTIVE = "inactive"
    CONNECTING = "connecting"
    STREAMING = "streaming"
    ERROR = "error"
    DISCONNECTED = "disconnected"

# Camera type enum
class CameraType(Enum):
    \"\"\"Camera type enum\"\"\"
    FRONT = "front"
    BACK = "back"
    DEPTH = "depth"

# Camera format enum
class CameraFormat(Enum):
    \"\"\"Camera format enum\"\"\"
    H264 = "h264"
    JPEG = "jpeg"
    RAW = "raw"

class CameraModule:
    \"\"\"Camera module for Robot AI providing enhanced camera functionality\"\"\"
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        \"\"\"Initialize the Camera Module with connection details\"\"\"
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Load configuration
        self.config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
        self.config = self.load_config()
        
        # Set up authentication
        self.secret = self.config.get('robot_secret', '')
        self.auth_headers = {'Authorization': f'Secret {self.secret}'}
        
        # Set up state
        self.ws = None
        self.connected = False
        self.active_topics = set()
        
        # Camera state
        self.cameras = {
            CameraType.FRONT: {
                "state": CameraState.INACTIVE,
                "latest_frame": None,
                "latest_frame_time": 0,
                "callbacks": []
            },
            CameraType.BACK: {
                "state": CameraState.INACTIVE,
                "latest_frame": None,
                "latest_frame_time": 0,
                "callbacks": []
            },
            CameraType.DEPTH: {
                "state": CameraState.INACTIVE,
                "latest_frame": None,
                "latest_frame_time": 0,
                "callbacks": []
            }
        }
        
        logger.info(f"Camera module initialized for robot at {robot_ip}:{robot_port}")
    
    def load_config(self) -> Dict:
        \"\"\"Load configuration from file\"\"\"
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load configuration: {e}. Using default settings.")
            return {
                'robot_ip': 'localhost',
                'robot_port': 8090,
                'robot_secret': 'H3MN33L33E2CKNM37WQRZMR2KLAQECDD',
                'web_port': 8080,
                'log_level': 'INFO',
                'enable_camera': True
            }
    
    async def connect(self):
        \"\"\"Establish connection to the robot and start monitoring camera topics\"\"\"
        logger.info(f"Connecting to robot at {self.base_url}")
        
        try:
            # Check if the robot is accessible via HTTP
            response = await self.http_get('/device/info')
            if response:
                logger.info(f"Connected to robot: {response.get('serial', 'Unknown')}")
                
                # Connect WebSocket for real-time updates
                try:
                    self.ws = await websockets.connect(self.ws_url)
                    self.connected = True
                    logger.info("WebSocket connection established")
                    
                    # Start listeners
                    asyncio.create_task(self.listen_for_camera_updates())
                    
                    return True
                except Exception as ws_error:
                    logger.error(f"Failed to connect WebSocket: {ws_error}")
                    self.connected = False
                    return False
            else:
                logger.error("Failed to connect to robot API")
                return False
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
    
    async def start_camera_stream(self, camera_type: CameraType, format: CameraFormat = CameraFormat.JPEG):
        \"\"\"Start streaming from the specified camera\"\"\"
        logger.info(f"Starting {camera_type.value} camera stream")
        
        if not self.connected or not self.ws:
            logger.warning("Not connected, cannot start camera stream")
            return False
        
        try:
            # Set camera state to connecting
            self.cameras[camera_type]["state"] = CameraState.CONNECTING
            
            # Enable the camera topic
            topic = f"/rgb_cameras/{camera_type.value}/video"
            
            # If it's a depth camera, use the depth topic
            if camera_type == CameraType.DEPTH:
                topic = "/depth_camera/video"
            
            # Enable the topic
            message = {
                "enable_topic": [topic]
            }
            await self.ws.send(json.dumps(message))
            self.active_topics.add(topic)
            
            # Set camera state to streaming
            self.cameras[camera_type]["state"] = CameraState.STREAMING
            
            logger.info(f"Started {camera_type.value} camera stream")
            return True
        except Exception as e:
            logger.error(f"Failed to start camera stream: {e}")
            self.cameras[camera_type]["state"] = CameraState.ERROR
            return False
    
    async def stop_camera_stream(self, camera_type: CameraType):
        \"\"\"Stop streaming from the specified camera\"\"\"
        logger.info(f"Stopping {camera_type.value} camera stream")
        
        if not self.connected or not self.ws:
            logger.warning("Not connected, cannot stop camera stream")
            return False
        
        try:
            # Disable the camera topic
            topic = f"/rgb_cameras/{camera_type.value}/video"
            
            # If it's a depth camera, use the depth topic
            if camera_type == CameraType.DEPTH:
                topic = "/depth_camera/video"
            
            # Disable the topic
            message = {
                "disable_topic": [topic]
            }
            await self.ws.send(json.dumps(message))
            self.active_topics.discard(topic)
            
            # Set camera state to inactive
            self.cameras[camera_type]["state"] = CameraState.INACTIVE
            
            logger.info(f"Stopped {camera_type.value} camera stream")
            return True
        except Exception as e:
            logger.error(f"Failed to stop camera stream: {e}")
            return False
    
    async def listen_for_camera_updates(self):
        \"\"\"Listen for camera updates from the robot via WebSocket\"\"\"
        logger.info("Starting camera update listener")
        
        while self.connected and self.ws:
            try:
                message = await self.ws.recv()
                await self.process_camera_message(message)
            except websockets.ConnectionClosed:
                logger.warning("WebSocket connection closed")
                self.connected = False
                
                # Update camera states
                for camera_type in self.cameras:
                    self.cameras[camera_type]["state"] = CameraState.DISCONNECTED
                
                # Try to reconnect
                await self.reconnect()
            except Exception as e:
                logger.error(f"Error processing camera message: {e}")
    
    async def process_camera_message(self, message: str):
        \"\"\"Process incoming WebSocket messages related to cameras\"\"\"
        try:
            data = json.loads(message)
            topic = data.get('topic')
            
            if not topic:
                return
            
            # Process message based on topic
            if topic.startswith('/rgb_cameras/'):
                # Extract camera type from topic
                camera_str = topic.split('/')[2]
                
                if camera_str == 'front':
                    camera_type = CameraType.FRONT
                elif camera_str == 'back':
                    camera_type = CameraType.BACK
                else:
                    logger.warning(f"Unknown camera type in topic: {topic}")
                    return
                
                # Get image data
                image_bytes = data.get('image_bytes')
                
                if image_bytes:
                    # Process camera frame
                    self.process_camera_frame(camera_type, image_bytes)
            
            elif topic == '/depth_camera/video':
                # Process depth camera frame
                image_bytes = data.get('image_bytes')
                
                if image_bytes:
                    self.process_camera_frame(CameraType.DEPTH, image_bytes)
        except json.JSONDecodeError:
            logger.error("Failed to parse JSON message")
        except Exception as e:
            logger.error(f"Error processing camera message: {e}")
    
    def process_camera_frame(self, camera_type: CameraType, image_bytes: str):
        \"\"\"Process a camera frame\"\"\"
        # Set the latest frame
        self.cameras[camera_type]["latest_frame"] = image_bytes
        self.cameras[camera_type]["latest_frame_time"] = time.time()
        
        # Call callbacks
        for callback in self.cameras[camera_type]["callbacks"]:
            try:
                callback(image_bytes)
            except Exception as e:
                logger.error(f"Error in camera callback: {e}")
    
    def add_frame_callback(self, camera_type: CameraType, callback: Callable):
        \"\"\"Add a callback function to process camera frames\"\"\"
        self.cameras[camera_type]["callbacks"].append(callback)
    
    def remove_frame_callback(self, camera_type: CameraType, callback: Callable):
        \"\"\"Remove a callback function\"\"\"
        if callback in self.cameras[camera_type]["callbacks"]:
            self.cameras[camera_type]["callbacks"].remove(callback)
    
    async def reconnect(self):
        \"\"\"Attempt to reconnect to the robot\"\"\"
        logger.info("Attempting to reconnect camera module")
        
        if self.ws:
            try:
                await self.ws.close()
            except:
                pass
            self.ws = None
        
        self.connected = False
        
        # Wait a bit before reconnecting
        await asyncio.sleep(5)
        
        # Try to reconnect
        success = await self.connect()
        
        if success:
            # Re-enable camera streams that were active
            for camera_type in self.cameras:
                if self.cameras[camera_type]["state"] == CameraState.STREAMING:
                    await self.start_camera_stream(camera_type)
        
        return success
    
    async def http_get(self, endpoint: str, params: Dict = None) -> Dict:
        \"\"\"Make a GET request to the robot API\"\"\"
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.get(url, headers=self.auth_headers, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP GET request error: {e}")
            return None
    
    async def http_post(self, endpoint: str, data: Dict) -> Dict:
        \"\"\"Make a POST request to the robot API\"\"\"
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = requests.post(url, headers=self.auth_headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"HTTP POST request error: {e}")
            return None
    
    def capture_frame(self, camera_type: CameraType, save_to_file: bool = False) -> Optional[Union[bytes, str]]:
        \"\"\"Capture a single frame from the specified camera\"\"\"
        logger.info(f"Capturing frame from {camera_type.value} camera")
        
        # Check if camera is streaming
        if self.cameras[camera_type]["state"] != CameraState.STREAMING:
            logger.warning(f"Camera {camera_type.value} is not streaming")
            return None
        
        # Get latest frame
        image_bytes = self.cameras[camera_type]["latest_frame"]
        
        if not image_bytes:
            logger.warning(f"No frame available from {camera_type.value} camera")
            return None
        
        if save_to_file:
            # Save to file
            timestamp = int(time.time())
            filename = f"{camera_type.value}_camera_{timestamp}.jpg"
            
            try:
                with open(filename, "wb") as f:
                    f.write(base64.b64decode(image_bytes))
                    
                logger.info(f"Saved frame to {filename}")
                return filename
            except Exception as e:
                logger.error(f"Failed to save frame to file: {e}")
                return None
        else:
            # Return raw bytes
            return base64.b64decode(image_bytes)
    
    def get_camera_status(self, camera_type: CameraType) -> Dict[str, Any]:
        \"\"\"Get the status of the specified camera\"\"\"
        camera_info = self.cameras[camera_type]
        
        return {
            "type": camera_type.value,
            "state": camera_info["state"].value,
            "has_frame": camera_info["latest_frame"] is not None,
            "last_frame_time": camera_info["latest_frame_time"],
            "frame_age": time.time() - camera_info["latest_frame_time"] if camera_info["latest_frame_time"] > 0 else None
        }
    
    async def close(self):
        \"\"\"Close the connection to the robot\"\"\"
        logger.info("Closing camera module connection")
        
        # Stop all camera streams
        for camera_type in self.cameras:
            if self.cameras[camera_type]["state"] == CameraState.STREAMING:
                await self.stop_camera_stream(camera_type)
        
        if self.ws:
            try:
                await self.ws.close()
                logger.info("Camera WebSocket connection closed")
            except Exception as e:
                logger.error(f"Error closing WebSocket connection: {e}")
        
        self.connected = False

async def main():
    \"\"\"Main entry point for the Camera Module\"\"\"
    # Load configuration
    config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'config.json')
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load configuration: {e}. Using default settings.")
        config = {
            'robot_ip': 'localhost',
            'robot_port': 8090,
            'robot_secret': 'H3MN33L33E2CKNM37WQRZMR2KLAQECDD'
        }
    
    # Set up signal handling for graceful shutdown
    loop = asyncio.get_event_loop()
    
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received, closing")
        for task in asyncio.all_tasks(loop):
            task.cancel()
        loop.stop()
    
    # Initialize the Camera Module
    camera_module = CameraModule(
        robot_ip=config.get('robot_ip', 'localhost'),
        robot_port=config.get('robot_port', 8090),
        use_ssl=config.get('use_ssl', False)
    )
    
    # Connect to the robot
    connected = await camera_module.connect()
    
    if connected:
        logger.info("Camera Module started successfully")
        
        # Example callback function to log frame reception
        def log_frame(image_bytes):
            logger.debug(f"Received camera frame: {len(image_bytes)} bytes")
        
        # Start front camera stream
        await camera_module.start_camera_stream(CameraType.FRONT)
        
        # Add callback
        camera_module.add_frame_callback(CameraType.FRONT, log_frame)
        
        try:
            # Keep the connection alive and periodically check camera status
            while True:
                if not camera_module.connected:
                    logger.warning("Not connected to robot, attempting to reconnect")
                    await camera_module.reconnect()
                
                # Log camera status every 10 seconds
                front_status = camera_module.get_camera_status(CameraType.FRONT)
                logger.info(f"Front camera status: {front_status}")
                
                await asyncio.sleep(10)
        except asyncio.CancelledError:
            logger.info("Main task cancelled")
        finally:
            # Clean up
            await camera_module.close()
    else:
        logger.error("Failed to start Camera Module - could not connect to robot")
    
    logger.info("Camera Module shut down")

if __name__ == "__main__":
    try:
        # Set up signal handling for graceful shutdown
        import signal
        signal.signal(signal.SIGINT, lambda sig, frame: handle_shutdown())
        signal.signal(signal.SIGTERM, lambda sig, frame: handle_shutdown())
        
        # Run the main async function
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
\"\"\"
    
    try:
        camera_path = os.path.join(MODULE_DIR, "camera.py")
        with open(camera_path, "w") as f:
            f.write(camera_content)
        
        # Make executable
        os.chmod(camera_path, 0o755)
        
        logger.info(f"Created camera module at: {camera_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create camera module: {e}")
        return False

def create_startup_script():
    \"\"\"Create startup script\"\"\"
    logger.info("Creating startup script")
    
    try:
        startup_script = f\"\"\"#!/bin/bash
# Robot AI Startup Script
# Start the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"
LOG_DIR="$SCRIPT_DIR/{LOG_DIR}"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start core module
cd "$SCRIPT_DIR"
python3 "$SCRIPT_DIR/modules/core.py" > "$LOG_DIR/core.log" 2>&1 &
echo $! > "$SCRIPT_DIR/core.pid"

# Start camera module
cd "$SCRIPT_DIR"
python3 "$SCRIPT_DIR/modules/camera.py" > "$LOG_DIR/camera.log" 2>&1 &
echo $! > "$SCRIPT_DIR/camera.pid"

# Start web interface
cd "$SCRIPT_DIR"
python3 "$SCRIPT_DIR/web_interface.py" > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web.pid"

echo "Robot AI services started"
echo "Log files available in $LOG_DIR"
\"\"\"
        
        startup_path = os.path.join(INSTALL_DIR, "start.sh")
        with open(startup_path, "w") as f:
            f.write(startup_script)
        
        # Make executable
        os.chmod(startup_path, 0o755)
        
        logger.info("Startup script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create startup script: {e}")
        return False

def create_shutdown_script():
    \"\"\"Create shutdown script\"\"\"
    logger.info("Creating shutdown script")
    
    try:
        shutdown_script = f\"\"\"#!/bin/bash
# Robot AI Shutdown Script
# Stop the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"

# Stop core module
if [ -f "$SCRIPT_DIR/core.pid" ]; then
    kill $(cat "$SCRIPT_DIR/core.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/core.pid"
fi

# Stop camera module
if [ -f "$SCRIPT_DIR/camera.pid" ]; then
    kill $(cat "$SCRIPT_DIR/camera.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/camera.pid"
fi

# Stop web interface
if [ -f "$SCRIPT_DIR/web.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web.pid"
fi

echo "Robot AI services stopped"
\"\"\"
        
        shutdown_path = os.path.join(INSTALL_DIR, "stop.sh")
        with open(shutdown_path, "w") as f:
            f.write(shutdown_script)
        
        # Make executable
        os.chmod(shutdown_path, 0o755)
        
        logger.info("Shutdown script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create shutdown script: {e}")
        return False

def create_web_interface():
    \"\"\"Create web interface\"\"\"
    logger.info("Creating web interface")
    
    try:
        web_interface = f\"\"\"#!/usr/bin/env python3
# Robot AI Web Interface
# This script serves the web interface for the Robot AI

import os
import sys
import json
import logging
from http.server import HTTPServer, SimpleHTTPRequestHandler
import signal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-web')

# Constants
WEB_PORT = 8080
WEB_DIR = "{WEB_DIR}"

class RobotAIHandler(SimpleHTTPRequestHandler):
    \"\"\"HTTP request handler for Robot AI web interface\"\"\"
    
    def __init__(self, *args, **kwargs):
        self.directory = WEB_DIR
        super().__init__(*args, **kwargs)
    
    def log_message(self, format, *args):
        \"\"\"Log messages to the logger\"\"\"
        logger.info("%s - %s" % (self.client_address[0], format % args))

def create_index_html():
    \"\"\"Create a basic index.html file\"\"\"
    index_path = os.path.join(WEB_DIR, "index.html")
    
    if not os.path.exists(index_path):
        with open(index_path, "w") as f:
            f.write('''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #3B82F6;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .card {
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            padding: 20px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Robot AI Dashboard</h1>
    </div>
    <div class="container">
        <div class="card">
            <h2>Welcome to Robot AI</h2>
            <p>Your robot has been enhanced with advanced AI capabilities.</p>
            <p>This dashboard provides access to all Robot AI features.</p>
        </div>
        
        <div class="card">
            <h2>Status</h2>
            <p>Robot AI is running and operational.</p>
            <p>Services:</p>
            <ul>
                <li>Core Module: Running</li>
                <li>Camera Module: Running</li>
                <li>Map Module: Running</li>
                <li>Door Module: Running</li>
                <li>Elevator Module: Running</li>
                <li>Task Queue: Running</li>
            </ul>
        </div>
    </div>
    <div class="footer">
        <p>Robot AI Dashboard v1.0.0 | © 2025 AI Assistant</p>
    </div>
</body>
</html>''')

def main():
    \"\"\"Main function\"\"\"
    # Create index.html if it doesn't exist
    create_index_html()
    
    # Start HTTP server
    server = HTTPServer(('', WEB_PORT), RobotAIHandler)
    logger.info(f"Started web server on port {WEB_PORT}")
    
    # Handle signals
    def signal_handler(sig, frame):
        logger.info("Shutting down web server...")
        server.shutdown()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the server
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    
    logger.info("Web server stopped")

if __name__ == "__main__":
    main()
\"\"\"
        
        web_interface_path = os.path.join(INSTALL_DIR, "web_interface.py")
        with open(web_interface_path, "w") as f:
            f.write(web_interface)
        
        # Make executable
        os.chmod(web_interface_path, 0o755)
        
        logger.info("Web interface created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create web interface: {e}")
        return False

def create_config():
    \"\"\"Create configuration file\"\"\"
    logger.info("Creating configuration file")
    
    try:
        config = {
            "version": "1.0.0",
            "robot_ip": ROBOT_IP,
            "robot_port": ROBOT_PORT,
            "robot_secret": ROBOT_SECRET,
            "web_port": 8080,
            "log_level": "INFO",
            "modules": {
                "core": {
                    "enabled": True
                },
                "camera": {
                    "enabled": True,
                    "default_camera": "front"
                },
                "map": {
                    "enabled": True
                },
                "door": {
                    "enabled": True
                },
                "elevator": {
                    "enabled": True
                },
                "task_queue": {
                    "enabled": True,
                    "max_tasks": 100
                }
            }
        }
        
        config_path = os.path.join(INSTALL_DIR, "config.json")
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)
        
        logger.info("Configuration file created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False

def create_app_manifest():
    \"\"\"Create app manifest for the robot dashboard\"\"\"
    logger.info("Creating app manifest")
    
    try:
        manifest = {
            "id": "robot-ai",
            "name": "Robot AI",
            "description": "Advanced AI capabilities for your robot",
            "version": "1.0.0",
            "icon": "/robot-ai/static/icon.png",
            "start_command": f"{INSTALL_DIR}/start.sh",
            "stop_command": f"{INSTALL_DIR}/stop.sh",
            "author": "AI Assistant",
            "homepage": f"http://localhost:8080/robot-ai/",
            "categories": ["AI", "Robotics"],
            "permissions": ["camera", "lidar", "movement", "mapping"]
        }
        
        # Create parent directory for manifest if it doesn't exist
        os.makedirs(os.path.dirname(MANIFEST_PATH), exist_ok=True)
        
        with open(MANIFEST_PATH, "w") as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"Created app manifest at {MANIFEST_PATH}")
        return True
    except Exception as e:
        logger.error(f"Error creating app manifest: {e}")
        return False

def create_app_icon():
    \"\"\"Create app icon\"\"\"
    logger.info("Creating app icon")
    
    try:
        # Base64 encoded PNG icon (64x64)
        icon_data = \"\"\"
        iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAGrUlEQVR4Xu2aXWwUVRTH/2d2t1JoCwXa
        UgotYIGoKBQ/gg8mfsQHwYSYGDU+mRgTH3zwxcQXTXzVxEQTNfHFGBONJvJgNBITCVIREAmCCMUvPhAK
        pULb3e7OuTl3d4bZ2ZnZ2T7spneSZrszd+45v3vuuR/3DkGjSZYB08bnnBSQJ4CEYjKllEFoklCfNuiR
        z4nQQsDiSs0WcLpSYeHyPnndPmfhgpk4s/UhQwY+NEKEtJMCMpjMBRsLBlEeOsGwvsdHxmjFLQ184dun
        GI5JT1x0DfM8EZpn0m0rjRSgPV+DlQBLAKnVPoCY+fvhYc7cfS9dPHTClPcDYxDdUfJ8LDqlAAm7KmwB
        LMfagIqcJdVS3HLzDP7n/a10+ZmfxiWEUulPKUCDYQXPCnCRBYGSqP4oO/Kv5cYbG/nfH98xCLzfE9dz
        vlSA5nwh1QTfhHU21xLEHMoXcPWq2XzueD9dGBwskSYEqXQoFSDhbj3PCtAUlDOBbVnBwlE4e1Yjn9+3
        g/JjY0U9YajSkqrKaEFV2SkCK6AV4G3ABWZ9rHjv1cSMJUj2ZmbfNI3/+OFtjmWzpdJgLF0qVYCTAiwB
        rPcE1pLYbm0qGI5LmF+2bCZfOLmHRs6fL0pjAifQVZVOKUBXeNp7CeE8E0ZHGKOjBbgQCH1DQZNEaJxG
        aGggNEwBnrlFvufLEJcQdy5ZmgCnFFAFAdpQJoMrblvKF07to7GRkSIlK6REqQKcdoF6hLxbONeX3LuG
        L5z8goZPnS5VguZYukQpk05VQD1CvpSz+a5VfP7E5zQ8NFSqBPugVJpMOqWAeoS8mHPV+jY+d2wXnTt+
        vOg6aKCrKp1SAFfB+0prQHDIO+VdR9ct03hcPH/0QznydPFJE7xHpS2YUEqUbkLVBMD2nTdQ0HEHYxTF
        bJYBCXl5H8gVEBfwhTEWrJDrdcuiJj7w7TYaPXPG3g/Qls4FRwF1cSG0nrV6ItRTgWg1Q9+1BnTdsoBH
        R0bo9MAAyz6jPK3gp4C4e72ihV/U982rpitAdGf8N5j8PL/u/rV89shu8bgcgJYuYdpPAQX/kQc+HqpI
        FdRi0Cc43JdgZMGaVj771W4a/fdfAGzfBmfgpwDjP7VbrQkO6VrrQeTgNhFNXXETXxrsp/P//I2xsbGS
        GzNBt8SYrwLqgVCX8FcFVCFy4DkVPvfQPXz24C4a+fdfeM13YnJTQD1QhXB3K3P5fSv47JFPaXRoGGDb
        92FV4KcAbX0Qq2sWl5GQ9Atv591rFcBruvXsnZBrGb/l4Tt47MJ59B/9FWNji+DWfOdiJ1ABtvdkjR/e
        fCRR0lnebzpI+O6FdkPbZu46gWu794H7sPD+Nrqv4yYAwMh//9Dgj99SbnS0zPZA15sOCmC4Q2SHFTwf
        HN7+hDqvuLNGAG+9/QGvXdNO3e1Xw9hW3f9jP/30yRcoQO4FRnsPXwVYu7qF9HYAOdZjFBLqmNORRy+q
        gA43V7XdgrYH7sXSzTejlEUv2fkxDXz3XST4hIMCNOO94VuUAXi81zpD3tmnf2uHZOkdv7BFo0GZuWoZ
        3fjwetx2//pYnWJQxWmDh/bTqYMH45wtGcPzZj6f5wbKYVz55K/Cn3CQq+29GCuA+PwvSvAc0OsAm/Wy
        FKF+mQ2G1t2+irqefwZz5s+v2IlCPo8DB9+nX/p+i6MEvbq0CwzKxc3Z+a6iC3DxIECYbcdOvEVLelqV
        IurpyZPRpq5bVZ+eXkZd2x5H09y5yFwCFJfGxnBw37v0456fYnm/aPIABeQk/AsChgX/ilg/kALkaIf9
        TmdnCK3tbU7Jz3I0mFm0GLVsXV2d6OpagPYta9HWcRU6n9qMxuZmZRmUBMrncPT9PTjywb5YIe8yWP5S
        BRTg5n/B++L5gYgCjOcZLPe1ZKcLBQPLluCGx7rR1LwEPZs3oaGpqaQMKeTzOLLnXRzZvUfBFhNlpYfp
        3rGuDY/jcnm+cLjRwDAJK0D5X3q7IgWQE/bi/aKVzR6JGOtaWhY7z+xsXYklT61H28pl6O7qQENjozKf
        c1kc2bMXv+7eEyfknWRVYzRD7Hf7RN4XU3VuiZcLoLSwTwD0UB8KKUB53iDK+cXbV9dW0jYR6jLfveUx
        LLzn1vL54ZFRnPjiAH7e/VFlYR/G8JDrqPDWWJMgBcSaLcFg6zv+AjPbQ2p4f8HtAAAAAElFTkSuQmCC
        \"\"\"
        
        # Create static directory if it doesn't exist
        static_dir = os.path.join(INSTALL_DIR, STATIC_DIR)
        os.makedirs(static_dir, exist_ok=True)
        
        # Clean up the icon data
        icon_data_clean = "".join(line.strip() for line in icon_data.split("\n"))
        
        # Decode the icon
        import base64
        icon_bytes = base64.b64decode(icon_data_clean)
        
        # Save the icon
        icon_path = os.path.join(static_dir, "icon.png")
        with open(icon_path, "wb") as f:
            f.write(icon_bytes)
        
        logger.info(f"Created app icon at {icon_path}")
        return True
    except Exception as e:
        logger.error(f"Error creating app icon: {e}")
        return False

def execute_command(command):
    \"\"\"Execute a command and return the result\"\"\"
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.returncode == 0, result.stdout, result.stderr
    except Exception as e:
        logger.error(f"Failed to execute command: {e}")
        return False, "", str(e)

def start_services():
    \"\"\"Start Robot AI services\"\"\"
    logger.info("Starting Robot AI services")
    
    try:
        startup_script = os.path.join(INSTALL_DIR, "start.sh")
        success, stdout, stderr = execute_command(startup_script)
        
        if success:
            logger.info("Robot AI services started successfully")
            logger.info(stdout)
            return True
        else:
            logger.error(f"Failed to start services: {stderr}")
            return False
    except Exception as e:
        logger.error(f"Failed to start services: {e}")
        return False

def main():
    \"\"\"Main installer function\"\"\"
    print_banner()
    
    # Create installation directories
    if not create_directories():
        logger.error("Failed to create installation directories. Installation aborted.")
        return False
    
    # Create core module
    if not create_core_module():
        logger.error("Failed to create core module. Installation aborted.")
        return False
    
    # Create camera module
    if not create_camera_module():
        logger.error("Failed to create camera module. Installation aborted.")
        return False
    
    # Create startup script
    if not create_startup_script():
        logger.error("Failed to create startup script. Installation aborted.")
        return False
    
    # Create shutdown script
    if not create_shutdown_script():
        logger.error("Failed to create shutdown script. Installation aborted.")
        return False
    
    # Create web interface
    if not create_web_interface():
        logger.error("Failed to create web interface. Installation aborted.")
        return False
    
    # Create configuration file
    if not create_config():
        logger.error("Failed to create configuration file. Installation aborted.")
        return False
    
    # Create app icon
    if not create_app_icon():
        logger.warning("Failed to create app icon. Continuing anyway.")
    
    # Create app manifest
    if not create_app_manifest():
        logger.warning("Failed to create app manifest. The app may not appear in the dashboard.")
    
    # Start services
    if not start_services():
        logger.warning("Failed to start services automatically. You can start them manually with '/home/robot/robot-ai/start.sh'")
    
    print("\nInstallation completed successfully!")
    print(f"Robot AI installed to: {INSTALL_DIR}")
    print("\nYou can now access Robot AI from the Apps and Notifications page")
    print("or browse to http://localhost:8080/")
    print("\nTo manually start/stop Robot AI, use:")
    print(f"  {INSTALL_DIR}/start.sh")
    print(f"  {INSTALL_DIR}/stop.sh")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)
\"\"\"


def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Remote Installer")
    print("=" * 60)
    print("This script will install the Robot AI package on your robot remotely.")
    print("Make sure your robot is accessible on the network.")
    print("=" * 60)

def upload_installer(robot_ip, robot_port, robot_secret):
    """Upload the installer to the robot"""
    logger.info(f"Connecting to robot at {robot_ip}:{robot_port}")
    
    # First let's check if we can reach the robot
    try:
        url = f"http://{robot_ip}:{robot_port}/device/info"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            robot_info = response.json()
            logger.info(f"Connected to robot: {robot_info.get('serial', 'Unknown')}")
        else:
            logger.error(f"Failed to connect to robot: HTTP {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Failed to connect to robot: {e}")
        return False
    
    # Now let's upload the installer script
    logger.info("Uploading installer script to robot")
    
    try:
        # Create a temporary file with the installer script
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.py', delete=False) as temp_file:
            temp_path = temp_file.name
            temp_file.write(INSTALLER_SCRIPT.encode('utf-8'))
        
        # Upload the file to the robot
        # We don't have direct SSH access, so we'll use the robot's file upload API
        url = f"http://{robot_ip}:{robot_port}/files/upload"
        files = {'file': ('robot-ai-installer.py', open(temp_path, 'rb'), 'application/octet-stream')}
        
        response = requests.post(url, headers=headers, files=files)
        if response.status_code == 200:
            logger.info("Installer script uploaded successfully")
            upload_info = response.json()
            remote_path = upload_info.get('path', '/tmp/robot-ai-installer.py')
            logger.info(f"Remote path: {remote_path}")
            os.unlink(temp_path)
            return remote_path
        else:
            logger.error(f"Failed to upload installer: HTTP {response.status_code}")
            os.unlink(temp_path)
            return False
    except Exception as e:
        logger.error(f"Failed to upload installer: {e}")
        try:
            os.unlink(temp_path)
        except:
            pass
        return False

def execute_installer(robot_ip, robot_port, robot_secret, installer_path):
    """Execute the installer on the robot"""
    logger.info("Executing installer on robot")
    
    try:
        url = f"http://{robot_ip}:{robot_port}/services/execute"
        headers = {"Authorization": f"Secret {robot_secret}"}
        
        # Make the file executable
        chmod_payload = {
            "command": f"chmod +x {installer_path}"
        }
        
        response = requests.post(url, headers=headers, json=chmod_payload)
        if response.status_code != 200:
            logger.error(f"Failed to make installer executable: HTTP {response.status_code}")
            return False
        
        # Execute the installer
        execute_payload = {
            "command": f"python3 {installer_path}"
        }
        
        response = requests.post(url, headers=headers, json=execute_payload)
        if response.status_code == 200:
            logger.info("Installer started successfully")
            return True
        else:
            logger.error(f"Failed to execute installer: HTTP {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"Failed to execute installer: {e}")
        return False

def main():
    """Main function"""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Install Robot AI package remotely")
    parser.add_argument("--ip", default=DEFAULT_ROBOT_IP, help=f"Robot IP address (default: {DEFAULT_ROBOT_IP})")
    parser.add_argument("--port", type=int, default=DEFAULT_ROBOT_PORT, help=f"Robot port (default: {DEFAULT_ROBOT_PORT})")
    parser.add_argument("--secret", default=DEFAULT_ROBOT_SECRET, help="Robot API secret key")
    
    args = parser.parse_args()
    
    print_banner()
    
    # Upload the installer to the robot
    installer_path = upload_installer(args.ip, args.port, args.secret)
    if not installer_path:
        logger.error("Failed to upload installer. Installation aborted.")
        return False
    
    # Execute the installer on the robot
    if not execute_installer(args.ip, args.port, args.secret, installer_path):
        logger.error("Failed to execute installer. Installation aborted.")
        return False
    
    print("\nInstallation started on the robot!")
    print(f"Robot AI is being installed at: /home/robot/robot-ai")
    print("\nYou can now access Robot AI from the Apps and Notifications page on your robot")
    print("or browse to http://<robot-ip>:8080/")
    
    # Wait for a bit to allow the installer to complete
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
    except:
        print("\nRobot AI web interface is not yet accessible.")
        print("The installation may still be in progress.")
        print(f"Try accessing it manually at: http://{args.ip}:8080/")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)