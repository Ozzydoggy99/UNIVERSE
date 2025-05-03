#!/usr/bin/env python3
"""
Robot AI - Door Control Module
This module enables automatic door control through ESP-NOW protocol
for seamless robot navigation through doorways.

Author: AI Assistant
Version: 1.0.0
"""

import asyncio
import json
import logging
import math
import os
import signal
import sys
import time
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple, Any, Union
import requests
import websockets
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-door.log')
    ]
)
logger = logging.getLogger('robot-ai-door')

class DoorState(Enum):
    """Door state enum"""
    CLOSED = "closed"
    OPEN = "open"
    OPENING = "opening"
    CLOSING = "closing"
    ERROR = "error"
    UNKNOWN = "unknown"

@dataclass
class AutoDoor:
    """Auto door data class"""
    id: str
    mac_address: str
    polygon: List[Tuple[float, float]]  # Door area polygon
    state: DoorState
    last_update: float  # Timestamp of last update

class DoorController:
    """Controller for automatic door operations"""
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, robot_sn: str = None, use_ssl: bool = False):
        """Initialize the Door Controller with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.robot_sn = robot_sn
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Registered doors
        self.doors: Dict[str, AutoDoor] = {}
        
        # Robot state
        self.robot_position = [0, 0]
        self.robot_orientation = 0
        self.current_path = []  # Current planned path
        
        # Door monitoring
        self.door_check_interval = 2.0  # seconds
        self.door_request_timeout = 10.0  # seconds
        self.door_recently_requested = {}  # {door_id: timestamp}
        
        # WebSocket connection
        self.ws = None
        self.esp_now_enabled = False
        
        # Background tasks
        self.monitor_task = None
        
        logger.info(f"Door Controller initialized for robot at {self.base_url}")
    
    async def connect(self):
        """Establish connection to the robot"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            
            # Enable essential topics
            message = {"enable_topic": [
                "/tracked_pose",
                "/path",
                "/planning_state"
            ]}
            await self.ws.send(json.dumps(message))
            
            logger.info("Successfully connected to robot")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    
    def register_door(self, door_id: str, mac_address: str, polygon: List[Tuple[float, float]]) -> bool:
        """
        Register a new door
        
        Args:
            door_id: Unique identifier for the door
            mac_address: MAC address for ESP-NOW communication
            polygon: Door area polygon coordinates
        """
        try:
            self.doors[door_id] = AutoDoor(
                id=door_id,
                mac_address=mac_address,
                polygon=polygon,
                state=DoorState.UNKNOWN,
                last_update=time.time()
            )
            logger.info(f"Registered door {door_id} with MAC {mac_address}")
            return True
        except Exception as e:
            logger.error(f"Error registering door: {e}")
            return False
    
    async def start(self):
        """Start the door controller"""
        # Start ESP-NOW communication if not already enabled
        if not self.esp_now_enabled:
            await self.enable_esp_now_communication()
        
        # Start door monitoring
        self.monitor_task = asyncio.create_task(self._door_monitor_loop())
        
        logger.info("Door controller started")
    
    async def stop(self):
        """Stop the door controller"""
        # Cancel background tasks
        if self.monitor_task and not self.monitor_task.done():
            self.monitor_task.cancel()
        
        # Close WebSocket connection
        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("WebSocket connection closed")
        
        logger.info("Door controller stopped")
    
    async def enable_esp_now_communication(self) -> bool:
        """
        Enable ESP-NOW communication protocol for door control
        """
        try:
            # Check if ESP-NOW service is available
            url = f"{self.base_url}/services/esp_now/enable"
            response = requests.post(url)
            
            if response.status_code == 200:
                self.esp_now_enabled = True
                logger.info("ESP-NOW communication enabled")
                return True
            else:
                logger.error(f"Failed to enable ESP-NOW: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error enabling ESP-NOW communication: {e}")
            return False
    
    def update_door_status(self, door_id: str, status_data: Dict[str, Any]) -> bool:
        """
        Update the status of a door based on received data
        
        Args:
            door_id: ID of the door to update
            status_data: Dictionary containing status information
        """
        if door_id not in self.doors:
            logger.warning(f"Received status update for unknown door {door_id}")
            return False
        
        try:
            door = self.doors[door_id]
            
            # Update door state based on received data
            if "state" in status_data:
                state_str = status_data["state"]
                # Map the received state string to DoorState enum
                try:
                    door.state = DoorState(state_str)
                except ValueError:
                    door.state = DoorState.UNKNOWN
            
            door.last_update = time.time()
            logger.info(f"Updated door {door_id} status: state={door.state.value}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating door status: {e}")
            return False
    
    async def process_esp_now_message(self, message: Dict[str, Any]) -> bool:
        """
        Process an ESP-NOW message, potentially from a door
        
        Args:
            message: The message received via ESP-NOW
        """
        try:
            device_type = message.get("device_type")
            device_id = message.get("device_id")
            data = message.get("data", {})
            
            if device_type == "door" and device_id in self.doors:
                # Process door status update
                self.update_door_status(device_id, data)
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {e}")
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
            logger.error(f"Unknown door {door_id}")
            return False
        
        door = self.doors[door_id]
        
        # Check if we recently requested this door to open
        now = time.time()
        if door_id in self.door_recently_requested:
            last_request = self.door_recently_requested[door_id]
            if now - last_request < self.door_request_timeout:
                logger.info(f"Door {door_id} was recently requested, skipping")
                return True
        
        try:
            # Send ESP-NOW message to the door
            message = {
                "command": "open",
                "robot_sn": self.robot_sn
            }
            
            # Use the ESP-NOW service to send the message
            url = f"{self.base_url}/services/esp_now/send"
            payload = {
                "mac": door.mac_address,
                "data": json.dumps(message)
            }
            
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Requested door {door_id} to open")
                self.door_recently_requested[door_id] = now
                return True
            else:
                logger.error(f"Failed to request door open: {response.status_code} {response.text}")
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
    
    def check_door_on_path(self) -> Optional[str]:
        """
        Check if the robot's current path passes through any registered door
        
        Returns:
            Optional[str]: Door ID if a door is on the path, None otherwise
        """
        if not self.current_path or len(self.current_path) < 2:
            return None
        
        # For each segment in the path
        for i in range(len(self.current_path) - 1):
            start = self.current_path[i]
            end = self.current_path[i + 1]
            
            # Create a set of points along the segment
            num_points = 10  # Number of points to check along the segment
            for j in range(num_points + 1):
                t = j / num_points
                point_x = start[0] + t * (end[0] - start[0])
                point_y = start[1] + t * (end[1] - start[1])
                
                # Check if this point is inside any door's polygon
                for door_id, door in self.doors.items():
                    if self.is_point_in_polygon((point_x, point_y), door.polygon):
                        return door_id
        
        return None
    
    async def _door_monitor_loop(self):
        """Monitor robot path and automatically request doors to open"""
        try:
            while True:
                # Process WebSocket messages
                if self.ws and not self.ws.closed:
                    try:
                        message = await asyncio.wait_for(self.ws.recv(), timeout=0.1)
                        await self._process_websocket_message(message)
                    except asyncio.TimeoutError:
                        pass
                    except websockets.exceptions.ConnectionClosed:
                        logger.warning("WebSocket connection closed")
                        await asyncio.sleep(2)
                        # Try to reconnect
                        connected = await self.connect()
                        if not connected:
                            await asyncio.sleep(5)
                    except Exception as e:
                        logger.error(f"Error processing WebSocket message: {e}")
                
                # Check if there's a door on the path
                door_id = self.check_door_on_path()
                if door_id:
                    logger.info(f"Detected door {door_id} on the path")
                    
                    # Request the door to open
                    await self.request_door_open(door_id)
                
                await asyncio.sleep(self.door_check_interval)
                
        except asyncio.CancelledError:
            logger.info("Door monitor loop cancelled")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in door monitor loop: {e}")
    
    async def _process_websocket_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            topic = data.get("topic")
            
            if not topic:
                return
            
            # Process based on topic
            if topic == "/tracked_pose":
                # Update robot position
                self.robot_position = data.get("pos", [0, 0])
                self.robot_orientation = data.get("ori", 0)
                
            elif topic == "/path":
                # Update current path
                self.current_path = data.get("positions", [])
                
            elif topic == "/planning_state":
                # Handle planning state updates
                move_state = data.get("move_state")
                
                # If robot started moving, check for doors on the path
                if move_state == "moving" and self.current_path:
                    door_id = self.check_door_on_path()
                    if door_id:
                        logger.info(f"Robot started moving and door {door_id} is on the path")
                        # Request the door to open
                        await self.request_door_open(door_id)
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
    
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
            
            door = self.doors[door_id]
            return {
                "id": door.id,
                "state": door.state.value,
                "last_update": door.last_update
            }
        else:
            # Return status of all doors
            return {
                door_id: {
                    "state": door.state.value,
                    "last_update": door.last_update
                }
                for door_id, door in self.doors.items()
            }


async def main():
    """Main entry point for the Door Controller"""
    # Get robot IP and SN from environment variables or use defaults
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    robot_sn = os.getenv("ROBOT_SN", "L382502104987ir")
    
    # Create door controller instance
    controller = DoorController(robot_ip=robot_ip, robot_port=robot_port, robot_sn=robot_sn)
    
    # Set up clean shutdown
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received")
        asyncio.create_task(controller.stop())
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Connect to robot
    connected = await controller.connect()
    if not connected:
        logger.error("Failed to connect to robot, exiting")
        sys.exit(1)
    
    # Register example door
    controller.register_door(
        door_id="main_entrance",
        mac_address="30:AE:A4:1F:38:C2",
        polygon=[
            (-2.7, -5.78),
            (-1.0, -5.83),
            (-1.05, -6.35),
            (-2.55, -6.39)
        ]
    )
    
    # Start controller
    await controller.start()
    
    try:
        # Keep the main task running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Door controller interrupted, shutting down")
    finally:
        await controller.stop()


if __name__ == "__main__":
    asyncio.run(main())