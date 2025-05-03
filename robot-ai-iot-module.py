#!/usr/bin/env python3
"""
Robot AI - IoT Integration Module
This module enables seamless interaction with IoT devices including:
- Auto doors
- Elevators
- Gateways
- Bluetooth devices

It uses ESP-NOW and BLE protocols for communication.
"""

import logging
import json
import time
import threading
import requests
import socket
import os
import queue
from typing import Dict, List, Optional, Tuple, Any, Union

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("/var/log/robot-ai-iot.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai-iot")

class IoTDevice:
    """Base class for all IoT devices"""
    def __init__(self, device_id: str, device_type: str, mac_address: str):
        self.device_id = device_id
        self.device_type = device_type
        self.mac_address = mac_address
        self.last_seen = 0
        self.status = "unknown"
        self.connected = False
        
    def update_status(self, status: str) -> None:
        """Update the device status"""
        self.status = status
        self.last_seen = time.time()
        
    def is_active(self) -> bool:
        """Check if the device is active (seen in the last 10 seconds)"""
        return (time.time() - self.last_seen) < 10

class AutoDoor(IoTDevice):
    """Auto door device"""
    def __init__(self, device_id: str, mac_address: str, location: List[Tuple[float, float]]):
        super().__init__(device_id, "auto_door", mac_address)
        self.location = location  # Polygon coordinates representing door location
        self.state = "closed"
        self.etc = 0  # Estimated time of closing
        
    def is_open(self) -> bool:
        """Check if the door is open"""
        return self.state == "open"
    
    def request_open(self, robot_sn: str) -> None:
        """Request to open the door for a specific robot"""
        logger.info(f"Requesting to open door {self.device_id} for robot {robot_sn}")
        # In a real implementation, this would send an ESP-NOW message
        
    def process_status_message(self, message: str) -> None:
        """Process a status message from the door"""
        if "open" in message.lower():
            self.state = "open"
        elif "opening" in message.lower():
            self.state = "opening"
        elif "closing" in message.lower():
            self.state = "closing"
        elif "closed" in message.lower():
            self.state = "closed"
            
        # Extract ETC if present
        if "etc in" in message.lower():
            try:
                etc_str = message.lower().split("etc in")[1].strip()
                seconds = int(etc_str.split()[0])
                self.etc = time.time() + seconds
            except (IndexError, ValueError):
                pass

class Elevator(IoTDevice):
    """Elevator device"""
    def __init__(self, device_id: str, mac_address: str, floors: List[int]):
        super().__init__(device_id, "elevator", mac_address)
        self.floors = floors
        self.current_floor = None
        self.target_floor = None
        self.state = "idle"  # idle, moving, door_opening, door_closing
        
    def request_floor(self, floor: int) -> bool:
        """Request the elevator to go to a specific floor"""
        if floor not in self.floors:
            logger.warning(f"Floor {floor} not available in elevator {self.device_id}")
            return False
            
        logger.info(f"Requesting elevator {self.device_id} to go to floor {floor}")
        # In a real implementation, this would send an ESP-NOW message
        self.target_floor = floor
        return True

class BluetoothDevice(IoTDevice):
    """Bluetooth device"""
    def __init__(self, device_id: str, address: str):
        super().__init__(device_id, "bluetooth", address)
        self.message_queue = queue.Queue()
        
    async def connect(self, robot_ip: str) -> bool:
        """Connect to the Bluetooth device"""
        try:
            response = requests.post(
                f"http://{robot_ip}:8090/bluetooth/connect",
                json={"address": self.mac_address},
                timeout=5
            )
            if response.status_code == 200:
                self.connected = True
                logger.info(f"Connected to Bluetooth device {self.device_id}")
                return True
            else:
                logger.error(f"Failed to connect to Bluetooth device {self.device_id}: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error connecting to Bluetooth device {self.device_id}: {e}")
            return False
            
    async def disconnect(self, robot_ip: str) -> bool:
        """Disconnect from the Bluetooth device"""
        try:
            response = requests.post(
                f"http://{robot_ip}:8090/bluetooth/disconnect",
                json={"address": self.mac_address},
                timeout=5
            )
            if response.status_code == 200:
                self.connected = False
                logger.info(f"Disconnected from Bluetooth device {self.device_id}")
                return True
            else:
                logger.error(f"Failed to disconnect from Bluetooth device {self.device_id}: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error disconnecting from Bluetooth device {self.device_id}: {e}")
            return False
            
    def send_data(self, data: str) -> None:
        """Send data to the Bluetooth device"""
        self.message_queue.put(data)

class IoTManager:
    """Manager for all IoT devices"""
    def __init__(self, robot_ip: str, robot_sn: str):
        self.robot_ip = robot_ip
        self.robot_sn = robot_sn
        self.devices: Dict[str, IoTDevice] = {}
        self.auto_doors: Dict[str, AutoDoor] = {}
        self.elevators: Dict[str, Elevator] = {}
        self.bluetooth_devices: Dict[str, BluetoothDevice] = {}
        self.running = False
        self.door_request_thread = None
        
    def register_device(self, device: IoTDevice) -> None:
        """Register a new IoT device"""
        self.devices[device.device_id] = device
        
        if device.device_type == "auto_door":
            self.auto_doors[device.device_id] = device
        elif device.device_type == "elevator":
            self.elevators[device.device_id] = device
        elif device.device_type == "bluetooth":
            self.bluetooth_devices[device.device_id] = device
            
        logger.info(f"Registered {device.device_type} device {device.device_id}")
        
    def start(self) -> None:
        """Start the IoT manager"""
        self.running = True
        
        # Start door request thread
        self.door_request_thread = threading.Thread(target=self._door_request_loop)
        self.door_request_thread.daemon = True
        self.door_request_thread.start()
        
        logger.info("IoT Manager started")
        
    def stop(self) -> None:
        """Stop the IoT manager"""
        self.running = False
        if self.door_request_thread:
            self.door_request_thread.join(timeout=2)
        logger.info("IoT Manager stopped")
        
    def check_door_on_path(self, path: List[Tuple[float, float]]) -> Optional[AutoDoor]:
        """Check if there's a door on the given path"""
        # This is a simplified implementation
        # A real implementation would check if the path intersects with any door polygon
        for door in self.auto_doors.values():
            # Just return the first door for demonstration
            return door
        return None
        
    def _door_request_loop(self) -> None:
        """Loop to periodically request doors to open"""
        while self.running:
            for door in self.auto_doors.values():
                if not door.is_open():
                    # In a real implementation, we would only request doors that are on the robot's path
                    door.request_open(self.robot_sn)
            time.sleep(1)
            
    def process_esp_now_message(self, message: str) -> None:
        """Process an ESP-NOW message"""
        if "Door" in message and "is" in message:
            # Handle door status message
            try:
                # Extract MAC address
                mac_start = message.find("Door") + 5
                mac_end = message.find("is", mac_start) - 1
                mac = message[mac_start:mac_end].strip()
                
                # Find the corresponding door
                for door in self.auto_doors.values():
                    if door.mac_address == mac:
                        door.process_status_message(message)
                        break
            except Exception as e:
                logger.error(f"Error processing door message: {e}")
        
    def request_elevator(self, elevator_id: str, floor: int) -> bool:
        """Request an elevator to go to a specific floor"""
        if elevator_id in self.elevators:
            return self.elevators[elevator_id].request_floor(floor)
        else:
            logger.warning(f"Elevator {elevator_id} not found")
            return False

# Example usage
if __name__ == "__main__":
    # This is a demonstration of how the IoT module would be used
    # In a real implementation, this would be imported and used by the main Robot AI module
    
    manager = IoTManager("192.168.1.100", "L382502104987ir")
    
    # Register some devices
    door1 = AutoDoor("door1", "AA:BB:CC:DD:EE:FF", [(0, 0), (1, 0), (1, 1), (0, 1)])
    manager.register_device(door1)
    
    elevator1 = Elevator("elevator1", "FF:EE:DD:CC:BB:AA", [1, 2, 3, 4, 5])
    manager.register_device(elevator1)
    
    bt_device1 = BluetoothDevice("bt1", "00:11:22:33:FF:EE")
    manager.register_device(bt_device1)
    
    # Start the manager
    manager.start()
    
    # Simulate some messages
    manager.process_esp_now_message("Door AA:BB:CC:DD:EE:FF is open, ETC in 5 seconds")
    
    # Request elevator
    manager.request_elevator("elevator1", 3)
    
    # Wait a bit
    time.sleep(10)
    
    # Stop the manager
    manager.stop()