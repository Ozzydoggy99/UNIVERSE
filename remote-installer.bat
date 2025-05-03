@echo off
echo =========================================
echo   Robot AI Remote Installer (Windows)
echo =========================================

set ROBOT_IP=192.168.25.25
set ROBOT_USER=robot
set ROBOT_SN=L382502104987ir

echo Robot IP: %ROBOT_IP%
echo Robot User: %ROBOT_USER%
echo Robot SN: %ROBOT_SN%
echo =========================================

echo Attempting to connect to robot...
ssh %ROBOT_USER%@%ROBOT_IP% "echo Connected successfully"

if %ERRORLEVEL% NEQ 0 (
    echo Error: Could not connect to the robot. Please check the IP address and username.
    goto end
)

echo Creating installation script on the robot...
ssh %ROBOT_USER%@%ROBOT_IP% "mkdir -p ~/robot-ai && mkdir -p ~/robot-ai/logs && mkdir -p ~/robot-ai/modules && mkdir -p ~/robot-ai/www"

echo Setting up web interface...
ssh %ROBOT_USER%@%ROBOT_IP% "cat > ~/robot-ai/www/index.html" << EOF
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
                    <p><strong>Robot SN:</strong> <span id="robot-sn">%ROBOT_SN%</span></p>
                    <p><strong>IP Address:</strong> <span id="robot-ip">%ROBOT_IP%</span></p>
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
        // Initialization code
        document.getElementById('robot-sn').textContent = "%ROBOT_SN%";
        document.getElementById('robot-ip').textContent = "%ROBOT_IP%";
        document.getElementById('battery-level').textContent = "99% (Charging)";
        document.getElementById('position').textContent = "X: 0.00, Y: 0.00";
        document.getElementById('current-map').textContent = "Default Map";
        document.getElementById('movement-status').textContent = "Idle";
        
        console.log("Robot AI Dashboard initialized");
    </script>
</body>
</html>
EOF

echo Creating configuration file...
ssh %ROBOT_USER%@%ROBOT_IP% "cat > ~/robot-ai/config.json" << EOF
{
  "robot_ip": "%ROBOT_IP%",
  "robot_sn": "%ROBOT_SN%",
  "dev_mode": true,
  "install_dir": "/home/%ROBOT_USER%/robot-ai",
  "installed_at": "$(date)"
}
EOF

echo Creating start script...
ssh %ROBOT_USER%@%ROBOT_IP% "cat > ~/robot-ai/start.sh" << EOF
#!/bin/bash
# Start the Robot AI

SCRIPT_DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOG_DIR="\$SCRIPT_DIR/logs"

# Ensure log directory exists
mkdir -p "\$LOG_DIR"

# Start the web interface
python3 -m http.server 8080 --directory "\$SCRIPT_DIR/www" > "\$LOG_DIR/web-interface.log" 2>&1 &
echo \$! > "\$SCRIPT_DIR/web-interface.pid"

echo "Robot AI services started. Access web interface at http://localhost:8080"
EOF

echo Setting execution permissions for scripts...
ssh %ROBOT_USER%@%ROBOT_IP% "chmod +x ~/robot-ai/start.sh"

echo Creating stop script...
ssh %ROBOT_USER%@%ROBOT_IP% "cat > ~/robot-ai/stop.sh" << EOF
#!/bin/bash
# Stop the Robot AI services

SCRIPT_DIR="\$( cd "\$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Stop the web interface
if [ -f "\$SCRIPT_DIR/web-interface.pid" ]; then
    kill \$(cat "\$SCRIPT_DIR/web-interface.pid") 2>/dev/null || true
    rm "\$SCRIPT_DIR/web-interface.pid"
fi

echo "Robot AI services stopped"
EOF

echo Setting execution permissions for scripts...
ssh %ROBOT_USER%@%ROBOT_IP% "chmod +x ~/robot-ai/stop.sh"

echo Starting Robot AI service...
ssh %ROBOT_USER%@%ROBOT_IP% "~/robot-ai/start.sh"

echo =========================================
echo   Installation Complete!
echo   Access the Robot AI dashboard at:
echo   http://%ROBOT_IP%:8080
echo =========================================

set /p OPEN_BROWSER=Do you want to open the dashboard in your browser? (y/n): 
if /i "%OPEN_BROWSER%" == "y" (
    start http://%ROBOT_IP%:8080
)

:end
pause