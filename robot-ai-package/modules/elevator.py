#!/usr/bin/env python3
"""
Robot AI - Elevator Control Module
This module enables multi-floor navigation through elevator integration,
supporting both ESP-NOW direct communication and API-based control for
various elevator systems.

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
        logging.FileHandler("/var/log/robot-ai/elevator.log", mode='a')
    ]
)
logger = logging.getLogger("robot-ai-elevator")

class ElevatorState(Enum):
    """Elevator state enum"""
    UNKNOWN = "unknown"
    AVAILABLE = "available"
    MOVING = "moving"
    DOOR_OPENING = "door_opening"
    DOOR_CLOSING = "door_closing"
    DOOR_OPEN = "door_open"
    DOOR_CLOSED = "door_closed"
    ERROR = "error"
    OCCUPIED = "occupied"

class RobotElevatorState(Enum):
    """Robot's state with respect to elevator operations"""
    IDLE = "idle"
    MOVING_TO_ELEVATOR = "moving_to_elevator"
    WAITING_FOR_ELEVATOR = "waiting_for_elevator"
    WAITING_FOR_DOOR = "waiting_for_door"
    ENTERING_ELEVATOR = "entering_elevator"
    INSIDE_ELEVATOR = "inside_elevator"
    EXITING_ELEVATOR = "exiting_elevator"
    LEAVING_ELEVATOR = "leaving_elevator"
    ERROR = "error"

class Elevator:
    """Elevator data class"""
    def __init__(self, elevator_id: str, mac_address: str, floors: List[int], 
                waiting_point: List[float], entry_point: List[float]):
        self.id = elevator_id
        self.mac_address = mac_address
        self.floors = floors
        self.waiting_point = waiting_point
        self.entry_point = entry_point
        self.state = ElevatorState.UNKNOWN
        self.current_floor = None
        self.target_floor = None
        self.last_update = 0.0
        self.last_command = 0.0
        self.control_mode = "esp_now"  # or "api"

class ElevatorController:
    """Controller for elevator operations"""
    
    def __init__(self, robot_ai):
        """Initialize the Elevator Controller with a reference to the Robot AI"""
        self.robot_ai = robot_ai
        self.elevators = {}  # Dictionary of elevator_id -> Elevator
        self.esp_now_enabled = False
        self.current_elevator_id = None
        self.robot_elevator_state = RobotElevatorState.IDLE
        self.monitor_running = False
        self.monitor_task = None
        self.current_floor = 1  # Default starting floor
        self.target_floor = None
    
    async def connect(self):
        """Establish connection to the robot and elevator system"""
        try:
            # Try to enable ESP-NOW communication for direct elevator control
            self.esp_now_enabled = await self._enable_esp_now()
            
            if self.esp_now_enabled:
                logger.info("Elevator controller connected with ESP-NOW enabled")
            else:
                logger.info("Elevator controller connected (ESP-NOW disabled, will use API mode)")
            
            # Start elevator monitor
            await self.start_monitor()
            
            return True
        except Exception as e:
            logger.error(f"Error connecting elevator controller: {e}")
            return False
    
    async def _enable_esp_now(self) -> bool:
        """Enable ESP-NOW communication"""
        try:
            # In a real implementation, this would enable ESP-NOW on the robot
            # For now, we simulate success
            logger.info("ESP-NOW communication enabled for elevator control")
            return True
        except Exception as e:
            logger.error(f"Error enabling ESP-NOW for elevator control: {e}")
            return False
    
    async def start_monitor(self):
        """Start the elevator monitor task"""
        if self.monitor_running:
            logger.warning("Elevator monitor already running")
            return
        
        self.monitor_running = True
        self.monitor_task = asyncio.create_task(self._elevator_monitor_loop())
        logger.info("Elevator monitor started")
    
    async def stop_monitor(self):
        """Stop the elevator monitor task"""
        if not self.monitor_running:
            logger.warning("Elevator monitor not running")
            return
        
        self.monitor_running = False
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
            self.monitor_task = None
        
        logger.info("Elevator monitor stopped")
    
    def register_elevator(self, elevator_id: str, mac_address: str, floors: List[int],
                        waiting_point: List[float], entry_point: List[float]) -> bool:
        """Register an elevator for multi-floor navigation"""
        try:
            if elevator_id in self.elevators:
                logger.warning(f"Elevator {elevator_id} already registered, updating")
            
            # Create and register the elevator
            elevator = Elevator(elevator_id, mac_address, floors, waiting_point, entry_point)
            
            # Determine control mode based on ESP-NOW availability
            elevator.control_mode = "esp_now" if self.esp_now_enabled else "api"
            
            self.elevators[elevator_id] = elevator
            
            logger.info(f"Registered elevator {elevator_id} with floors {floors}, control mode: {elevator.control_mode}")
            return True
        except Exception as e:
            logger.error(f"Error registering elevator: {e}")
            return False
    
    async def move_to_elevator(self, elevator_id: str) -> Dict[str, Any]:
        """Move to an elevator waiting point"""
        if elevator_id not in self.elevators:
            err_msg = f"Unknown elevator: {elevator_id}"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        try:
            elevator = self.elevators[elevator_id]
            
            # Set state and current elevator
            self.current_elevator_id = elevator_id
            self.robot_elevator_state = RobotElevatorState.MOVING_TO_ELEVATOR
            
            # Create move action to waiting point
            waiting_x, waiting_y = elevator.waiting_point
            
            logger.info(f"Moving to elevator {elevator_id} waiting point at ({waiting_x}, {waiting_y})")
            
            # Use robot_ai to create the move action
            result = await self.robot_ai.create_move_action(waiting_x, waiting_y)
            
            if "error" in result:
                self.robot_elevator_state = RobotElevatorState.ERROR
                return {"success": False, "error": result["error"]}
            
            # Success
            return {
                "success": True, 
                "elevator_id": elevator_id,
                "state": self.robot_elevator_state.value,
                "action_id": result.get("action_id")
            }
        except Exception as e:
            logger.error(f"Error moving to elevator: {e}")
            self.robot_elevator_state = RobotElevatorState.ERROR
            return {"success": False, "error": str(e)}
    
    async def request_elevator(self, elevator_id: str, target_floor: int) -> Dict[str, Any]:
        """Request an elevator to go to a specific floor"""
        if elevator_id not in self.elevators:
            err_msg = f"Unknown elevator: {elevator_id}"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        elevator = self.elevators[elevator_id]
        
        # Validate target floor
        if target_floor not in elevator.floors:
            err_msg = f"Invalid floor {target_floor} for elevator {elevator_id}"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        try:
            # Set target floor
            self.target_floor = target_floor
            elevator.target_floor = target_floor
            
            # Different handling based on control mode
            if elevator.control_mode == "esp_now" and self.esp_now_enabled:
                return await self._request_elevator_esp_now(elevator_id, target_floor)
            else:
                return await self._request_elevator_api(elevator_id, target_floor)
        except Exception as e:
            logger.error(f"Error requesting elevator: {e}")
            return {"success": False, "error": str(e)}
    
    async def _request_elevator_esp_now(self, elevator_id: str, target_floor: int) -> Dict[str, Any]:
        """Request elevator using ESP-NOW direct communication"""
        elevator = self.elevators[elevator_id]
        
        try:
            # Prepare command
            command = {
                "command": "call_elevator",
                "elevator_id": elevator_id,
                "current_floor": self.current_floor,
                "target_floor": target_floor,
                "timestamp": time.time()
            }
            
            # In a real implementation, this would send via ESP-NOW
            # For now, we simulate success
            
            # Update state and timestamps
            self.robot_elevator_state = RobotElevatorState.WAITING_FOR_ELEVATOR
            elevator.last_command = time.time()
            
            logger.info(f"Requested elevator {elevator_id} using ESP-NOW to floor {target_floor}")
            return {
                "success": True,
                "elevator_id": elevator_id,
                "state": self.robot_elevator_state.value,
                "target_floor": target_floor
            }
        except Exception as e:
            logger.error(f"Error requesting elevator via ESP-NOW: {e}")
            return {"success": False, "error": str(e)}
    
    async def _request_elevator_api(self, elevator_id: str, target_floor: int) -> Dict[str, Any]:
        """Request elevator using API call"""
        elevator = self.elevators[elevator_id]
        
        try:
            # Prepare API request
            # In a real implementation, this would make an HTTP request to the elevator system
            # For now, we simulate success
            
            # Update state and timestamps
            self.robot_elevator_state = RobotElevatorState.WAITING_FOR_ELEVATOR
            elevator.last_command = time.time()
            
            logger.info(f"Requested elevator {elevator_id} using API to floor {target_floor}")
            return {
                "success": True,
                "elevator_id": elevator_id,
                "state": self.robot_elevator_state.value,
                "target_floor": target_floor
            }
        except Exception as e:
            logger.error(f"Error requesting elevator via API: {e}")
            return {"success": False, "error": str(e)}
    
    async def enter_elevator(self, elevator_id: str) -> Dict[str, Any]:
        """Create a move action to enter an elevator"""
        if elevator_id not in self.elevators:
            err_msg = f"Unknown elevator: {elevator_id}"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        if self.robot_elevator_state != RobotElevatorState.WAITING_FOR_DOOR:
            err_msg = f"Robot not ready to enter elevator (state: {self.robot_elevator_state.value})"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        try:
            elevator = self.elevators[elevator_id]
            
            # Set state
            self.robot_elevator_state = RobotElevatorState.ENTERING_ELEVATOR
            
            # Create move action to entry point
            entry_x, entry_y = elevator.entry_point
            
            logger.info(f"Entering elevator {elevator_id} at entry point ({entry_x}, {entry_y})")
            
            # Use robot_ai to create the move action
            result = await self.robot_ai.create_move_action(entry_x, entry_y)
            
            if "error" in result:
                self.robot_elevator_state = RobotElevatorState.ERROR
                return {"success": False, "error": result["error"]}
            
            # After move is complete, state will be updated to INSIDE_ELEVATOR by monitor
            
            # Success
            return {
                "success": True, 
                "elevator_id": elevator_id,
                "state": self.robot_elevator_state.value,
                "action_id": result.get("action_id")
            }
        except Exception as e:
            logger.error(f"Error entering elevator: {e}")
            self.robot_elevator_state = RobotElevatorState.ERROR
            return {"success": False, "error": str(e)}
    
    async def exit_elevator(self, elevator_id: str) -> Dict[str, Any]:
        """Create a move action to exit an elevator"""
        if elevator_id not in self.elevators:
            err_msg = f"Unknown elevator: {elevator_id}"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        if self.robot_elevator_state != RobotElevatorState.INSIDE_ELEVATOR:
            err_msg = f"Robot not inside elevator (state: {self.robot_elevator_state.value})"
            logger.error(err_msg)
            return {"success": False, "error": err_msg}
        
        try:
            elevator = self.elevators[elevator_id]
            
            # Set state
            self.robot_elevator_state = RobotElevatorState.EXITING_ELEVATOR
            
            # For exiting, we use a point just outside the elevator
            # This could be configured per floor in a real implementation
            exit_x = elevator.entry_point[0] - 1.0  # 1 meter in front of entry point
            exit_y = elevator.entry_point[1]
            
            logger.info(f"Exiting elevator {elevator_id} to point ({exit_x}, {exit_y})")
            
            # Use robot_ai to create the move action
            result = await self.robot_ai.create_move_action(exit_x, exit_y)
            
            if "error" in result:
                self.robot_elevator_state = RobotElevatorState.ERROR
                return {"success": False, "error": result["error"]}
            
            # After move is complete, state will be updated to LEAVING_ELEVATOR by monitor
            
            # Success
            return {
                "success": True, 
                "elevator_id": elevator_id,
                "state": self.robot_elevator_state.value,
                "action_id": result.get("action_id")
            }
        except Exception as e:
            logger.error(f"Error exiting elevator: {e}")
            self.robot_elevator_state = RobotElevatorState.ERROR
            return {"success": False, "error": str(e)}
    
    def update_elevator_status(self, elevator_id: str, status_data: Dict[str, Any]) -> bool:
        """Update elevator status based on received data"""
        if elevator_id not in self.elevators:
            logger.warning(f"Received status update for unknown elevator {elevator_id}")
            return False
        
        try:
            elevator = self.elevators[elevator_id]
            
            # Update state if provided
            if "state" in status_data:
                try:
                    elevator.state = ElevatorState(status_data["state"])
                except ValueError:
                    elevator.state = ElevatorState.UNKNOWN
            
            # Update current floor if provided
            if "current_floor" in status_data:
                elevator.current_floor = status_data["current_floor"]
                
                # If this is our current elevator, update our current floor
                if elevator_id == self.current_elevator_id and self.robot_elevator_state == RobotElevatorState.INSIDE_ELEVATOR:
                    self.current_floor = elevator.current_floor
            
            # Update timestamp
            elevator.last_update = time.time()
            
            logger.debug(f"Updated elevator {elevator_id} status: {elevator.state.value}, floor: {elevator.current_floor}")
            return True
        except Exception as e:
            logger.error(f"Error updating elevator status: {e}")
            return False
    
    async def process_esp_now_message(self, message: Dict[str, Any]) -> bool:
        """Process ESP-NOW message from elevator"""
        try:
            # Extract sender MAC address and elevator ID
            mac_address = message.get("sender", "")
            elevator_id = None
            
            # Find elevator by MAC address
            for e_id, elevator in self.elevators.items():
                if elevator.mac_address == mac_address:
                    elevator_id = e_id
                    break
            
            if elevator_id is None:
                logger.debug(f"Received ESP-NOW message from unknown device: {mac_address}")
                return False
            
            # Process elevator status
            if "status" in message:
                return self.update_elevator_status(elevator_id, message["status"])
            
            # Process other message types
            if "type" in message:
                msg_type = message["type"]
                
                if msg_type == "ack":
                    logger.debug(f"Received ACK from elevator {elevator_id}")
                    return True
                
                if msg_type == "elevator_arrived":
                    logger.info(f"Elevator {elevator_id} arrived at floor {message.get('floor')}")
                    
                    # Update elevator state and floor
                    self.elevators[elevator_id].state = ElevatorState.AVAILABLE
                    if "floor" in message:
                        self.elevators[elevator_id].current_floor = message["floor"]
                    
                    # If waiting for this elevator, update state
                    if (elevator_id == self.current_elevator_id and 
                        self.robot_elevator_state == RobotElevatorState.WAITING_FOR_ELEVATOR):
                        self.robot_elevator_state = RobotElevatorState.WAITING_FOR_DOOR
                    
                    return True
                
                if msg_type == "error":
                    logger.warning(f"Received error from elevator {elevator_id}: {message.get('message', 'Unknown error')}")
                    self.elevators[elevator_id].state = ElevatorState.ERROR
                    
                    # If this is our current elevator, update our state
                    if elevator_id == self.current_elevator_id:
                        self.robot_elevator_state = RobotElevatorState.ERROR
                    
                    return True
            
            logger.warning(f"Received unrecognized ESP-NOW message from elevator {elevator_id}")
            return False
        except Exception as e:
            logger.error(f"Error processing ESP-NOW message: {e}")
            return False
    
    async def _elevator_monitor_loop(self):
        """Monitor elevator operations and handle state transitions"""
        logger.info("Elevator monitor loop started")
        
        while self.monitor_running:
            try:
                # Process based on current state
                if self.robot_elevator_state == RobotElevatorState.MOVING_TO_ELEVATOR:
                    # Check if we've reached the waiting point
                    if not self.robot_ai.current_action_id and self.current_elevator_id:
                        logger.info(f"Reached elevator {self.current_elevator_id} waiting point")
                        
                        # Transition to waiting state
                        self.robot_elevator_state = RobotElevatorState.WAITING_FOR_ELEVATOR
                        
                        # Request elevator if target floor is set
                        elevator = self.elevators.get(self.current_elevator_id)
                        if elevator and elevator.target_floor:
                            await self.request_elevator(self.current_elevator_id, elevator.target_floor)
                
                elif self.robot_elevator_state == RobotElevatorState.WAITING_FOR_ELEVATOR:
                    # Check if elevator has arrived
                    if self.current_elevator_id:
                        elevator = self.elevators.get(self.current_elevator_id)
                        if elevator and elevator.state == ElevatorState.AVAILABLE:
                            logger.info(f"Elevator {self.current_elevator_id} available and ready")
                            self.robot_elevator_state = RobotElevatorState.WAITING_FOR_DOOR
                
                elif self.robot_elevator_state == RobotElevatorState.ENTERING_ELEVATOR:
                    # Check if we've entered the elevator
                    if not self.robot_ai.current_action_id:
                        logger.info(f"Entered elevator {self.current_elevator_id}")
                        self.robot_elevator_state = RobotElevatorState.INSIDE_ELEVATOR
                        
                        # In a real implementation, we would send confirmation to elevator
                        # For now, we simulate
                
                elif self.robot_elevator_state == RobotElevatorState.EXITING_ELEVATOR:
                    # Check if we've exited the elevator
                    if not self.robot_ai.current_action_id:
                        logger.info(f"Exited elevator {self.current_elevator_id}")
                        self.robot_elevator_state = RobotElevatorState.LEAVING_ELEVATOR
                
                elif self.robot_elevator_state == RobotElevatorState.LEAVING_ELEVATOR:
                    # Reset elevator state once we're done
                    logger.info(f"Completed elevator operation")
                    self.robot_elevator_state = RobotElevatorState.IDLE
                    self.current_elevator_id = None
                
                # Sleep to avoid excessive checking
                await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                logger.info("Elevator monitor loop cancelled")
                break
            except Exception as e:
                logger.error(f"Error in elevator monitor loop: {e}")
                await asyncio.sleep(1)
        
        logger.info("Elevator monitor loop ended")
    
    def get_elevator_status(self, elevator_id: str = None) -> Dict[str, Any]:
        """Get status of elevators"""
        if elevator_id:
            if elevator_id not in self.elevators:
                return {"error": f"Unknown elevator: {elevator_id}"}
            
            elevator = self.elevators[elevator_id]
            return {
                "id": elevator.id,
                "state": elevator.state.value,
                "current_floor": elevator.current_floor,
                "target_floor": elevator.target_floor,
                "last_update": elevator.last_update,
                "control_mode": elevator.control_mode
            }
        else:
            # Return status of all elevators
            result = {}
            for e_id, elevator in self.elevators.items():
                result[e_id] = {
                    "state": elevator.state.value,
                    "current_floor": elevator.current_floor,
                    "target_floor": elevator.target_floor,
                    "last_update": elevator.last_update,
                    "control_mode": elevator.control_mode
                }
            
            # Also include robot elevator state
            result["robot_state"] = {
                "state": self.robot_elevator_state.value,
                "current_elevator": self.current_elevator_id,
                "current_floor": self.current_floor,
                "target_floor": self.target_floor
            }
            
            return result