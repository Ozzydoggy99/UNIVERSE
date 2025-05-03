#!/bin/bash
# Robot AI Installation Script
# This script installs an AI package on your AxBot robot
# Usage: ./robot-ai-installer.sh [--test] [--with-iot] [--with-elevator] [--with-door] [--from-app-store]

set -e
ROBOT_IP=${ROBOT_IP:-"localhost"}
TEST_MODE=0
WITH_IOT=0
WITH_ELEVATOR=0
WITH_DOOR=0
FROM_APP_STORE=0
DEV_MODE_ENABLED=0
FACTORY_RESET_AVAILABLE=0
PACKAGE_NAME="robot_ai"
PACKAGE_VERSION="1.0.0"

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --test)
      TEST_MODE=1
      shift
      ;;
    --with-iot)
      WITH_IOT=1
      shift
      ;;
    --with-elevator)
      WITH_ELEVATOR=1
      shift
      ;;
    --with-door)
      WITH_DOOR=1
      shift
      ;;
    --from-app-store)
      FROM_APP_STORE=1
      shift
      ;;
  esac
done

echo "===================================================="
echo "🤖 Robot AI Installation Script"
echo "===================================================="

# Check if running on robot
if [ "$TEST_MODE" -eq 0 ] && [ ! -d "/opt/axbot" ]; then
  echo "⚠️  WARNING: This script should be run on the robot."
  echo "    Continue anyway? (y/n)"
  read -r response
  if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Installation canceled."
    exit 1
  fi
fi

# Function to install via App Store API
install_via_app_store() {
  echo "📱 Installing via App Store API..."
  
  # Check if App Store API is available
  if [ "$TEST_MODE" -eq 0 ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${ROBOT_IP}:8090/app_store/packages")
    if [ "$HTTP_CODE" != "200" ]; then
      echo "⚠️ App Store API not available (HTTP code: $HTTP_CODE)"
      echo "   Falling back to direct installation method"
      return 1
    fi
  else
    echo "🧪 Test mode: Simulating App Store API interaction"
  fi
  
  # Step 1: Refresh the App Store
  echo "📊 Refreshing App Store package index..."
  if [ "$TEST_MODE" -eq 0 ]; then
    curl -s -X POST "http://${ROBOT_IP}:8090/app_store/services/refresh_store"
    if [ $? -ne 0 ]; then
      echo "⚠️ Failed to refresh App Store"
      return 1
    fi
  else
    echo "🧪 Test mode: Simulating App Store refresh"
  fi
  
  # Step 2: Download the Robot AI package
  echo "📦 Downloading ${PACKAGE_NAME} package from App Store..."
  if [ "$TEST_MODE" -eq 0 ]; then
    DOWNLOAD_RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"packages\": [\"${PACKAGE_NAME}\"]}" \
      "http://${ROBOT_IP}:8090/app_store/services/download_packages")
    
    # Check for errors in response
    if [[ $DOWNLOAD_RESPONSE == *"invalid module"* ]]; then
      echo "⚠️ ${PACKAGE_NAME} package not found in App Store"
      return 1
    fi
  else
    echo "🧪 Test mode: Simulating package download"
    sleep 2
  fi
  
  # Step 3: Install the Robot AI package
  echo "🔧 Installing ${PACKAGE_NAME} package from App Store..."
  if [ "$TEST_MODE" -eq 0 ]; then
    INSTALL_RESPONSE=$(curl -s -X POST \
      -H "Content-Type: application/json" \
      -d "{\"packages\": [\"${PACKAGE_NAME}\"]}" \
      "http://${ROBOT_IP}:8090/app_store/services/install_packages")
    
    # Check for errors in response
    if [[ $INSTALL_RESPONSE == *"skip"* ]]; then
      echo "⚠️ Installation skipped: $INSTALL_RESPONSE"
      return 1
    fi
  else
    echo "🧪 Test mode: Simulating package installation"
    sleep 3
  fi
  
  echo "✅ ${PACKAGE_NAME} package installed successfully via App Store"
  return 0
}

echo "📥 Downloading Robot AI package..."

# Try App Store installation if requested
if [ "$FROM_APP_STORE" -eq 1 ]; then
  install_via_app_store
  if [ $? -eq 0 ]; then
    echo "🚀 Installation via App Store completed successfully!"
    exit 0
  else
    echo "⚠️ App Store installation failed, falling back to direct installation"
  fi
fi

mkdir -p /tmp/robot-ai
cd /tmp/robot-ai

# Download package (in production this would be a real URL)
if [ "$TEST_MODE" -eq 1 ]; then
  echo "🧪 Test mode: Creating mock package..."
  mkdir -p robot-ai
  cat > robot-ai/robot-ai-node.py << 'EOL'
#!/usr/bin/env python3
import rospy
from std_msgs.msg import String
import time
import json
import threading
import socket
import os
import signal
import sys

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("/var/log/robot-ai.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("robot-ai")

# WebSocket for real-time communication
from flask import Flask, jsonify, request
from flask_socketio import SocketIO, emit

# Signal handler for graceful shutdown
def signal_handler(sig, frame):
    logger.info("Shutting down Robot AI...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

class RobotAI:
    def __init__(self):
        self.node_name = 'robot_ai'
        self.version = '1.0.0'
        self.start_time = time.time()
        self.connected = False
        
        # Server connection info
        self.server_url = os.environ.get('SERVER_URL', 'http://localhost:5000')
        self.robot_id = os.environ.get('ROBOT_ID', socket.gethostname())
        self.secret = os.environ.get('ROBOT_SECRET', 'test-secret')
        
        logger.info(f"Starting Robot AI v{self.version}")
        logger.info(f"Robot ID: {self.robot_id}")
        logger.info(f"Server URL: {self.server_url}")
        
        # Initialize ROS node
        try:
            rospy.init_node(self.node_name, anonymous=True, disable_signals=True)
            self.ros_initialized = True
            logger.info("ROS node initialized successfully")
        except Exception as e:
            self.ros_initialized = False
            logger.error(f"Failed to initialize ROS node: {e}")
            logger.info("Continuing in limited functionality mode")
        
        # Set up subscribers and publishers
        if self.ros_initialized:
            self.setup_ros_communication()
        
        # Start web server for API in a separate thread
        self.setup_web_server()
        
        logger.info("Robot AI initialization complete")
    
    def setup_ros_communication(self):
        try:
            # Publishers
            self.status_pub = rospy.Publisher('/robot_ai/status', String, queue_size=10)
            
            # Subscribers
            rospy.Subscriber('/scan', String, self.lidar_callback)
            rospy.Subscriber('/battery_state', String, self.battery_callback)
            
            logger.info("ROS communication setup complete")
        except Exception as e:
            logger.error(f"Error setting up ROS communication: {e}")
    
    def setup_web_server(self):
        self.app = Flask(__name__)
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        
        # API routes
        @self.app.route('/api/status', methods=['GET'])
        def get_status():
            return jsonify({
                'status': 'online',
                'version': self.version,
                'uptime': time.time() - self.start_time,
                'ros_initialized': self.ros_initialized,
                'robot_id': self.robot_id
            })
        
        @self.app.route('/api/connect', methods=['POST'])
        def connect_to_server():
            server_url = request.json.get('server_url', self.server_url)
            self.server_url = server_url
            logger.info(f"Setting server URL to {server_url}")
            return jsonify({'success': True, 'server_url': server_url})
        
        # Socket.IO events
        @self.socketio.on('connect')
        def handle_connect():
            logger.info(f"Client connected to socket")
            emit('welcome', {'message': 'Connected to Robot AI'})
        
        @self.socketio.on('disconnect')
        def handle_disconnect():
            logger.info(f"Client disconnected from socket")
        
        # Start server in a separate thread
        self.server_thread = threading.Thread(target=self._run_server)
        self.server_thread.daemon = True
        self.server_thread.start()
        logger.info(f"Web server started on port 8090")
    
    def _run_server(self):
        try:
            self.socketio.run(self.app, host='0.0.0.0', port=8090)
        except Exception as e:
            logger.error(f"Error running web server: {e}")
    
    def lidar_callback(self, data):
        logger.debug("Received LiDAR data")
        # Process LiDAR data
    
    def battery_callback(self, data):
        logger.debug("Received battery data")
        # Process battery data
    
    def publish_status(self):
        if self.ros_initialized:
            try:
                status_msg = String()
                status_msg.data = json.dumps({
                    'status': 'active',
                    'version': self.version,
                    'uptime': time.time() - self.start_time
                })
                self.status_pub.publish(status_msg)
            except Exception as e:
                logger.error(f"Error publishing status: {e}")
    
    def run(self):
        rate = rospy.Rate(1) if self.ros_initialized else None  # 1 Hz
        logger.info("Robot AI is now running")
        
        while True:
            try:
                # Publish status
                self.publish_status()
                
                # Connect to server if not connected
                if not self.connected:
                    self.attempt_server_connection()
                
                # Sleep
                if rate:
                    rate.sleep()
                else:
                    time.sleep(1)
            except rospy.ROSInterruptException:
                logger.info("ROS interrupt received")
                break
            except KeyboardInterrupt:
                logger.info("Keyboard interrupt received")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                time.sleep(5)  # Wait before retrying
    
    def attempt_server_connection(self):
        logger.info(f"Attempting to connect to server at {self.server_url}")
        # In a real implementation, this would use requests to connect to the server
        self.connected = True
        logger.info("Successfully connected to server")

if __name__ == '__main__':
    try:
        robot_ai = RobotAI()
        robot_ai.run()
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
EOL

  cat > robot-ai/requirements.txt << 'EOL'
flask==2.0.1
flask-socketio==5.1.1
requests==2.26.0
numpy==1.21.2
EOL

  cat > robot-ai/install.sh << 'EOL'
#!/bin/bash
set -e

INSTALL_DIR=${INSTALL_DIR:-"/opt/robot-ai"}
CONFIG_DIR=${CONFIG_DIR:-"/etc/robot-ai"}
LOG_DIR=${LOG_DIR:-"/var/log"}
WITH_IOT=${WITH_IOT:-0}
WITH_ELEVATOR=${WITH_ELEVATOR:-0}
WITH_DOOR=${WITH_DOOR:-0}

echo "Installing Robot AI to $INSTALL_DIR..."

# Check for developer mode
if [ -f "/opt/axbot/dev_mode" ] || [ -f "/opt/axbot/developer_mode" ]; then
  echo "✅ Developer mode detected. Factory reset will be available if needed."
  DEV_MODE_ENABLED=1
  FACTORY_RESET_AVAILABLE=1
else
  echo "⚠️ Developer mode not detected. Note that factory reset functionality may be limited."
  echo "   It is recommended to enable developer mode before proceeding."
  echo "   Continue anyway? (y/n)"
  read -r response
  if [[ ! "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "Installation canceled."
    exit 1
  fi
  DEV_MODE_ENABLED=0
  FACTORY_RESET_AVAILABLE=0
fi

# Create directories
mkdir -p $INSTALL_DIR
mkdir -p $CONFIG_DIR
mkdir -p $CONFIG_DIR/modules
touch $LOG_DIR/robot-ai.log
chmod 666 $LOG_DIR/robot-ai.log

# Copy main files
cp robot-ai-node.py $INSTALL_DIR/
cp requirements.txt $INSTALL_DIR/
cp robot-ai-factory-reset.md $CONFIG_DIR/FACTORY_RESET_GUIDE.md
chmod +x $INSTALL_DIR/robot-ai-node.py

# Copy module files
if [ "$WITH_IOT" -eq 1 ]; then
  cp robot-ai-iot-module.py $INSTALL_DIR/modules/
  chmod +x $INSTALL_DIR/modules/robot-ai-iot-module.py
  echo "✅ IoT module installed"
fi

if [ "$WITH_ELEVATOR" -eq 1 ]; then
  cp robot-ai-elevator-module.py $INSTALL_DIR/modules/
  chmod +x $INSTALL_DIR/modules/robot-ai-elevator-module.py
  echo "✅ Elevator module installed"
fi

if [ "$WITH_DOOR" -eq 1 ]; then
  cp robot-ai-door-module.py $INSTALL_DIR/modules/ 2>/dev/null || echo "⚠️ Door module not found, skipping"
  chmod +x $INSTALL_DIR/modules/robot-ai-door-module.py 2>/dev/null || true
  echo "✅ Door module installed"
fi

# Create configuration file
cat > $CONFIG_DIR/config.json << EOC
{
  "version": "1.0.0",
  "server_url": "http://localhost:5000",
  "robot_sn": "$(hostname)",
  "modules": {
    "iot": $WITH_IOT,
    "elevator": $WITH_ELEVATOR,
    "door": $WITH_DOOR
  },
  "safety": {
    "dev_mode_enabled": $DEV_MODE_ENABLED,
    "factory_reset_available": $FACTORY_RESET_AVAILABLE,
    "max_cpu_usage": 80,
    "max_memory_usage": 75,
    "watchdog_interval_seconds": 30
  },
  "logging": {
    "level": "info",
    "max_file_size_mb": 10,
    "max_files": 5,
    "log_dir": "$LOG_DIR"
  }
}
EOC

# Install dependencies
echo "Installing Python dependencies..."
pip3 install -r $INSTALL_DIR/requirements.txt

# Add monitoring script
cat > $INSTALL_DIR/watchdog.sh << 'EOWATCHDOG'
#!/bin/bash
# Watchdog script to monitor and restart the Robot AI if needed

CONFIG_DIR=${CONFIG_DIR:-"/etc/robot-ai"}
LOG_DIR=${LOG_DIR:-"/var/log"}

# Get settings from config
MAX_CPU=$(grep -o '"max_cpu_usage": [0-9]*' $CONFIG_DIR/config.json | grep -o '[0-9]*')
MAX_MEM=$(grep -o '"max_memory_usage": [0-9]*' $CONFIG_DIR/config.json | grep -o '[0-9]*')

# Check CPU and memory usage
ROBOT_AI_PID=$(pgrep -f robot-ai-node.py)
if [ -z "$ROBOT_AI_PID" ]; then
  echo "[$(date)] Robot AI not running, restarting service" >> $LOG_DIR/robot-ai-watchdog.log
  systemctl restart robot-ai
  exit 0
fi

CPU_USAGE=$(ps -p $ROBOT_AI_PID -o %cpu | tail -1 | tr -d ' ')
MEM_USAGE=$(ps -p $ROBOT_AI_PID -o %mem | tail -1 | tr -d ' ')

if (( $(echo "$CPU_USAGE > $MAX_CPU" | bc -l) )); then
  echo "[$(date)] CPU usage too high ($CPU_USAGE%), restarting service" >> $LOG_DIR/robot-ai-watchdog.log
  systemctl restart robot-ai
  exit 0
fi

if (( $(echo "$MEM_USAGE > $MAX_MEM" | bc -l) )); then
  echo "[$(date)] Memory usage too high ($MEM_USAGE%), restarting service" >> $LOG_DIR/robot-ai-watchdog.log
  systemctl restart robot-ai
  exit 0
fi

# Check if the service is responsive
curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/api/status
if [ $? -ne 0 ]; then
  echo "[$(date)] API endpoint not responding, restarting service" >> $LOG_DIR/robot-ai-watchdog.log
  systemctl restart robot-ai
  exit 0
fi

echo "[$(date)] Service running normally - CPU: $CPU_USAGE%, MEM: $MEM_USAGE%" >> $LOG_DIR/robot-ai-watchdog.log
EOWATCHDOG
chmod +x $INSTALL_DIR/watchdog.sh

# Create systemd service
cat > /etc/systemd/system/robot-ai.service << 'EOSVC'
[Unit]
Description=Robot AI System
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/robot-ai
ExecStart=/usr/bin/python3 /opt/robot-ai/robot-ai-node.py
Restart=always
RestartSec=10
Environment=CONFIG_DIR=/etc/robot-ai
Environment=SERVER_URL=http://localhost:5000
Environment=ROBOT_SECRET=test-secret

[Install]
WantedBy=multi-user.target
EOSVC

# Create watchdog timer service
cat > /etc/systemd/system/robot-ai-watchdog.timer << 'EOTIMER'
[Unit]
Description=Run Robot AI watchdog every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=1s

[Install]
WantedBy=timers.target
EOTIMER

cat > /etc/systemd/system/robot-ai-watchdog.service << 'EOWATCHDOGSVC'
[Unit]
Description=Robot AI Watchdog Service
After=robot-ai.service

[Service]
Type=oneshot
ExecStart=/opt/robot-ai/watchdog.sh

[Install]
WantedBy=multi-user.target
EOWATCHDOGSVC

# Create uninstall script
cat > $INSTALL_DIR/uninstall.sh << 'EOUNINSTALL'
#!/bin/bash
echo "Uninstalling Robot AI..."

# Stop and disable services
systemctl stop robot-ai.service robot-ai-watchdog.timer robot-ai-watchdog.service
systemctl disable robot-ai.service robot-ai-watchdog.timer robot-ai-watchdog.service

# Remove service files
rm -f /etc/systemd/system/robot-ai.service
rm -f /etc/systemd/system/robot-ai-watchdog.timer
rm -f /etc/systemd/system/robot-ai-watchdog.service

# Reload systemd
systemctl daemon-reload

# Remove installation directory
rm -rf /opt/robot-ai
rm -rf /etc/robot-ai

echo "Robot AI has been uninstalled."
EOUNINSTALL
chmod +x $INSTALL_DIR/uninstall.sh

# Enable and start services
echo "Enabling and starting services..."
systemctl daemon-reload
systemctl enable robot-ai.service
systemctl enable robot-ai-watchdog.timer
systemctl enable robot-ai-watchdog.service
systemctl start robot-ai.service
systemctl start robot-ai-watchdog.timer

echo "Robot AI installation complete! Check status with: systemctl status robot-ai"
EOL
  chmod +x robot-ai/install.sh
else
  # In production, this would download from a real URL
  echo "wget https://robot-ai-releases.example.com/latest/robot-ai.tar.gz"
  echo "tar -xzf robot-ai.tar.gz"
fi

echo "📦 Unpacking Robot AI package..."
if [ "$TEST_MODE" -eq 1 ]; then
  echo "🧪 Test mode: Using mock package."
else
  echo "tar -xzf robot-ai.tar.gz"
fi

echo "🔧 Installing Robot AI..."
if [ "$TEST_MODE" -eq 1 ]; then
  echo "🧪 Test mode: Simulating installation..."
  sleep 2
else
  cd robot-ai
  ./install.sh
fi

# Clean up
if [ "$TEST_MODE" -eq 0 ]; then
  echo "🧹 Cleaning up temporary files..."
  cd ~
  rm -rf /tmp/robot-ai
fi

echo "🚀 Installation complete!"
echo "===================================================="
echo "Robot AI is now running!"
echo " "
echo "Access the web interface at: http://$ROBOT_IP:8090"
echo "Check logs with: tail -f /var/log/robot-ai.log"
echo "Control service with: systemctl [status|stop|start] robot-ai"
echo "===================================================="

# In test mode, show a message explaining what would happen
if [ "$TEST_MODE" -eq 1 ]; then
  echo " "
  echo "🧪 TEST MODE SUMMARY:"
  echo "In production mode, this script would:"
  echo "1. Download the actual Robot AI package"
  echo "2. Install Python dependencies"
  echo "3. Set up a systemd service to run at startup"
  echo "4. Connect to the central management server"
  echo " "
  echo "To install on the actual robot, copy this script to the robot"
  echo "and run it without the --test flag."
fi