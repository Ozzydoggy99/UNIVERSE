#!/bin/bash
# Robot AI Onboard Installer
# This installer runs directly on the robot and installs the AI package locally

# Log output
LOG_FILE="/tmp/robot-ai-install.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Configuration
INSTALL_DIR="/home/robot/robot-ai"
ROBOT_SN="L382502104987ir"
WEB_PORT=8080

echo "========================================"
echo "  Robot AI Onboard Installer v1.0.0"
echo "  Started at: $(date)"
echo "========================================"
echo "Installation directory: $INSTALL_DIR"
echo "Robot Serial: $ROBOT_SN"
echo "Log file: $LOG_FILE"
echo "========================================"

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/modules"
mkdir -p "$INSTALL_DIR/www"

# Create the core module
echo "Creating AI core module..."
cat > "$INSTALL_DIR/modules/core.py" << 'EOF'
"""
Robot AI Core Module
This is the main entry point for the Robot AI package that
provides enhanced autonomous capabilities.

Author: AI Assistant
Version: 1.0.0
"""
import os
import json
import time
import asyncio
import logging
import websockets
import requests
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/robot_ai.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai-core")

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
    
    def __init__(self, robot_ip: str = "127.0.0.1", robot_port: int = 8090, use_ssl: bool = False):
        """Initialize the Robot AI with connection details"""
        self.robot_ip = robot_ip
        self.robot_port = robot_port
        self.use_ssl = use_ssl
        self.protocol = "https" if use_ssl else "http"
        self.ws_protocol = "wss" if use_ssl else "ws"
        self.base_url = f"{self.protocol}://{self.robot_ip}:{self.robot_port}"
        self.ws_url = f"{self.ws_protocol}://{self.robot_ip}:{self.robot_port}/ws/v2/topics"
        self.ws = None
        self.state = RobotState.IDLE
        self.current_map_id = None
        self.position = {"x": 0, "y": 0, "orientation": 0}
        self.enabled_topics = []
        self.battery_state = {}
        self.wheel_state = {}
        self.maps = []
        self.connected = False
        self.last_connected = 0
        self.reconnect_attempts = 0
        self.max_reconnect_attempts = 10
        self.reconnect_delay = 1  # seconds
        self.topics_callbacks = {}
        self.session = requests.Session()
        self.session.verify = False
        
        # Try to read auth token for local use
        try:
            if os.path.exists("/etc/robot/auth.json"):
                with open("/etc/robot/auth.json", "r") as f:
                    auth_data = json.load(f)
                    if "secret" in auth_data:
                        self.session.headers.update({"Authorization": f"Secret {auth_data['secret']}"})
                        logger.info("Using local robot authentication")
        except Exception as e:
            logger.warning(f"Could not load local auth data: {e}")
    
    async def connect(self):
        """Establish connection to the robot and start monitoring topics"""
        try:
            logger.info(f"Connecting to robot at {self.robot_ip}:{self.robot_port}")
            
            # Test REST API connection
            response = self.session.get(f"{self.base_url}/device/info")
            if response.status_code != 200:
                logger.error(f"Could not connect to robot API: {response.status_code}")
                return False
            
            logger.info("Successfully connected to robot API")
            
            # Connect to WebSocket for real-time updates
            logger.info(f"Connecting to WebSocket at {self.ws_url}")
            
            headers = {}
            if "Authorization" in self.session.headers:
                headers["Authorization"] = self.session.headers["Authorization"]
                
            self.ws = await websockets.connect(
                self.ws_url,
                extra_headers=headers,
                ping_interval=None  # Handle pings manually
            )
            
            logger.info("WebSocket connection established")
            self.connected = True
            self.last_connected = time.time()
            self.reconnect_attempts = 0
            
            # Start the WebSocket listener
            asyncio.create_task(self.listen_for_updates())
            
            # Enable default topics
            default_topics = [
                "/wheel_state",
                "/tracked_pose",
                "/battery_state",
                "/detailed_battery_state",
                "/map",
                "/slam/state"
            ]
            await self.enable_topics(default_topics)
            
            return True
        except Exception as e:
            logger.error(f"Connection error: {e}")
            self.connected = False
            return False
    
    async def reconnect(self):
        """Attempt to reconnect to the robot"""
        if self.reconnect_attempts >= self.max_reconnect_attempts:
            logger.error("Maximum reconnect attempts reached")
            return False
        
        self.reconnect_attempts += 1
        delay = self.reconnect_delay * self.reconnect_attempts
        logger.info(f"Attempting to reconnect in {delay}s (attempt {self.reconnect_attempts})")
        
        await asyncio.sleep(delay)
        return await self.connect()
    
    async def enable_topics(self, topics: List[str]):
        """Enable specified topics for real-time updates"""
        if not self.connected or self.ws is None:
            logger.warning("Cannot enable topics: not connected")
            return False
        
        logger.info(f"Enabling topics: {topics}")
        
        # Add topics to the list if not already enabled
        for topic in topics:
            if topic not in self.enabled_topics:
                self.enabled_topics.append(topic)
        
        # Send enable_topics command
        try:
            message = {
                "op": "enable_topics",
                "topics": self.enabled_topics
            }
            await self.ws.send(json.dumps(message))
            logger.info(f"Enabled topics: {self.enabled_topics}")
            return True
        except Exception as e:
            logger.error(f"Error enabling topics: {e}")
            return False
    
    async def disable_topics(self, topics: List[str]):
        """Disable specified topics"""
        if not self.connected or self.ws is None:
            logger.warning("Cannot disable topics: not connected")
            return False
        
        logger.info(f"Disabling topics: {topics}")
        
        # Remove topics from the list
        for topic in topics:
            if topic in self.enabled_topics:
                self.enabled_topics.remove(topic)
        
        # Send enable_topics command with updated list
        try:
            message = {
                "op": "enable_topics",
                "topics": self.enabled_topics
            }
            await self.ws.send(json.dumps(message))
            logger.info(f"Updated enabled topics: {self.enabled_topics}")
            return True
        except Exception as e:
            logger.error(f"Error disabling topics: {e}")
            return False
    
    async def listen_for_updates(self):
        """Listen for updates from the robot via WebSocket"""
        logger.info("Started WebSocket listener")
        
        try:
            while self.connected and self.ws is not None:
                try:
                    # Send ping to keep connection alive
                    if time.time() - self.last_connected > 30:
                        await self.ws.ping()
                        self.last_connected = time.time()
                    
                    # Receive and process messages with timeout
                    message = await asyncio.wait_for(self.ws.recv(), timeout=1.0)
                    await self.process_message(message)
                except asyncio.TimeoutError:
                    # No message received within timeout, continue
                    continue
                except websockets.exceptions.ConnectionClosed:
                    logger.warning("WebSocket connection closed")
                    self.connected = False
                    break
        except Exception as e:
            logger.error(f"WebSocket listener error: {e}")
            self.connected = False
        
        # Try to reconnect if connection was lost
        if not self.connected:
            logger.info("Connection lost, attempting to reconnect")
            asyncio.create_task(self.reconnect())
    
    async def process_message(self, message: str):
        """Process incoming WebSocket messages"""
        try:
            data = json.loads(message)
            
            # Handle non-topic messages
            if "op" in data:
                if data["op"] == "enable_topics_result":
                    logger.info(f"Topics result: {data}")
                    return
            
            # Handle topic messages
            if "topic" in data:
                topic = data["topic"]
                
                # Process specific topics
                if topic == "/battery_state":
                    self.battery_state = data
                elif topic == "/wheel_state":
                    self.wheel_state = data
                elif topic == "/tracked_pose":
                    if "pose" in data:
                        self.position = {
                            "x": data["pose"].get("position", {}).get("x", 0),
                            "y": data["pose"].get("position", {}).get("y", 0),
                            "orientation": data["pose"].get("orientation", 0)
                        }
                
                # Call any registered callbacks for this topic
                if topic in self.topics_callbacks:
                    for callback in self.topics_callbacks[topic]:
                        try:
                            callback(data)
                        except Exception as e:
                            logger.error(f"Error in callback for topic {topic}: {e}")
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON message: {message}")
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def set_current_map(self, map_id: int) -> bool:
        """Set the current map on the robot"""
        try:
            response = self.session.post(
                f"{self.base_url}/api/set_current_map",
                json={"map_id": map_id}
            )
            
            if response.status_code == 200:
                self.current_map_id = map_id
                logger.info(f"Set current map to ID: {map_id}")
                return True
            else:
                logger.error(f"Failed to set current map: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error setting current map: {e}")
            return False
    
    async def set_initial_pose(self, x: float, y: float, orientation: float, adjust_position: bool = True) -> bool:
        """Set the initial pose of the robot on the current map"""
        try:
            data = {
                "x": x,
                "y": y,
                "ori": orientation,
                "adjust_position": adjust_position
            }
            
            response = self.session.post(
                f"{self.base_url}/api/set_initial_pose",
                json=data
            )
            
            if response.status_code == 200:
                self.position = {"x": x, "y": y, "orientation": orientation}
                logger.info(f"Set initial pose to x={x}, y={y}, orientation={orientation}")
                return True
            else:
                logger.error(f"Failed to set initial pose: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error setting initial pose: {e}")
            return False
    
    async def get_maps_list(self) -> List[Dict]:
        """Get a list of available maps"""
        try:
            response = self.session.get(f"{self.base_url}/api/maps")
            
            if response.status_code == 200:
                maps_data = response.json()
                self.maps = maps_data
                logger.info(f"Retrieved {len(maps_data)} maps")
                return maps_data
            else:
                logger.error(f"Failed to get maps list: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            logger.error(f"Error getting maps list: {e}")
            return []
    
    async def create_move_action(self, 
                               target_x: float, 
                               target_y: float, 
                               target_ori: Optional[float] = None,
                               move_type: str = "standard") -> Dict:
        """Create a movement action for the robot"""
        try:
            data = {
                "x": target_x,
                "y": target_y,
                "type": move_type
            }
            
            if target_ori is not None:
                data["ori"] = target_ori
            
            response = self.session.post(
                f"{self.base_url}/api/actions/move",
                json=data
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Created move action to ({target_x}, {target_y})")
                self.state = RobotState.MOVING
                return result
            else:
                logger.error(f"Failed to create move action: {response.status_code} - {response.text}")
                return {"success": False, "error": response.text}
        except Exception as e:
            logger.error(f"Error creating move action: {e}")
            return {"success": False, "error": str(e)}
    
    async def cancel_current_move(self) -> bool:
        """Cancel the current move action"""
        try:
            response = self.session.post(f"{self.base_url}/api/actions/cancel")
            
            if response.status_code == 200:
                logger.info("Cancelled current move action")
                self.state = RobotState.IDLE
                return True
            else:
                logger.error(f"Failed to cancel move action: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error cancelling move action: {e}")
            return False
    
    async def get_robot_status(self) -> Dict:
        """Get the current status of the robot"""
        status = {
            "state": self.state.value,
            "connected": self.connected,
            "position": self.position,
            "battery": self.battery_state,
            "wheel_state": self.wheel_state,
            "current_map_id": self.current_map_id
        }
        return status
    
    async def close(self):
        """Close the connection to the robot"""
        logger.info("Closing connection to robot")
        
        if self.ws is not None:
            await self.ws.close()
            self.ws = None
        
        self.connected = False

# Global robot_ai instance
robot_ai = None

async def get_robot_ai():
    """Get or create the RobotAI instance"""
    global robot_ai
    
    if robot_ai is None:
        robot_ai = RobotAI()
        await robot_ai.connect()
    
    return robot_ai

async def main():
    """Main entry point for the Robot AI"""
    try:
        # Initialize the Robot AI
        robot = await get_robot_ai()
        
        # Monitor for updates
        while True:
            if not robot.connected:
                logger.warning("Lost connection to robot, attempting to reconnect")
                await robot.reconnect()
            
            # Get the robot status
            status = await robot.get_robot_status()
            logger.info(f"Robot status: {status['state']}")
            
            # Wait before checking again
            await asyncio.sleep(5)
    except KeyboardInterrupt:
        logger.info("Shutting down Robot AI")
        if robot_ai is not None:
            await robot_ai.close()

if __name__ == "__main__":
    # Set up signal handlers for graceful shutdown
    import signal
    import sys
    
    def handle_shutdown(sig=None, frame=None):
        logger.info("Shutdown signal received")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    
    # Run the main function
    asyncio.run(main())
EOF

# Create a simple web interface
echo "Creating web interface..."
cat > "$INSTALL_DIR/www/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        
        .container {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: #2563EB;
            margin-top: 0;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }
        
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .card-title {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .status-online {
            background-color: #d1fae5;
            color: #065f46;
        }
        
        .status-offline {
            background-color: #fee2e2;
            color: #b91c1c;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Robot AI Dashboard</h1>
        <p>Enhanced autonomous robot control system running directly on $ROBOT_SN</p>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Robot Status</h2>
                    <span class="status-badge status-online">Online</span>
                </div>
                <div>
                    <p><strong>Robot:</strong> $ROBOT_SN</p>
                    <p><strong>IP Address:</strong> 127.0.0.1</p>
                    <p><strong>Status:</strong> Running locally</p>
                    <p><strong>Battery:</strong> <span id="battery-level">Loading...</span></p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Navigation</h2>
                </div>
                <div>
                    <p><strong>Current Position:</strong> <span id="position">Loading...</span></p>
                    <p><strong>Current Map:</strong> <span id="current-map">Loading...</span></p>
                    <p><strong>Movement Status:</strong> <span id="movement-status">Loading...</span></p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Camera Feed</h2>
                </div>
                <div>
                    <p>Camera feed is available through the robot's API.</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Task Queue</h2>
                </div>
                <div>
                    <p>No tasks currently in queue.</p>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // API endpoints
        const API_URL = '/api';
        
        // Update UI with robot status
        async function updateRobotStatus() {
            try {
                const response = await fetch(API_URL + '/status');
                if (response.ok) {
                    const data = await response.json();
                    
                    // Update battery information
                    if (data.battery && data.battery.percentage) {
                        const batteryPercentage = Math.round(data.battery.percentage * 100);
                        let batteryStatus = 'Not Charging';
                        
                        if (data.battery.is_charging) {
                            batteryStatus = 'Charging';
                        } else if (data.state === 'moving' || data.state === 'mapping') {
                            batteryStatus = 'In-Use';
                        }
                        
                        document.getElementById('battery-level').textContent = 
                            \`\${batteryPercentage}% (\${batteryStatus})\`;
                    }
                    
                    // Update position
                    if (data.position) {
                        const x = data.position.x.toFixed(2);
                        const y = data.position.y.toFixed(2);
                        const orientation = (data.position.orientation * (180/Math.PI)).toFixed(1);
                        document.getElementById('position').textContent = 
                            \`X: \${x}, Y: \${y}, θ: \${orientation}°\`;
                    }
                    
                    // Update movement status
                    document.getElementById('movement-status').textContent = 
                        data.state.charAt(0).toUpperCase() + data.state.slice(1);
                    
                    // Update map information
                    document.getElementById('current-map').textContent = 
                        data.current_map_id ? \`Map ID: \${data.current_map_id}\` : 'No map selected';
                }
            } catch (error) {
                console.error('Error updating robot status:', error);
            }
            
            // Schedule next update
            setTimeout(updateRobotStatus, 1000);
        }
        
        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            updateRobotStatus();
        });
    </script>
</body>
</html>
EOF

# Create a simple API server
echo "Creating API server..."
cat > "$INSTALL_DIR/server.py" << 'EOF'
#!/usr/bin/env python3
"""
Robot AI - API Server
This module provides a web API for the Robot AI
"""
import os
import json
import asyncio
import logging
from aiohttp import web
from modules.core import get_robot_ai

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai-api")

# Create web app
app = web.Application()
routes = web.RouteTableDef()

@routes.get('/api/status')
async def get_status(request):
    """Get the current status of the robot"""
    try:
        robot = await get_robot_ai()
        status = await robot.get_robot_status()
        return web.json_response(status)
    except Exception as e:
        logger.error(f"Error getting status: {e}")
        return web.json_response({"error": str(e)}, status=500)

@routes.get('/api/maps')
async def get_maps(request):
    """Get the list of available maps"""
    try:
        robot = await get_robot_ai()
        maps = await robot.get_maps_list()
        return web.json_response(maps)
    except Exception as e:
        logger.error(f"Error getting maps: {e}")
        return web.json_response({"error": str(e)}, status=500)

@routes.post('/api/move')
async def create_move(request):
    """Create a move action"""
    try:
        data = await request.json()
        robot = await get_robot_ai()
        
        # Extract parameters
        target_x = data.get('x')
        target_y = data.get('y')
        target_ori = data.get('orientation')
        move_type = data.get('type', 'standard')
        
        if target_x is None or target_y is None:
            return web.json_response({"error": "Missing required parameters: x, y"}, status=400)
        
        # Create the move action
        result = await robot.create_move_action(target_x, target_y, target_ori, move_type)
        return web.json_response(result)
    except Exception as e:
        logger.error(f"Error creating move: {e}")
        return web.json_response({"error": str(e)}, status=500)

@routes.post('/api/cancel')
async def cancel_move(request):
    """Cancel the current move action"""
    try:
        robot = await get_robot_ai()
        result = await robot.cancel_current_move()
        return web.json_response({"success": result})
    except Exception as e:
        logger.error(f"Error cancelling move: {e}")
        return web.json_response({"error": str(e)}, status=500)

# Add static file handler for web interface
async def index(request):
    return web.FileResponse('./www/index.html')

# Add routes to app
app.add_routes(routes)
app.router.add_get('/', index)
app.router.add_static('/', path='./www')

def run_server():
    # Change to the install directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create the logs directory if it doesn't exist
    os.makedirs("logs", exist_ok=True)
    
    # Start the web server
    web.run_app(app, host='0.0.0.0', port=8080)

if __name__ == '__main__':
    run_server()
EOF

# Create start script
echo "Creating start script..."
cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Start the API server
cd "$SCRIPT_DIR"
python3 server.py > "$LOG_DIR/server.log" 2>&1 &
echo $! > "$SCRIPT_DIR/server.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
EOF

# Make script executable
chmod +x "$INSTALL_DIR/start.sh"

# Create stop script
echo "Creating stop script..."
cat > "$INSTALL_DIR/stop.sh" << 'EOF'
#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Stop the server
if [ -f "$SCRIPT_DIR/server.pid" ]; then
    kill $(cat "$SCRIPT_DIR/server.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/server.pid"
fi

echo "Robot AI services stopped"
EOF

# Make script executable
chmod +x "$INSTALL_DIR/stop.sh"

# Install required Python packages
echo "Installing required Python packages..."
pip3 install websockets aiohttp requests

# Start the service
echo "Starting Robot AI service..."
"$INSTALL_DIR/start.sh"

# Create desktop notification (if running on a desktop)
if command -v notify-send &> /dev/null; then
    notify-send "Robot AI Installed" "Robot AI has been successfully installed. Access the web interface at http://localhost:8080"
fi

# Create desktop shortcut (if running on a desktop environment)
if [ -d "$HOME/Desktop" ]; then
    echo "Creating desktop shortcut..."
    cat > "$HOME/Desktop/Robot AI.desktop" << EOF
[Desktop Entry]
Name=Robot AI
Comment=Launch Robot AI Dashboard
Exec=xdg-open http://localhost:8080
Icon=applications-internet
Terminal=false
Type=Application
Categories=Utility;
EOF
    chmod +x "$HOME/Desktop/Robot AI.desktop"
fi

# Open web browser if possible
if command -v xdg-open &> /dev/null; then
    echo "Opening web interface in browser..."
    xdg-open http://localhost:8080 &
elif command -v open &> /dev/null; then
    echo "Opening web interface in browser..."
    open http://localhost:8080 &
fi

echo "========================================"
echo "  Installation Complete!"
echo "  Access the Robot AI dashboard at:"
echo "  http://localhost:8080"
echo "========================================"