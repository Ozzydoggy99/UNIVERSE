#!/bin/bash
# Remote installer for Robot AI Package
# This script will install the Robot AI on a robot over SSH

# Default configuration
ROBOT_IP="192.168.25.25"  # Robot's IP address on your WiFi network
ROBOT_SN="L382502104987ir"
ROBOT_USER="robot"        # Default username for the robot
INSTALL_DIR="/home/robot/robot-ai"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --robot-ip)
      ROBOT_IP="$2"
      shift 2
      ;;
    --robot-user)
      ROBOT_USER="$2"
      shift 2
      ;;
    --robot-sn)
      ROBOT_SN="$2"
      shift 2
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --help)
      echo "Remote Robot AI Installer"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --robot-ip IP       Robot's IP address (default: $ROBOT_IP)"
      echo "  --robot-user USER   Username for SSH login (default: $ROBOT_USER)"
      echo "  --robot-sn SN       Robot's serial number (default: $ROBOT_SN)"
      echo "  --install-dir DIR   Installation directory (default: $INSTALL_DIR)"
      echo "  --help              Display this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

echo "==========================================="
echo "  Robot AI Remote Installer"
echo "==========================================="
echo "Robot IP: $ROBOT_IP"
echo "Robot User: $ROBOT_USER"
echo "Robot SN: $ROBOT_SN"
echo "Installation Directory: $INSTALL_DIR"
echo "==========================================="

# Confirm with user
read -p "Do you want to proceed with the installation? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Installation cancelled"
    exit 0
fi

# Create installation script content
INSTALL_SCRIPT=$(cat << 'EOFSCRIPT'
#!/bin/bash
# Robot AI Installer Script
# This script will be executed on the robot

# Get parameters from environment variables
ROBOT_IP="${REMOTE_ROBOT_IP:-127.0.0.1}"
ROBOT_SN="${REMOTE_ROBOT_SN:-unknown}"
INSTALL_DIR="${REMOTE_INSTALL_DIR:-/home/robot/robot-ai}"
LOG_FILE="/tmp/robot-ai-install.log"

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1
echo "==========================================="
echo "  Robot AI Installation Script"
echo "  Started at: $(date)"
echo "==========================================="
echo "Robot IP: $ROBOT_IP"
echo "Robot SN: $ROBOT_SN"
echo "Installation directory: $INSTALL_DIR"
echo "Log file: $LOG_FILE"
echo "==========================================="

# Create installation directory
echo "Creating installation directory..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/modules"
mkdir -p "$INSTALL_DIR/www"

# Create a simple HTML page for the web interface
echo "Creating web interface..."
cat > "$INSTALL_DIR/www/index.html" << 'EOF'
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
        <p>Enhanced autonomous robot control system</p>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Robot Status</h2>
                    <span class="status-badge status-online">Online</span>
                </div>
                <div>
                    <p><strong>Robot SN:</strong> <span id="robot-sn">Loading...</span></p>
                    <p><strong>IP Address:</strong> <span id="robot-ip">Loading...</span></p>
                    <p><strong>Status:</strong> Connected</p>
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
        // Configuration
        const config = {
            robotSn: "${ROBOT_SN}",
            robotIp: "${ROBOT_IP}"
        };
        
        // Update UI elements
        document.getElementById('robot-sn').textContent = config.robotSn;
        document.getElementById('robot-ip').textContent = config.robotIp;
        document.getElementById('battery-level').textContent = "99% (Charging)";
        document.getElementById('position').textContent = "X: 0.00, Y: 0.00";
        document.getElementById('current-map').textContent = "Default Map";
        document.getElementById('movement-status').textContent = "Idle";
        
        console.log("Robot AI Dashboard initialized");
    </script>
</body>
</html>
EOF

# Create configuration file
echo "Creating configuration file..."
cat > "$INSTALL_DIR/config.json" << EOF
{
  "robot_ip": "$ROBOT_IP",
  "robot_sn": "$ROBOT_SN",
  "dev_mode": true,
  "install_dir": "$INSTALL_DIR",
  "installed_at": "$(date -Iseconds)"
}
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

# Start the web interface
python3 -m http.server 8080 --directory "$SCRIPT_DIR/www" > "$LOG_DIR/web-interface.log" 2>&1 &
echo $! > "$SCRIPT_DIR/web-interface.pid"

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

# Stop the web interface
if [ -f "$SCRIPT_DIR/web-interface.pid" ]; then
    kill $(cat "$SCRIPT_DIR/web-interface.pid") 2>/dev/null || true
    rm "$SCRIPT_DIR/web-interface.pid"
fi

echo "Robot AI services stopped"
EOF

# Make script executable
chmod +x "$INSTALL_DIR/stop.sh"

# Start the service
echo "Starting Robot AI service..."
"$INSTALL_DIR/start.sh"

echo "==========================================="
echo "  Installation Complete!"
echo "  Access the Robot AI dashboard at:"
echo "  http://$ROBOT_IP:8080"
echo "==========================================="
EOFSCRIPT
)

# Check if SSH is installed
if ! command -v ssh &> /dev/null; then
    echo "Error: ssh is not installed. Please install ssh to continue."
    exit 1
fi

# Try to connect to the robot
echo "Connecting to the robot at $ROBOT_IP..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes -o StrictHostKeyChecking=no "$ROBOT_USER@$ROBOT_IP" "echo Connected successfully"; then
    echo "Error: Could not connect to the robot. Please check the IP address and username."
    exit 1
fi

# Install the Robot AI
echo "Installing Robot AI on the robot..."
ssh -o StrictHostKeyChecking=no "$ROBOT_USER@$ROBOT_IP" "REMOTE_ROBOT_IP='$ROBOT_IP' REMOTE_ROBOT_SN='$ROBOT_SN' REMOTE_INSTALL_DIR='$INSTALL_DIR' bash -s" << EOF
$INSTALL_SCRIPT
EOF

if [ $? -eq 0 ]; then
    echo "==========================================="
    echo "  Installation Complete!"
    echo "  Access the Robot AI dashboard at:"
    echo "  http://$ROBOT_IP:8080"
    echo "==========================================="
    
    # Ask if the user wants to open the dashboard
    read -p "Do you want to open the dashboard in your browser? (y/n): " OPEN_BROWSER
    if [[ "$OPEN_BROWSER" =~ ^[Yy]$ ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://$ROBOT_IP:8080"
        elif command -v open &> /dev/null; then
            open "http://$ROBOT_IP:8080"
        else
            echo "Could not automatically open the browser. Please visit http://$ROBOT_IP:8080 manually."
        fi
    fi
else
    echo "Error: Installation failed."
    exit 1
fi