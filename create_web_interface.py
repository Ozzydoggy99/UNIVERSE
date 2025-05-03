#!/usr/bin/env python3
import os
import base64
import zlib

# Create a simple HTML dashboard interface
html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        header {
            background-color: #3498db;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .card {
            background-color: white;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            padding: 20px;
            margin-bottom: 20px;
        }
        .row {
            display: flex;
            flex-wrap: wrap;
            margin: 0 -10px;
        }
        .col {
            flex: 1;
            padding: 0 10px;
            min-width: 300px;
        }
        .button {
            display: inline-block;
            background-color: #3498db;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            text-decoration: none;
            margin-right: 10px;
            margin-bottom: 10px;
            cursor: pointer;
            border: none;
        }
        .button:hover {
            background-color: #2980b9;
        }
        .button.success {
            background-color: #2ecc71;
        }
        .button.success:hover {
            background-color: #27ae60;
        }
        .button.warning {
            background-color: #f39c12;
        }
        .button.warning:hover {
            background-color: #e67e22;
        }
        .button.danger {
            background-color: #e74c3c;
        }
        .button.danger:hover {
            background-color: #c0392b;
        }
        .status {
            padding: 10px;
            border-radius: 5px;
            margin-bottom: 10px;
        }
        .status.success {
            background-color: #d5f5e3;
            color: #27ae60;
        }
        .status.warning {
            background-color: #fef9e7;
            color: #f39c12;
        }
        .status.danger {
            background-color: #fadbd8;
            color: #e74c3c;
        }
        .status.info {
            background-color: #d6eaf8;
            color: #3498db;
        }
        .map-container {
            height: 400px;
            background-color: #eee;
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }
        .camera-feed {
            height: 300px;
            background-color: #333;
            border-radius: 5px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table th, table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        footer {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
            font-size: 0.8em;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Robot AI Dashboard</h1>
            <p>Advanced robot control interface</p>
        </header>
        
        <div class="row">
            <div class="col">
                <div class="card">
                    <h2>Connection Status</h2>
                    <div class="status info" id="connection-status">
                        <strong>Status:</strong> <span id="status-text">Initializing...</span>
                    </div>
                    <div>
                        <label for="robot-ip">Robot IP:</label>
                        <input type="text" id="robot-ip" value="192.168.4.31" style="width: 150px; margin-right: 10px;">
                        <button class="button" id="connect-btn">Connect</button>
                    </div>
                </div>
                
                <div class="card">
                    <h2>Robot Information</h2>
                    <p><strong>Serial Number:</strong> <span id="robot-serial">--</span></p>
                    <p><strong>State:</strong> <span id="robot-state">--</span></p>
                    <p><strong>Battery:</strong> <span id="robot-battery">--</span></p>
                    <p><strong>Position:</strong> (<span id="robot-x">0.00</span>, <span id="robot-y">0.00</span>), <span id="robot-orientation">0.00</span> rad</p>
                </div>
            </div>
            
            <div class="col">
                <div class="card">
                    <h2>Map Visualization</h2>
                    <div class="map-container" id="map-container">
                        <canvas id="map-canvas" width="100%" height="100%"></canvas>
                    </div>
                    <div style="margin-top: 10px;">
                        <button class="button" id="load-map-btn">Load Map</button>
                        <select id="map-select" style="padding: 5px; margin-left: 10px;">
                            <option value="">Select a map...</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row">
            <div class="col">
                <div class="card">
                    <h2>Camera Feed</h2>
                    <div class="camera-feed" id="camera-feed">
                        <span>No camera feed available</span>
                    </div>
                    <div style="margin-top: 10px;">
                        <button class="button" id="refresh-camera-btn">Refresh Camera</button>
                        <select id="camera-select" style="padding: 5px; margin-left: 10px;">
                            <option value="front">Front Camera</option>
                            <option value="back">Back Camera</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div class="col">
                <div class="card">
                    <h2>Controls</h2>
                    <div style="margin-bottom: 20px;">
                        <h3>Movement</h3>
                        <button class="button" id="move-forward-btn">Forward</button>
                        <button class="button" id="move-backward-btn">Backward</button>
                        <button class="button" id="move-left-btn">Left</button>
                        <button class="button" id="move-right-btn">Right</button>
                        <button class="button danger" id="stop-btn">Stop</button>
                    </div>
                    
                    <div>
                        <h3>Navigate to Point</h3>
                        <div style="margin-bottom: 10px;">
                            <label for="target-x">X:</label>
                            <input type="number" id="target-x" value="0.0" step="0.1" style="width: 80px; margin-right: 10px;">
                            <label for="target-y">Y:</label>
                            <input type="number" id="target-y" value="0.0" step="0.1" style="width: 80px;">
                        </div>
                        <button class="button success" id="navigate-btn">Navigate</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Task Queue</h2>
            <table id="task-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Details</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td colspan="5">No tasks in queue</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top: 10px;">
                <button class="button" id="add-task-btn">Add Task</button>
                <button class="button warning" id="clear-tasks-btn">Clear All</button>
            </div>
        </div>
        
        <footer>
            <p>Robot AI Web Interface v1.0.0 | Created by AI Assistant</p>
        </footer>
    </div>

    <script>
        // Basic functionality to be expanded
        document.addEventListener('DOMContentLoaded', function() {
            const connectBtn = document.getElementById('connect-btn');
            const statusText = document.getElementById('status-text');
            const connectionStatus = document.getElementById('connection-status');
            
            // Connect button click handler
            connectBtn.addEventListener('click', function() {
                const robotIp = document.getElementById('robot-ip').value;
                statusText.textContent = `Connecting to ${robotIp}...`;
                connectionStatus.className = 'status warning';
                
                // Simulate connection (would be replaced with actual API calls)
                setTimeout(function() {
                    statusText.textContent = `Connected to ${robotIp}`;
                    connectionStatus.className = 'status success';
                    document.getElementById('robot-serial').textContent = 'L382502104987ir';
                    document.getElementById('robot-state').textContent = 'Idle';
                    document.getElementById('robot-battery').textContent = '87% (Charging)';
                }, 1500);
            });
            
            // Navigation button click handler
            document.getElementById('navigate-btn').addEventListener('click', function() {
                const x = document.getElementById('target-x').value;
                const y = document.getElementById('target-y').value;
                alert(`Navigating to point (${x}, ${y})`);
                // Would be replaced with actual API call
            });
            
            // Stop button
            document.getElementById('stop-btn').addEventListener('click', function() {
                alert('Emergency stop triggered');
                // Would be replaced with actual API call
            });
            
            // Other movement buttons
            const movementBtns = ['move-forward-btn', 'move-backward-btn', 'move-left-btn', 'move-right-btn'];
            movementBtns.forEach(btnId => {
                document.getElementById(btnId).addEventListener('click', function() {
                    const direction = btnId.replace('move-', '').replace('-btn', '');
                    alert(`Moving ${direction}`);
                    // Would be replaced with actual API call
                });
            });
            
            // Camera refresh button
            document.getElementById('refresh-camera-btn').addEventListener('click', function() {
                const cameraType = document.getElementById('camera-select').value;
                document.getElementById('camera-feed').innerHTML = `<p>Refreshing ${cameraType} camera...</p>`;
                
                // Simulate getting camera feed
                setTimeout(function() {
                    document.getElementById('camera-feed').innerHTML = 
                        `<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzMzIiAvPgogICAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPgogICAgICAgICR7Y2FtZXJhVHlwZX0gQ2FtZXJhIFNpbXVsYXRpb24KICAgIDwvdGV4dD4KPC9zdmc+Cg==" alt="Camera Feed" style="max-width: 100%; max-height: 100%;">`;
                }, 1000);
            });
            
            // Map loading button
            document.getElementById('load-map-btn').addEventListener('click', function() {
                const mapSelect = document.getElementById('map-select');
                
                // If no maps loaded yet, simulate loading them
                if (mapSelect.options.length <= 1) {
                    mapSelect.innerHTML = `
                        <option value="">Select a map...</option>
                        <option value="1">Ground Floor</option>
                        <option value="2">First Floor</option>
                        <option value="3">Warehouse</option>
                    `;
                }
                
                // Simulate drawing a map on canvas
                const canvas = document.getElementById('map-canvas');
                const ctx = canvas.getContext('2d');
                
                // Set canvas size to match container
                const container = document.getElementById('map-container');
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                
                // Draw a simple map
                ctx.fillStyle = '#EEEEEE';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw walls
                ctx.strokeStyle = '#333333';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.rect(50, 50, canvas.width - 100, canvas.height - 100);
                ctx.stroke();
                
                // Draw some rooms
                ctx.beginPath();
                ctx.moveTo(50, 150);
                ctx.lineTo(200, 150);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(200, 50);
                ctx.lineTo(200, 250);
                ctx.stroke();
                
                // Draw robot position
                ctx.fillStyle = '#3498db';
                ctx.beginPath();
                ctx.arc(150, 200, 10, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw robot orientation
                ctx.strokeStyle = '#2980b9';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(150, 200);
                ctx.lineTo(170, 200);
                ctx.stroke();
            });
        });
    </script>
</body>
</html>
"""

# Compress and encode the HTML
compressed = zlib.compress(html_content.encode('utf-8'))
encoded_html = base64.b64encode(compressed).decode('utf-8')

with open('encoded_html.txt', 'w') as out:
    out.write(encoded_html)
    
print(f"Encoded web interface written to encoded_html.txt (length: {len(encoded_html)})")
