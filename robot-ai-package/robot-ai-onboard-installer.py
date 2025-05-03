#!/usr/bin/env python3
"""
Robot AI Onboard Installer
This is a self-contained installer that downloads and sets up the Robot AI package
directly on the robot's Linux system.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import base64
import logging
import argparse
import tempfile
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-installer')

# Default installation paths
HOME_DIR = os.path.expanduser("~")
INSTALL_DIR = os.path.join(HOME_DIR, "robot-ai")
MODULE_DIR = os.path.join(INSTALL_DIR, "modules")
LOG_DIR = os.path.join(INSTALL_DIR, "logs")
WEB_PORT = 8080

# Embedded modules as base64 strings
# These will be extracted and written to files during installation
EMBEDDED_FILES = {
    # Core module
    "modules/core.py": """
# Base64-encoded content of core.py will be inserted here
""",
    
    # Camera module
    "modules/camera.py": """
# Base64-encoded content of camera.py will be inserted here
""",
    
    # Map module
    "modules/map.py": """
# Base64-encoded content of map.py will be inserted here
""",
    
    # Door module
    "modules/door.py": """
# Base64-encoded content of door.py will be inserted here
""",
    
    # Elevator module
    "modules/elevator.py": """
# Base64-encoded content of elevator.py will be inserted here
""",
    
    # Task Queue module
    "modules/task_queue.py": """
# Base64-encoded content of task_queue.py will be inserted here
""",
    
    # Dashboard HTML
    "dashboard.html": """
# Base64-encoded content of dashboard.html will be inserted here
""",
}

# The dashboard will be embedded here as a base64 encoded string
DASHBOARD_HTML = """
# Base64-encoded content of dashboard.html will be inserted here
"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Onboard Installer")
    print("=" * 60)
    print("This script will install the Robot AI package on your robot.")
    print("Version: 1.0.0")
    print("=" * 60)

def create_directories():
    """Create installation directories"""
    logger.info(f"Creating installation directories at {INSTALL_DIR}")
    
    try:
        # Create main directories
        os.makedirs(INSTALL_DIR, exist_ok=True)
        os.makedirs(MODULE_DIR, exist_ok=True)
        os.makedirs(LOG_DIR, exist_ok=True)
        
        logger.info("Directories created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create directories: {e}")
        # If we can't create directories in the home folder, try temp directory
        try:
            global INSTALL_DIR, MODULE_DIR, LOG_DIR
            INSTALL_DIR = os.path.join(tempfile.gettempdir(), "robot-ai")
            MODULE_DIR = os.path.join(INSTALL_DIR, "modules")
            LOG_DIR = os.path.join(INSTALL_DIR, "logs")
            
            os.makedirs(INSTALL_DIR, exist_ok=True)
            os.makedirs(MODULE_DIR, exist_ok=True)
            os.makedirs(LOG_DIR, exist_ok=True)
            
            logger.info(f"Using temporary directory instead: {INSTALL_DIR}")
            return True
        except Exception as e2:
            logger.error(f"Failed to create temporary directories: {e2}")
            return False

def extract_embedded_files():
    """Extract embedded files to their locations"""
    logger.info("Extracting embedded files")
    
    try:
        # Extract modules and dashboard
        for file_path, encoded_content in EMBEDDED_FILES.items():
            # Skip empty content (placeholders)
            if "# Base64-encoded content" in encoded_content:
                continue
                
            full_path = os.path.join(INSTALL_DIR, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            # Decode and write file
            content = base64.b64decode(encoded_content).decode('utf-8')
            with open(full_path, 'w') as f:
                f.write(content)
                
            logger.info(f"Extracted: {file_path}")
        
        # Extract dashboard separately if it's defined
        if "# Base64-encoded content" not in DASHBOARD_HTML:
            dashboard_path = os.path.join(INSTALL_DIR, "dashboard.html")
            dashboard_content = base64.b64decode(DASHBOARD_HTML).decode('utf-8')
            with open(dashboard_path, 'w') as f:
                f.write(dashboard_content)
                
            logger.info(f"Extracted: dashboard.html")
            
        return True
    except Exception as e:
        logger.error(f"Failed to extract embedded files: {e}")
        return False

def create_dashboard_from_scratch():
    """Create minimal dashboard when embedded one is not available"""
    logger.info("Creating minimal dashboard")
    
    try:
        dashboard_path = os.path.join(INSTALL_DIR, "dashboard.html")
        
        minimal_dashboard = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        body { font-family: sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #4a6cf7; }
        .card { border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
        input, button { padding: 8px 16px; margin: 8px 0; }
        button { background-color: #4a6cf7; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background-color: #3a5ce5; }
        .status { padding: 6px 12px; border-radius: 16px; display: inline-block; font-size: 14px; }
        .connected { background-color: #d1fae5; color: #065f46; }
        .disconnected { background-color: #fee2e2; color: #b91c1c; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Robot AI Dashboard</h1>
        <p>This dashboard provides an interface to your robot's AI capabilities.</p>
        
        <div class="card">
            <h2>Robot Connection</h2>
            <div>
                <span id="connection-status" class="status disconnected">Disconnected</span>
            </div>
            <div>
                <label for="robot-ip">Robot IP:</label>
                <input type="text" id="robot-ip" value="localhost" placeholder="e.g. 192.168.4.31">
                <button id="connect-button">Connect</button>
            </div>
            <div id="robot-info"></div>
        </div>
        
        <div class="card">
            <h2>Robot Controls</h2>
            <button id="get-maps-button">Get Maps</button>
            <div id="maps-list"></div>
            
            <div>
                <h3>Movement</h3>
                <div>
                    <label for="target-x">X:</label>
                    <input type="number" id="target-x" step="0.1" value="0">
                    <label for="target-y">Y:</label>
                    <input type="number" id="target-y" step="0.1" value="0">
                    <button id="move-button">Move To Position</button>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Robot Status</h2>
            <div id="status-display">
                <p>Position: <span id="position">--</span></p>
                <p>Battery: <span id="battery">--</span></p>
                <p>State: <span id="state">--</span></p>
            </div>
        </div>
    </div>

    <script>
        // Robot API connection
        const connectButton = document.getElementById('connect-button');
        const robotIpInput = document.getElementById('robot-ip');
        const connectionStatus = document.getElementById('connection-status');
        const robotInfo = document.getElementById('robot-info');
        const getMapsButton = document.getElementById('get-maps-button');
        const mapsList = document.getElementById('maps-list');
        const moveButton = document.getElementById('move-button');
        const targetX = document.getElementById('target-x');
        const targetY = document.getElementById('target-y');
        const positionDisplay = document.getElementById('position');
        const batteryDisplay = document.getElementById('battery');
        const stateDisplay = document.getElementById('state');
        
        let robotIP = 'localhost';
        let robotPort = 8090;
        let websocket = null;
        
        // Connect to robot
        connectButton.addEventListener('click', async () => {
            robotIP = robotIpInput.value;
            connectionStatus.textContent = 'Connecting...';
            connectionStatus.className = 'status disconnected';
            
            try {
                // Test connection with device info API
                const response = await fetch(`http://${robotIP}:${robotPort}/device/info`);
                if (response.ok) {
                    const data = await response.json();
                    
                    connectionStatus.textContent = 'Connected';
                    connectionStatus.className = 'status connected';
                    
                    robotInfo.innerHTML = `
                        <p><strong>Serial:</strong> ${data.serial || 'Unknown'}</p>
                        <p><strong>Name:</strong> ${data.name || 'Unknown'}</p>
                        <p><strong>Software Version:</strong> ${data.software_version || 'Unknown'}</p>
                    `;
                    
                    // Connect to WebSocket
                    connectWebSocket();
                    
                } else {
                    connectionStatus.textContent = `Connection Error: ${response.status}`;
                    connectionStatus.className = 'status disconnected';
                }
            } catch (error) {
                connectionStatus.textContent = `Connection Error: ${error.message}`;
                connectionStatus.className = 'status disconnected';
            }
        });
        
        // Connect to WebSocket
        function connectWebSocket() {
            try {
                websocket = new WebSocket(`ws://${robotIP}:${robotPort}/ws/v2/topics`);
                
                websocket.onopen = () => {
                    console.log('WebSocket connected');
                    
                    // Enable topics
                    const message = {
                        enable_topic: [
                            "/tracked_pose",
                            "/battery_state",
                            "/wheel_state"
                        ]
                    };
                    websocket.send(JSON.stringify(message));
                };
                
                websocket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    
                    if (data.topic === '/tracked_pose') {
                        // Update position
                        const pos = data.pos || [0, 0];
                        const ori = data.ori || 0;
                        positionDisplay.textContent = `(${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${ori.toFixed(2)})`;
                    } else if (data.topic === '/battery_state') {
                        // Update battery
                        const percentage = (data.percentage || 0) * 100;
                        const status = data.power_supply_status || 'unknown';
                        batteryDisplay.textContent = `${percentage.toFixed(1)}% (${status})`;
                    } else if (data.topic === '/wheel_state') {
                        // Update state
                        stateDisplay.textContent = data.control_mode || 'unknown';
                    }
                };
                
                websocket.onclose = () => {
                    console.log('WebSocket disconnected');
                };
                
                websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                };
            } catch (error) {
                console.error('WebSocket connection error:', error);
            }
        }
        
        // Get maps
        getMapsButton.addEventListener('click', async () => {
            try {
                const response = await fetch(`http://${robotIP}:${robotPort}/maps/`);
                if (response.ok) {
                    const maps = await response.json();
                    
                    mapsList.innerHTML = '<h3>Available Maps</h3>';
                    
                    maps.forEach(map => {
                        const mapItem = document.createElement('div');
                        mapItem.innerHTML = `
                            <p>
                                <strong>${map.name || `Map ${map.id}`}</strong>
                                <button class="load-map-button" data-id="${map.id}">Load</button>
                            </p>
                        `;
                        mapsList.appendChild(mapItem);
                    });
                    
                    // Add event listeners to load map buttons
                    document.querySelectorAll('.load-map-button').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const mapId = e.target.getAttribute('data-id');
                            loadMap(mapId);
                        });
                    });
                } else {
                    mapsList.innerHTML = `<p>Error fetching maps: ${response.status}</p>`;
                }
            } catch (error) {
                mapsList.innerHTML = `<p>Error fetching maps: ${error.message}</p>`;
            }
        });
        
        // Load map
        async function loadMap(mapId) {
            try {
                const response = await fetch(`http://${robotIP}:${robotPort}/chassis/current-map`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ map_id: parseInt(mapId) })
                });
                
                if (response.ok) {
                    alert(`Map ${mapId} loaded successfully!`);
                } else {
                    alert(`Error loading map: ${response.status}`);
                }
            } catch (error) {
                alert(`Error loading map: ${error.message}`);
            }
        }
        
        // Move to position
        moveButton.addEventListener('click', async () => {
            const x = parseFloat(targetX.value);
            const y = parseFloat(targetY.value);
            
            try {
                const response = await fetch(`http://${robotIP}:${robotPort}/chassis/moves`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        creator: "robot-ai-dashboard",
                        type: "standard",
                        target_x: x,
                        target_y: y
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    alert(`Move action created! ID: ${result.id}`);
                } else {
                    alert(`Error creating move action: ${response.status}`);
                }
            } catch (error) {
                alert(`Error creating move action: ${error.message}`);
            }
        });
    </script>
</body>
</html>
"""
        
        with open(dashboard_path, 'w') as f:
            f.write(minimal_dashboard)
            
        logger.info(f"Created minimal dashboard at {dashboard_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create minimal dashboard: {e}")
        return False

def create_startup_script():
    """Create startup script"""
    logger.info("Creating startup script")
    
    try:
        startup_script = f"""#!/bin/bash
# Robot AI Startup Script
# Start the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"
LOG_DIR="{LOG_DIR}"

# Create log directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Start Python server for web dashboard
cd "$SCRIPT_DIR"
python3 -m http.server {WEB_PORT} > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web.pid"

# Start core module
cd "$SCRIPT_DIR"
if [ -f "$SCRIPT_DIR/modules/core.py" ]; then
    python3 -m modules.core > "$LOG_DIR/core.log" 2>&1 &
    echo $! > "$SCRIPT_DIR/core.pid"
fi

echo "Robot AI services started"
echo "Web dashboard available at: http://localhost:{WEB_PORT}/dashboard.html"
"""
        
        startup_path = os.path.join(INSTALL_DIR, "start.sh")
        with open(startup_path, "w") as f:
            f.write(startup_script)
        
        # Make executable
        os.chmod(startup_path, 0o755)
        
        logger.info("Startup script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create startup script: {e}")
        return False

def create_shutdown_script():
    """Create shutdown script"""
    logger.info("Creating shutdown script")
    
    try:
        shutdown_script = f"""#!/bin/bash
# Robot AI Shutdown Script
# Stop the Robot AI service

SCRIPT_DIR="{INSTALL_DIR}"

# Stop web server
if [ -f "$SCRIPT_DIR/web.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web.pid"
fi

# Stop core module
if [ -f "$SCRIPT_DIR/core.pid" ]; then
    kill $(cat "$SCRIPT_DIR/core.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/core.pid"
fi

echo "Robot AI services stopped"
"""
        
        shutdown_path = os.path.join(INSTALL_DIR, "stop.sh")
        with open(shutdown_path, "w") as f:
            f.write(shutdown_script)
        
        # Make executable
        os.chmod(shutdown_path, 0o755)
        
        logger.info("Shutdown script created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create shutdown script: {e}")
        return False

def create_config():
    """Create configuration file"""
    logger.info("Creating configuration file")
    
    try:
        config = {
            "version": "1.0.0",
            "robot_ip": "localhost",
            "robot_port": 8090,
            "use_ssl": False,
            "web_port": WEB_PORT,
            "log_level": "INFO",
            "enable_camera": True,
            "enable_lidar": True,
            "enable_door_control": True,
            "enable_elevator_control": True,
            "enable_task_queue": True
        }
        
        config_path = os.path.join(INSTALL_DIR, "config.json")
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)
        
        logger.info("Configuration file created successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to create configuration file: {e}")
        return False

def check_required_packages():
    """Check if required Python packages are installed"""
    logger.info("Checking required Python packages")
    
    required_packages = ["websockets", "requests"]
    missing_packages = []
    
    try:
        import importlib
        for package in required_packages:
            try:
                importlib.import_module(package)
            except ImportError:
                missing_packages.append(package)
        
        if missing_packages:
            logger.warning(f"Missing required packages: {', '.join(missing_packages)}")
            logger.info("Attempting to install missing packages...")
            
            try:
                subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
                logger.info("Successfully installed missing packages")
            except Exception as e:
                logger.error(f"Failed to install packages: {e}")
                return False
    except Exception as e:
        logger.error(f"Error checking packages: {e}")
        return False
    
    return True

def start_services():
    """Start Robot AI services"""
    logger.info("Starting Robot AI services")
    
    try:
        startup_script = os.path.join(INSTALL_DIR, "start.sh")
        if os.path.exists(startup_script):
            subprocess.Popen([startup_script], shell=True)
            logger.info("Started Robot AI services")
            return True
        else:
            # Fall back to starting a simple HTTP server
            os.chdir(INSTALL_DIR)
            subprocess.Popen([sys.executable, "-m", "http.server", str(WEB_PORT)], 
                            stdout=open(os.path.join(LOG_DIR, "web.log"), "w"),
                            stderr=subprocess.STDOUT)
            logger.info(f"Started HTTP server on port {WEB_PORT}")
            return True
    except Exception as e:
        logger.error(f"Failed to start services: {e}")
        return False

class DashboardHandler(BaseHTTPRequestHandler):
    """HTTP Handler for serving the dashboard"""
    
    def do_GET(self):
        if self.path == '/' or self.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            dashboard_path = os.path.join(INSTALL_DIR, "dashboard.html")
            if os.path.exists(dashboard_path):
                with open(dashboard_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                # Fallback to minimal dashboard
                self.wfile.write(b"""
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Robot AI Dashboard</title>
                </head>
                <body>
                    <h1>Robot AI Dashboard</h1>
                    <p>The full dashboard could not be loaded.</p>
                    <p><a href="http://localhost:8080/">Click here to access the full dashboard</a></p>
                </body>
                </html>
                """)
        else:
            self.send_response(404)
            self.end_headers()

def start_local_server():
    """Start a local HTTP server to display installation progress and redirect to dashboard"""
    server = HTTPServer(('localhost', 8000), DashboardHandler)
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    logger.info("Started local HTTP server on port 8000")
    return server

def main():
    """Main installation function"""
    print_banner()
    
    parser = argparse.ArgumentParser(description="Robot AI Onboard Installer")
    parser.add_argument("--no-start", action="store_true", help="Don't start services after installation")
    parser.add_argument("--port", type=int, default=WEB_PORT, help=f"Port for web dashboard (default: {WEB_PORT})")
    args = parser.parse_args()
    
    global WEB_PORT
    WEB_PORT = args.port
    
    # Start local server for status display
    local_server = start_local_server()
    
    try:
        # Check required packages
        if not check_required_packages():
            logger.warning("Some required packages are missing, but we'll continue anyway")
        
        # Create directories
        if not create_directories():
            logger.error("Failed to create directories. Installation aborted.")
            return False
        
        # Extract embedded files or create from scratch
        if not extract_embedded_files():
            logger.warning("Failed to extract embedded files, creating from scratch")
        
        if not os.path.exists(os.path.join(INSTALL_DIR, "dashboard.html")):
            if not create_dashboard_from_scratch():
                logger.error("Failed to create dashboard. Installation aborted.")
                return False
        
        # Create startup script
        if not create_startup_script():
            logger.error("Failed to create startup script. Installation aborted.")
            return False
        
        # Create shutdown script
        if not create_shutdown_script():
            logger.error("Failed to create shutdown script. Installation aborted.")
            return False
        
        # Create configuration file
        if not create_config():
            logger.error("Failed to create configuration file. Installation aborted.")
            return False
        
        # Start services
        if not args.no_start:
            start_services()
        
        print("\nInstallation completed successfully!")
        print(f"Robot AI dashboard is available at: http://localhost:{WEB_PORT}/dashboard.html")
        print(f"Installation directory: {INSTALL_DIR}")
        print("\nTo start Robot AI manually, run:")
        print(f"  {INSTALL_DIR}/start.sh")
        print("\nTo stop Robot AI, run:")
        print(f"  {INSTALL_DIR}/stop.sh")
        
        # Open browser
        import webbrowser
        webbrowser.open(f"http://localhost:{WEB_PORT}/dashboard.html")
        
        # Keep the server running for a while
        time.sleep(60)
        
        return True
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        return False
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        return False
    finally:
        # Shut down the local server
        local_server.shutdown()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)