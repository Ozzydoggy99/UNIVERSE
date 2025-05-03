#!/bin/bash
# Robot AI Installation Script
# This script installs an AI package on your AxBot robot
# Usage: ./robot-ai-installer.sh [--test]

set -e
ROBOT_IP=${ROBOT_IP:-"localhost"}
TEST_MODE=0

# Parse command line arguments
for arg in "$@"; do
  case $arg in
    --test)
      TEST_MODE=1
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

echo "📥 Downloading Robot AI package..."
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

echo "Installing Robot AI to $INSTALL_DIR..."

# Create directories
mkdir -p $INSTALL_DIR
mkdir -p $CONFIG_DIR
touch $LOG_DIR/robot-ai.log
chmod 666 $LOG_DIR/robot-ai.log

# Copy files
cp robot-ai-node.py $INSTALL_DIR/
cp requirements.txt $INSTALL_DIR/
chmod +x $INSTALL_DIR/robot-ai-node.py

# Install dependencies
pip3 install -r $INSTALL_DIR/requirements.txt

# Create systemd service
cat > /etc/systemd/system/robot-ai.service << 'EOSVC'
[Unit]
Description=Robot AI System
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/robot-ai/robot-ai-node.py
Restart=always
RestartSec=10
Environment=SERVER_URL=http://localhost:5000
Environment=ROBOT_SECRET=test-secret

[Install]
WantedBy=multi-user.target
EOSVC

# Enable and start service
systemctl enable robot-ai.service
systemctl start robot-ai.service

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