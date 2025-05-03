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
import json
import logging
import os
import signal
import sys
import time
import websockets
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/var/log/robot-ai/robot-ai.log", mode='a')
    ]
)
logger = logging.getLogger("robot-ai")

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
        self.protocol = "wss" if use_ssl else "ws"
        self.base_url = f"http{'s' if use_ssl else ''}://{robot_ip}:{robot_port}"
        self.ws_url = f"{self.protocol}://{robot_ip}:{robot_port}/ws"
        self.ws = None
        self.connected = False
        self.enabled_topics = []
        self.state = RobotState.IDLE
        self.position = {"x": 0, "y": 0, "orientation": 0}
        self.battery = {"percentage": 0, "voltage": 0, "current": 0, "temperature": 0, "status": "unknown"}
        self.current_map_id = None
        self.current_action_id = None
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 2  # seconds
        
        # Create module instances
        try:
            from modules.map import MapVisualizer
            from modules.camera import CameraModule
            from modules.elevator import ElevatorController
            from modules.door import DoorController
            from modules.task_queue import TaskQueue
            
            self.map_visualizer = MapVisualizer(self)
            self.camera_module = CameraModule(self)
            self.elevator_controller = ElevatorController(self)
            self.door_controller = DoorController(self)
            self.task_queue = TaskQueue(self)
            
            logger.info("All modules initialized successfully")
        except ImportError as e:
            logger.error(f"Error importing modules: {e}")
            logger.warning("Some functionality may be limited due to missing modules")
    
    async def connect(self):
        """Establish connection to the robot and start monitoring topics"""
        logger.info(f"Connecting to robot at {self.base_url}")
        try:
            self.ws = await websockets.connect(self.ws_url)
            self.connected = True
            self.reconnect_attempts = 0
            logger.info("Connected to robot websocket successfully")
            
            # Enable essential topics
            topics_to_enable = [
                "/tracked_pose",
                "/map",
                "/wheel_state", 
                "/battery_state",
                "/detailed_battery_state",
                "/slam/state",
                "/rgb_cameras/front/video",
            ]
            await self.enable_topics(topics_to_enable)
            
            # Start listening for updates
            asyncio.create_task(self.listen_for_updates())
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            self.connected = False
            return False
    
    async def reconnect(self):
        """Attempt to reconnect to the robot"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Maximum reconnection attempts reached. Giving up.")
            return False
        
        self.reconnect_attempts += 1
        wait_time = self.reconnect_delay * self.reconnect_attempts
        logger.info(f"Attempting to reconnect (attempt {self.reconnect_attempts}/{self.max_reconnect_attempts}) in {wait_time} seconds...")
        
        await asyncio.sleep(wait_time)
        return await self.connect()
    
    async def enable_topics(self, topics: List[str]):
        """Enable specified topics for real-time updates"""
        if not self.connected or not self.ws:
            logger.error("Cannot enable topics: not connected to robot")
            return False
        
        try:
            enable_command = {"op": "subscribe", "topics": topics}
            await self.ws.send(json.dumps(enable_command))
            self.enabled_topics.extend(topics)
            logger.info(f"Enabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to enable topics: {e}")
            return False
    
    async def disable_topics(self, topics: List[str]):
        """Disable specified topics"""
        if not self.connected or not self.ws:
            logger.error("Cannot disable topics: not connected to robot")
            return False
        
        try:
            disable_command = {"op": "unsubscribe", "topics": topics}
            await self.ws.send(json.dumps(disable_command))
            self.enabled_topics = [t for t in self.enabled_topics if t not in topics]
            logger.info(f"Disabled topics: {topics}")
            return True
        except Exception as e:
            logger.error(f"Failed to disable topics: {e}")
            return False
    
    async def listen_for_updates(self):
        """Listen for updates from the robot via WebSocket"""
        if not self.connected or not self.ws:
            logger.error("Cannot listen for updates: not connected to robot")
            return
        
        logger.info("Starting to listen for robot updates")
        try:
            async for message in self.ws:
                await self.process_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
            # Try to reconnect
            reconnected = await self.reconnect()
            if reconnected:
                await self.listen_for_updates()
        except Exception as e:
            logger.error(f"Error in WebSocket listener: {e}")
            self.connected = False
    
    async def process_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            
            # Check if this is a topic update
            if "topic" in data:
                topic = data["topic"]
                
                # Process based on topic
                if topic == "/tracked_pose":
                    # Update robot position
                    if "pos" in data and len(data["pos"]) >= 2:
                        self.position["x"] = data["pos"][0]
                        self.position["y"] = data["pos"][1]
                    if "ori" in data:
                        self.position["orientation"] = data["ori"]
                
                elif topic == "/battery_state":
                    # Update battery information
                    self.battery["percentage"] = data.get("percentage", 0)
                    self.battery["voltage"] = data.get("voltage", 0)
                    self.battery["current"] = data.get("current", 0)
                    self.battery["temperature"] = data.get("temperature", 0)
                    self.battery["status"] = data.get("power_supply_status", "unknown")
                
                elif topic == "/wheel_state":
                    # Update wheel state and check for emergency stop
                    if data.get("emergency_stop_pressed", False):
                        logger.warning("Emergency stop button is pressed!")
                    
                elif topic == "/slam/state":
                    # Update the SLAM state
                    slam_state = data.get("state", "unknown")
                    logger.debug(f"SLAM state update: {slam_state}")
                
                elif topic == "/map":
                    # Pass map data to map visualizer
                    if hasattr(self, 'map_visualizer'):
                        self.map_visualizer.process_map_data(data)
                
                elif topic == "/rgb_cameras/front/video":
                    # Pass camera data to camera module
                    if hasattr(self, 'camera_module'):
                        self.camera_module.process_camera_data(data)
                
                # Log other topics at debug level
                else:
                    logger.debug(f"Received update for topic: {topic}")
            
            # Process non-topic messages
            elif "enabled_topics" in data:
                logger.info(f"Topics enabled on robot: {data['enabled_topics']}")
            
            else:
                logger.debug(f"Received non-topic message: {data}")
                
        except json.JSONDecodeError:
            logger.error(f"Failed to decode message: {message}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def set_current_map(self, map_id: int) -> bool:
        """Set the current map on the robot"""
        url = f"{self.base_url}/api/map/{map_id}/set_current"
        try:
            async with websockets.connect(url) as ws:
                response = await ws.recv()
                data = json.loads(response)
                if data.get("status") == "success":
                    self.current_map_id = map_id
                    logger.info(f"Current map set to ID: {map_id}")
                    return True
                else:
                    logger.error(f"Failed to set current map: {data.get('message', 'Unknown error')}")
                    return False
        except Exception as e:
            logger.error(f"Error setting current map: {e}")
            return False
    
    async def set_initial_pose(self, x: float, y: float, orientation: float, adjust_position: bool = True) -> bool:
        """Set the initial pose of the robot on the current map"""
        url = f"{self.base_url}/map_align_at"
        data = {
            "map_name": self.current_map_id,
            "x": x,
            "y": y,
            "theta": orientation,
            "adjust_position": adjust_position
        }
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(data))
                response = await ws.recv()
                result = json.loads(response)
                if result.get("status") == "success":
                    logger.info(f"Initial pose set to x:{x}, y:{y}, orientation:{orientation}")
                    return True
                else:
                    logger.error(f"Failed to set initial pose: {result.get('message', 'Unknown error')}")
                    return False
        except Exception as e:
            logger.error(f"Error setting initial pose: {e}")
            return False
    
    async def get_maps_list(self) -> List[Dict]:
        """Get a list of available maps"""
        url = f"{self.base_url}/maps/"
        try:
            async with websockets.connect(url) as ws:
                response = await ws.recv()
                data = json.loads(response)
                logger.info(f"Retrieved {len(data)} maps from robot")
                return data
        except Exception as e:
            logger.error(f"Error getting maps list: {e}")
            return []
    
    async def create_move_action(self, 
                               target_x: float, 
                               target_y: float, 
                               target_ori: Optional[float] = None,
                               move_type: str = "standard") -> Dict:
        """Create a movement action for the robot"""
        url = f"{self.base_url}/move_create"
        
        # Build the move request
        move_request = {
            "goal": {
                "x": target_x,
                "y": target_y,
            },
            "type": move_type,
        }
        
        # Add orientation if provided
        if target_ori is not None:
            move_request["goal"]["theta"] = target_ori
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(move_request))
                response = await ws.recv()
                result = json.loads(response)
                
                if "action_id" in result:
                    self.current_action_id = result["action_id"]
                    self.state = RobotState.MOVING
                    logger.info(f"Created move action to ({target_x}, {target_y}), action ID: {self.current_action_id}")
                    return result
                else:
                    logger.error(f"Failed to create move action: {result.get('message', 'Unknown error')}")
                    return {"error": result.get('message', 'Failed to create move action')}
        except Exception as e:
            logger.error(f"Error creating move action: {e}")
            return {"error": str(e)}
    
    async def cancel_current_move(self) -> bool:
        """Cancel the current move action"""
        if not self.current_action_id:
            logger.warning("No current move action to cancel")
            return False
        
        url = f"{self.base_url}/move_cancel"
        data = {"action_id": self.current_action_id}
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(data))
                response = await ws.recv()
                result = json.loads(response)
                
                if result.get("status") == "success":
                    logger.info(f"Cancelled move action: {self.current_action_id}")
                    self.current_action_id = None
                    self.state = RobotState.IDLE
                    return True
                else:
                    logger.error(f"Failed to cancel move action: {result.get('message', 'Unknown error')}")
                    return False
        except Exception as e:
            logger.error(f"Error cancelling move action: {e}")
            return False
    
    async def start_mapping(self, continue_mapping: bool = False) -> Dict:
        """Start a mapping task"""
        url = f"{self.base_url}/{'mapping_continue' if continue_mapping else 'mapping_start'}"
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({}))
                response = await ws.recv()
                result = json.loads(response)
                
                if result.get("status") == "success":
                    self.state = RobotState.MAPPING
                    logger.info(f"Started {'continued' if continue_mapping else 'new'} mapping task")
                    return result
                else:
                    logger.error(f"Failed to start mapping: {result.get('message', 'Unknown error')}")
                    return {"error": result.get('message', 'Failed to start mapping')}
        except Exception as e:
            logger.error(f"Error starting mapping: {e}")
            return {"error": str(e)}
    
    async def finish_mapping(self, save_map: bool = True, map_name: Optional[str] = None) -> Dict:
        """Finish the current mapping task and optionally save it as a map"""
        if not save_map:
            url = f"{self.base_url}/mapping_cancel"
        else:
            url = f"{self.base_url}/mapping_finish"
        
        data = {}
        if save_map and map_name:
            data["name"] = map_name
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(data))
                response = await ws.recv()
                result = json.loads(response)
                
                if result.get("status") == "success":
                    self.state = RobotState.IDLE
                    action = "cancelled" if not save_map else "finished and saved"
                    logger.info(f"Mapping {action}")
                    return result
                else:
                    logger.error(f"Failed to finish mapping: {result.get('message', 'Unknown error')}")
                    return {"error": result.get('message', 'Failed to finish mapping')}
        except Exception as e:
            logger.error(f"Error finishing mapping: {e}")
            return {"error": str(e)}
    
    async def jack_up(self) -> bool:
        """Jack up the robot to lift a cargo"""
        url = f"{self.base_url}/jack_up"
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({}))
                response = await ws.recv()
                result = json.loads(response)
                
                if result.get("status") == "success":
                    self.state = RobotState.JACKING_UP
                    logger.info("Started jacking up")
                    return True
                else:
                    logger.error(f"Failed to jack up: {result.get('message', 'Unknown error')}")
                    return False
        except Exception as e:
            logger.error(f"Error jacking up: {e}")
            return False
    
    async def jack_down(self) -> bool:
        """Jack down the robot to release a cargo"""
        url = f"{self.base_url}/jack_down"
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps({}))
                response = await ws.recv()
                result = json.loads(response)
                
                if result.get("status") == "success":
                    self.state = RobotState.JACKING_DOWN
                    logger.info("Started jacking down")
                    return True
                else:
                    logger.error(f"Failed to jack down: {result.get('message', 'Unknown error')}")
                    return False
        except Exception as e:
            logger.error(f"Error jacking down: {e}")
            return False
    
    async def align_with_rack(self, target_x: float, target_y: float) -> Dict:
        """Create a move action to align with a rack for jacking"""
        url = f"{self.base_url}/move_create"
        
        # Build the move request
        move_request = {
            "goal": {
                "x": target_x,
                "y": target_y,
            },
            "type": "align_with_rack",
        }
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(move_request))
                response = await ws.recv()
                result = json.loads(response)
                
                if "action_id" in result:
                    self.current_action_id = result["action_id"]
                    self.state = RobotState.ALIGNING
                    logger.info(f"Created align with rack action to ({target_x}, {target_y}), action ID: {self.current_action_id}")
                    return result
                else:
                    logger.error(f"Failed to create align action: {result.get('message', 'Unknown error')}")
                    return {"error": result.get('message', 'Failed to create align action')}
        except Exception as e:
            logger.error(f"Error creating align action: {e}")
            return {"error": str(e)}
    
    async def move_to_unload_point(self, target_x: float, target_y: float) -> Dict:
        """Create a move action to move to an unload point"""
        return await self.create_move_action(target_x, target_y, move_type="to_unload_point")
    
    async def move_along_route(self, coordinates: List[List[float]], detour_tolerance: float = 0.5) -> Dict:
        """Create a move action to follow a specific route"""
        url = f"{self.base_url}/move_create"
        
        # Build the move request
        move_request = {
            "type": "along_route",
            "route": coordinates,
            "detour_tolerance": detour_tolerance
        }
        
        try:
            async with websockets.connect(url) as ws:
                await ws.send(json.dumps(move_request))
                response = await ws.recv()
                result = json.loads(response)
                
                if "action_id" in result:
                    self.current_action_id = result["action_id"]
                    self.state = RobotState.MOVING
                    logger.info(f"Created move along route action with {len(coordinates)} points, action ID: {self.current_action_id}")
                    return result
                else:
                    logger.error(f"Failed to create move along route action: {result.get('message', 'Unknown error')}")
                    return {"error": result.get('message', 'Failed to create move along route action')}
        except Exception as e:
            logger.error(f"Error creating move along route action: {e}")
            return {"error": str(e)}
    
    async def move_to_elevator(self, elevator_id: str) -> Dict:
        """Move to an elevator waiting point"""
        # This needs to be implemented with elevator_controller
        if hasattr(self, 'elevator_controller'):
            return await self.elevator_controller.move_to_elevator(elevator_id)
        else:
            logger.error("Elevator controller not available")
            return {"error": "Elevator controller not available"}
    
    async def enter_elevator(self, elevator_id: str) -> Dict:
        """Create a move action to enter an elevator"""
        # This needs to be implemented with elevator_controller
        if hasattr(self, 'elevator_controller'):
            return await self.elevator_controller.enter_elevator(elevator_id)
        else:
            logger.error("Elevator controller not available")
            return {"error": "Elevator controller not available"}
    
    async def request_elevator(self, elevator_id: str, target_floor: int) -> Dict:
        """Request an elevator to go to a specific floor"""
        # This needs to be implemented with elevator_controller
        if hasattr(self, 'elevator_controller'):
            return await self.elevator_controller.request_elevator(elevator_id, target_floor)
        else:
            logger.error("Elevator controller not available")
            return {"error": "Elevator controller not available"}
    
    async def register_door(self, door_id: str, mac_address: str, polygon: List[List[float]]) -> bool:
        """Register a door for automatic opening"""
        # This needs to be implemented with door_controller
        if hasattr(self, 'door_controller'):
            return await self.door_controller.register_door(door_id, mac_address, polygon)
        else:
            logger.error("Door controller not available")
            return False
    
    async def register_elevator(self, 
                              elevator_id: str, 
                              mac_address: str, 
                              floors: List[int],
                              waiting_point: List[float],
                              entry_point: List[float]) -> bool:
        """Register an elevator for multi-floor navigation"""
        # This needs to be implemented with elevator_controller
        if hasattr(self, 'elevator_controller'):
            return await self.elevator_controller.register_elevator(
                elevator_id, mac_address, floors, waiting_point, entry_point
            )
        else:
            logger.error("Elevator controller not available")
            return False
    
    async def request_door_open(self, door_id: str) -> Dict:
        """Request a door to open"""
        # This needs to be implemented with door_controller
        if hasattr(self, 'door_controller'):
            return await self.door_controller.request_door_open(door_id)
        else:
            logger.error("Door controller not available")
            return {"error": "Door controller not available"}
    
    async def get_camera_frame(self, camera: str = "front") -> Dict:
        """Get the latest camera frame"""
        # This needs to be implemented with camera_module
        if hasattr(self, 'camera_module'):
            return await self.camera_module.get_camera_frame(camera)
        else:
            logger.error("Camera module not available")
            return {"error": "Camera module not available"}
    
    async def add_task_to_queue(self, task_type: str, params: Dict) -> Dict:
        """Add a task to the queue"""
        # This needs to be implemented with task_queue
        if hasattr(self, 'task_queue'):
            return await self.task_queue.add_task(task_type, params)
        else:
            logger.error("Task queue not available")
            return {"error": "Task queue not available"}
    
    async def process_task_queue(self):
        """Process the task queue"""
        # This needs to be implemented with task_queue
        if hasattr(self, 'task_queue'):
            return await self.task_queue.process_queue()
        else:
            logger.error("Task queue not available")
            return {"error": "Task queue not available"}
    
    async def get_robot_status(self) -> Dict:
        """Get the current status of the robot"""
        status = {
            "state": self.state.value if isinstance(self.state, RobotState) else str(self.state),
            "position": self.position,
            "battery": self.battery,
            "connected": self.connected,
            "current_map_id": self.current_map_id,
            "current_action_id": self.current_action_id,
        }
        return status
    
    async def close(self):
        """Close the connection to the robot"""
        if self.ws:
            await self.ws.close()
            self.connected = False
            logger.info("Closed connection to robot")

async def main():
    """Main entry point for the Robot AI"""
    # Get configuration from environment or use defaults
    robot_ip = os.environ.get("ROBOT_IP", "127.0.0.1")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    robot_sn = os.environ.get("ROBOT_SERIAL", "L382502104987ir")
    use_ssl = os.environ.get("USE_SSL", "0").lower() in ("1", "true", "yes")
    
    logger.info(f"Starting Robot AI Core for robot at {robot_ip}:{robot_port}")
    robot_ai = RobotAI(robot_ip, robot_port, use_ssl)
    
    # Register signal handlers for graceful shutdown
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received, closing connections...")
        asyncio.create_task(robot_ai.close())
        asyncio.get_event_loop().stop()
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Connect to the robot
    connected = await robot_ai.connect()
    if not connected:
        logger.error("Failed to connect to robot, exiting")
        return
    
    # Start processing tasks
    asyncio.create_task(robot_ai.process_task_queue())
    
    # Keep the event loop running
    while robot_ai.connected:
        await asyncio.sleep(1)
    
    # If we get here, we've lost connection
    logger.warning("Lost connection to robot, shutting down")
    handle_shutdown()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received, shutting down")
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)