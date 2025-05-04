#!/usr/bin/env python3
"""
Robot AI Updater Module
This module adds self-updating capabilities to the Robot AI system.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import base64
import hashlib
import asyncio
import logging
import tempfile
import websockets
import requests
from enum import Enum
from typing import List, Dict, Optional, Any, Union

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

class UpdateState(Enum):
    IDLE = "idle"
    CHECKING = "checking"
    DOWNLOADING = "downloading"
    UPDATING = "updating"
    RESTARTING = "restarting"
    ERROR = "error"

class UpdaterModule:
    """Updater module for Robot AI with self-updating capabilities"""
    
    def __init__(self, robot_ip: str = "localhost", robot_port: int = 8090):
        """Initialize the Updater Module"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.ws_url = f"ws://{robot_ip}:{robot_port}/ws"
        self.rest_url = f"http://{robot_ip}:{robot_port}"
        self.websocket = None
        self.connected = False
        self.update_state = UpdateState.IDLE
        self.modules_dir = self._find_modules_directory()
        self.versions = {}
        self.update_server_url = os.environ.get("UPDATE_SERVER_URL", "http://47.180.91.99:3000/api/updates")
        
        # Load robot secret from environment
        self.robot_secret = os.environ.get('ROBOT_SECRET')
        if not self.robot_secret:
            logger.warning("ROBOT_SECRET environment variable not set")
        
        logger.info(f"Updater Module initialized for {self.robot_ip}:{self.robot_port}")
        logger.info(f"Using modules directory: {self.modules_dir}")
        
        # Initialize versions information
        self._load_versions()
    
    def _find_modules_directory(self) -> str:
        """Find the modules directory where Robot AI modules are installed"""
        # Try common Android storage locations
        possible_dirs = [
            "/storage/emulated/0/Documents/modules",
            "/sdcard/Documents/modules",
            "/data/local/tmp"
        ]
        
        # Check if this script is in one of those directories
        script_dir = os.path.dirname(os.path.realpath(__file__))
        if os.path.exists(script_dir) and os.access(script_dir, os.W_OK):
            logger.info(f"Using current script directory: {script_dir}")
            return script_dir
        
        # Otherwise check possible locations
        for directory in possible_dirs:
            if os.path.exists(directory) and os.access(directory, os.W_OK):
                logger.info(f"Found writable modules directory: {directory}")
                return directory
        
        # Fallback to temporary directory
        logger.warning("No suitable modules directory found, using temporary directory")
        return tempfile.gettempdir()
    
    def _load_versions(self):
        """Load current module versions"""
        try:
            self.versions = {}
            # Check all Python files in the modules directory
            if os.path.exists(self.modules_dir):
                for filename in os.listdir(self.modules_dir):
                    if filename.endswith('.py') and 'robot-ai-' in filename:
                        file_path = os.path.join(self.modules_dir, filename)
                        with open(file_path, 'r') as f:
                            content = f.read()
                            # Extract version information
                            try:
                                # Look for Version: X.Y.Z pattern
                                version_info = None
                                for line in content.split('\n')[:20]:  # Look in first 20 lines
                                    if 'Version:' in line:
                                        version_info = line.split('Version:')[1].strip()
                                        break
                                
                                module_name = filename.replace('.py', '')
                                self.versions[module_name] = {
                                    'path': file_path,
                                    'version': version_info or '0.0.0',
                                    'hash': hashlib.md5(content.encode()).hexdigest()
                                }
                            except Exception as e:
                                logger.error(f"Error parsing version info for {filename}: {e}")
            
            logger.info(f"Loaded versions for {len(self.versions)} modules: {', '.join(self.versions.keys())}")
            
        except Exception as e:
            logger.error(f"Error loading module versions: {e}")
    
    async def connect(self):
        """Connect to robot WebSocket"""
        try:
            logger.info(f"Connecting to {self.ws_url}")
            self.websocket = await websockets.connect(self.ws_url)
            self.connected = True
            logger.info("Connected to robot WebSocket")
            
            # Subscribe to update-related topics
            await self.subscribe_topics()
            
            # Start listening for updates
            await self.listen_for_updates()
        except Exception as e:
            logger.error(f"Updater connection error: {e}")
            self.connected = False
    
    async def subscribe_topics(self):
        """Subscribe to update-related topics"""
        if not self.connected:
            logger.error("Cannot subscribe: not connected")
            return
            
        try:
            # Subscribe to topics for receiving update commands
            topics = ["/updates/command"]
            message = json.dumps({
                "op": "subscribe",
                "topics": topics
            })
            await self.websocket.send(message)
            logger.info(f"Subscribed to topics: {topics}")
        except Exception as e:
            logger.error(f"Subscribe error: {e}")
    
    async def listen_for_updates(self):
        """Listen for update commands"""
        if not self.connected:
            logger.error("Cannot listen: not connected")
            return
            
        try:
            async for message in self.websocket:
                await self.process_update_message(message)
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.connected = False
        except Exception as e:
            logger.error(f"Listen error: {e}")
            self.connected = False
    
    async def process_update_message(self, message: str):
        """Process update-related messages"""
        try:
            data = json.loads(message)
            topic = data.get("topic", "")
            
            if topic == "/updates/command":
                command = data.get("command", "")
                
                if command == "check_updates":
                    logger.info("Received check_updates command")
                    await self.check_for_updates()
                
                elif command == "update":
                    logger.info("Received update command")
                    module = data.get("module")
                    version = data.get("version")
                    if module and version:
                        await self.update_module(module, version)
                    else:
                        # Update all modules
                        await self.update_all_modules()
                
                elif command == "restart":
                    logger.info("Received restart command")
                    service_name = data.get("service", "robot-ai")
                    await self.restart_service(service_name)
                
                elif command == "status":
                    logger.info("Received status command")
                    await self.send_status()
        
        except Exception as e:
            logger.error(f"Process update message error: {e}")
    
    async def check_for_updates(self) -> Dict[str, Any]:
        """Check for available updates from the update server"""
        try:
            self.update_state = UpdateState.CHECKING
            logger.info(f"Checking for updates from {self.update_server_url}")
            
            # Prepare current versions information
            self._load_versions()  # Refresh versions info
            
            payload = {
                "robot_id": os.environ.get("ROBOT_ID", "unknown"),
                "modules": self.versions
            }
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            response = requests.post(
                f"{self.update_server_url}/check", 
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                updates = response.json()
                logger.info(f"Found {len(updates)} available updates")
                
                # Broadcast update information
                await self.broadcast_update_status({
                    "status": "updates_available",
                    "updates": updates
                })
                
                self.update_state = UpdateState.IDLE
                return updates
            else:
                logger.error(f"Error checking for updates: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return {}
                
        except Exception as e:
            logger.error(f"Error checking for updates: {e}")
            self.update_state = UpdateState.ERROR
            return {}
    
    async def update_module(self, module_name: str, version: str) -> bool:
        """Update a specific module to the specified version"""
        try:
            self.update_state = UpdateState.DOWNLOADING
            logger.info(f"Updating module {module_name} to version {version}")
            
            # Broadcast update status
            await self.broadcast_update_status({
                "status": "updating",
                "module": module_name,
                "version": version
            })
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            # Request module update from update server
            payload = {
                "robot_id": os.environ.get("ROBOT_ID", "unknown"),
                "module": module_name,
                "version": version
            }
            
            response = requests.post(
                f"{self.update_server_url}/download", 
                headers=headers,
                json=payload
            )
            
            if response.status_code == 200:
                update_data = response.json()
                module_code = update_data.get("code")
                module_version = update_data.get("version")
                
                if not module_code:
                    logger.error("No module code received in update response")
                    self.update_state = UpdateState.ERROR
                    return False
                
                # Determine module filename
                module_filename = f"{module_name}.py"
                if not module_filename.startswith("robot-ai-"):
                    module_filename = f"robot-ai-{module_filename}"
                
                # Save backup of current module
                module_path = os.path.join(self.modules_dir, module_filename)
                if os.path.exists(module_path):
                    backup_path = f"{module_path}.bak"
                    try:
                        with open(module_path, 'r') as src, open(backup_path, 'w') as dst:
                            dst.write(src.read())
                        logger.info(f"Created backup at {backup_path}")
                    except Exception as e:
                        logger.error(f"Failed to create backup: {e}")
                
                # Write new module version
                try:
                    self.update_state = UpdateState.UPDATING
                    with open(module_path, 'w') as f:
                        f.write(module_code)
                    
                    # Make executable
                    os.chmod(module_path, 0o755)
                    
                    logger.info(f"Successfully updated {module_filename} to version {module_version}")
                    
                    # Update versions information
                    self._load_versions()
                    
                    # Broadcast successful update
                    await self.broadcast_update_status({
                        "status": "updated",
                        "module": module_name,
                        "version": module_version
                    })
                    
                    self.update_state = UpdateState.IDLE
                    return True
                    
                except Exception as e:
                    logger.error(f"Failed to write updated module: {e}")
                    self.update_state = UpdateState.ERROR
                    
                    # Try to restore from backup
                    if os.path.exists(backup_path):
                        try:
                            with open(backup_path, 'r') as src, open(module_path, 'w') as dst:
                                dst.write(src.read())
                            logger.info(f"Restored from backup")
                        except Exception as e2:
                            logger.error(f"Failed to restore from backup: {e2}")
                    
                    return False
            else:
                logger.error(f"Error downloading update: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return False
                
        except Exception as e:
            logger.error(f"Error updating module: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def update_all_modules(self) -> bool:
        """Update all modules that have updates available"""
        try:
            # Check for available updates
            updates = await self.check_for_updates()
            
            if not updates:
                logger.info("No updates available")
                return True
            
            # Update each module that has an update available
            success = True
            for module_info in updates:
                module_name = module_info.get("module")
                version = module_info.get("version")
                
                if module_name and version:
                    module_success = await self.update_module(module_name, version)
                    if not module_success:
                        logger.warning(f"Failed to update {module_name} to version {version}")
                        success = False
            
            # If all updates were successful, restart the service
            if success:
                logger.info("All modules updated successfully, restarting service")
                await self.restart_service("robot-ai")
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating all modules: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def broadcast_update_status(self, status: Dict[str, Any]):
        """Broadcast update status through WebSocket"""
        try:
            if self.connected and self.websocket:
                message = json.dumps({
                    "topic": "/updates/status",
                    "data": status
                })
                await self.websocket.send(message)
                logger.debug(f"Broadcasted update status: {status['status']}")
        except Exception as e:
            logger.error(f"Error broadcasting update status: {e}")
    
    async def restart_service(self, service_name: str = "robot-ai") -> bool:
        """Restart a system service"""
        try:
            self.update_state = UpdateState.RESTARTING
            logger.info(f"Restarting service {service_name}")
            
            # Broadcast service restart
            await self.broadcast_update_status({
                "status": "restarting",
                "service": service_name
            })
            
            url = f"{self.rest_url}/services/restart"
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Secret {self.robot_secret}"
            }
            
            payload = {
                "name": service_name
            }
            
            response = requests.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                logger.info(f"Successfully restarted service {service_name}")
                self.update_state = UpdateState.IDLE
                return True
            else:
                logger.error(f"Failed to restart service: HTTP {response.status_code}")
                self.update_state = UpdateState.ERROR
                return False
                
        except Exception as e:
            logger.error(f"Error restarting service: {e}")
            self.update_state = UpdateState.ERROR
            return False
    
    async def send_status(self):
        """Send current status information"""
        try:
            # Prepare status information
            status = {
                "update_state": self.update_state.value,
                "modules": self.versions,
                "modules_dir": self.modules_dir,
                "update_server": self.update_server_url
            }
            
            # Broadcast status
            await self.broadcast_update_status({
                "status": "status",
                "data": status
            })
            
            logger.info(f"Sent status information")
            return status
            
        except Exception as e:
            logger.error(f"Error sending status: {e}")
            return None
    
    async def check_update_schedule(self):
        """Check for updates on a schedule"""
        try:
            # Check for updates once a day
            while True:
                await asyncio.sleep(24 * 60 * 60)  # 24 hours
                logger.info("Performing scheduled update check")
                await self.check_for_updates()
        except Exception as e:
            logger.error(f"Error in update schedule: {e}")
    
    async def close(self):
        """Close the updater module"""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            logger.info("Updater module disconnected")

async def main():
    """Main entry point for the Updater Module"""
    # Use localhost since we're running on the robot
    robot_ip = os.environ.get("ROBOT_IP", "localhost")
    robot_port = int(os.environ.get("ROBOT_PORT", "8090"))
    
    updater_module = UpdaterModule(robot_ip, robot_port)
    
    try:
        # Start the scheduled update checker
        update_checker_task = asyncio.create_task(updater_module.check_update_schedule())
        
        # Connect to the robot
        await updater_module.connect()
        
        # Check for updates on startup
        await updater_module.check_for_updates()
        
        # Keep running
        while True:
            if not updater_module.connected:
                await updater_module.connect()
            await asyncio.sleep(10)
            
    except KeyboardInterrupt:
        logger.info("Updater module shutting down...")
    finally:
        await updater_module.close()
        logger.info("Updater module shutdown complete")

if __name__ == "__main__":
    logger.info("Starting Robot AI Updater Module")
    asyncio.run(main())