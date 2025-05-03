#!/usr/bin/env python3
"""
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
"""

import asyncio
import base64
import json
import logging
import os
import signal
import sys
import time
import uuid
from enum import Enum
from typing import Dict, List, Optional, Tuple, Union, Any
import websockets
import requests
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai.log')
    ]
)
logger = logging.getLogger('robot-ai')

# Robot State Constants
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
    """Main Robot AI class that manages all robot functionality"""
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Robot AI with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Robot state
        self.state = RobotState.IDLE
        self.current_pose = {"pos": [0, 0], "ori": 0}
        self.battery_state = {"percentage": 0, "power_supply_status": "unknown"}
        self.current_map_id = None
        self.current_map_data = None
        self.point_cloud = []
        self.camera_feed = None
        self.connection_status = {"connected": False, "last_heartbeat": None}
        self.current_task = None
        self.task_queue = []
        
        # WebSocket connection
        self.ws = None
        self.topics_enabled = []
        
        # IoT integrations
        self.registered_doors = {}  # {door_id: {"mac": mac_address, "polygon": [...], "status": "closed"}}
        self.registered_elevators = {}  # {elevator_id: {"mac": mac_address, "floors": [...], "status": "idle"}}
        
        logger.info(f"Robot AI initialized for robot at {self.base_url}")
        
    async def connect(self):
        """Establish connection to the robot and start monitoring topics"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            self.connection_status["connected"] = True
            self.connection_status["last_heartbeat"] = time.time()
            
            # Enable essential topics
            await self.enable_topics([
                "/tracked_pose",
                "/battery_state",
                "/map",
                "/scan_matched_points2",
                "/slam/state",
                "/wheel_state",
                "/rgb_cameras/front/video",
                "/planning_state",
                "/alerts",
                "/jack_state"
            ])
            
            logger.info("Successfully connected to robot")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            self.connection_status["connected"] = False
            return False
    
    async def reconnect(self):
        """Attempt to reconnect to the robot"""
        logger.info("Attempting to reconnect to robot...")
        
        try:
            if self.ws and not self.ws.closed:
                await self.ws.close()
                
            return await self.connect()
        except Exception as e:
            logger.error(f"Reconnection failed: {e}")
            return False
    
    async def enable_topics(self, topics: List[str]):
        """Enable specified topics for real-time updates"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot enable topics: WebSocket connection not established")
            return False
        
        try:
            message = {"enable_topic": topics}
            await self.ws.send(json.dumps(message))
            self.topics_enabled.extend(topics)
            logger.info(f"Enabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to enable topics: {e}")
            return False
    
    async def disable_topics(self, topics: List[str]):
        """Disable specified topics"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot disable topics: WebSocket connection not established")
            return False
        
        try:
            message = {"disable_topic": topics}
            await self.ws.send(json.dumps(message))
            for topic in topics:
                if topic in self.topics_enabled:
                    self.topics_enabled.remove(topic)
            logger.info(f"Disabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to disable topics: {e}")
            return False
    
    async def listen_for_updates(self):
        """Listen for updates from the robot via WebSocket"""
        if not self.ws or self.ws.closed:
            logger.error("Cannot listen for updates: WebSocket connection not established")
            return
        
        logger.info("Starting to listen for robot updates")
        
        try:
            while True:
                try:
                    message = await self.ws.recv()
                    await self.process_message(message)
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    await asyncio.sleep(2)
                    connected = await self.reconnect()
                    if not connected:
                        await asyncio.sleep(5)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    await asyncio.sleep(1)
        except asyncio.CancelledError:
            logger.info("Listening task cancelled")
        except Exception as e:
            logger.error(f"Unexpected error in listen_for_updates: {e}")
    
    async def process_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            topic = data.get("topic")
            
            if not topic:
                logger.debug(f"Received non-topic message: {data}")
                return
            
            # Update internal state based on topic
            if topic == "/tracked_pose":
                self.current_pose = {"pos": data.get("pos", [0, 0]), "ori": data.get("ori", 0)}
                
            elif topic == "/battery_state":
                self.battery_state = {
                    "percentage": data.get("percentage", 0),
                    "power_supply_status": data.get("power_supply_status", "unknown"),
                    "voltage": data.get("voltage", 0),
                    "current": data.get("current", 0)
                }
                
            elif topic == "/map":
                # Store minimal map data to avoid excessive memory usage
                self.current_map_data = {
                    "resolution": data.get("resolution"),
                    "size": data.get("size"),
                    "origin": data.get("origin"),
                    "stamp": data.get("stamp")
                }
                # Don't store the full data array here as it can be very large
                
            elif topic == "/scan_matched_points2":
                self.point_cloud = data.get("points", [])
                
            elif topic == "/rgb_cameras/front/video":
                # Store reference to camera data, not the full data
                self.camera_feed = {
                    "stamp": data.get("stamp"),
                    "available": True
                }
                
            elif topic == "/planning_state":
                move_state = data.get("move_state")
                if move_state == "moving":
                    self.state = RobotState.MOVING
                elif move_state == "succeeded":
                    self.state = RobotState.IDLE
                elif move_state == "failed":
                    self.state = RobotState.ERROR
                    logger.error(f"Move action failed: {data.get('fail_reason_str')}")
                
            elif topic == "/jack_state":
                jack_state = data.get("state")
                progress = data.get("progress", 0)
                if jack_state == "jacking_up":
                    self.state = RobotState.JACKING_UP
                elif jack_state == "jacking_down":
                    self.state = RobotState.JACKING_DOWN
                
            # Add more topic handling as needed
            
            # Update connection status
            self.connection_status["last_heartbeat"] = time.time()
            
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def set_current_map(self, map_id: int) -> bool:
        """Set the current map on the robot"""
        try:
            url = f"{self.base_url}/chassis/current-map"
            response = requests.post(url, json={"map_id": map_id})
            
            if response.status_code == 200:
                self.current_map_id = map_id
                logger.info(f"Successfully set current map to ID {map_id}")
                return True
            else:
                logger.error(f"Failed to set map: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error setting current map: {e}")
            return False
    
    async def set_initial_pose(self, x: float, y: float, orientation: float, adjust_position: bool = True) -> bool:
        """Set the initial pose of the robot on the current map"""
        try:
            url = f"{self.base_url}/chassis/pose"
            payload = {
                "position": [x, y, 0],
                "ori": orientation,
                "adjust_position": adjust_position
            }
            
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Successfully set pose to ({x}, {y}, {orientation})")
                return True
            else:
                logger.error(f"Failed to set pose: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error setting pose: {e}")
            return False
    
    async def get_maps_list(self) -> List[Dict]:
        """Get a list of available maps"""
        try:
            url = f"{self.base_url}/maps/"
            response = requests.get(url)
            
            if response.status_code == 200:
                maps = response.json()
                logger.info(f"Retrieved {len(maps)} maps")
                return maps
            else:
                logger.error(f"Failed to get maps: {response.status_code} {response.text}")
                return []
                
        except Exception as e:
            logger.error(f"Error getting maps: {e}")
            return []
    
    async def create_move_action(self, 
                                target_x: float, 
                                target_y: float, 
                                target_ori: Optional[float] = None,
                                move_type: str = "standard") -> Dict:
        """Create a movement action for the robot"""
        try:
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "robot-ai",
                "type": move_type,
                "target_x": target_x,
                "target_y": target_y
            }
            
            if target_ori is not None:
                payload["target_ori"] = target_ori
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created move action {action_id} to ({target_x}, {target_y})")
                
                # Update state
                self.state = RobotState.MOVING
                self.current_task = {
                    "id": action_id,
                    "type": "move",
                    "params": payload,
                    "start_time": time.time()
                }
                
                return {"success": True, "action_id": action_id}
            else:
                logger.error(f"Failed to create move action: {response.status_code} {response.text}")
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"Error creating move action: {e}")
            return {"success": False, "error": str(e)}
    
    async def cancel_current_move(self) -> bool:
        """Cancel the current move action"""
        try:
            url = f"{self.base_url}/chassis/moves/current"
            response = requests.patch(url, json={"state": "cancelled"})
            
            if response.status_code == 200:
                logger.info("Successfully cancelled current move")
                return True
            else:
                logger.error(f"Failed to cancel move: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error cancelling move: {e}")
            return False
    
    async def start_mapping(self, continue_mapping: bool = False) -> Dict:
        """Start a mapping task"""
        try:
            url = f"{self.base_url}/mappings/"
            payload = {"continue_mapping": continue_mapping}
            
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                mapping_id = result.get("id")
                logger.info(f"Started mapping task {mapping_id}")
                
                # Update state
                self.state = RobotState.MAPPING
                
                return {"success": True, "mapping_id": mapping_id}
            else:
                logger.error(f"Failed to start mapping: {response.status_code} {response.text}")
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"Error starting mapping: {e}")
            return {"success": False, "error": str(e)}
    
    async def finish_mapping(self, save_map: bool = True, map_name: Optional[str] = None) -> Dict:
        """Finish the current mapping task and optionally save it as a map"""
        try:
            # Finish mapping
            url = f"{self.base_url}/mappings/current"
            finish_response = requests.patch(url, json={"state": "finished"})
            
            if finish_response.status_code != 200:
                logger.error(f"Failed to finish mapping: {finish_response.status_code} {finish_response.text}")
                return {"success": False, "error": finish_response.text}
            
            mapping_result = finish_response.json()
            mapping_id = mapping_result.get("id")
            
            # Save as map if requested
            if save_map:
                if not map_name:
                    map_name = f"Map {datetime.now().strftime('%Y-%m-%d %H:%M')}"
                
                save_url = f"{self.base_url}/maps/"
                save_payload = {
                    "map_name": map_name,
                    "mapping_id": mapping_id
                }
                
                save_response = requests.post(save_url, json=save_payload)
                
                if save_response.status_code == 200:
                    map_result = save_response.json()
                    map_id = map_result.get("id")
                    logger.info(f"Saved mapping {mapping_id} as map {map_id}")
                    
                    # Update state
                    self.state = RobotState.IDLE
                    
                    return {"success": True, "mapping_id": mapping_id, "map_id": map_id}
                else:
                    logger.error(f"Failed to save map: {save_response.status_code} {save_response.text}")
                    return {"success": False, "error": save_response.text}
            
            # Update state
            self.state = RobotState.IDLE
            
            return {"success": True, "mapping_id": mapping_id}
                
        except Exception as e:
            logger.error(f"Error finishing mapping: {e}")
            return {"success": False, "error": str(e)}
    
    async def jack_up(self) -> bool:
        """Jack up the robot to lift a cargo"""
        try:
            url = f"{self.base_url}/services/jack_up"
            response = requests.post(url)
            
            if response.status_code == 200:
                logger.info("Successfully initiated jack up operation")
                self.state = RobotState.JACKING_UP
                return True
            else:
                logger.error(f"Failed to jack up: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error jacking up: {e}")
            return False
    
    async def jack_down(self) -> bool:
        """Jack down the robot to release a cargo"""
        try:
            url = f"{self.base_url}/services/jack_down"
            response = requests.post(url)
            
            if response.status_code == 200:
                logger.info("Successfully initiated jack down operation")
                self.state = RobotState.JACKING_DOWN
                return True
            else:
                logger.error(f"Failed to jack down: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error jacking down: {e}")
            return False
    
    async def align_with_rack(self, target_x: float, target_y: float) -> Dict:
        """Create a move action to align with a rack for jacking"""
        return await self.create_move_action(
            target_x=target_x,
            target_y=target_y,
            move_type="align_with_rack"
        )
    
    async def move_to_unload_point(self, target_x: float, target_y: float) -> Dict:
        """Create a move action to move to an unload point"""
        return await self.create_move_action(
            target_x=target_x,
            target_y=target_y,
            move_type="to_unload_point"
        )
    
    async def move_along_route(self, coordinates: List[List[float]], detour_tolerance: float = 0.5) -> Dict:
        """Create a move action to follow a specific route"""
        try:
            # Convert coordinates to the required format (comma-separated string)
            route_coords = []
            for point in coordinates:
                if len(point) >= 2:
                    route_coords.extend([point[0], point[1]])
            
            route_coordinates = ", ".join(map(str, route_coords))
            
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "robot-ai",
                "type": "along_given_route",
                "route_coordinates": route_coordinates,
                "detour_tolerance": detour_tolerance
            }
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created route following action {action_id} with {len(coordinates)} points")
                
                # Update state
                self.state = RobotState.MOVING
                self.current_task = {
                    "id": action_id,
                    "type": "follow_route",
                    "params": payload,
                    "start_time": time.time()
                }
                
                return {"success": True, "action_id": action_id}
            else:
                logger.error(f"Failed to create route following action: {response.status_code} {response.text}")
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"Error creating route following action: {e}")
            return {"success": False, "error": str(e)}
    
    async def move_to_elevator(self, elevator_id: str) -> Dict:
        """Move to an elevator waiting point"""
        if elevator_id not in self.registered_elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return {"success": False, "error": f"Elevator {elevator_id} not registered"}
        
        elevator = self.registered_elevators[elevator_id]
        
        if not elevator.get("waiting_point"):
            logger.error(f"Elevator {elevator_id} missing waiting point coordinates")
            return {"success": False, "error": "Missing waiting point coordinates"}
        
        return await self.create_move_action(
            target_x=elevator["waiting_point"][0],
            target_y=elevator["waiting_point"][1],
            move_type="standard"
        )
    
    async def enter_elevator(self, elevator_id: str) -> Dict:
        """Create a move action to enter an elevator"""
        if elevator_id not in self.registered_elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return {"success": False, "error": f"Elevator {elevator_id} not registered"}
        
        elevator = self.registered_elevators[elevator_id]
        
        if not elevator.get("entry_point"):
            logger.error(f"Elevator {elevator_id} missing entry point coordinates")
            return {"success": False, "error": "Missing entry point coordinates"}
        
        return await self.create_move_action(
            target_x=elevator["entry_point"][0],
            target_y=elevator["entry_point"][1],
            move_type="enter_elevator"
        )
    
    async def request_elevator(self, elevator_id: str, target_floor: int) -> Dict:
        """Request an elevator to go to a specific floor"""
        if elevator_id not in self.registered_elevators:
            logger.error(f"Elevator {elevator_id} not registered")
            return {"success": False, "error": f"Elevator {elevator_id} not registered"}
        
        elevator = self.registered_elevators[elevator_id]
        
        # Request elevator through IoT integration
        try:
            # Command the elevator to move to target floor
            # This would be implemented in the IoT module
            logger.info(f"Requesting elevator {elevator_id} to go to floor {target_floor}")
            
            # Placeholder for actual implementation
            # In real implementation, this would communicate with the IoT module
            success = True  # Simulated success
            
            if success:
                return {"success": True, "message": f"Requested elevator to floor {target_floor}"}
            else:
                return {"success": False, "error": "Failed to communicate with elevator"}
                
        except Exception as e:
            logger.error(f"Error requesting elevator: {e}")
            return {"success": False, "error": str(e)}
    
    async def register_door(self, door_id: str, mac_address: str, polygon: List[List[float]]) -> bool:
        """Register a door for automatic opening"""
        try:
            self.registered_doors[door_id] = {
                "mac": mac_address,
                "polygon": polygon,
                "status": "closed"
            }
            logger.info(f"Registered door {door_id} with MAC {mac_address}")
            return True
        except Exception as e:
            logger.error(f"Error registering door: {e}")
            return False
    
    async def register_elevator(self, 
                              elevator_id: str, 
                              mac_address: str, 
                              floors: List[int],
                              waiting_point: List[float],
                              entry_point: List[float]) -> bool:
        """Register an elevator for multi-floor navigation"""
        try:
            self.registered_elevators[elevator_id] = {
                "mac": mac_address,
                "floors": floors,
                "waiting_point": waiting_point,
                "entry_point": entry_point,
                "status": "idle",
                "current_floor": floors[0] if floors else None
            }
            logger.info(f"Registered elevator {elevator_id} with MAC {mac_address} serving floors {floors}")
            return True
        except Exception as e:
            logger.error(f"Error registering elevator: {e}")
            return False
    
    async def request_door_open(self, door_id: str) -> Dict:
        """Request a door to open"""
        if door_id not in self.registered_doors:
            logger.error(f"Door {door_id} not registered")
            return {"success": False, "error": f"Door {door_id} not registered"}
        
        door = self.registered_doors[door_id]
        
        # Request door to open through IoT integration
        try:
            # Send open command to the door
            # This would be implemented in the IoT module
            logger.info(f"Requesting door {door_id} to open")
            
            # Placeholder for actual implementation
            # In real implementation, this would communicate with the IoT module
            success = True  # Simulated success
            
            if success:
                # Update door status
                self.registered_doors[door_id]["status"] = "opening"
                return {"success": True, "message": "Door opening command sent"}
            else:
                return {"success": False, "error": "Failed to communicate with door"}
                
        except Exception as e:
            logger.error(f"Error requesting door to open: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_camera_frame(self, camera: str = "front") -> Dict:
        """Get the latest camera frame"""
        try:
            url = f"{self.base_url}/rgb_cameras/{camera}/compressed"
            response = requests.get(url)
            
            if response.status_code == 200:
                image_data = response.content
                logger.info(f"Retrieved camera frame from {camera} camera")
                return {
                    "success": True, 
                    "data": base64.b64encode(image_data).decode('utf-8'),
                    "format": "jpeg",
                    "timestamp": datetime.now().timestamp()
                }
            else:
                logger.error(f"Failed to get camera frame: {response.status_code}")
                return {"success": False, "error": response.reason}
                
        except Exception as e:
            logger.error(f"Error getting camera frame: {e}")
            return {"success": False, "error": str(e)}
    
    async def add_task_to_queue(self, task_type: str, params: Dict) -> Dict:
        """Add a task to the queue"""
        try:
            task_id = str(uuid.uuid4())
            task = {
                "id": task_id,
                "type": task_type,
                "params": params,
                "status": "queued",
                "created_at": time.time()
            }
            
            self.task_queue.append(task)
            logger.info(f"Added {task_type} task {task_id} to queue (position {len(self.task_queue)})")
            
            return {"success": True, "task_id": task_id, "position": len(self.task_queue)}
        except Exception as e:
            logger.error(f"Error adding task to queue: {e}")
            return {"success": False, "error": str(e)}
    
    async def process_task_queue(self):
        """Process the task queue"""
        if not self.task_queue:
            return
        
        # If there's a current task in progress, don't start a new one
        if self.current_task:
            return
        
        # Get the next task
        next_task = self.task_queue.pop(0)
        logger.info(f"Processing task {next_task['id']} of type {next_task['type']}")
        
        task_type = next_task["type"]
        params = next_task["params"]
        
        try:
            result = None
            
            if task_type == "move":
                result = await self.create_move_action(
                    target_x=params.get("target_x"),
                    target_y=params.get("target_y"),
                    target_ori=params.get("target_ori"),
                    move_type=params.get("move_type", "standard")
                )
            
            elif task_type == "mapping":
                result = await self.start_mapping(
                    continue_mapping=params.get("continue_mapping", False)
                )
            
            elif task_type == "elevator":
                result = await self.request_elevator(
                    elevator_id=params.get("elevator_id"),
                    target_floor=params.get("target_floor")
                )
            
            elif task_type == "door":
                result = await self.request_door_open(
                    door_id=params.get("door_id")
                )
            
            elif task_type == "jack_up":
                result = {"success": await self.jack_up()}
            
            elif task_type == "jack_down":
                result = {"success": await self.jack_down()}
            
            # Add more task types as needed
            
            logger.info(f"Task {next_task['id']} processed with result: {result}")
            
        except Exception as e:
            logger.error(f"Error processing task {next_task['id']}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_robot_status(self) -> Dict:
        """Get the current status of the robot"""
        return {
            "state": self.state.value,
            "pose": self.current_pose,
            "battery": self.battery_state,
            "connection": self.connection_status,
            "current_task": self.current_task,
            "queue_length": len(self.task_queue),
            "timestamp": time.time()
        }
    
    async def close(self):
        """Close the connection to the robot"""
        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("WebSocket connection closed")
        
        logger.info("Robot AI connection closed")


async def main():
    """Main entry point for the Robot AI"""
    # Get robot IP from environment variable or use default
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    
    # Create Robot AI instance
    robot = RobotAI(robot_ip=robot_ip, robot_port=robot_port)
    
    # Set up clean shutdown
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received")
        asyncio.create_task(robot.close())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Connect to robot
    connected = await robot.connect()
    if not connected:
        logger.error("Failed to connect to robot, exiting")
        sys.exit(1)
    
    # Start listening for updates
    listener_task = asyncio.create_task(robot.listen_for_updates())
    
    # Process task queue periodically
    while True:
        await robot.process_task_queue()
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())