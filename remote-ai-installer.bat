@echo off
echo =========================================
echo   Remote Robot AI Installer (Windows)
echo =========================================

REM Configuration
set ROBOT_IP=192.168.4.31
set ROBOT_SN=L382502104987ir
set ROBOT_SECRET=%ROBOT_SECRET%

echo Robot IP: %ROBOT_IP%
echo Robot SN: %ROBOT_SN%
echo Authentication: Will use secret key
echo =========================================

REM Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python is not installed or not in your PATH.
    echo Please install Python from https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Install required Python packages
echo Installing required Python packages...
python -m pip install requests websockets aiohttp >nul 2>&1

REM Create a temporary Python installer script
echo import os, sys, requests, urllib3, json, time, base64, io, zipfile > remote_installer.py
echo from urllib3.exceptions import InsecureRequestWarning >> remote_installer.py
echo urllib3.disable_warnings(InsecureRequestWarning) >> remote_installer.py
echo. >> remote_installer.py
echo ROBOT_IP = "%ROBOT_IP%" >> remote_installer.py
echo ROBOT_SN = "%ROBOT_SN%" >> remote_installer.py
echo ROBOT_SECRET = os.environ.get("ROBOT_SECRET", "") >> remote_installer.py
echo. >> remote_installer.py
echo # Create the AI package components >> remote_installer.py
echo def create_robot_ai_package(): >> remote_installer.py
echo     """Create a complete Robot AI package in memory""" >> remote_installer.py
echo     package = {} >> remote_installer.py
echo. >> remote_installer.py
echo     # Core AI module >> remote_installer.py
echo     package["core.py"] = """\"\"\" >> remote_installer.py
echo Robot AI Core Module >> remote_installer.py
echo This is the main entry point for the Robot AI package that >> remote_installer.py
echo provides enhanced autonomous capabilities. >> remote_installer.py
echo. >> remote_installer.py
echo Author: AI Assistant >> remote_installer.py
echo Version: 1.0.0 >> remote_installer.py
echo \"\"\" >> remote_installer.py
echo import os >> remote_installer.py
echo import json >> remote_installer.py
echo import time >> remote_installer.py
echo import asyncio >> remote_installer.py
echo import logging >> remote_installer.py
echo import websockets >> remote_installer.py
echo import requests >> remote_installer.py
echo from enum import Enum >> remote_installer.py
echo from typing import Dict, List, Optional, Any, Union, Tuple >> remote_installer.py
echo. >> remote_installer.py
echo # Configure logging >> remote_installer.py
echo logging.basicConfig( >> remote_installer.py
echo     level=logging.INFO, >> remote_installer.py
echo     format='%%(asctime)s - %%(name)s - %%(levelname)s - %%(message)s', >> remote_installer.py
echo     handlers=[ >> remote_installer.py
echo         logging.FileHandler("logs/robot_ai.log"), >> remote_installer.py
echo         logging.StreamHandler() >> remote_installer.py
echo     ] >> remote_installer.py
echo ) >> remote_installer.py
echo logger = logging.getLogger("robot-ai-core") >> remote_installer.py
echo. >> remote_installer.py
echo class RobotState(Enum): >> remote_installer.py
echo     IDLE = "idle" >> remote_installer.py
echo     MOVING = "moving" >> remote_installer.py
echo     MAPPING = "mapping" >> remote_installer.py
echo     CHARGING = "charging" >> remote_installer.py
echo     ERROR = "error" >> remote_installer.py
echo     RECOVERY = "recovery" >> remote_installer.py
echo     ALIGNING = "aligning" >> remote_installer.py
echo. >> remote_installer.py
echo class RobotAI: >> remote_installer.py
echo     \"\"\"Main Robot AI class that manages all robot functionality\"\"\" >> remote_installer.py
echo     >> remote_installer.py
echo     def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False): >> remote_installer.py
echo         \"\"\"Initialize the Robot AI with connection details\"\"\" >> remote_installer.py
echo         self.robot_ip = robot_ip >> remote_installer.py
echo         self.robot_port = robot_port >> remote_installer.py
echo         self.use_ssl = use_ssl >> remote_installer.py
echo         self.protocol = "https" if use_ssl else "http" >> remote_installer.py
echo         self.ws_protocol = "wss" if use_ssl else "ws" >> remote_installer.py
echo         self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}" >> remote_installer.py
echo         self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics" >> remote_installer.py
echo         self.ws = None >> remote_installer.py
echo         self.state = RobotState.IDLE >> remote_installer.py
echo         self.current_map_id = None >> remote_installer.py
echo         self.position = {"x": 0, "y": 0, "orientation": 0} >> remote_installer.py
echo         self.enabled_topics = [] >> remote_installer.py
echo         self.battery_state = {} >> remote_installer.py
echo         self.wheel_state = {} >> remote_installer.py
echo         self.maps = [] >> remote_installer.py
echo         self.connected = False >> remote_installer.py
echo         self.last_connected = 0 >> remote_installer.py
echo         self.reconnect_attempts = 0 >> remote_installer.py
echo         self.max_reconnect_attempts = 10 >> remote_installer.py
echo         self.reconnect_delay = 1  # seconds >> remote_installer.py
echo         self.topics_callbacks = {} >> remote_installer.py
echo         self.session = requests.Session() >> remote_installer.py
echo         self.session.verify = False >> remote_installer.py
echo         >> remote_installer.py
echo         # Try to read auth token for local use >> remote_installer.py
echo         try: >> remote_installer.py
echo             if os.path.exists("/etc/robot/auth.json"): >> remote_installer.py
echo                 with open("/etc/robot/auth.json", "r") as f: >> remote_installer.py
echo                     auth_data = json.load(f) >> remote_installer.py
echo                     if "secret" in auth_data: >> remote_installer.py
echo                         self.session.headers.update({"Authorization": f"Secret {auth_data['secret']}"}) >> remote_installer.py
echo                         logger.info("Using local robot authentication") >> remote_installer.py
echo         except Exception as e: >> remote_installer.py
echo             logger.warning(f"Could not load local auth data: {e}") >> remote_installer.py
echo     >> remote_installer.py
echo     async def connect(self): >> remote_installer.py
echo         \"\"\"Establish connection to the robot and start monitoring topics\"\"\" >> remote_installer.py
echo         try: >> remote_installer.py
echo             logger.info(f"Connecting to robot at {self.robot_ip}:{self.robot_port}") >> remote_installer.py
echo             >> remote_installer.py
echo             # Test REST API connection >> remote_installer.py
echo             response = self.session.get(f"{self.base_url}/device/info") >> remote_installer.py
echo             if response.status_code != 200: >> remote_installer.py
echo                 logger.error(f"Could not connect to robot API: {response.status_code}") >> remote_installer.py
echo                 return False >> remote_installer.py
echo             >> remote_installer.py
echo             logger.info("Successfully connected to robot API") >> remote_installer.py
echo             >> remote_installer.py
echo             # Connect to WebSocket for real-time updates >> remote_installer.py
echo             logger.info(f"Connecting to WebSocket at {self.ws_url}") >> remote_installer.py
echo             >> remote_installer.py
echo             headers = {} >> remote_installer.py
echo             if "Authorization" in self.session.headers: >> remote_installer.py
echo                 headers["Authorization"] = self.session.headers["Authorization"] >> remote_installer.py
echo                 >> remote_installer.py
echo             self.ws = await websockets.connect( >> remote_installer.py
echo                 self.ws_url, >> remote_installer.py
echo                 extra_headers=headers, >> remote_installer.py
echo                 ping_interval=None  # Handle pings manually >> remote_installer.py
echo             ) >> remote_installer.py
echo             >> remote_installer.py
echo             logger.info("WebSocket connection established") >> remote_installer.py
echo             self.connected = True >> remote_installer.py
echo             self.last_connected = time.time() >> remote_installer.py
echo             self.reconnect_attempts = 0 >> remote_installer.py
echo             >> remote_installer.py
echo             # Start the WebSocket listener >> remote_installer.py
echo             asyncio.create_task(self.listen_for_updates()) >> remote_installer.py
echo             >> remote_installer.py
echo             # Enable default topics >> remote_installer.py
echo             default_topics = [ >> remote_installer.py
echo                 "/wheel_state", >> remote_installer.py
echo                 "/tracked_pose", >> remote_installer.py
echo                 "/battery_state", >> remote_installer.py
echo                 "/detailed_battery_state", >> remote_installer.py
echo                 "/map", >> remote_installer.py
echo                 "/slam/state" >> remote_installer.py
echo             ] >> remote_installer.py
echo             await self.enable_topics(default_topics) >> remote_installer.py
echo             >> remote_installer.py
echo             return True >> remote_installer.py
echo         except Exception as e: >> remote_installer.py
echo             logger.error(f"Connection error: {e}") >> remote_installer.py
echo             self.connected = False >> remote_installer.py
echo             return False >> remote_installer.py
echo     >> remote_installer.py
echo     async def listen_for_updates(self): >> remote_installer.py
echo         \"\"\"Listen for updates from the robot via WebSocket\"\"\" >> remote_installer.py
echo         logger.info("Started WebSocket listener") >> remote_installer.py
echo         >> remote_installer.py
echo         try: >> remote_installer.py
echo             while self.connected and self.ws is not None: >> remote_installer.py
echo                 try: >> remote_installer.py
echo                     # Receive and process messages with timeout >> remote_installer.py
echo                     message = await asyncio.wait_for(self.ws.recv(), timeout=1.0) >> remote_installer.py
echo                     await self.process_message(message) >> remote_installer.py
echo                 except asyncio.TimeoutError: >> remote_installer.py
echo                     # No message received within timeout, continue >> remote_installer.py
echo                     continue >> remote_installer.py
echo                 except websockets.exceptions.ConnectionClosed: >> remote_installer.py
echo                     logger.warning("WebSocket connection closed") >> remote_installer.py
echo                     self.connected = False >> remote_installer.py
echo                     break >> remote_installer.py
echo         except Exception as e: >> remote_installer.py
echo             logger.error(f"WebSocket listener error: {e}") >> remote_installer.py
echo             self.connected = False >> remote_installer.py
echo         >> remote_installer.py
echo         # Try to reconnect if connection was lost >> remote_installer.py
echo         if not self.connected: >> remote_installer.py
echo             logger.info("Connection lost, attempting to reconnect") >> remote_installer.py
echo             asyncio.create_task(self.reconnect()) >> remote_installer.py
echo     >> remote_installer.py
echo     async def process_message(self, message: str): >> remote_installer.py
echo         \"\"\"Process incoming WebSocket messages\"\"\" >> remote_installer.py
echo         try: >> remote_installer.py
echo             data = json.loads(message) >> remote_installer.py
echo             >> remote_installer.py
echo             # Handle topic messages >> remote_installer.py
echo             if "topic" in data: >> remote_installer.py
echo                 topic = data["topic"] >> remote_installer.py
echo                 >> remote_installer.py
echo                 # Process specific topics >> remote_installer.py
echo                 if topic == "/battery_state": >> remote_installer.py
echo                     self.battery_state = data >> remote_installer.py
echo                 elif topic == "/wheel_state": >> remote_installer.py
echo                     self.wheel_state = data >> remote_installer.py
echo                 elif topic == "/tracked_pose": >> remote_installer.py
echo                     if "pose" in data: >> remote_installer.py
echo                         self.position = { >> remote_installer.py
echo                             "x": data["pose"].get("position", {}).get("x", 0), >> remote_installer.py
echo                             "y": data["pose"].get("position", {}).get("y", 0), >> remote_installer.py
echo                             "orientation": data["pose"].get("orientation", 0) >> remote_installer.py
echo                         } >> remote_installer.py
echo         except Exception as e: >> remote_installer.py
echo             logger.error(f"Error processing message: {e}") >> remote_installer.py
echo     >> remote_installer.py
echo     async def get_robot_status(self) -> Dict: >> remote_installer.py
echo         \"\"\"Get the current status of the robot\"\"\" >> remote_installer.py
echo         status = { >> remote_installer.py
echo             "state": self.state.value, >> remote_installer.py
echo             "connected": self.connected, >> remote_installer.py
echo             "position": self.position, >> remote_installer.py
echo             "battery": self.battery_state, >> remote_installer.py
echo             "wheel_state": self.wheel_state, >> remote_installer.py
echo             "current_map_id": self.current_map_id >> remote_installer.py
echo         } >> remote_installer.py
echo         return status >> remote_installer.py
echo. >> remote_installer.py
echo # Global robot_ai instance >> remote_installer.py
echo robot_ai = None >> remote_installer.py
echo. >> remote_installer.py
echo async def get_robot_ai(): >> remote_installer.py
echo     \"\"\"Get or create the RobotAI instance\"\"\" >> remote_installer.py
echo     global robot_ai >> remote_installer.py
echo     >> remote_installer.py
echo     if robot_ai is None: >> remote_installer.py
echo         robot_ai = RobotAI() >> remote_installer.py
echo         await robot_ai.connect() >> remote_installer.py
echo     >> remote_installer.py
echo     return robot_ai >> remote_installer.py
echo """ >> remote_installer.py
echo. >> remote_installer.py
echo     # Web interface >> remote_installer.py
echo     package["index.html"] = """<!DOCTYPE html> >> remote_installer.py
echo <html lang="en"> >> remote_installer.py
echo <head> >> remote_installer.py
echo     <meta charset="UTF-8"> >> remote_installer.py
echo     <meta name="viewport" content="width=device-width, initial-scale=1.0"> >> remote_installer.py
echo     <title>Robot AI Dashboard</title> >> remote_installer.py
echo     <style> >> remote_installer.py
echo         body { >> remote_installer.py
echo             font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; >> remote_installer.py
echo             line-height: 1.6; >> remote_installer.py
echo             color: #333; >> remote_installer.py
echo             max-width: 1200px; >> remote_installer.py
echo             margin: 0 auto; >> remote_installer.py
echo             padding: 20px; >> remote_installer.py
echo             background-color: #f5f5f5; >> remote_installer.py
echo         } >> remote_installer.py
echo         .container { >> remote_installer.py
echo             background: white; >> remote_installer.py
echo             border-radius: 8px; >> remote_installer.py
echo             padding: 20px; >> remote_installer.py
echo             box-shadow: 0 2px 10px rgba(0,0,0,0.1); >> remote_installer.py
echo         } >> remote_installer.py
echo         h1 { >> remote_installer.py
echo             color: #2563EB; >> remote_installer.py
echo             margin-top: 0; >> remote_installer.py
echo         } >> remote_installer.py
echo         .grid { >> remote_installer.py
echo             display: grid; >> remote_installer.py
echo             grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); >> remote_installer.py
echo             gap: 20px; >> remote_installer.py
echo             margin-top: 20px; >> remote_installer.py
echo         } >> remote_installer.py
echo         .card { >> remote_installer.py
echo             background: white; >> remote_installer.py
echo             border-radius: 8px; >> remote_installer.py
echo             padding: 20px; >> remote_installer.py
echo             box-shadow: 0 2px 6px rgba(0,0,0,0.1); >> remote_installer.py
echo         } >> remote_installer.py
echo         .card-header { >> remote_installer.py
echo             display: flex; >> remote_installer.py
echo             justify-content: space-between; >> remote_installer.py
echo             align-items: center; >> remote_installer.py
echo             margin-bottom: 15px; >> remote_installer.py
echo             padding-bottom: 10px; >> remote_installer.py
echo             border-bottom: 1px solid #e5e7eb; >> remote_installer.py
echo         } >> remote_installer.py
echo         .card-title { >> remote_installer.py
echo             margin: 0; >> remote_installer.py
echo             font-size: 18px; >> remote_installer.py
echo             font-weight: 600; >> remote_installer.py
echo         } >> remote_installer.py
echo         .status-badge { >> remote_installer.py
echo             display: inline-block; >> remote_installer.py
echo             padding: 4px 8px; >> remote_installer.py
echo             border-radius: 9999px; >> remote_installer.py
echo             font-size: 12px; >> remote_installer.py
echo             font-weight: 500; >> remote_installer.py
echo         } >> remote_installer.py
echo         .status-online { >> remote_installer.py
echo             background-color: #d1fae5; >> remote_installer.py
echo             color: #065f46; >> remote_installer.py
echo         } >> remote_installer.py
echo         .status-offline { >> remote_installer.py
echo             background-color: #fee2e2; >> remote_installer.py
echo             color: #b91c1c; >> remote_installer.py
echo         } >> remote_installer.py
echo     </style> >> remote_installer.py
echo </head> >> remote_installer.py
echo <body> >> remote_installer.py
echo     <div class="container"> >> remote_installer.py
echo         <h1>Robot AI Dashboard</h1> >> remote_installer.py
echo         <p>Enhanced autonomous robot control system</p> >> remote_installer.py
echo         <div class="grid"> >> remote_installer.py
echo             <div class="card"> >> remote_installer.py
echo                 <div class="card-header"> >> remote_installer.py
echo                     <h2 class="card-title">Robot Status</h2> >> remote_installer.py
echo                     <span id="status-badge" class="status-badge status-offline">Connecting...</span> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo                 <div> >> remote_installer.py
echo                     <p><strong>Robot SN:</strong> <span id="robot-sn">Loading...</span></p> >> remote_installer.py
echo                     <p><strong>IP Address:</strong> <span id="robot-ip">Loading...</span></p> >> remote_installer.py
echo                     <p><strong>Status:</strong> <span id="connection-status">Initializing...</span></p> >> remote_installer.py
echo                     <p><strong>Battery:</strong> <span id="battery-level">Loading...</span></p> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo             </div> >> remote_installer.py
echo             <div class="card"> >> remote_installer.py
echo                 <div class="card-header"> >> remote_installer.py
echo                     <h2 class="card-title">Navigation</h2> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo                 <div> >> remote_installer.py
echo                     <p><strong>Current Position:</strong> <span id="position">Loading...</span></p> >> remote_installer.py
echo                     <p><strong>Current Map:</strong> <span id="current-map">Loading...</span></p> >> remote_installer.py
echo                     <p><strong>Movement Status:</strong> <span id="movement-status">Loading...</span></p> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo             </div> >> remote_installer.py
echo             <div class="card"> >> remote_installer.py
echo                 <div class="card-header"> >> remote_installer.py
echo                     <h2 class="card-title">Camera Feed</h2> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo                 <div> >> remote_installer.py
echo                     <p>Camera feed is available through the robot's API.</p> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo             </div> >> remote_installer.py
echo             <div class="card"> >> remote_installer.py
echo                 <div class="card-header"> >> remote_installer.py
echo                     <h2 class="card-title">Task Queue</h2> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo                 <div> >> remote_installer.py
echo                     <p>No tasks currently in queue.</p> >> remote_installer.py
echo                 </div> >> remote_installer.py
echo             </div> >> remote_installer.py
echo         </div> >> remote_installer.py
echo     </div> >> remote_installer.py
echo     <script> >> remote_installer.py
echo         // Configuration >> remote_installer.py
echo         const config = { >> remote_installer.py
echo             robotSn: "{sn}", >> remote_installer.py
echo             robotIp: "{ip}", >> remote_installer.py
echo             robotSecret: localStorage.getItem('robotSecret') || "" >> remote_installer.py
echo         }; >> remote_installer.py
echo         // Update UI elements >> remote_installer.py
echo         document.getElementById('robot-sn').textContent = config.robotSn; >> remote_installer.py
echo         document.getElementById('robot-ip').textContent = config.robotIp; >> remote_installer.py
echo         document.getElementById('battery-level').textContent = "Loading..."; >> remote_installer.py
echo         document.getElementById('position').textContent = "Loading..."; >> remote_installer.py
echo         document.getElementById('current-map').textContent = "Loading..."; >> remote_installer.py
echo         document.getElementById('movement-status').textContent = "Loading..."; >> remote_installer.py
echo         // Function to check robot connection >> remote_installer.py
echo         async function checkRobotConnection() { >> remote_installer.py
echo             document.getElementById('connection-status').textContent = "Checking connection..."; >> remote_installer.py
echo             const statusBadge = document.getElementById('status-badge'); >> remote_installer.py
echo             try { >> remote_installer.py
echo                 const response = await fetch(`http://${config.robotIp}/api/status`, { >> remote_installer.py
echo                     headers: { >> remote_installer.py
echo                         'Authorization': `Secret ${config.robotSecret}` >> remote_installer.py
echo                     } >> remote_installer.py
echo                 }); >> remote_installer.py
echo                 if (response.ok) { >> remote_installer.py
echo                     const data = await response.json(); >> remote_installer.py
echo                     document.getElementById('connection-status').textContent = "Connected"; >> remote_installer.py
echo                     statusBadge.textContent = "Online"; >> remote_installer.py
echo                     statusBadge.classList.remove('status-offline'); >> remote_installer.py
echo                     statusBadge.classList.add('status-online'); >> remote_installer.py
echo                     return true; >> remote_installer.py
echo                 } else { >> remote_installer.py
echo                     throw new Error(`HTTP error: ${response.status}`); >> remote_installer.py
echo                 } >> remote_installer.py
echo             } catch (error) { >> remote_installer.py
echo                 console.error('Connection error:', error); >> remote_installer.py
echo                 document.getElementById('connection-status').textContent = "Disconnected"; >> remote_installer.py
echo                 statusBadge.textContent = "Offline"; >> remote_installer.py
echo                 statusBadge.classList.remove('status-online'); >> remote_installer.py
echo                 statusBadge.classList.add('status-offline'); >> remote_installer.py
echo                 return false; >> remote_installer.py
echo             } >> remote_installer.py
echo         } >> remote_installer.py
echo         // Check connection periodically >> remote_installer.py
echo         setInterval(checkRobotConnection, 5000); >> remote_installer.py
echo         // Initial connection check >> remote_installer.py
echo         checkRobotConnection(); >> remote_installer.py
echo         console.log("Robot AI Dashboard initialized"); >> remote_installer.py
echo     </script> >> remote_installer.py
echo </body> >> remote_installer.py
echo </html>""" >> remote_installer.py
echo. >> remote_installer.py
echo     # Server script >> remote_installer.py
echo     package["server.py"] = """#!/usr/bin/env python3 >> remote_installer.py
echo \"\"\" >> remote_installer.py
echo Robot AI - API Server >> remote_installer.py
echo This module provides a web API for the Robot AI >> remote_installer.py
echo \"\"\" >> remote_installer.py
echo import os >> remote_installer.py
echo import json >> remote_installer.py
echo import asyncio >> remote_installer.py
echo import logging >> remote_installer.py
echo from aiohttp import web >> remote_installer.py
echo from core import get_robot_ai >> remote_installer.py
echo. >> remote_installer.py
echo # Configure logging >> remote_installer.py
echo logging.basicConfig( >> remote_installer.py
echo     level=logging.INFO, >> remote_installer.py
echo     format='%%(asctime)s - %%(name)s - %%(levelname)s - %%(message)s', >> remote_installer.py
echo     handlers=[ >> remote_installer.py
echo         logging.FileHandler("logs/api.log"), >> remote_installer.py
echo         logging.StreamHandler() >> remote_installer.py
echo     ] >> remote_installer.py
echo ) >> remote_installer.py
echo logger = logging.getLogger("robot-ai-api") >> remote_installer.py
echo. >> remote_installer.py
echo # Create web app >> remote_installer.py
echo app = web.Application() >> remote_installer.py
echo routes = web.RouteTableDef() >> remote_installer.py
echo. >> remote_installer.py
echo @routes.get('/api/status') >> remote_installer.py
echo async def get_status(request): >> remote_installer.py
echo     \"\"\"Get the current status of the robot\"\"\" >> remote_installer.py
echo     try: >> remote_installer.py
echo         robot = await get_robot_ai() >> remote_installer.py
echo         status = await robot.get_robot_status() >> remote_installer.py
echo         return web.json_response(status) >> remote_installer.py
echo     except Exception as e: >> remote_installer.py
echo         logger.error(f"Error getting status: {e}") >> remote_installer.py
echo         return web.json_response({"error": str(e)}, status=500) >> remote_installer.py
echo. >> remote_installer.py
echo # Add static file handler for web interface >> remote_installer.py
echo async def index(request): >> remote_installer.py
echo     return web.FileResponse('./index.html') >> remote_installer.py
echo. >> remote_installer.py
echo # Add routes to app >> remote_installer.py
echo app.add_routes(routes) >> remote_installer.py
echo app.router.add_get('/', index) >> remote_installer.py
echo. >> remote_installer.py
echo def run_server(): >> remote_installer.py
echo     # Create the logs directory if it doesn't exist >> remote_installer.py
echo     os.makedirs("logs", exist_ok=True) >> remote_installer.py
echo     >> remote_installer.py
echo     # Start the web server >> remote_installer.py
echo     web.run_app(app, host='0.0.0.0', port=8080) >> remote_installer.py
echo. >> remote_installer.py
echo if __name__ == '__main__': >> remote_installer.py
echo     run_server() >> remote_installer.py
echo """ >> remote_installer.py
echo. >> remote_installer.py
echo     # Start script >> remote_installer.py
echo     package["start.sh"] = """#!/bin/bash >> remote_installer.py
echo # Start the Robot AI >> remote_installer.py
echo. >> remote_installer.py
echo SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" >> remote_installer.py
echo LOG_DIR="$SCRIPT_DIR/logs" >> remote_installer.py
echo. >> remote_installer.py
echo # Ensure log directory exists >> remote_installer.py
echo mkdir -p "$LOG_DIR" >> remote_installer.py
echo. >> remote_installer.py
echo # Start the API server >> remote_installer.py
echo cd "$SCRIPT_DIR" >> remote_installer.py
echo python3 server.py > "$LOG_DIR/server.log" 2>&1 & >> remote_installer.py
echo echo $! > "$SCRIPT_DIR/server.pid" >> remote_installer.py
echo. >> remote_installer.py
echo echo "Robot AI services started. Access web interface at http://localhost:8080" >> remote_installer.py
echo """ >> remote_installer.py
echo. >> remote_installer.py
echo     # Stop script >> remote_installer.py
echo     package["stop.sh"] = """#!/bin/bash >> remote_installer.py
echo # Stop the Robot AI services >> remote_installer.py
echo. >> remote_installer.py
echo SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )" >> remote_installer.py
echo. >> remote_installer.py
echo # Stop the server >> remote_installer.py
echo if [ -f "$SCRIPT_DIR/server.pid" ]; then >> remote_installer.py
echo     kill $(cat "$SCRIPT_DIR/server.pid") 2>/dev/null || true >> remote_installer.py
echo     rm "$SCRIPT_DIR/server.pid" >> remote_installer.py
echo fi >> remote_installer.py
echo. >> remote_installer.py
echo echo "Robot AI services stopped" >> remote_installer.py
echo """ >> remote_installer.py
echo. >> remote_installer.py
echo     return package >> remote_installer.py
echo. >> remote_installer.py
echo def install_robot_ai(): >> remote_installer.py
echo     """Install the Robot AI package on the robot""" >> remote_installer.py
echo     print(f"Starting remote installation to robot {ROBOT_SN} at {ROBOT_IP}") >> remote_installer.py
echo     print("Using authentication with secret key") >> remote_installer.py
echo. >> remote_installer.py
echo     if not ROBOT_SECRET: >> remote_installer.py
echo         print("Error: No authentication secret provided") >> remote_installer.py
echo         return False >> remote_installer.py
echo. >> remote_installer.py
echo     try: >> remote_installer.py
echo         # Test connection with authentication >> remote_installer.py
echo         headers = {"Authorization": f"Secret {ROBOT_SECRET}"} >> remote_installer.py
echo         response = requests.get(f"http://{ROBOT_IP}:8090/device/info", >> remote_installer.py
echo                               headers=headers, verify=False, timeout=10) >> remote_installer.py
echo. >> remote_installer.py
echo         if response.status_code != 200: >> remote_installer.py
echo             print(f"Error: Could not connect to robot. Status code: {response.status_code}") >> remote_installer.py
echo             return False >> remote_installer.py
echo. >> remote_installer.py
echo         robot_info = response.json() >> remote_installer.py
echo         print("Successfully connected to robot:") >> remote_installer.py
echo         print(f"  Name: {robot_info.get('name', 'Unknown')}") >> remote_installer.py
echo         print(f"  Serial: {robot_info.get('serial', 'Unknown')}") >> remote_installer.py
echo         print(f"  Version: {robot_info.get('version', 'Unknown')}") >> remote_installer.py
echo         print() >> remote_installer.py
echo. >> remote_installer.py
echo         # Create AI package in memory >> remote_installer.py
echo         print("Creating Robot AI package...") >> remote_installer.py
echo         package = create_robot_ai_package() >> remote_installer.py
echo. >> remote_installer.py
echo         # Prepare package for upload >> remote_installer.py
echo         bio = io.BytesIO() >> remote_installer.py
echo         with zipfile.ZipFile(bio, 'w') as zipf: >> remote_installer.py
echo             for filename, content in package.items(): >> remote_installer.py
echo                 zipf.writestr(filename, content.replace("{sn}", ROBOT_SN).replace("{ip}", ROBOT_IP)) >> remote_installer.py
echo. >> remote_installer.py
echo         bio.seek(0) >> remote_installer.py
echo         package_data = base64.b64encode(bio.read()).decode('utf-8') >> remote_installer.py
echo. >> remote_installer.py
echo         # Send install command to robot >> remote_installer.py
echo         print("Uploading and installing package on robot...") >> remote_installer.py
echo         install_payload = { >> remote_installer.py
echo             "action": "install_ai_package", >> remote_installer.py
echo             "package_data": package_data, >> remote_installer.py
echo             "install_path": "/home/robot/robot-ai", >> remote_installer.py
echo             "auto_start": True >> remote_installer.py
echo         } >> remote_installer.py
echo. >> remote_installer.py
echo         install_response = requests.post( >> remote_installer.py
echo             f"http://{ROBOT_IP}:8090/api/extensions/install", >> remote_installer.py
echo             headers=headers, >> remote_installer.py
echo             json=install_payload, >> remote_installer.py
echo             verify=False, >> remote_installer.py
echo             timeout=60 >> remote_installer.py
echo         ) >> remote_installer.py
echo. >> remote_installer.py
echo         if install_response.status_code == 200: >> remote_installer.py
echo             print("Successfully installed Robot AI package!") >> remote_installer.py
echo             print(f"Web interface is available at: http://{ROBOT_IP}:8080") >> remote_installer.py
echo             print() >> remote_installer.py
echo             print("Opening web interface...") >> remote_installer.py
echo             try: >> remote_installer.py
echo                 import webbrowser >> remote_installer.py
echo                 webbrowser.open(f"http://{ROBOT_IP}:8080") >> remote_installer.py
echo             except: >> remote_installer.py
echo                 print(f"Could not automatically open browser. Please visit http://{ROBOT_IP}:8080 manually.") >> remote_installer.py
echo             return True >> remote_installer.py
echo         else: >> remote_installer.py
echo             print(f"Error installing package. Status code: {install_response.status_code}") >> remote_installer.py
echo             print(f"Response: {install_response.text}") >> remote_installer.py
echo. >> remote_installer.py
echo             # Try alternate installation method using SSH >> remote_installer.py
echo             print("Trying alternate installation method...") >> remote_installer.py
echo             alt_payload = { >> remote_installer.py
echo                 "action": "execute_command", >> remote_installer.py
echo                 "command": f"mkdir -p /home/robot/robot-ai && echo 'Robot AI installed via alternate method' > /home/robot/robot-ai/installed.txt" >> remote_installer.py
echo             } >> remote_installer.py
echo. >> remote_installer.py
echo             alt_response = requests.post( >> remote_installer.py
echo                 f"http://{ROBOT_IP}:8090/api/system/execute", >> remote_installer.py
echo                 headers=headers, >> remote_installer.py
echo                 json=alt_payload, >> remote_installer.py
echo                 verify=False, >> remote_installer.py
echo                 timeout=30 >> remote_installer.py
echo             ) >> remote_installer.py
echo. >> remote_installer.py
echo             if alt_response.status_code == 200: >> remote_installer.py
echo                 print("Alternate installation method successful") >> remote_installer.py
echo                 print("Now uploading files one by one...") >> remote_installer.py
echo. >> remote_installer.py
echo                 for filename, content in package.items(): >> remote_installer.py
echo                     file_content = content.replace("{sn}", ROBOT_SN).replace("{ip}", ROBOT_IP) >> remote_installer.py
echo                     file_payload = { >> remote_installer.py
echo                         "action": "write_file", >> remote_installer.py
echo                         "path": f"/home/robot/robot-ai/{filename}", >> remote_installer.py
echo                         "content": base64.b64encode(file_content.encode('utf-8')).decode('utf-8') >> remote_installer.py
echo                     } >> remote_installer.py
echo. >> remote_installer.py
echo                     file_response = requests.post( >> remote_installer.py
echo                         f"http://{ROBOT_IP}:8090/api/system/file", >> remote_installer.py
echo                         headers=headers, >> remote_installer.py
echo                         json=file_payload, >> remote_installer.py
echo                         verify=False, >> remote_installer.py
echo                         timeout=30 >> remote_installer.py
echo                     ) >> remote_installer.py
echo. >> remote_installer.py
echo                     if file_response.status_code == 200: >> remote_installer.py
echo                         print(f"Uploaded {filename}") >> remote_installer.py
echo                     else: >> remote_installer.py
echo                         print(f"Failed to upload {filename}: {file_response.status_code}") >> remote_installer.py
echo. >> remote_installer.py
echo                 # Make scripts executable >> remote_installer.py
echo                 chmod_payload = { >> remote_installer.py
echo                     "action": "execute_command", >> remote_installer.py
echo                     "command": "chmod +x /home/robot/robot-ai/*.sh" >> remote_installer.py
echo                 } >> remote_installer.py
echo. >> remote_installer.py
echo                 requests.post( >> remote_installer.py
echo                     f"http://{ROBOT_IP}:8090/api/system/execute", >> remote_installer.py
echo                     headers=headers, >> remote_installer.py
echo                     json=chmod_payload, >> remote_installer.py
echo                     verify=False, >> remote_installer.py
echo                     timeout=30 >> remote_installer.py
echo                 ) >> remote_installer.py
echo. >> remote_installer.py
echo                 # Start the service >> remote_installer.py
echo                 start_payload = { >> remote_installer.py
echo                     "action": "execute_command", >> remote_installer.py
echo                     "command": "/home/robot/robot-ai/start.sh" >> remote_installer.py
echo                 } >> remote_installer.py
echo. >> remote_installer.py
echo                 start_response = requests.post( >> remote_installer.py
echo                     f"http://{ROBOT_IP}:8090/api/system/execute", >> remote_installer.py
echo                     headers=headers, >> remote_installer.py
echo                     json=start_payload, >> remote_installer.py
echo                     verify=False, >> remote_installer.py
echo                     timeout=30 >> remote_installer.py
echo                 ) >> remote_installer.py
echo. >> remote_installer.py
echo                 if start_response.status_code == 200: >> remote_installer.py
echo                     print("Successfully started Robot AI service!") >> remote_installer.py
echo                     print(f"Web interface is available at: http://{ROBOT_IP}:8080") >> remote_installer.py
echo                     print() >> remote_installer.py
echo                     print("Opening web interface...") >> remote_installer.py
echo                     try: >> remote_installer.py
echo                         import webbrowser >> remote_installer.py
echo                         webbrowser.open(f"http://{ROBOT_IP}:8080") >> remote_installer.py
echo                     except: >> remote_installer.py
echo                         print(f"Could not automatically open browser. Please visit http://{ROBOT_IP}:8080 manually.") >> remote_installer.py
echo                     return True >> remote_installer.py
echo                 else: >> remote_installer.py
echo                     print(f"Failed to start service: {start_response.status_code}") >> remote_installer.py
echo             else: >> remote_installer.py
echo                 print(f"Alternate installation method failed: {alt_response.status_code}") >> remote_installer.py
echo. >> remote_installer.py
echo             return False >> remote_installer.py
echo. >> remote_installer.py
echo     except Exception as e: >> remote_installer.py
echo         print(f"Error: {str(e)}") >> remote_installer.py
echo         return False >> remote_installer.py
echo. >> remote_installer.py
echo if __name__ == "__main__": >> remote_installer.py
echo     if not ROBOT_SECRET: >> remote_installer.py
echo         print("Error: ROBOT_SECRET environment variable not set") >> remote_installer.py
echo         sys.exit(1) >> remote_installer.py
echo. >> remote_installer.py
echo     success = install_robot_ai() >> remote_installer.py
echo     if not success: >> remote_installer.py
echo         print("Installation failed") >> remote_installer.py
echo         sys.exit(1) >> remote_installer.py
echo. >> remote_installer.py
echo     print("Installation complete. Press Enter to exit...") >> remote_installer.py
echo     input() >> remote_installer.py

REM Run the Python script with the ROBOT_SECRET environment variable
echo =========================================
echo   Starting Remote Robot AI Installer
echo =========================================
set ROBOT_SECRET=%ROBOT_SECRET%
python remote_installer.py

REM Clean up
del remote_installer.py

echo.
echo =========================================
echo   Installation process complete!
echo =========================================
pause