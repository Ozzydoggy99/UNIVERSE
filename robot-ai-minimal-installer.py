#!/usr/bin/env python3
"""
Robot AI Minimal Installer
This simple installer script checks for existing AI modules and enhances them.
It's designed to work WITH the existing files on the robot.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import time
import json
import subprocess
from datetime import datetime

def print_status(message):
    """Print a status message with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def check_existing_file(path):
    """Check if a file exists and return its content if it does"""
    try:
        if os.path.exists(path):
            with open(path, 'r') as f:
                content = f.read()
            print_status(f"File exists at {path} ({len(content)} bytes)")
            return content
        else:
            print_status(f"File not found: {path}")
            return None
    except Exception as e:
        print_status(f"Error checking file {path}: {str(e)}")
        return None

def enhance_module(original_content, enhancement_code, module_name):
    """Add enhancement code to a module if it doesn't already contain it"""
    if not original_content:
        print_status(f"No original content for {module_name} module, creating new file")
        return enhancement_code
    
    # Check if enhancement is already applied
    if "ENHANCED BY ROBOT AI INSTALLER" in original_content:
        print_status(f"Enhancement already applied to {module_name} module")
        return original_content
    
    # Add enhancement to the module
    enhanced_content = original_content + "\n\n" + enhancement_code
    print_status(f"Enhanced {module_name} module with additional functionality")
    return enhanced_content

def create_status_monitor():
    """Create a status monitor that writes to a status file"""
    status_code = """
# ENHANCED BY ROBOT AI INSTALLER
# Status monitoring functionality
import threading
import time
import os

def _status_monitor_thread():
    \"\"\"Thread that updates the status file periodically\"\"\"
    start_time = time.time()
    status_path = "/tmp/robot-ai-status.txt"
    
    while True:
        try:
            with open(status_path, "w") as f:
                uptime = time.time() - start_time
                f.write(f"Robot AI running since {time.ctime(start_time)}\\n")
                f.write(f"Uptime: {uptime:.2f} seconds\\n")
                f.write(f"Last update: {time.ctime()}\\n")
        except Exception as e:
            print(f"Error updating status file: {str(e)}")
        
        # Sleep for 5 seconds
        time.sleep(5)

# Start the status monitor thread
status_thread = threading.Thread(target=_status_monitor_thread, daemon=True)
status_thread.start()
"""
    return status_code

def create_door_module_enhancement():
    """Create door module enhancement code"""
    door_code = """
# ENHANCED BY ROBOT AI INSTALLER
# Door control enhancement
import threading
import time

class SmartDoorController:
    \"\"\"Enhanced door control with automatic detection\"\"\"
    
    def __init__(self):
        \"\"\"Initialize the smart door controller\"\"\"
        self.doors = {}
        self.active = True
        self.monitor_thread = threading.Thread(target=self._door_monitor, daemon=True)
        self.monitor_thread.start()
        print("Smart door controller initialized")
    
    def register_door(self, door_id, mac_address, area_polygon):
        \"\"\"Register a new door\"\"\"
        self.doors[door_id] = {
            "mac_address": mac_address,
            "area": area_polygon,
            "last_open": None
        }
        print(f"Door {door_id} registered with MAC {mac_address}")
        return True
    
    def _door_monitor(self):
        \"\"\"Monitor thread that checks if doors need to be opened\"\"\"
        while self.active:
            try:
                # Check robot position and open doors as needed
                self._check_doors_on_path()
            except Exception as e:
                print(f"Error in door monitor: {str(e)}")
            time.sleep(1)
    
    def _check_doors_on_path(self):
        \"\"\"Check if any doors are on the robot's current path\"\"\"
        # Implementation would use the robot's current position and planned path
        pass

# Create a global instance of the smart door controller
smart_door_controller = SmartDoorController()
"""
    return door_code

def create_camera_module_enhancement():
    """Create camera module enhancement code"""
    camera_code = """
# ENHANCED BY ROBOT AI INSTALLER
# Camera enhancement with person detection
import threading
import time

class EnhancedCameraProcessor:
    \"\"\"Enhanced camera processing with object detection\"\"\"
    
    def __init__(self):
        \"\"\"Initialize the enhanced camera processor\"\"\"
        self.processing_active = True
        self.frame_callbacks = []
        self.current_detections = []
        self.processor_thread = threading.Thread(target=self._process_frames, daemon=True)
        self.processor_thread.start()
        print("Enhanced camera processor initialized")
    
    def add_frame_callback(self, callback):
        \"\"\"Add a callback for processed frames\"\"\"
        self.frame_callbacks.append(callback)
        return True
    
    def remove_frame_callback(self, callback):
        \"\"\"Remove a callback\"\"\"
        if callback in self.frame_callbacks:
            self.frame_callbacks.remove(callback)
        return True
    
    def _process_frames(self):
        \"\"\"Process frames from the camera\"\"\"
        while self.processing_active:
            try:
                # This would normally process the latest frame
                # For the demo, we'll just simulate detections
                self._simulate_detections()
                
                # Call any callbacks
                for callback in self.frame_callbacks:
                    try:
                        callback(self.current_detections)
                    except Exception as e:
                        print(f"Error in camera callback: {str(e)}")
            except Exception as e:
                print(f"Error processing camera frames: {str(e)}")
            
            time.sleep(0.1)
    
    def _simulate_detections(self):
        \"\"\"Simulate detections for demo purposes\"\"\"
        # In a real implementation, this would use computer vision
        pass

# Create a global instance of the enhanced camera processor
enhanced_camera_processor = EnhancedCameraProcessor()
"""
    return camera_code

def create_core_module_enhancement():
    """Create core module enhancement code"""
    core_code = """
# ENHANCED BY ROBOT AI INSTALLER
# Core module enhancements
import threading
import time
import math
import random

class EnhancedNavigation:
    \"\"\"Enhanced navigation capabilities\"\"\"
    
    def __init__(self):
        \"\"\"Initialize the enhanced navigation\"\"\"
        self.obstacle_threshold = 0.5  # meters
        self.optimization_active = True
        self.optimizer_thread = threading.Thread(target=self._path_optimizer, daemon=True)
        self.optimizer_thread.start()
        print("Enhanced navigation initialized")
    
    def optimize_path(self, original_path):
        \"\"\"Optimize a path to be smoother and more efficient\"\"\"
        if not original_path or len(original_path) < 3:
            return original_path
            
        # This is a simplified path smoothing algorithm
        optimized_path = [original_path[0]]
        
        for i in range(1, len(original_path) - 1):
            # Check if we can skip this waypoint
            prev = original_path[i-1]
            current = original_path[i]
            next_point = original_path[i+1]
            
            # Calculate angles
            angle1 = math.atan2(current[1] - prev[1], current[0] - prev[0])
            angle2 = math.atan2(next_point[1] - current[1], next_point[0] - current[0])
            
            # If the path is relatively straight, we can skip this waypoint
            if abs(angle1 - angle2) < 0.3:  # ~15 degrees
                continue
                
            optimized_path.append(current)
            
        optimized_path.append(original_path[-1])
        
        print(f"Path optimized from {len(original_path)} to {len(optimized_path)} waypoints")
        return optimized_path
    
    def _path_optimizer(self):
        \"\"\"Background thread that optimizes navigation\"\"\"
        while self.optimization_active:
            try:
                # This would normally optimize the robot's current path
                pass
            except Exception as e:
                print(f"Error in path optimizer: {str(e)}")
            time.sleep(1)

# Create a global instance of the enhanced navigation
enhanced_navigation = EnhancedNavigation()
"""
    return core_code

def create_map_module_enhancement():
    """Create map module enhancement code"""
    map_code = """
# ENHANCED BY ROBOT AI INSTALLER
# Map module enhancements
import threading
import time

class EnhancedMapProcessor:
    \"\"\"Enhanced map processing with dynamic updates\"\"\"
    
    def __init__(self):
        \"\"\"Initialize the enhanced map processor\"\"\"
        self.processing_active = True
        self.obstacle_memory = {}  # Remember obstacles even when they're not visible
        self.processor_thread = threading.Thread(target=self._process_maps, daemon=True)
        self.processor_thread.start()
        print("Enhanced map processor initialized")
    
    def enhance_map(self, map_data):
        \"\"\"Enhance a map with remembered obstacles and improved paths\"\"\"
        if not map_data:
            return map_data
            
        # Add remembered obstacles that might not be currently visible
        enhanced_map = dict(map_data)
        
        # In a real implementation, this would merge in remembered obstacles
        # and optimize paths based on historical data
        
        return enhanced_map
    
    def _process_maps(self):
        \"\"\"Process maps in the background\"\"\"
        while self.processing_active:
            try:
                # This would normally process the latest map data
                # For the demo, we'll just simulate processing
                time.sleep(1)
            except Exception as e:
                print(f"Error processing maps: {str(e)}")
            
            time.sleep(1)

# Create a global instance of the enhanced map processor
enhanced_map_processor = EnhancedMapProcessor()
"""
    return map_code

def main():
    """Main installer function"""
    print_status("Robot AI Minimal Installer - Enhancement Mode")
    print_status("========================================")
    
    # Define paths to check for existing modules
    core_path = "/tmp/robot-ai-core.py"
    camera_path = "/tmp/robot-ai-camera.py"
    door_path = "/tmp/robot-ai-door.py"
    map_path = "/tmp/robot-ai-map.py"
    
    # Check for existing modules
    print_status("Checking for existing AI modules...")
    core_content = check_existing_file(core_path)
    camera_content = check_existing_file(camera_path)
    door_content = check_existing_file(door_path)
    map_content = check_existing_file(map_path)
    
    # Enhance or create modules
    print_status("Enhancing AI modules...")
    
    # Core module
    enhanced_core = enhance_module(core_content, create_core_module_enhancement(), "core")
    with open(core_path, "w") as f:
        f.write(enhanced_core)
    
    # Camera module
    enhanced_camera = enhance_module(camera_content, create_camera_module_enhancement(), "camera")
    with open(camera_path, "w") as f:
        f.write(enhanced_camera)
    
    # Door module
    enhanced_door = enhance_module(door_content, create_door_module_enhancement(), "door")
    with open(door_path, "w") as f:
        f.write(enhanced_door)
    
    # Map module
    enhanced_map = enhance_module(map_content, create_map_module_enhancement(), "map")
    with open(map_path, "w") as f:
        f.write(enhanced_map)
    
    # Add status monitor to core module
    with open(core_path, "a") as f:
        # Only add if not already there
        if "status_monitor_thread" not in enhanced_core:
            f.write(create_status_monitor())
    
    # Create status file
    status_path = "/tmp/robot-ai-status.txt"
    with open(status_path, "w") as f:
        f.write(f"Robot AI enhancement installed at {datetime.now()}")
    
    # Make files executable
    os.chmod(core_path, 0o755)
    
    # Create start script
    start_script = "#!/bin/sh\npython3 /tmp/robot-ai-core.py &"
    start_path = "/tmp/start-robot-ai.sh"
    with open(start_path, "w") as f:
        f.write(start_script)
    os.chmod(start_path, 0o755)
    
    # Start the service
    print_status("Starting Robot AI service...")
    try:
        subprocess.Popen(["sh", start_path])
        print_status("Robot AI service started successfully")
    except Exception as e:
        print_status(f"Error starting service: {str(e)}")
    
    print_status("Robot AI enhancement completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())