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
import time
from enum import Enum
from typing import List, Dict, Optional, Any, Tuple, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/var/log/robot-ai/door.log", mode='a')
    ]
)
logger = logging.getLogger("robot-ai-door")

class DoorState(Enum):
    """Door state enum"""
    CLOSED = "closed"
    OPEN = "open"
    OPENING = "opening"
    CLOSING = "closing"
    ERROR = "error"
    UNKNOWN = "unknown"

class AutoDoor:
    """Auto door data class"""
    def __init__(self, door_id: str, mac_address: str, polygon: List[Tuple[float, float]]):
        self.id = door_id
        self.mac_address = mac_address
        self.polygon = polygon  # Door area polygon
        self.state = DoorState.UNKNOWN
        self.last_update = 0.0  # Timestamp of last update
        self.last_command = 0.0  # Timestamp of last command

class DoorController:
    """Controller for automatic door operations"""
    
    def __init__(self, robot_ai):
        """Initialize the Door Controller with a reference to the Robot AI"""
        self.robot_ai = robot_ai
        self.doors = {}  # Dictionary of door_id -> AutoDoor
        self.esp_now_enabled = False
        self.monitor_running = False
        self.monitor_task = None
    
    async def connect(self):
        """Establish connection to the robot"""
        try:
            # Enable ESP-NOW communication
            self.esp_now_enabled = await self.enable_esp_now_communication()
            
            if self.esp_now_enabled:
                logger.info("Door controller connected and ESP-NOW enabled")
                
                # Start door monitor loop
                await self.start()
                
                return True
            else:
                logger.warning("Door controller connected but ESP-NOW is not enabled")
                return False
        except Exception as e:
            logger.error(f"Error connecting door controller: {e}")
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
            if door_id in self.doors:
                logger.warning(f"Door {door_id} already registered, updating")
            
            # Create and register the door
            door = AutoDoor(door_id, mac_address, polygon)
            self.doors[door_id] = door
            
            logger.info(f"Registered door {door_id} with MAC {mac_address}")
            return True
        except Exception as e:
            logger.error(f"Error registering door: {e}")
            return False
    
    async def start(self):
        """Start the door controller"""
        if self.monitor_running:
            logger.warning("Door monitor already running")
            return
        
        self.monitor_running = True
        self.monitor_task = asyncio.create_task(self._door_monitor_loop())
        logger.info("Door monitor started")
    
    async def stop(self):
        """Stop the door controller"""
        if not self.monitor_running:
            logger.warning("Door monitor not running")
            return
        
        self.monitor_running = False
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
            self.monitor_task = None
        
        logger.info("Door monitor stopped")
    
    async def enable_esp_now_communication(self) -> bool:
        """
        Enable ESP-NOW communication protocol for door control
        """
        try:
            # In a real implementation, this would enable ESP-NOW on the robot
            # For now, we simulate success
            logger.info("ESP-NOW communication enabled")
            return True
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
            
            # Update state
            if "state" in status_data:
                try:
                    door.state = DoorState(status_data["state"])
                except ValueError:
                    door.state = DoorState.UNKNOWN
            
            # Update timestamp
            door.last_update = time.time()
            
            logger.debug(f"Updated door {door_id} status: {door.state.value}")
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
            # Extract sender MAC address and door ID
            mac_address = message.get("sender", "")
            door_id = None
            
            # Find door by MAC address
            for d_id, door in self.doors.items():
                if door.mac_address == mac_address:
                    door_id = d_id
                    break
            
            if door_id is None:
                logger.debug(f"Received ESP-NOW message from unknown device: {mac_address}")
                return False
            
            # Process door status
            if "status" in message:
                return self.update_door_status(door_id, message["status"])
            
            # Process other message types
            if "type" in message:
                msg_type = message["type"]
                
                if msg_type == "ack":
                    logger.debug(f"Received ACK from door {door_id}")
                    return True
                
                if msg_type == "error":
                    logger.warning(f"Received error from door {door_id}: {message.get('message', 'Unknown error')}")
                    self.doors[door_id].state = DoorState.ERROR
                    return True
            
            logger.warning(f"Received unrecognized ESP-NOW message from door {door_id}")
            return False
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {e}")
            return False
    
    async def request_door_open(self, door_id: str) -> Dict[str, Any]:
        """
        Request a door to open
        
        Args:
            door_id: ID of the door to open
            
        Returns:
            Dict with status of the request
        """
        if door_id not in self.doors:
            logger.error(f"Unknown door: {door_id}")
            return {"success": False, "error": f"Unknown door: {door_id}"}
        
        door = self.doors[door_id]
        
        # Check if door is already open or opening
        if door.state in [DoorState.OPEN, DoorState.OPENING]:
            logger.info(f"Door {door_id} is already open or opening")
            return {"success": True, "state": door.state.value}
        
        try:
            # Prepare command
            command = {
                "command": "open",
                "door_id": door_id,
                "timestamp": time.time()
            }
            
            # Send ESP-NOW command
            if not self.esp_now_enabled:
                logger.error("ESP-NOW communication not enabled")
                return {"success": False, "error": "ESP-NOW communication not enabled"}
            
            # In a real implementation, this would send via ESP-NOW
            # For now, we simulate success
            
            # Update door state and timestamp
            door.state = DoorState.OPENING
            door.last_command = time.time()
            
            logger.info(f"Requested door {door_id} to open")
            return {"success": True, "state": door.state.value}
        except Exception as e:
            logger.error(f"Error requesting door open: {e}")
            return {"success": False, "error": str(e)}
    
    def is_point_in_polygon(self, point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
        """
        Check if a point is inside a polygon using ray casting algorithm
        
        Args:
            point: (x, y) coordinates of the point to check
            polygon: List of (x, y) coordinates forming the polygon
            
        Returns:
            bool: True if point is inside polygon
        """
        if not polygon or len(polygon) < 3:
            return False
        
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
                            x_intersect = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= x_intersect:
                            inside = not inside
            p1x, p1y = p2x, p2y
        
        return inside
    
    def check_door_on_path(self) -> Optional[str]:
        """
        Check if the robot's current path passes through any registered door
        
        Returns:
            Optional[str]: Door ID if a door is on the path, None otherwise
        """
        # Need current position and path from robot_ai
        if not hasattr(self.robot_ai, "position") or not self.robot_ai.position:
            return None
        
        # Get robot position
        robot_x = self.robot_ai.position.get("x", 0)
        robot_y = self.robot_ai.position.get("y", 0)
        robot_pos = (robot_x, robot_y)
        
        # If we have a current action and it's a move action, check if we're going to cross a door
        if (hasattr(self.robot_ai, "current_action_id") and self.robot_ai.current_action_id and
            self.robot_ai.state.value == "moving"):
            
            # Check each door
            for door_id, door in self.doors.items():
                # Check if robot is near the door area
                if self.is_point_in_polygon(robot_pos, door.polygon):
                    logger.debug(f"Robot is inside door {door_id} area")
                    return door_id
                
                # Future: Check if path crosses door polygon
            
        return None
    
    async def _door_monitor_loop(self):
        """Monitor robot path and automatically request doors to open"""
        logger.info("Door monitor loop started")
        
        while self.monitor_running:
            try:
                # Check if robot is approaching a door
                door_id = self.check_door_on_path()
                
                if door_id:
                    # Request door to open
                    logger.info(f"Robot approaching door {door_id}, requesting to open")
                    await self.request_door_open(door_id)
                
                # Sleep to avoid excessive checking
                await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                logger.info("Door monitor loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in door monitor loop: {e}")
                await asyncio.sleep(1)
        
        logger.info("Door monitor loop ended")
    
    async def _process_websocket_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            
            # Check if this is an ESP-NOW message
            if "esp_now" in data and "message" in data:
                await self.process_esp_now_message(data["message"])
        except json.JSONDecodeError:
            logger.error(f"Failed to decode message: {message}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
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
                return {"error": f"Unknown door: {door_id}"}
            
            door = self.doors[door_id]
            return {
                "id": door.id,
                "state": door.state.value,
                "last_update": door.last_update,
                "mac_address": door.mac_address
            }
        else:
            # Return status of all doors
            result = {}
            for d_id, door in self.doors.items():
                result[d_id] = {
                    "state": door.state.value,
                    "last_update": door.last_update,
                    "mac_address": door.mac_address
                }
            return result