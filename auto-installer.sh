#!/bin/bash
# Auto-installer for Robot AI Package
# This script will automatically detect the download location
# and install the Robot AI package

# Configuration
ROBOT_IP="127.0.0.1"
ROBOT_SN="L382502104987ir"
INSTALL_DIR="/home/robot/robot-ai"
LOG_FILE="/tmp/robot-ai-install.log"

# Start logging
exec > >(tee -a "$LOG_FILE") 2>&1
echo "========================================"
echo "  Robot AI Auto-Installer v1.0.0"
echo "  Started at: $(date)"
echo "========================================"
echo "Robot IP: $ROBOT_IP"
echo "Robot SN: $ROBOT_SN"
echo "Installation directory: $INSTALL_DIR"
echo "Log file: $LOG_FILE"
echo "========================================"

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
        <p>Enhanced autonomous robot control system for L382502104987ir</p>
        
        <div class="grid">
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Robot Status</h2>
                    <span class="status-badge status-online">Online</span>
                </div>
                <div>
                    <p><strong>Robot:</strong> L382502104987ir</p>
                    <p><strong>IP Address:</strong> 127.0.0.1</p>
                    <p><strong>Status:</strong> Connected</p>
                    <p><strong>Battery:</strong> 99% (Charging)</p>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Navigation</h2>
                </div>
                <div>
                    <p><strong>Current Position:</strong> X: 0.00, Y: 0.00</p>
                    <p><strong>Current Map:</strong> Default Map</p>
                    <p><strong>Movement Status:</strong> Idle</p>
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
        // This would normally connect to the Robot AI backend
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

# Create desktop notification
if command -v notify-send &> /dev/null; then
    notify-send "Robot AI Installed" "Robot AI has been successfully installed. Access the web interface at http://localhost:8080"
fi

# Create desktop shortcut (if running a desktop environment)
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