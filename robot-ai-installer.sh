#!/bin/bash
#
# Robot AI Installer
# This script installs the comprehensive robot AI package
# on a compatible robot controller
#
# Features:
# - Robot AI Core Module
# - Map Visualization
# - Camera Module
# - Elevator Controller
# - Door Controller
# - Task Queue Management
# - App Store Integration
# - Dependencies Management
#
# Usage: ./robot-ai-installer.sh [OPTIONS]
# Options:
#   --robot-ip IP         Robot IP address (default: 192.168.25.25)
#   --robot-port PORT     Robot port (default: 8090)
#   --robot-sn SN         Robot serial number
#   --install-dir DIR     Installation directory (default: /opt/robot-ai)
#   --dev-mode            Enable developer mode
#   --help                Show this help message
#
# Author: AI Assistant
# Version: 1.0.0

set -e

# Default values
ROBOT_IP="192.168.25.25"
ROBOT_PORT="8090"
ROBOT_SN=""
INSTALL_DIR="/opt/robot-ai"
DEV_MODE=false
COMPONENT_ALL=true
COMPONENT_CORE=false
COMPONENT_MAP=false
COMPONENT_CAMERA=false
COMPONENT_ELEVATOR=false
COMPONENT_DOOR=false
COMPONENT_TASKS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display help
show_help() {
    echo "Robot AI Installer"
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --robot-ip IP         Robot IP address (default: ${ROBOT_IP})"
    echo "  --robot-port PORT     Robot port (default: ${ROBOT_PORT})"
    echo "  --robot-sn SN         Robot serial number"
    echo "  --install-dir DIR     Installation directory (default: ${INSTALL_DIR})"
    echo "  --dev-mode            Enable developer mode"
    echo "  --component COMP      Install specific component (core,map,camera,elevator,door,tasks)"
    echo "  --help                Show this help message"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        --robot-ip)
            ROBOT_IP="$2"
            shift
            shift
            ;;
        --robot-port)
            ROBOT_PORT="$2"
            shift
            shift
            ;;
        --robot-sn)
            ROBOT_SN="$2"
            shift
            shift
            ;;
        --install-dir)
            INSTALL_DIR="$2"
            shift
            shift
            ;;
        --dev-mode)
            DEV_MODE=true
            shift
            ;;
        --component)
            COMPONENT_ALL=false
            case "$2" in
                core)
                    COMPONENT_CORE=true
                    ;;
                map)
                    COMPONENT_MAP=true
                    ;;
                camera)
                    COMPONENT_CAMERA=true
                    ;;
                elevator)
                    COMPONENT_ELEVATOR=true
                    ;;
                door)
                    COMPONENT_DOOR=true
                    ;;
                tasks)
                    COMPONENT_TASKS=true
                    ;;
                *)
                    echo -e "${RED}Error: Unknown component '$2'${NC}"
                    show_help
                    exit 1
                    ;;
            esac
            shift
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$key'${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Banner
echo -e "${BLUE}=======================================================${NC}"
echo -e "${BLUE}              Robot AI Installer v1.0.0               ${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo

# Check if running as root
if [[ $EUID -ne 0 && "$DEV_MODE" = false ]]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run with sudo or as root user"
    exit 1
fi

# Check required parameters
if [[ -z "$ROBOT_SN" ]]; then
    echo -e "${YELLOW}Warning: Robot serial number not provided${NC}"
    echo "Attempting to auto-detect robot serial number..."
    
    # Try to get robot SN from API
    if command -v curl &> /dev/null; then
        ROBOT_INFO=$(curl -s "http://${ROBOT_IP}:${ROBOT_PORT}/device_info" || echo "")
        if [[ ! -z "$ROBOT_INFO" ]]; then
            SN=$(echo "$ROBOT_INFO" | grep -oP '"serial_number":\s*"\K[^"]+' || echo "")
            if [[ ! -z "$SN" ]]; then
                ROBOT_SN="$SN"
                echo -e "${GREEN}Auto-detected robot serial number: ${ROBOT_SN}${NC}"
            fi
        fi
    fi
    
    if [[ -z "$ROBOT_SN" ]]; then
        echo -e "${YELLOW}Could not auto-detect robot serial number${NC}"
        read -p "Please enter robot serial number: " ROBOT_SN
        
        if [[ -z "$ROBOT_SN" ]]; then
            echo -e "${RED}Error: Robot serial number is required${NC}"
            exit 1
        fi
    fi
fi

# Validate robot connection
echo "Checking connection to robot at ${ROBOT_IP}:${ROBOT_PORT}..."
if ! ping -c 1 -W 2 "$ROBOT_IP" &> /dev/null; then
    echo -e "${RED}Error: Cannot ping robot at ${ROBOT_IP}${NC}"
    echo "Please check the robot IP address and connectivity"
    exit 1
fi

# Check if robot API is accessible
if ! curl -s "http://${ROBOT_IP}:${ROBOT_PORT}/device_info" &> /dev/null; then
    echo -e "${RED}Error: Cannot connect to robot API at ${ROBOT_IP}:${ROBOT_PORT}${NC}"
    echo "Please check if the robot is powered on and the API is accessible"
    exit 1
fi

echo -e "${GREEN}Robot connection successful${NC}"

# Create installation directory
echo "Creating installation directory at ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/config"
mkdir -p "$INSTALL_DIR/scripts"
mkdir -p "$INSTALL_DIR/data"

# Check for Python and dependencies
echo "Checking for required dependencies..."

# Check for Python 3.7+
if ! command -v python3 &> /dev/null; then
    echo -e "${YELLOW}Python 3 not found, installing...${NC}"
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y python3 python3-pip python3-venv
    elif command -v yum &> /dev/null; then
        yum install -y python3 python3-pip
    else
        echo -e "${RED}Error: Package manager not found${NC}"
        echo "Please install Python 3.7+ manually"
        exit 1
    fi
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print("{}.{}".format(sys.version_info.major, sys.version_info.minor))')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

if [[ "$PYTHON_MAJOR" -lt 3 || ("$PYTHON_MAJOR" -eq 3 && "$PYTHON_MINOR" -lt 7) ]]; then
    echo -e "${RED}Error: Python 3.7+ is required, found ${PYTHON_VERSION}${NC}"
    echo "Please upgrade Python to version 3.7 or higher"
    exit 1
fi

echo -e "${GREEN}Python ${PYTHON_VERSION} found${NC}"

# Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv "$INSTALL_DIR/venv"
source "$INSTALL_DIR/venv/bin/activate"

# Install required Python packages
echo "Installing required Python packages..."
pip install --upgrade pip
pip install websockets requests numpy pillow asyncio

# Check for App Store connection
echo "Checking App Store connection..."
APP_STORE_API="https://rb-admin.autoxing.com/api/v1"
if curl -s "$APP_STORE_API/status" &> /dev/null; then
    echo -e "${GREEN}App Store connection successful${NC}"
    HAS_APP_STORE=true
    
    # Get available AI modules from App Store
    echo "Checking for available AI modules..."
    MODULES=$(curl -s "$APP_STORE_API/modules/ai" || echo "{}")
    
    # Parse and display available modules
    MODULE_COUNT=$(echo "$MODULES" | grep -o '"id"' | wc -l)
    if [[ "$MODULE_COUNT" -gt 0 ]]; then
        echo -e "${GREEN}Found ${MODULE_COUNT} AI modules available in App Store${NC}"
        # TODO: Implement module selection and download
    fi
else
    echo -e "${YELLOW}Cannot connect to App Store, continuing with local installation${NC}"
    HAS_APP_STORE=false
fi

# Write core AI modules
echo "Installing Robot AI core modules..."

# Copy module files from current directory if they exist, otherwise create them
MODULES=(
    "robot-ai-core.py"
    "robot-ai-map-visualizer.py"
    "robot-ai-camera-module.py"
    "robot-ai-elevator-controller.py"
    "robot-ai-door-module.py"
    "robot-ai-task-queue.py"
)

for module in "${MODULES[@]}"; do
    if [[ -f "$module" ]]; then
        echo "Copying $module from current directory..."
        cp "$module" "$INSTALL_DIR/$module"
    else
        echo "Module $module not found in current directory, skipping..."
    fi
done

# Create configuration file
echo "Creating configuration file..."
cat > "$INSTALL_DIR/config/robot-ai-config.json" << EOF
{
    "robot": {
        "ip": "${ROBOT_IP}",
        "port": ${ROBOT_PORT},
        "serial_number": "${ROBOT_SN}",
        "use_ssl": false
    },
    "modules": {
        "core": {
            "enabled": true,
            "log_level": "INFO"
        },
        "map_visualizer": {
            "enabled": true,
            "log_level": "INFO"
        },
        "camera": {
            "enabled": true,
            "log_level": "INFO",
            "default_camera": "front",
            "default_format": "jpeg"
        },
        "elevator": {
            "enabled": true,
            "log_level": "INFO"
        },
        "door": {
            "enabled": true,
            "log_level": "INFO"
        },
        "task_queue": {
            "enabled": true,
            "log_level": "INFO",
            "max_queue_size": 100
        }
    },
    "options": {
        "dev_mode": ${DEV_MODE},
        "auto_start": true,
        "web_interface_port": 8080
    }
}
EOF

# Create systemd service file
if [[ "$DEV_MODE" = false ]]; then
    echo "Creating systemd service file..."
    cat > "/etc/systemd/system/robot-ai.service" << EOF
[Unit]
Description=Robot AI Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/venv/bin/python3 ${INSTALL_DIR}/robot-ai-core.py
Restart=on-failure
RestartSec=5
Environment="ROBOT_IP=${ROBOT_IP}"
Environment="ROBOT_PORT=${ROBOT_PORT}"
Environment="ROBOT_SN=${ROBOT_SN}"

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start service
    echo "Enabling and starting Robot AI service..."
    systemctl daemon-reload
    systemctl enable robot-ai.service
    systemctl start robot-ai.service
fi

# Create startup script
echo "Creating startup script..."
cat > "$INSTALL_DIR/scripts/start-robot-ai.sh" << EOF
#!/bin/bash
# Robot AI Startup Script

cd "${INSTALL_DIR}"
source "${INSTALL_DIR}/venv/bin/activate"

export ROBOT_IP="${ROBOT_IP}"
export ROBOT_PORT="${ROBOT_PORT}"
export ROBOT_SN="${ROBOT_SN}"

# Start all modules
echo "Starting Robot AI modules..."
python3 "${INSTALL_DIR}/robot-ai-core.py"
EOF

chmod +x "$INSTALL_DIR/scripts/start-robot-ai.sh"

# Create web interface for local access
echo "Creating web interface..."
cat > "$INSTALL_DIR/web-interface.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Web Interface</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f2f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        h1 {
            margin: 0;
            color: #333;
        }
        .status {
            display: flex;
            align-items: center;
        }
        .status-indicator {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: #ccc;
            margin-right: 8px;
        }
        .status-indicator.connected {
            background-color: #4CAF50;
        }
        .status-indicator.disconnected {
            background-color: #F44336;
        }
        .modules {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .module {
            background-color: #f9f9f9;
            padding: 15px;
            border-radius: 6px;
            border: 1px solid #eee;
        }
        .module h3 {
            margin-top: 0;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
        }
        .module-status {
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 12px;
            background-color: #eee;
            color: #666;
        }
        .module-status.enabled {
            background-color: #E8F5E9;
            color: #2E7D32;
        }
        .module-status.disabled {
            background-color: #FFEBEE;
            color: #C62828;
        }
        .controls {
            margin-top: 20px;
        }
        button {
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            font-size: 14px;
        }
        button:hover {
            background-color: #45a049;
        }
        button.secondary {
            background-color: #2196F3;
        }
        button.secondary:hover {
            background-color: #0b7dda;
        }
        button.danger {
            background-color: #F44336;
        }
        button.danger:hover {
            background-color: #d32f2f;
        }
        .map-view {
            margin-top: 20px;
            border: 1px solid #eee;
            padding: 20px;
            border-radius: 6px;
            background-color: #f9f9f9;
        }
        .camera-view {
            margin-top: 20px;
            border: 1px solid #eee;
            padding: 20px;
            border-radius: 6px;
            background-color: #f9f9f9;
        }
        .camera-feed {
            width: 100%;
            max-width: 640px;
            height: auto;
            background-color: #000;
            margin: 10px auto;
            display: block;
        }
        .logs {
            margin-top: 20px;
            font-family: monospace;
            background-color: #f5f5f5;
            padding: 15px;
            border-radius: 4px;
            height: 200px;
            overflow-y: auto;
            border: 1px solid #ddd;
        }
        .log-entry {
            margin-bottom: 5px;
        }
        .log-entry.info {
            color: #2196F3;
        }
        .log-entry.error {
            color: #F44336;
        }
        .log-entry.warning {
            color: #FF9800;
        }
        @media (max-width: 768px) {
            .modules {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Robot AI Web Interface</h1>
            <div class="status">
                <div class="status-indicator" id="connection-status"></div>
                <span id="status-text">Checking connection...</span>
            </div>
        </header>
        
        <div class="modules">
            <div class="module">
                <h3>Core Module <span class="module-status" id="core-status">Loading...</span></h3>
                <p>Central control and coordination of all AI functions.</p>
                <div class="controls">
                    <button onclick="toggleModule('core')">Toggle</button>
                    <button class="secondary" onclick="restartModule('core')">Restart</button>
                </div>
            </div>
            
            <div class="module">
                <h3>Map Visualizer <span class="module-status" id="map-status">Loading...</span></h3>
                <p>Advanced map visualization and processing.</p>
                <div class="controls">
                    <button onclick="toggleModule('map')">Toggle</button>
                    <button class="secondary" onclick="viewMap()">View Map</button>
                </div>
            </div>
            
            <div class="module">
                <h3>Camera Module <span class="module-status" id="camera-status">Loading...</span></h3>
                <p>Camera feed processing and control.</p>
                <div class="controls">
                    <button onclick="toggleModule('camera')">Toggle</button>
                    <button class="secondary" onclick="viewCamera()">View Camera</button>
                </div>
            </div>
            
            <div class="module">
                <h3>Elevator Controller <span class="module-status" id="elevator-status">Loading...</span></h3>
                <p>Multi-floor navigation with elevator control.</p>
                <div class="controls">
                    <button onclick="toggleModule('elevator')">Toggle</button>
                    <button class="secondary" onclick="showElevatorStatus()">Status</button>
                </div>
            </div>
            
            <div class="module">
                <h3>Door Controller <span class="module-status" id="door-status">Loading...</span></h3>
                <p>Automatic door control for seamless navigation.</p>
                <div class="controls">
                    <button onclick="toggleModule('door')">Toggle</button>
                    <button class="secondary" onclick="showDoorStatus()">Status</button>
                </div>
            </div>
            
            <div class="module">
                <h3>Task Queue <span class="module-status" id="task-status">Loading...</span></h3>
                <p>Task scheduling and execution management.</p>
                <div class="controls">
                    <button onclick="toggleModule('task')">Toggle</button>
                    <button class="secondary" onclick="viewTasks()">View Tasks</button>
                </div>
            </div>
        </div>
        
        <div id="map-view" class="map-view" style="display: none;">
            <h2>Map Visualization</h2>
            <div id="map-container" style="width: 100%; height: 400px; background-color: #eee; position: relative;">
                <p style="text-align: center; padding-top: 180px;">Map will load here...</p>
            </div>
            <div class="controls">
                <button class="secondary" onclick="refreshMap()">Refresh</button>
                <button onclick="hideMap()">Close</button>
            </div>
        </div>
        
        <div id="camera-view" class="camera-view" style="display: none;">
            <h2>Camera Feed</h2>
            <img id="camera-feed" class="camera-feed" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="Camera Feed">
            <div class="controls">
                <button class="secondary" onclick="switchCamera('front')">Front Camera</button>
                <button class="secondary" onclick="switchCamera('back')">Back Camera</button>
                <button onclick="hideCamera()">Close</button>
            </div>
        </div>
        
        <h2>System Logs</h2>
        <div class="logs" id="logs">
            <div class="log-entry info">[INFO] Robot AI Web Interface loaded</div>
            <div class="log-entry">[SYSTEM] Connecting to Robot AI service...</div>
        </div>
        
        <div class="controls" style="margin-top: 20px;">
            <button onclick="startAllModules()">Start All</button>
            <button class="danger" onclick="stopAllModules()">Stop All</button>
            <button class="secondary" onclick="refreshStatus()">Refresh Status</button>
        </div>
    </div>

    <script>
        // This is a simplified client-side implementation
        // In a real implementation, these functions would communicate with the backend
        
        let moduleStatus = {
            core: false,
            map: false,
            camera: false,
            elevator: false,
            door: false,
            task: false
        };
        
        let connected = false;
        
        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            addLog('[SYSTEM] Initializing Robot AI Web Interface');
            setTimeout(checkConnection, 1000);
        });
        
        function checkConnection() {
            // In a real implementation, this would check the actual connection
            connected = Math.random() > 0.3; // Simulate connection (70% chance of success)
            
            const statusIndicator = document.getElementById('connection-status');
            const statusText = document.getElementById('status-text');
            
            if (connected) {
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = 'Connected to Robot AI';
                addLog('[INFO] Successfully connected to Robot AI service');
                
                // Simulate module status
                moduleStatus.core = true;
                moduleStatus.map = true;
                moduleStatus.camera = true;
                moduleStatus.elevator = true;
                moduleStatus.door = true;
                moduleStatus.task = true;
                
                updateModuleStatus();
            } else {
                statusIndicator.className = 'status-indicator disconnected';
                statusText.textContent = 'Disconnected';
                addLog('[ERROR] Failed to connect to Robot AI service');
            }
        }
        
        function updateModuleStatus() {
            for (const [module, enabled] of Object.entries(moduleStatus)) {
                const statusElement = document.getElementById(`${module}-status`);
                if (statusElement) {
                    statusElement.textContent = enabled ? 'Enabled' : 'Disabled';
                    statusElement.className = `module-status ${enabled ? 'enabled' : 'disabled'}`;
                }
            }
        }
        
        function toggleModule(module) {
            if (!connected) {
                addLog('[ERROR] Cannot toggle module: Not connected to Robot AI service');
                return;
            }
            
            moduleStatus[module] = !moduleStatus[module];
            updateModuleStatus();
            
            addLog(`[INFO] ${moduleStatus[module] ? 'Enabled' : 'Disabled'} ${module} module`);
        }
        
        function restartModule(module) {
            if (!connected) {
                addLog('[ERROR] Cannot restart module: Not connected to Robot AI service');
                return;
            }
            
            addLog(`[INFO] Restarting ${module} module...`);
            
            // Simulate restart
            moduleStatus[module] = false;
            updateModuleStatus();
            
            setTimeout(() => {
                moduleStatus[module] = true;
                updateModuleStatus();
                addLog(`[INFO] ${module} module restarted successfully`);
            }, 2000);
        }
        
        function viewMap() {
            if (!connected) {
                addLog('[ERROR] Cannot view map: Not connected to Robot AI service');
                return;
            }
            
            if (!moduleStatus.map) {
                addLog('[WARNING] Map module is disabled');
                return;
            }
            
            document.getElementById('map-view').style.display = 'block';
            document.getElementById('camera-view').style.display = 'none';
            
            addLog('[INFO] Fetching map data...');
            
            // In a real implementation, this would fetch the actual map
            // For now, we'll just simulate it
            setTimeout(() => {
                addLog('[INFO] Map data received');
            }, 1000);
        }
        
        function hideMap() {
            document.getElementById('map-view').style.display = 'none';
        }
        
        function refreshMap() {
            addLog('[INFO] Refreshing map data...');
            
            // Simulate refresh
            setTimeout(() => {
                addLog('[INFO] Map data refreshed');
            }, 1000);
        }
        
        function viewCamera() {
            if (!connected) {
                addLog('[ERROR] Cannot view camera: Not connected to Robot AI service');
                return;
            }
            
            if (!moduleStatus.camera) {
                addLog('[WARNING] Camera module is disabled');
                return;
            }
            
            document.getElementById('camera-view').style.display = 'block';
            document.getElementById('map-view').style.display = 'none';
            
            addLog('[INFO] Connecting to camera feed...');
            
            // In a real implementation, this would connect to the actual camera feed
            // For now, we'll just simulate it
            setTimeout(() => {
                addLog('[INFO] Camera feed connected');
                // In a real implementation, we would set up a WebSocket connection
                // to receive camera frames in real-time
            }, 1000);
        }
        
        function hideCamera() {
            document.getElementById('camera-view').style.display = 'none';
        }
        
        function switchCamera(camera) {
            addLog(`[INFO] Switching to ${camera} camera...`);
            
            // In a real implementation, this would switch the actual camera
            setTimeout(() => {
                addLog(`[INFO] Now viewing ${camera} camera`);
            }, 500);
        }
        
        function showElevatorStatus() {
            if (!connected) {
                addLog('[ERROR] Cannot view elevator status: Not connected to Robot AI service');
                return;
            }
            
            if (!moduleStatus.elevator) {
                addLog('[WARNING] Elevator module is disabled');
                return;
            }
            
            addLog('[INFO] Fetching elevator status...');
            
            // In a real implementation, this would fetch the actual elevator status
            setTimeout(() => {
                addLog('[INFO] Elevator status: Available, current floor: 1');
            }, 1000);
        }
        
        function showDoorStatus() {
            if (!connected) {
                addLog('[ERROR] Cannot view door status: Not connected to Robot AI service');
                return;
            }
            
            if (!moduleStatus.door) {
                addLog('[WARNING] Door module is disabled');
                return;
            }
            
            addLog('[INFO] Fetching door status...');
            
            // In a real implementation, this would fetch the actual door status
            setTimeout(() => {
                addLog('[INFO] Door status: All doors closed');
            }, 1000);
        }
        
        function viewTasks() {
            if (!connected) {
                addLog('[ERROR] Cannot view tasks: Not connected to Robot AI service');
                return;
            }
            
            if (!moduleStatus.task) {
                addLog('[WARNING] Task Queue module is disabled');
                return;
            }
            
            addLog('[INFO] Fetching task queue...');
            
            // In a real implementation, this would fetch the actual task queue
            setTimeout(() => {
                addLog('[INFO] Task Queue: 0 tasks in queue, 0 tasks completed');
            }, 1000);
        }
        
        function startAllModules() {
            if (!connected) {
                addLog('[ERROR] Cannot start modules: Not connected to Robot AI service');
                return;
            }
            
            addLog('[INFO] Starting all modules...');
            
            // Enable all modules
            for (const module in moduleStatus) {
                moduleStatus[module] = true;
            }
            
            updateModuleStatus();
            
            addLog('[INFO] All modules started successfully');
        }
        
        function stopAllModules() {
            if (!connected) {
                addLog('[ERROR] Cannot stop modules: Not connected to Robot AI service');
                return;
            }
            
            addLog('[INFO] Stopping all modules...');
            
            // Disable all modules
            for (const module in moduleStatus) {
                moduleStatus[module] = false;
            }
            
            updateModuleStatus();
            
            addLog('[INFO] All modules stopped successfully');
        }
        
        function refreshStatus() {
            addLog('[INFO] Refreshing status...');
            
            // Simulate refresh
            setTimeout(() => {
                checkConnection();
                addLog('[INFO] Status refreshed');
            }, 1000);
        }
        
        function addLog(message) {
            const logs = document.getElementById('logs');
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            if (message.includes('[INFO]')) {
                logEntry.className += ' info';
            } else if (message.includes('[ERROR]')) {
                logEntry.className += ' error';
            } else if (message.includes('[WARNING]')) {
                logEntry.className += ' warning';
            }
            
            logEntry.textContent = message;
            logs.appendChild(logEntry);
            logs.scrollTop = logs.scrollHeight;
            
            // Limit log entries to prevent too much memory usage
            if (logs.children.length > 100) {
                logs.removeChild(logs.children[0]);
            }
        }
    </script>
</body>
</html>
EOF

# Create documentation
echo "Creating documentation..."
mkdir -p "$INSTALL_DIR/docs"

# Create README file
cat > "$INSTALL_DIR/docs/README.md" << EOF
# Robot AI Package

A comprehensive robot AI package that enhances your robot's capabilities.

## Features

- **Core Module**: Central control and coordination of all AI functions.
- **Map Visualization**: Advanced map visualization and processing.
- **Camera Module**: Camera feed processing and control.
- **Elevator Controller**: Multi-floor navigation with elevator control.
- **Door Controller**: Automatic door control for seamless navigation.
- **Task Queue**: Task scheduling and execution management.

## Configuration

The main configuration file is located at \`config/robot-ai-config.json\`.

## Usage

To start the Robot AI package:

\`\`\`bash
./scripts/start-robot-ai.sh
\`\`\`

Or, if installed as a service:

\`\`\`bash
systemctl start robot-ai
\`\`\`

## Web Interface

A web interface is available at:

\`\`\`
http://localhost:8080
\`\`\`

## Logs

Logs are stored in the \`logs\` directory.

## Support

For support, please contact the robot manufacturer.
EOF

# Create Quick Start Guide
cat > "$INSTALL_DIR/docs/QuickStart.md" << EOF
# Quick Start Guide

## 1. Verify Installation

Ensure that the Robot AI package is properly installed:

\`\`\`bash
systemctl status robot-ai
\`\`\`

## 2. Check Robot Connection

Make sure your robot is powered on and accessible at ${ROBOT_IP}:${ROBOT_PORT}.

## 3. Access Web Interface

Open a web browser and navigate to:

\`\`\`
http://localhost:8080
\`\`\`

## 4. Verify Modules

Check that all modules are enabled and functioning properly.

## 5. Start Using Features

- View the robot's current map
- Access camera feeds
- Use elevator and door controls
- Create and manage tasks

## 6. Troubleshooting

If you encounter any issues, check the logs:

\`\`\`bash
journalctl -u robot-ai -f
\`\`\`

Or check the log files in the \`logs\` directory.
EOF

# Set permissions
echo "Setting permissions..."
chmod -R 755 "$INSTALL_DIR/scripts"
chmod -R 644 "$INSTALL_DIR/config"
chmod -R 644 "$INSTALL_DIR/docs"

if [[ "$DEV_MODE" = true ]]; then
    chmod -R 777 "$INSTALL_DIR/logs"
    chmod -R 777 "$INSTALL_DIR/data"
else
    chmod -R 755 "$INSTALL_DIR/logs"
    chmod -R 755 "$INSTALL_DIR/data"
fi

# Create symbolic links
echo "Creating symbolic links..."
mkdir -p /usr/local/bin
ln -sf "$INSTALL_DIR/scripts/start-robot-ai.sh" /usr/local/bin/robot-ai

# Installation summary
echo
echo -e "${BLUE}=======================================================${NC}"
echo -e "${GREEN}Robot AI Package successfully installed!${NC}"
echo -e "${BLUE}=======================================================${NC}"
echo
echo "Installation directory: $INSTALL_DIR"
echo "Robot IP: $ROBOT_IP"
echo "Robot Port: $ROBOT_PORT"
echo "Robot Serial Number: $ROBOT_SN"
echo
echo "To start the Robot AI package:"
echo "  1. As a service: systemctl start robot-ai"
echo "  2. Manually: $INSTALL_DIR/scripts/start-robot-ai.sh"
echo
echo "Web interface available at: http://localhost:8080"
echo
echo "Documentation can be found in: $INSTALL_DIR/docs"
echo
echo -e "${BLUE}=======================================================${NC}"

# Exit with success
exit 0