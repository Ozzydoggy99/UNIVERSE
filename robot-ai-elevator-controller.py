#!/usr/bin/env python3
"""
Robot AI - Elevator Controller Module
This module provides specialized functionality for elevator interaction, 
including multi-floor navigation, elevator summoning, and status tracking.

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
from typing import Dict, List, Optional, Tuple, Any, Union, Set
import requests
import websockets

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('robot-ai-elevator.log')
    ]
)
logger = logging.getLogger('robot-ai-elevator')

class ElevatorState(Enum):
    """Elevator state enum"""
    IDLE = "idle"
    MOVING = "moving"
    DOOR_OPENING = "door_opening"
    DOOR_CLOSING = "door_closing"
    ERROR = "error"
    UNKNOWN = "unknown"

class NavigationState(Enum):
    """Elevator navigation state enum"""
    IDLE = "idle"
    MOVING_TO_ELEVATOR = "moving_to_elevator"
    WAITING_FOR_ELEVATOR = "waiting_for_elevator"
    ENTERING_ELEVATOR = "entering_elevator"
    INSIDE_ELEVATOR = "inside_elevator"
    REQUESTING_FLOOR = "requesting_floor"
    MOVING_BETWEEN_FLOORS = "moving_between_floors"
    EXITING_ELEVATOR = "exiting_elevator"
    COMPLETED = "completed"
    ERROR = "error"

@dataclass
class Elevator:
    """Elevator data class"""
    id: str
    mac_address: str
    floors: List[int]
    current_floor: int
    state: ElevatorState
    door_state: str  # "open", "closed", "opening", "closing"
    position: Dict[int, List[Tuple[float, float]]]  # Map of floor to door positions (polygons)
    waiting_points: Dict[int, Tuple[float, float]]  # Map of floor to waiting point coordinates
    orientation: Dict[int, float]  # Map of floor to elevator orientation

class ElevatorController:
    """Controller for elevator communications and operations"""
    
    def __init__(self, robot_ip: str, robot_port: int = 8090, robot_sn: str = None, use_ssl: bool = False):
        """Initialize the Elevator Controller with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.robot_sn = robot_sn
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        
        # Registered elevators
        self.elevators: Dict[str, Elevator] = {}
        
        # Navigation state
        self.navigation_state = NavigationState.IDLE
        self.target_elevator = None
        self.current_floor = None
        self.target_floor = None
        self.navigation_start_time = None
        self.last_status_update = None
        
        # Robot state
        self.robot_position = [0, 0]
        self.robot_orientation = 0
        self.current_map_id = None
        
        # WebSocket connection
        self.ws = None
        self.esp_now_enabled = False
        
        # Background tasks
        self.navigation_task = None
        self.monitor_task = None
        
        logger.info(f"Elevator Controller initialized for robot at {self.base_url}")
    
    async def connect(self):
        """Establish connection to the robot"""
        logger.info(f"Connecting to robot at {self.ws_url}")
        
        try:
            self.ws = await websockets.connect(self.ws_url)
            
            # Enable essential topics
            message = {"enable_topic": [
                "/tracked_pose",
                "/planning_state",
                "/alerts"
            ]}
            await self.ws.send(json.dumps(message))
            
            logger.info("Successfully connected to robot")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to robot: {e}")
            return False
    
    def register_elevator(self, 
                       elevator_id: str, 
                       mac_address: str, 
                       floors: List[int], 
                       location: Dict[int, List[Tuple[float, float]]],
                       waiting_points: Dict[int, Tuple[float, float]],
                       orientation: Dict[int, float]) -> bool:
        """
        Register a new elevator
        
        Args:
            elevator_id: Unique identifier for the elevator
            mac_address: MAC address for ESP-NOW communication
            floors: List of floors this elevator serves
            location: Dict mapping floor numbers to elevator door positions (polygons)
            waiting_points: Dict mapping floor numbers to waiting point coordinates
            orientation: Dict mapping floor numbers to elevator orientation
        """
        try:
            self.elevators[elevator_id] = Elevator(
                id=elevator_id,
                mac_address=mac_address,
                floors=floors,
                current_floor=floors[0] if floors else None,
                state=ElevatorState.UNKNOWN,
                door_state="unknown",
                position=location,
                waiting_points=waiting_points,
                orientation=orientation
            )
            logger.info(f"Registered elevator {elevator_id} with MAC {mac_address} serving floors {floors}")
            return True
        except Exception as e:
            logger.error(f"Error registering elevator: {e}")
            return False
    
    async def start(self):
        """Start the elevator controller"""
        # Start ESP-NOW communication if not already enabled
        if not self.esp_now_enabled:
            await self.enable_esp_now_communication()
        
        # Start elevator monitoring
        self.monitor_task = asyncio.create_task(self._elevator_monitor_loop())
        
        logger.info("Elevator controller started")
    
    async def stop(self):
        """Stop the elevator controller"""
        # Cancel background tasks
        if self.navigation_task and not self.navigation_task.done():
            self.navigation_task.cancel()
        
        if self.monitor_task and not self.monitor_task.done():
            self.monitor_task.cancel()
        
        # Close WebSocket connection
        if self.ws and not self.ws.closed:
            await self.ws.close()
            logger.info("WebSocket connection closed")
        
        logger.info("Elevator controller stopped")
    
    async def enable_esp_now_communication(self) -> bool:
        """
        Enable ESP-NOW communication protocol for elevator control
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
    
    def update_elevator_status(self, elevator_id: str, status_data: Dict[str, Any]) -> bool:
        """
        Update the status of an elevator based on received data
        
        Args:
            elevator_id: ID of the elevator to update
            status_data: Dictionary containing status information
        """
        if elevator_id not in self.elevators:
            logger.warning(f"Received status update for unknown elevator {elevator_id}")
            return False
        
        try:
            elevator = self.elevators[elevator_id]
            
            # Update elevator state based on received data
            if "floor" in status_data:
                elevator.current_floor = status_data["floor"]
            
            if "state" in status_data:
                state_str = status_data["state"]
                # Map the received state string to ElevatorState enum
                try:
                    elevator.state = ElevatorState(state_str)
                except ValueError:
                    elevator.state = ElevatorState.UNKNOWN
            
            if "door_state" in status_data:
                elevator.door_state = status_data["door_state"]
            
            self.last_status_update = time.time()
            logger.info(f"Updated elevator {elevator_id} status: floor={elevator.current_floor}, state={elevator.state.value}, door={elevator.door_state}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating elevator status: {e}")
            return False
    
    async def process_esp_now_message(self, message: Dict[str, Any]) -> bool:
        """
        Process an ESP-NOW message, potentially from an elevator
        
        Args:
            message: The message received via ESP-NOW
        """
        try:
            device_type = message.get("device_type")
            device_id = message.get("device_id")
            data = message.get("data", {})
            
            if device_type == "elevator" and device_id in self.elevators:
                # Process elevator status update
                self.update_elevator_status(device_id, data)
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {e}")
            return False
    
    async def request_floor(self, elevator_id: str, floor: int) -> bool:
        """
        Request an elevator to go to a specific floor
        
        Args:
            elevator_id: ID of the elevator to control
            floor: The target floor number
            
        Returns:
            bool: True if the request was sent successfully
        """
        if elevator_id not in self.elevators:
            logger.error(f"Unknown elevator {elevator_id}")
            return False
        
        elevator = self.elevators[elevator_id]
        
        if floor not in elevator.floors:
            logger.error(f"Elevator {elevator_id} does not serve floor {floor}")
            return False
        
        try:
            # Send ESP-NOW message to the elevator
            message = {
                "command": "request_floor",
                "floor": floor,
                "robot_sn": self.robot_sn
            }
            
            # Use the ESP-NOW service to send the message
            url = f"{self.base_url}/services/esp_now/send"
            payload = {
                "mac": elevator.mac_address,
                "data": json.dumps(message)
            }
            
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Requested elevator {elevator_id} to go to floor {floor}")
                return True
            else:
                logger.error(f"Failed to request floor: {response.status_code} {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Error requesting floor: {e}")
            return False
    
    async def navigate_to_floor(self, elevator_id: str, target_floor: int) -> bool:
        """
        Initiate multi-floor navigation using an elevator
        
        Args:
            elevator_id: ID of the elevator to use
            target_floor: The target floor number
            
        Returns:
            bool: True if the navigation was successfully initiated
        """
        if elevator_id not in self.elevators:
            logger.error(f"Unknown elevator {elevator_id}")
            return False
        
        elevator = self.elevators[elevator_id]
        
        if target_floor not in elevator.floors:
            logger.error(f"Elevator {elevator_id} does not serve floor {target_floor}")
            return False
        
        # Get current floor from robot position
        # This would require knowledge of which map corresponds to which floor
        # For simplicity, we'll get the current floor from the elevator status
        # In a real implementation, this would need to be determined from the map
        current_floor = elevator.current_floor
        
        if current_floor == target_floor:
            logger.info(f"Already on floor {target_floor}, no need to use elevator")
            return True
        
        logger.info(f"Initiating multi-floor navigation from floor {current_floor} to {target_floor} using elevator {elevator_id}")
        
        # Set navigation state
        self.navigation_state = NavigationState.MOVING_TO_ELEVATOR
        self.target_elevator = elevator_id
        self.current_floor = current_floor
        self.target_floor = target_floor
        self.navigation_start_time = time.time()
        
        # Start navigation in a separate task
        self.navigation_task = asyncio.create_task(self._execute_elevator_navigation())
        
        return True
    
    async def _execute_elevator_navigation(self):
        """Execute the full elevator navigation sequence"""
        try:
            elevator_id = self.target_elevator
            target_floor = self.target_floor
            current_floor = self.current_floor
            
            if not elevator_id or elevator_id not in self.elevators:
                logger.error("Invalid elevator ID for navigation")
                self.navigation_state = NavigationState.ERROR
                return False
            
            elevator = self.elevators[elevator_id]
            
            # Step 1: Move to elevator waiting point
            self.navigation_state = NavigationState.MOVING_TO_ELEVATOR
            
            # Check if we have waiting point for current floor
            if current_floor not in elevator.waiting_points:
                logger.error(f"No waiting point defined for elevator {elevator_id} on floor {current_floor}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            waiting_point = elevator.waiting_points[current_floor]
            
            # Create move action to move to waiting point
            logger.info(f"Moving to elevator waiting point at {waiting_point}")
            move_result = await self._create_move_action(
                target_x=waiting_point[0],
                target_y=waiting_point[1],
                move_type="standard"
            )
            
            if not move_result.get("success", False):
                logger.error(f"Failed to move to elevator waiting point: {move_result.get('error')}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 2: Wait for elevator to arrive
            self.navigation_state = NavigationState.WAITING_FOR_ELEVATOR
            
            # Call the elevator to our floor
            logger.info(f"Requesting elevator {elevator_id} to come to floor {current_floor}")
            floor_requested = await self.request_floor(elevator_id, current_floor)
            
            if not floor_requested:
                logger.error(f"Failed to request elevator to floor {current_floor}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Wait for elevator to arrive with door open
            logger.info("Waiting for elevator to arrive")
            elevator_ready = await self._wait_for_elevator_ready(elevator_id, current_floor, timeout=180)
            
            if not elevator_ready:
                logger.error("Elevator did not arrive or door did not open")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 3: Enter the elevator
            self.navigation_state = NavigationState.ENTERING_ELEVATOR
            
            # Create move action to enter elevator
            logger.info("Entering elevator")
            enter_result = await self._create_move_action(
                target_x=elevator.position[current_floor][0][0],  # Use first point of polygon as entry point
                target_y=elevator.position[current_floor][0][1],
                move_type="enter_elevator"
            )
            
            if not enter_result.get("success", False):
                logger.error(f"Failed to enter elevator: {enter_result.get('error')}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 4: Inside elevator, request target floor
            self.navigation_state = NavigationState.INSIDE_ELEVATOR
            
            # Wait a moment to ensure we're fully inside
            await asyncio.sleep(2)
            
            # Step 5: Request target floor
            self.navigation_state = NavigationState.REQUESTING_FLOOR
            
            logger.info(f"Requesting elevator to go to floor {target_floor}")
            target_requested = await self.request_floor(elevator_id, target_floor)
            
            if not target_requested:
                logger.error(f"Failed to request elevator to floor {target_floor}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 6: Moving between floors
            self.navigation_state = NavigationState.MOVING_BETWEEN_FLOORS
            
            # Wait for elevator to arrive at target floor with door open
            logger.info(f"Waiting for elevator to arrive at floor {target_floor}")
            arrived_at_target = await self._wait_for_elevator_ready(elevator_id, target_floor, timeout=180)
            
            if not arrived_at_target:
                logger.error(f"Elevator did not arrive at floor {target_floor} or door did not open")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 7: Exit the elevator
            self.navigation_state = NavigationState.EXITING_ELEVATOR
            
            # Create move action to exit elevator to waiting point on target floor
            target_waiting_point = elevator.waiting_points[target_floor]
            
            logger.info(f"Exiting elevator to waiting point at {target_waiting_point}")
            exit_result = await self._create_move_action(
                target_x=target_waiting_point[0],
                target_y=target_waiting_point[1],
                move_type="standard"
            )
            
            if not exit_result.get("success", False):
                logger.error(f"Failed to exit elevator: {exit_result.get('error')}")
                self.navigation_state = NavigationState.ERROR
                return False
            
            # Step 8: Navigation completed
            self.navigation_state = NavigationState.COMPLETED
            self.current_floor = target_floor
            logger.info(f"Successfully navigated to floor {target_floor}")
            
            return True
            
        except asyncio.CancelledError:
            logger.info("Elevator navigation cancelled")
            self.navigation_state = NavigationState.IDLE
            raise
        except Exception as e:
            logger.error(f"Error in elevator navigation: {e}")
            self.navigation_state = NavigationState.ERROR
            return False
    
    async def _wait_for_elevator_ready(self, elevator_id: str, floor: int, timeout: int = 60) -> bool:
        """
        Wait for elevator to arrive at specified floor with door open
        
        Args:
            elevator_id: ID of the elevator
            floor: Expected floor number
            timeout: Maximum time to wait in seconds
            
        Returns:
            bool: True if elevator is ready (at floor with door open)
        """
        if elevator_id not in self.elevators:
            return False
        
        elevator = self.elevators[elevator_id]
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Check if elevator is at the right floor with door open
            if elevator.current_floor == floor and elevator.door_state == "open":
                logger.info(f"Elevator {elevator_id} ready at floor {floor}")
                return True
            
            # If elevator is at the right floor but door is closing or closed, send another request
            if elevator.current_floor == floor and elevator.door_state in ["closing", "closed"]:
                logger.info(f"Elevator {elevator_id} at floor {floor} but door is {elevator.door_state}, requesting door open")
                await self.request_floor(elevator_id, floor)
            
            await asyncio.sleep(1)
        
        logger.warning(f"Timeout waiting for elevator {elevator_id} to be ready at floor {floor}")
        return False
    
    async def _elevator_monitor_loop(self):
        """Monitor elevator status and manage the navigation process"""
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
                
                # Check for navigation timeouts
                if self.navigation_state not in [NavigationState.IDLE, NavigationState.COMPLETED, NavigationState.ERROR]:
                    if self.navigation_start_time and time.time() - self.navigation_start_time > 600:  # 10 minutes timeout
                        logger.error("Elevator navigation timed out")
                        self.navigation_state = NavigationState.ERROR
                        if self.navigation_task and not self.navigation_task.done():
                            self.navigation_task.cancel()
                
                await asyncio.sleep(0.5)
                
        except asyncio.CancelledError:
            logger.info("Elevator monitor loop cancelled")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in elevator monitor loop: {e}")
    
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
                
            elif topic == "/planning_state":
                # Handle planning state updates for move actions
                move_state = data.get("move_state")
                action_id = data.get("action_id")
                
                # Only process updates for our navigate_to_floor move actions
                if not self.navigation_task or self.navigation_task.done():
                    return
                
                if move_state == "failed":
                    fail_reason = data.get("fail_reason_str", "Unknown")
                    logger.error(f"Move action {action_id} failed: {fail_reason}")
                    
                    # If we're in the middle of elevator navigation, handle the failure
                    if self.navigation_state in [
                        NavigationState.MOVING_TO_ELEVATOR,
                        NavigationState.ENTERING_ELEVATOR,
                        NavigationState.EXITING_ELEVATOR
                    ]:
                        logger.error(f"Elevator navigation step failed: {self.navigation_state.value}")
                        self.navigation_state = NavigationState.ERROR
                
            elif topic == "/alerts":
                # Handle alerts that might affect elevator navigation
                alerts = data.get("alerts", [])
                for alert in alerts:
                    code = alert.get("code")
                    level = alert.get("level")
                    msg = alert.get("msg")
                    
                    if level == "error" and self.navigation_state != NavigationState.IDLE:
                        logger.warning(f"Alert during elevator navigation: [{code}] {msg}")
            
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing WebSocket message: {e}")
    
    async def _create_move_action(self, target_x: float, target_y: float, move_type: str = "standard") -> Dict:
        """
        Create a move action for the robot
        
        Args:
            target_x: Target X coordinate
            target_y: Target Y coordinate
            move_type: Type of move action
            
        Returns:
            Dict with result information
        """
        try:
            url = f"{self.base_url}/chassis/moves"
            
            payload = {
                "creator": "elevator-controller",
                "type": move_type,
                "target_x": target_x,
                "target_y": target_y
            }
                
            response = requests.post(url, json=payload)
            
            if response.status_code == 200:
                result = response.json()
                action_id = result.get("id")
                logger.info(f"Created {move_type} action {action_id} to ({target_x}, {target_y})")
                return {"success": True, "action_id": action_id}
            else:
                logger.error(f"Failed to create move action: {response.status_code} {response.text}")
                return {"success": False, "error": response.text}
                
        except Exception as e:
            logger.error(f"Error creating move action: {e}")
            return {"success": False, "error": str(e)}
    
    def get_navigation_status(self) -> Dict[str, Any]:
        """Get the current elevator navigation status"""
        return {
            "state": self.navigation_state.value,
            "target_elevator": self.target_elevator,
            "current_floor": self.current_floor,
            "target_floor": self.target_floor,
            "start_time": self.navigation_start_time,
            "duration": time.time() - self.navigation_start_time if self.navigation_start_time else None,
            "elevators": {
                elevator_id: {
                    "current_floor": elevator.current_floor,
                    "state": elevator.state.value,
                    "door_state": elevator.door_state
                }
                for elevator_id, elevator in self.elevators.items()
            }
        }


async def main():
    """Main entry point for the Elevator Controller"""
    # Get robot IP and SN from environment variables or use defaults
    robot_ip = os.getenv("ROBOT_IP", "192.168.25.25")
    robot_port = int(os.getenv("ROBOT_PORT", "8090"))
    robot_sn = os.getenv("ROBOT_SN", "L382502104987ir")
    
    # Create elevator controller instance
    controller = ElevatorController(robot_ip=robot_ip, robot_port=robot_port, robot_sn=robot_sn)
    
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
    
    # Register example elevator
    controller.register_elevator(
        elevator_id="main_elevator",
        mac_address="30:AE:A4:1F:38:B1",
        floors=[1, 2, 3, 4, 5],
        location={
            1: [(-2.5, 3.2), (-1.3, 3.2), (-1.3, 2.0), (-2.5, 2.0)],
            2: [(-2.5, 3.2), (-1.3, 3.2), (-1.3, 2.0), (-2.5, 2.0)],
            3: [(-2.5, 3.2), (-1.3, 3.2), (-1.3, 2.0), (-2.5, 2.0)],
            4: [(-2.5, 3.2), (-1.3, 3.2), (-1.3, 2.0), (-2.5, 2.0)],
            5: [(-2.5, 3.2), (-1.3, 3.2), (-1.3, 2.0), (-2.5, 2.0)]
        },
        waiting_points={
            1: (-3.0, 2.6),
            2: (-3.0, 2.6),
            3: (-3.0, 2.6),
            4: (-3.0, 2.6),
            5: (-3.0, 2.6)
        },
        orientation={
            1: 0.0,
            2: 0.0,
            3: 0.0,
            4: 0.0,
            5: 0.0
        }
    )
    
    # Start controller
    await controller.start()
    
    try:
        # Keep the main task running
        while True:
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Elevator controller interrupted, shutting down")
    finally:
        await controller.stop()


if __name__ == "__main__":
    asyncio.run(main())