#!/usr/bin/env python3
"""
Robot AI Installer
This simple installer creates and runs a web-based robot control dashboard.
Upload this single file to your robot and run it to gain full control.

Author: AI Assistant
Version: 1.0.0
"""

import os
import sys
import json
import time
import tempfile
import logging
import subprocess
from http.server import HTTPServer, SimpleHTTPRequestHandler
import threading
import webbrowser
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('robot-ai-installer')

# Constants
WEB_PORT = 8080
ROBOT_IP = "192.168.4.31"
ROBOT_PORT = 8090
INSTALL_DIR = os.path.expanduser("~/robot-ai")

# The complete dashboard HTML file
DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Robot AI Dashboard</title>
    <style>
        :root {
            --primary: #3B82F6;
            --primary-dark: #2563EB;
            --secondary: #10B981;
            --danger: #EF4444;
            --warning: #F59E0B;
            --success: #10B981;
            --background: #F9FAFB;
            --card-bg: #FFFFFF;
            --text: #1F2937;
            --text-light: #6B7280;
            --border: #E5E7EB;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--background);
            color: var(--text);
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 0;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1rem;
        }

        .header h1 {
            margin: 0;
            font-size: 1.5rem;
            color: var(--primary);
        }

        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
        }

        .status-connected {
            background-color: #D1FAE5;
            color: #065F46;
        }

        .status-disconnected {
            background-color: #FEE2E2;
            color: #B91C1C;
        }

        .card {
            background-color: var(--card-bg);
            border-radius: 0.5rem;
            box-shadow: var(--shadow);
            padding: 1rem;
            margin-bottom: 1rem;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
            padding-bottom: 0.5rem;
            border-bottom: 1px solid var(--border);
        }

        .card-title {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
        }

        .tabs {
            display: flex;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1rem;
        }

        .tab {
            padding: 0.5rem 1rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
        }

        .tab.active {
            border-bottom: 2px solid var(--primary);
            color: var(--primary);
            font-weight: 500;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
        }

        .button {
            display: inline-block;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.25rem;
            background-color: var(--primary);
            color: white;
            font-weight: 500;
            cursor: pointer;
            text-align: center;
            transition: background-color 0.2s;
        }

        .button:hover {
            background-color: var(--primary-dark);
        }

        .button.secondary {
            background-color: #E5E7EB;
            color: var(--text);
        }

        .button.secondary:hover {
            background-color: #D1D5DB;
        }

        .button.danger {
            background-color: var(--danger);
        }

        .button.danger:hover {
            background-color: #DC2626;
        }

        .button.success {
            background-color: var(--success);
        }

        .button.success:hover {
            background-color: #059669;
        }

        .form-group {
            margin-bottom: 1rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.25rem;
            font-weight: 500;
        }

        .form-group input,
        .form-group select {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid var(--border);
            border-radius: 0.25rem;
            font-size: 1rem;
        }

        .map-container {
            position: relative;
            overflow: hidden;
            border-radius: 0.5rem;
            height: 400px;
            background-color: #F3F4F6;
        }
        
        #map-canvas {
            width: 100%;
            height: 100%;
        }

        .robot-marker {
            position: absolute;
            width: 20px;
            height: 20px;
            background-color: var(--primary);
            border-radius: 50%;
            transform: translate(-50%, -50%);
        }

        .robot-direction {
            position: absolute;
            width: 15px;
            height: 2px;
            background-color: var(--primary-dark);
            transform-origin: 0 0;
        }

        .camera-feed {
            width: 100%;
            height: 300px;
            border-radius: 0.5rem;
            background-color: #111827;
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
        }

        #camera-image {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }

        .lidar-visualization {
            width: 100%;
            height: 300px;
            border-radius: 0.5rem;
            background-color: #111827;
            position: relative;
        }

        #lidar-canvas {
            width: 100%;
            height: 100%;
        }

        .task-item {
            padding: 0.75rem;
            border-radius: 0.25rem;
            background-color: #F3F4F6;
            margin-bottom: 0.5rem;
        }

        .task-item:last-child {
            margin-bottom: 0;
        }

        .task-header {
            display: flex;
            justify-content: space-between;
            font-weight: 500;
        }

        .battery-indicator {
            display: flex;
            align-items: center;
            margin-top: 0.5rem;
        }

        .battery-bar {
            flex-grow: 1;
            height: 1rem;
            background-color: #F3F4F6;
            border-radius: 0.5rem;
            overflow: hidden;
        }

        .battery-level {
            height: 100%;
            background-color: var(--success);
            transition: width 0.3s;
        }

        .battery-level.charging {
            background-color: var(--primary);
        }

        .battery-level.low {
            background-color: var(--warning);
        }

        .battery-level.critical {
            background-color: var(--danger);
        }

        .battery-percentage {
            margin-left: 0.5rem;
            font-weight: 500;
        }

        .doorway {
            position: absolute;
            border: 2px solid #10B981;
            background-color: rgba(16, 185, 129, 0.1);
            border-radius: 3px;
        }

        .elevator {
            position: absolute;
            border: 2px solid #6366F1;
            background-color: rgba(99, 102, 241, 0.1);
            border-radius: 3px;
        }

        .config-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 1rem;
        }

        .logs {
            font-family: monospace;
            background-color: #111827;
            color: #E5E7EB;
            padding: 1rem;
            border-radius: 0.5rem;
            height: 300px;
            overflow-y: auto;
        }

        .log-entry {
            margin-bottom: 0.25rem;
        }

        .log-time {
            color: #9CA3AF;
        }

        .log-info {
            color: #93C5FD;
        }

        .log-warning {
            color: #FCD34D;
        }

        .log-error {
            color: #F87171;
        }

        .footer {
            text-align: center;
            padding: 1rem 0;
            margin-top: 2rem;
            border-top: 1px solid var(--border);
            color: var(--text-light);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Robot AI Web Interface</h1>
            <div>
                <span id="connection-status" class="status-badge status-disconnected">Disconnected</span>
            </div>
        </div>

        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Robot Information</h2>
            </div>
            <div class="grid">
                <div>
                    <p><strong>Robot IP:</strong> <span id="robot-ip">--</span></p>
                    <p><strong>Robot Serial:</strong> <span id="robot-serial">--</span></p>
                    <p><strong>Current State:</strong> <span id="robot-state">--</span></p>
                    <p><strong>Position:</strong> (<span id="robot-position-x">0.00</span>, <span id="robot-position-y">0.00</span>)</p>
                    <p><strong>Orientation:</strong> <span id="robot-orientation">0.00</span> rad</p>
                </div>
                <div>
                    <p><strong>Battery Status:</strong> <span id="battery-status">--</span></p>
                    <div class="battery-indicator">
                        <div class="battery-bar">
                            <div id="battery-level" class="battery-level" style="width: 0%;"></div>
                        </div>
                        <span id="battery-percentage" class="battery-percentage">0%</span>
                    </div>
                    <div class="form-group" style="margin-top: 1rem;">
                        <label for="robot-ip-input">Robot IP Address</label>
                        <div style="display: flex;">
                            <input type="text" id="robot-ip-input" value="192.168.4.31" placeholder="e.g. 192.168.4.31">
                            <button id="connect-button" class="button" style="margin-left: 0.5rem;">Connect</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="navigation">Navigation</div>
            <div class="tab" data-tab="camera">Camera</div>
            <div class="tab" data-tab="lidar">LiDAR</div>
            <div class="tab" data-tab="tasks">Tasks</div>
            <div class="tab" data-tab="settings">Settings</div>
            <div class="tab" data-tab="logs">Logs</div>
        </div>

        <div id="navigation" class="tab-content active">
            <div class="grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Map & Navigation</h3>
                    </div>
                    <div class="map-container">
                        <canvas id="map-canvas"></canvas>
                        <div id="robot-marker" class="robot-marker">
                            <div id="robot-direction" class="robot-direction"></div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button id="set-pose-button" class="button">Set Initial Pose</button>
                        <button id="cancel-move-button" class="button danger" style="margin-left: 0.5rem;">Cancel Move</button>
                    </div>
                </div>
                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Maps</h3>
                        </div>
                        <div class="form-group">
                            <label for="map-select">Select Map</label>
                            <select id="map-select">
                                <option value="">Loading maps...</option>
                            </select>
                        </div>
                        <div>
                            <button id="load-map-button" class="button">Load Map</button>
                            <button id="start-mapping-button" class="button secondary" style="margin-left: 0.5rem;">Start Mapping</button>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Movement Controls</h3>
                        </div>
                        <div class="form-group">
                            <label for="target-x">Target X Position</label>
                            <input type="number" id="target-x" step="0.1" value="0.0">
                        </div>
                        <div class="form-group">
                            <label for="target-y">Target Y Position</label>
                            <input type="number" id="target-y" step="0.1" value="0.0">
                        </div>
                        <div class="form-group">
                            <label for="target-orientation">Target Orientation (rad)</label>
                            <input type="number" id="target-orientation" step="0.1" value="0.0">
                        </div>
                        <button id="move-button" class="button success">Move to Position</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="camera" class="tab-content">
            <div class="grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Camera Feed</h3>
                    </div>
                    <div class="camera-feed">
                        <img id="camera-image" src="" alt="Camera feed not available">
                    </div>
                    <div style="margin-top: 1rem;">
                        <button id="refresh-camera-button" class="button">Refresh Camera</button>
                        <button id="camera-settings-button" class="button secondary" style="margin-left: 0.5rem;">Camera Settings</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Camera Controls</h3>
                    </div>
                    <div class="form-group">
                        <label for="camera-source">Camera Source</label>
                        <select id="camera-source">
                            <option value="front">Front Camera</option>
                            <option value="back">Back Camera</option>
                            <option value="depth">Depth Camera</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="camera-quality">Quality</label>
                        <select id="camera-quality">
                            <option value="high">High</option>
                            <option value="medium" selected>Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="camera-framerate">Frame Rate</label>
                        <select id="camera-framerate">
                            <option value="30">30 FPS</option>
                            <option value="15" selected>15 FPS</option>
                            <option value="5">5 FPS</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="camera-autorefresh" checked> Auto Refresh</label>
                    </div>
                </div>
            </div>
        </div>

        <div id="lidar" class="tab-content">
            <div class="grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">LiDAR Visualization</h3>
                    </div>
                    <div class="lidar-visualization">
                        <canvas id="lidar-canvas"></canvas>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button id="refresh-lidar-button" class="button">Refresh LiDAR</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">LiDAR Settings</h3>
                    </div>
                    <div class="form-group">
                        <label for="lidar-range">Display Range (meters)</label>
                        <input type="range" id="lidar-range" min="1" max="10" value="5" step="0.5">
                        <div style="display: flex; justify-content: space-between;">
                            <span>1m</span>
                            <span id="lidar-range-value">5m</span>
                            <span>10m</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="point-size">Point Size</label>
                        <input type="range" id="point-size" min="1" max="10" value="3" step="1">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Small</span>
                            <span>Medium</span>
                            <span>Large</span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="show-obstacles" checked> Show Obstacles</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" id="show-intensity" checked> Show Intensity</label>
                    </div>
                </div>
            </div>
        </div>

        <div id="tasks" class="tab-content">
            <div class="grid">
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Task Queue</h3>
                    </div>
                    <div id="task-list">
                        <p>No tasks in queue</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button id="clear-tasks-button" class="button danger">Clear All Tasks</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Add Task</h3>
                    </div>
                    <div class="form-group">
                        <label for="task-type">Task Type</label>
                        <select id="task-type">
                            <option value="move">Move to Position</option>
                            <option value="elevator">Use Elevator</option>
                            <option value="door">Open Door</option>
                            <option value="wait">Wait</option>
                            <option value="charge">Go to Charger</option>
                        </select>
                    </div>
                    
                    <!-- Move Task Parameters -->
                    <div id="move-params" class="task-params">
                        <div class="form-group">
                            <label for="move-x">X Position</label>
                            <input type="number" id="move-x" step="0.1" value="0.0">
                        </div>
                        <div class="form-group">
                            <label for="move-y">Y Position</label>
                            <input type="number" id="move-y" step="0.1" value="0.0">
                        </div>
                        <div class="form-group">
                            <label for="move-orientation">Orientation (rad)</label>
                            <input type="number" id="move-orientation" step="0.1" value="0.0">
                        </div>
                    </div>
                    
                    <!-- Elevator Task Parameters -->
                    <div id="elevator-params" class="task-params" style="display: none;">
                        <div class="form-group">
                            <label for="elevator-id">Elevator ID</label>
                            <select id="elevator-id">
                                <option value="elevator-1">Elevator 1</option>
                                <option value="elevator-2">Elevator 2</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="target-floor">Target Floor</label>
                            <select id="target-floor">
                                <option value="1">Floor 1</option>
                                <option value="2">Floor 2</option>
                                <option value="3">Floor 3</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Door Task Parameters -->
                    <div id="door-params" class="task-params" style="display: none;">
                        <div class="form-group">
                            <label for="door-id">Door ID</label>
                            <select id="door-id">
                                <option value="door-1">Door 1</option>
                                <option value="door-2">Door 2</option>
                            </select>
                        </div>
                    </div>
                    
                    <!-- Wait Task Parameters -->
                    <div id="wait-params" class="task-params" style="display: none;">
                        <div class="form-group">
                            <label for="wait-time">Wait Time (seconds)</label>
                            <input type="number" id="wait-time" min="1" max="3600" value="30">
                        </div>
                    </div>
                    
                    <!-- Charge Task Parameters -->
                    <div id="charge-params" class="task-params" style="display: none;">
                        <div class="form-group">
                            <label for="charge-time">Charge Time (minutes)</label>
                            <input type="number" id="charge-time" min="1" max="120" value="30">
                        </div>
                        <div class="form-group">
                            <label for="charge-target">Target Charge Level (%)</label>
                            <input type="number" id="charge-target" min="1" max="100" value="90">
                        </div>
                    </div>
                    
                    <button id="add-task-button" class="button success">Add Task</button>
                </div>
            </div>
        </div>

        <div id="settings" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Robot Settings</h3>
                </div>
                <div class="config-grid">
                    <div class="form-group">
                        <label for="reconnect-interval">Reconnect Interval (seconds)</label>
                        <input type="number" id="reconnect-interval" min="1" max="60" value="5">
                    </div>
                    <div class="form-group">
                        <label for="movement-speed">Movement Speed</label>
                        <select id="movement-speed">
                            <option value="slow">Slow</option>
                            <option value="normal" selected>Normal</option>
                            <option value="fast">Fast</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="topic-update-rate">Topic Update Rate (ms)</label>
                        <input type="number" id="topic-update-rate" min="100" max="10000" step="100" value="1000">
                    </div>
                    <div class="form-group">
                        <label for="robot-secret">Robot Secret Key</label>
                        <input type="password" id="robot-secret" placeholder="Enter secret key" value="H3MN33L33E2CKNM37WQRZMR2KLAQECDD">
                    </div>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="auto-reconnect" checked> Auto Reconnect</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" id="enable-logging" checked> Enable Logging</label>
                </div>
                <button id="save-settings-button" class="button">Save Settings</button>
                <button id="reboot-button" class="button danger" style="margin-left: 0.5rem;">Reboot Robot</button>
            </div>
        </div>

        <div id="logs" class="tab-content">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">System Logs</h3>
                    <button id="clear-logs-button" class="button secondary">Clear Logs</button>
                </div>
                <div class="logs" id="log-container">
                    <div class="log-entry">
                        <span class="log-time">[10:00:00]</span>
                        <span class="log-info">Robot AI Web Interface initialized</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="footer">
            <p>Robot AI Web Interface v1.0.0 | © 2025</p>
        </div>
    </div>

    <script>
        // Initialize variables
        const robotIP = "192.168.4.31";
        const robotPort = 8090;
        const robotSecret = "H3MN33L33E2CKNM37WQRZMR2KLAQECDD"; // Pre-configured robot secret
        
        let ws = null;
        let robotState = {
            connected: false,
            position: { x: 0, y: 0 },
            orientation: 0,
            battery: {
                percentage: 0,
                status: "unknown"
            },
            state: "idle",
            mapId: null,
            currentMap: null,
            lidarData: [],
            cameraData: null,
            tasks: []
        };
        
        // DOM Elements
        const connectionStatus = document.getElementById('connection-status');
        const robotIP_display = document.getElementById('robot-ip');
        const robotSerial = document.getElementById('robot-serial');
        const robotState_display = document.getElementById('robot-state');
        const robotPositionX = document.getElementById('robot-position-x');
        const robotPositionY = document.getElementById('robot-position-y');
        const robotOrientation = document.getElementById('robot-orientation');
        const batteryStatus = document.getElementById('battery-status');
        const batteryLevel = document.getElementById('battery-level');
        const batteryPercentage = document.getElementById('battery-percentage');
        const mapCanvas = document.getElementById('map-canvas');
        const robotMarker = document.getElementById('robot-marker');
        const robotDirection = document.getElementById('robot-direction');
        const lidarCanvas = document.getElementById('lidar-canvas');
        const cameraImage = document.getElementById('camera-image');
        const taskList = document.getElementById('task-list');
        const logContainer = document.getElementById('log-container');
        
        // Map context
        const mapCtx = mapCanvas.getContext('2d');
        const lidarCtx = lidarCanvas.getContext('2d');
        
        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            });
        });
        
        // Task type change handler
        document.getElementById('task-type').addEventListener('change', (e) => {
            // Hide all task parameter sections
            document.querySelectorAll('.task-params').forEach(section => {
                section.style.display = 'none';
            });
            
            // Show the relevant task parameter section
            const taskType = e.target.value;
            document.getElementById(`${taskType}-params`).style.display = 'block';
        });
        
        // Connect to robot
        document.getElementById('connect-button').addEventListener('click', () => {
            const ipInput = document.getElementById('robot-ip-input').value;
            connectToRobot(ipInput);
        });
        
        // Initial connection attempt
        function init() {
            connectToRobot(robotIP);
            addLogEntry('Robot AI Web Interface initialized', 'info');
            
            // Set up LiDAR range display
            document.getElementById('lidar-range').addEventListener('input', (e) => {
                document.getElementById('lidar-range-value').textContent = `${e.target.value}m`;
                drawLidar();
            });
            
            // Set up map canvas
            resizeCanvases();
            window.addEventListener('resize', resizeCanvases);
            
            // Set up movement buttons
            document.getElementById('move-button').addEventListener('click', moveRobot);
            document.getElementById('cancel-move-button').addEventListener('click', cancelMove);
            document.getElementById('set-pose-button').addEventListener('click', setInitialPose);
            document.getElementById('load-map-button').addEventListener('click', loadSelectedMap);
            document.getElementById('start-mapping-button').addEventListener('click', startMapping);
            document.getElementById('refresh-camera-button').addEventListener('click', refreshCamera);
            document.getElementById('refresh-lidar-button').addEventListener('click', refreshLidar);
            document.getElementById('add-task-button').addEventListener('click', addTask);
            document.getElementById('clear-tasks-button').addEventListener('click', clearTasks);
            document.getElementById('save-settings-button').addEventListener('click', saveSettings);
            document.getElementById('clear-logs-button').addEventListener('click', clearLogs);
            document.getElementById('reboot-button').addEventListener('click', rebootRobot);
            
            // Poll for updates
            setInterval(pollRobotStatus, 1000);
        }
        
        // Connect to robot WebSocket
        async function connectToRobot(ip) {
            try {
                addLogEntry(`Connecting to robot at ${ip}:${robotPort}`, 'info');
                
                // First, check if the robot is accessible
                const response = await fetch(`http://${ip}:${robotPort}/device/info`, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    updateRobotInfo(data);
                    connectWebSocket(ip);
                } else {
                    addLogEntry(`Failed to connect: HTTP ${response.status}`, 'error');
                    updateConnectionStatus(false);
                }
            } catch (error) {
                addLogEntry(`Connection error: ${error.message}`, 'error');
                updateConnectionStatus(false);
            }
        }
        
        // Connect to WebSocket
        function connectWebSocket(ip) {
            const wsUrl = `ws://${ip}:${robotPort}/ws/v2/topics`;
            
            if (ws) {
                ws.close();
            }
            
            try {
                ws = new WebSocket(wsUrl);
                
                ws.onopen = () => {
                    addLogEntry('WebSocket connection established', 'info');
                    updateConnectionStatus(true);
                    
                    // Enable topics
                    const topics = [
                        "/tracked_pose",
                        "/battery_state",
                        "/map",
                        "/scan_matched_points2",
                        "/slam/state",
                        "/wheel_state",
                        "/rgb_cameras/front/video"
                    ];
                    
                    ws.send(JSON.stringify({ "enable_topic": topics }));
                };
                
                ws.onmessage = (event) => {
                    processMessage(event.data);
                };
                
                ws.onclose = () => {
                    addLogEntry('WebSocket connection closed', 'warning');
                    updateConnectionStatus(false);
                    
                    // Auto reconnect if enabled
                    if (document.getElementById('auto-reconnect').checked) {
                        const reconnectInterval = parseInt(document.getElementById('reconnect-interval').value) * 1000;
                        setTimeout(() => {
                            connectToRobot(ip);
                        }, reconnectInterval);
                    }
                };
                
                ws.onerror = (error) => {
                    addLogEntry(`WebSocket error: ${error.message}`, 'error');
                };
                
            } catch (error) {
                addLogEntry(`WebSocket connection error: ${error.message}`, 'error');
            }
        }
        
        // Process incoming WebSocket messages
        function processMessage(message) {
            try {
                const data = JSON.parse(message);
                const topic = data.topic;
                
                if (!topic) {
                    console.log('Received non-topic message:', data);
                    return;
                }
                
                switch (topic) {
                    case '/tracked_pose':
                        updatePosition(data);
                        break;
                    case '/battery_state':
                        updateBattery(data);
                        break;
                    case '/map':
                        updateMap(data);
                        break;
                    case '/scan_matched_points2':
                        updateLidar(data);
                        break;
                    case '/rgb_cameras/front/video':
                        updateCamera(data);
                        break;
                    case '/slam/state':
                        updateSlamState(data);
                        break;
                    case '/wheel_state':
                        updateWheelState(data);
                        break;
                    default:
                        // Other topics
                        console.log(`Received data from ${topic}`);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }
        
        // Update robot information
        function updateRobotInfo(data) {
            robotSerial.textContent = data.serial || data.name || 'Unknown';
            robotIP_display.textContent = document.getElementById('robot-ip-input').value;
        }
        
        // Update connection status
        function updateConnectionStatus(connected) {
            robotState.connected = connected;
            
            if (connected) {
                connectionStatus.textContent = 'Connected';
                connectionStatus.classList.remove('status-disconnected');
                connectionStatus.classList.add('status-connected');
            } else {
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.classList.remove('status-connected');
                connectionStatus.classList.add('status-disconnected');
            }
        }
        
        // Update robot position
        function updatePosition(data) {
            const pos = data.pos || [0, 0];
            const ori = data.ori || 0;
            
            robotState.position = { x: pos[0], y: pos[1] };
            robotState.orientation = ori;
            
            robotPositionX.textContent = pos[0].toFixed(2);
            robotPositionY.textContent = pos[1].toFixed(2);
            robotOrientation.textContent = ori.toFixed(2);
            
            // Update robot marker on map
            updateRobotMarker();
        }
        
        // Update battery information
        function updateBattery(data) {
            const percentage = (data.percentage || 0) * 100;
            const status = data.power_supply_status || 'unknown';
            
            robotState.battery.percentage = percentage;
            robotState.battery.status = status;
            
            batteryPercentage.textContent = `${Math.round(percentage)}%`;
            batteryLevel.style.width = `${percentage}%`;
            
            // Update battery status text and color
            batteryLevel.classList.remove('charging', 'low', 'critical');
            
            if (status === 'charging') {
                batteryStatus.textContent = 'Charging';
                batteryLevel.classList.add('charging');
            } else if (status === 'discharging') {
                batteryStatus.textContent = 'In-Use';
                
                if (percentage < 20) {
                    batteryLevel.classList.add('critical');
                } else if (percentage < 50) {
                    batteryLevel.classList.add('low');
                }
            } else {
                batteryStatus.textContent = 'Not Charging';
            }
        }
        
        // Update map data
        function updateMap(data) {
            if (!data.resolution || !data.size || !data.origin) {
                return;
            }
            
            robotState.currentMap = {
                resolution: data.resolution,
                size: data.size,
                origin: data.origin,
                stamp: data.stamp
                // We don't store the full data array here to save memory
            };
            
            addLogEntry(`Received map update with size: ${data.size[0]}x${data.size[1]}`, 'info');
            
            // Redraw the map
            drawMap();
        }
        
        // Update LiDAR data
        function updateLidar(data) {
            if (data.points) {
                robotState.lidarData = data.points;
                drawLidar();
            }
        }
        
        // Update camera feed
        function updateCamera(data) {
            if (data.image_bytes) {
                const imageData = `data:image/jpeg;base64,${data.image_bytes}`;
                cameraImage.src = imageData;
                robotState.cameraData = {
                    timestamp: data.stamp,
                    available: true
                };
            } else if (data.stamp) {
                // We received camera data but without image bytes
                // This might be a header-only message
                robotState.cameraData = {
                    timestamp: data.stamp,
                    available: true
                };
                
                // If auto-refresh is enabled, request a full frame
                if (document.getElementById('camera-autorefresh').checked) {
                    refreshCamera();
                }
            }
        }
        
        // Update SLAM state
        function updateSlamState(data) {
            const state = data.state;
            
            if (state === 'mapping') {
                robotState.state = 'mapping';
                robotState_display.textContent = 'Mapping';
            } else if (state === 'positioning') {
                // Robot is determining its position
                addLogEntry(`Robot is positioning (quality: ${data.position_quality})`, 'info');
            }
        }
        
        // Update wheel state
        function updateWheelState(data) {
            const controlMode = data.control_mode;
            const emergencyStop = data.emergency_stop_pressed;
            
            if (emergencyStop) {
                robotState.state = 'emergency_stop';
                robotState_display.textContent = 'Emergency Stop';
                addLogEntry('Emergency stop is pressed', 'warning');
            } else if (controlMode === 'manual') {
                robotState.state = 'manual_control';
                robotState_display.textContent = 'Manual Control';
            } else if (controlMode === 'auto') {
                // The state will be determined by other messages
                if (robotState.state !== 'moving' && robotState.state !== 'mapping') {
                    robotState.state = 'idle';
                    robotState_display.textContent = 'Idle';
                }
            }
        }
        
        // Draw the map on the canvas
        function drawMap() {
            if (!robotState.currentMap) {
                return;
            }
            
            // Clear canvas
            mapCtx.fillStyle = '#F3F4F6';
            mapCtx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);
            
            // Request the map image via REST API
            const ip = document.getElementById('robot-ip-input').value;
            const mapUrl = `http://${ip}:${robotPort}/maps/current/image?width=${mapCanvas.width}&height=${mapCanvas.height}`;
            
            const mapImage = new Image();
            mapImage.onload = () => {
                mapCtx.drawImage(mapImage, 0, 0);
                updateRobotMarker();
            };
            mapImage.onerror = () => {
                mapCtx.fillStyle = '#111827';
                mapCtx.font = '16px sans-serif';
                mapCtx.textAlign = 'center';
                mapCtx.fillText('Map image not available', mapCanvas.width / 2, mapCanvas.height / 2);
            };
            mapImage.src = mapUrl;
        }
        
        // Update robot marker position on the map
        function updateRobotMarker() {
            if (!robotState.currentMap || !robotState.position) {
                return;
            }
            
            // Convert map coordinates to pixel coordinates
            const mapWidth = robotState.currentMap.size[0] * robotState.currentMap.resolution;
            const mapHeight = robotState.currentMap.size[1] * robotState.currentMap.resolution;
            const originX = robotState.currentMap.origin[0];
            const originY = robotState.currentMap.origin[1];
            
            const pixelX = (robotState.position.x - originX) / mapWidth * mapCanvas.width;
            const pixelY = mapCanvas.height - (robotState.position.y - originY) / mapHeight * mapCanvas.height;
            
            // Position robot marker
            robotMarker.style.left = `${pixelX}px`;
            robotMarker.style.top = `${pixelY}px`;
            
            // Update direction indicator
            const angle = robotState.orientation;
            robotDirection.style.width = '15px';
            robotDirection.style.transform = `rotate(${angle}rad)`;
        }
        
        // Draw LiDAR data on canvas
        function drawLidar() {
            // Clear canvas
            lidarCtx.fillStyle = '#111827';
            lidarCtx.fillRect(0, 0, lidarCanvas.width, lidarCanvas.height);
            
            if (!robotState.lidarData || robotState.lidarData.length === 0) {
                lidarCtx.fillStyle = '#FFFFFF';
                lidarCtx.font = '16px sans-serif';
                lidarCtx.textAlign = 'center';
                lidarCtx.fillText('No LiDAR data available', lidarCanvas.width / 2, lidarCanvas.height / 2);
                return;
            }
            
            const showIntensity = document.getElementById('show-intensity').checked;
            const pointSize = parseInt(document.getElementById('point-size').value);
            const range = parseFloat(document.getElementById('lidar-range').value);
            
            // Calculate center of canvas
            const centerX = lidarCanvas.width / 2;
            const centerY = lidarCanvas.height / 2;
            
            // Calculate scale factor (pixels per meter)
            const scaleFactor = Math.min(lidarCanvas.width, lidarCanvas.height) / (2 * range);
            
            // Draw points
            lidarCtx.save();
            lidarCtx.translate(centerX, centerY);
            
            // Draw range circles
            lidarCtx.strokeStyle = '#3B3F45';
            lidarCtx.setLineDash([5, 5]);
            for (let r = 1; r <= range; r++) {
                lidarCtx.beginPath();
                lidarCtx.arc(0, 0, r * scaleFactor, 0, Math.PI * 2);
                lidarCtx.stroke();
                
                // Add labels
                lidarCtx.fillStyle = '#9CA3AF';
                lidarCtx.font = '10px sans-serif';
                lidarCtx.textAlign = 'left';
                lidarCtx.fillText(`${r}m`, r * scaleFactor + 5, 0);
            }
            lidarCtx.setLineDash([]);
            
            // Draw origin
            lidarCtx.fillStyle = '#3B82F6';
            lidarCtx.beginPath();
            lidarCtx.arc(0, 0, 5, 0, Math.PI * 2);
            lidarCtx.fill();
            
            // Draw forward direction
            lidarCtx.strokeStyle = '#3B82F6';
            lidarCtx.lineWidth = 2;
            lidarCtx.beginPath();
            lidarCtx.moveTo(0, 0);
            lidarCtx.lineTo(0, -30);
            lidarCtx.stroke();
            
            // Draw points
            robotState.lidarData.forEach(point => {
                const x = point[0] * scaleFactor;
                const y = -point[1] * scaleFactor; // Flip Y axis
                
                if (showIntensity && point.length > 2) {
                    // Use intensity value for color if available
                    const intensity = point[2];
                    const color = intensityToColor(intensity);
                    lidarCtx.fillStyle = color;
                } else {
                    lidarCtx.fillStyle = '#10B981';
                }
                
                lidarCtx.beginPath();
                lidarCtx.arc(x, y, pointSize, 0, Math.PI * 2);
                lidarCtx.fill();
            });
            
            lidarCtx.restore();
        }
        
        // Convert intensity value to color
        function intensityToColor(intensity) {
            // Normalize intensity to 0-1
            const normalizedIntensity = Math.min(Math.max(intensity, 0), 1);
            
            // Create color gradient: blue (low) to green (medium) to red (high)
            const r = normalizedIntensity > 0.5 ? 255 * (normalizedIntensity - 0.5) * 2 : 0;
            const g = normalizedIntensity < 0.5 ? 255 * normalizedIntensity * 2 : 255 * (1 - (normalizedIntensity - 0.5) * 2);
            const b = normalizedIntensity < 0.5 ? 255 * (0.5 - normalizedIntensity) * 2 : 0;
            
            return `rgb(${r}, ${g}, ${b})`;
        }
        
        // Refresh camera feed
        function refreshCamera() {
            const ip = document.getElementById('robot-ip-input').value;
            const cameraSource = document.getElementById('camera-source').value;
            const quality = document.getElementById('camera-quality').value;
            
            let endpoint = '/rgb_cameras/front/image';
            if (cameraSource === 'back') {
                endpoint = '/rgb_cameras/back/image';
            } else if (cameraSource === 'depth') {
                endpoint = '/depth_camera/image';
            }
            
            let qualityParam = '';
            if (quality === 'high') {
                qualityParam = '?quality=90';
            } else if (quality === 'low') {
                qualityParam = '?quality=60';
            }
            
            const cameraUrl = `http://${ip}:${robotPort}${endpoint}${qualityParam}`;
            
            // Set a random query parameter to bypass cache
            const cacheBuster = `&cache=${Date.now()}`;
            cameraImage.src = cameraUrl + cacheBuster;
            
            addLogEntry(`Refreshed ${cameraSource} camera feed`, 'info');
        }
        
        // Refresh LiDAR data
        function refreshLidar() {
            // We don't need to explicitly refresh - just redraw with current data
            drawLidar();
            addLogEntry('Refreshed LiDAR visualization', 'info');
        }
        
        // Move robot to position
        function moveRobot() {
            const targetX = parseFloat(document.getElementById('target-x').value);
            const targetY = parseFloat(document.getElementById('target-y').value);
            const targetOri = parseFloat(document.getElementById('target-orientation').value);
            
            createMoveAction(targetX, targetY, targetOri);
        }
        
        // Create move action
        async function createMoveAction(targetX, targetY, targetOri) {
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/chassis/moves`;
                
                const payload = {
                    creator: "robot-ai-web",
                    type: "standard",
                    target_x: targetX,
                    target_y: targetY,
                    target_ori: targetOri
                };
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const actionId = result.id;
                    
                    robotState.state = 'moving';
                    robotState_display.textContent = 'Moving';
                    
                    addLogEntry(`Created move action ${actionId} to (${targetX.toFixed(2)}, ${targetY.toFixed(2)})`, 'info');
                    return { success: true, actionId };
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to create move action: ${response.status} ${errorText}`, 'error');
                    return { success: false, error: errorText };
                }
            } catch (error) {
                addLogEntry(`Error creating move action: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        }
        
        // Cancel current move
        async function cancelMove() {
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/chassis/moves/current`;
                
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    },
                    body: JSON.stringify({ state: "cancelled" })
                });
                
                if (response.ok) {
                    addLogEntry('Successfully cancelled current move', 'info');
                    return true;
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to cancel move: ${response.status} ${errorText}`, 'error');
                    return false;
                }
            } catch (error) {
                addLogEntry(`Error cancelling move: ${error.message}`, 'error');
                return false;
            }
        }
        
        // Set initial pose
        async function setInitialPose() {
            try {
                const x = parseFloat(document.getElementById('target-x').value);
                const y = parseFloat(document.getElementById('target-y').value);
                const orientation = parseFloat(document.getElementById('target-orientation').value);
                
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/chassis/pose`;
                
                const payload = {
                    position: [x, y, 0],
                    ori: orientation,
                    adjust_position: true
                };
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    addLogEntry(`Successfully set initial pose to (${x.toFixed(2)}, ${y.toFixed(2)}, ${orientation.toFixed(2)})`, 'info');
                    return true;
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to set initial pose: ${response.status} ${errorText}`, 'error');
                    return false;
                }
            } catch (error) {
                addLogEntry(`Error setting initial pose: ${error.message}`, 'error');
                return false;
            }
        }
        
        // Load selected map
        async function loadSelectedMap() {
            const mapSelect = document.getElementById('map-select');
            const mapId = mapSelect.value;
            
            if (!mapId) {
                addLogEntry('No map selected', 'warning');
                return;
            }
            
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/chassis/current-map`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    },
                    body: JSON.stringify({ map_id: parseInt(mapId) })
                });
                
                if (response.ok) {
                    robotState.mapId = parseInt(mapId);
                    addLogEntry(`Successfully set current map to ID ${mapId}`, 'info');
                    
                    // Update map
                    setTimeout(drawMap, 1000);
                    
                    return true;
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to set map: ${response.status} ${errorText}`, 'error');
                    return false;
                }
            } catch (error) {
                addLogEntry(`Error setting current map: ${error.message}`, 'error');
                return false;
            }
        }
        
        // Start mapping
        async function startMapping() {
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/mappings/`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    },
                    body: JSON.stringify({ continue_mapping: false })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    const mappingId = result.id;
                    
                    robotState.state = 'mapping';
                    robotState_display.textContent = 'Mapping';
                    
                    addLogEntry(`Started mapping task ${mappingId}`, 'info');
                    return { success: true, mappingId };
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to start mapping: ${response.status} ${errorText}`, 'error');
                    return { success: false, error: errorText };
                }
            } catch (error) {
                addLogEntry(`Error starting mapping: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        }
        
        // Get maps list
        async function getMaps() {
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/maps/`;
                
                const response = await fetch(url, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    }
                });
                
                if (response.ok) {
                    const maps = await response.json();
                    
                    // Update maps dropdown
                    const mapSelect = document.getElementById('map-select');
                    mapSelect.innerHTML = '';
                    
                    maps.forEach(map => {
                        const option = document.createElement('option');
                        option.value = map.id;
                        option.textContent = map.name || `Map ${map.id}`;
                        mapSelect.appendChild(option);
                    });
                    
                    addLogEntry(`Retrieved ${maps.length} maps`, 'info');
                    return maps;
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to get maps: ${response.status} ${errorText}`, 'error');
                    return [];
                }
            } catch (error) {
                addLogEntry(`Error getting maps: ${error.message}`, 'error');
                return [];
            }
        }
        
        // Add task to queue
        function addTask() {
            const taskType = document.getElementById('task-type').value;
            let taskParams = {};
            
            switch (taskType) {
                case 'move':
                    taskParams = {
                        x: parseFloat(document.getElementById('move-x').value),
                        y: parseFloat(document.getElementById('move-y').value),
                        orientation: parseFloat(document.getElementById('move-orientation').value)
                    };
                    break;
                case 'elevator':
                    taskParams = {
                        elevatorId: document.getElementById('elevator-id').value,
                        targetFloor: parseInt(document.getElementById('target-floor').value)
                    };
                    break;
                case 'door':
                    taskParams = {
                        doorId: document.getElementById('door-id').value
                    };
                    break;
                case 'wait':
                    taskParams = {
                        waitTime: parseInt(document.getElementById('wait-time').value)
                    };
                    break;
                case 'charge':
                    taskParams = {
                        chargeTime: parseInt(document.getElementById('charge-time').value),
                        targetCharge: parseInt(document.getElementById('charge-target').value)
                    };
                    break;
            }
            
            const task = {
                id: Date.now().toString(),
                type: taskType,
                params: taskParams,
                status: 'queued',
                addedTime: new Date().toISOString()
            };
            
            robotState.tasks.push(task);
            addLogEntry(`Added ${taskType} task to queue`, 'info');
            updateTaskList();
        }
        
        // Clear task queue
        function clearTasks() {
            robotState.tasks = [];
            addLogEntry('Cleared task queue', 'info');
            updateTaskList();
        }
        
        // Update task list
        function updateTaskList() {
            const taskList = document.getElementById('task-list');
            
            if (robotState.tasks.length === 0) {
                taskList.innerHTML = '<p>No tasks in queue</p>';
                return;
            }
            
            taskList.innerHTML = '';
            
            robotState.tasks.forEach((task, index) => {
                const taskItem = document.createElement('div');
                taskItem.className = 'task-item';
                
                let taskDescription = '';
                switch (task.type) {
                    case 'move':
                        taskDescription = `Move to (${task.params.x.toFixed(2)}, ${task.params.y.toFixed(2)})`;
                        break;
                    case 'elevator':
                        taskDescription = `Use elevator ${task.params.elevatorId} to floor ${task.params.targetFloor}`;
                        break;
                    case 'door':
                        taskDescription = `Open door ${task.params.doorId}`;
                        break;
                    case 'wait':
                        taskDescription = `Wait for ${task.params.waitTime} seconds`;
                        break;
                    case 'charge':
                        taskDescription = `Charge to ${task.params.targetCharge}% (max ${task.params.chargeTime} min)`;
                        break;
                }
                
                taskItem.innerHTML = `
                    <div class="task-header">
                        <span>${index + 1}. ${taskDescription}</span>
                        <span>${task.status}</span>
                    </div>
                `;
                
                // Add a button to remove this task
                const removeButton = document.createElement('button');
                removeButton.className = 'button danger';
                removeButton.textContent = 'Remove';
                removeButton.style.marginTop = '0.5rem';
                removeButton.style.padding = '0.25rem 0.5rem';
                removeButton.style.fontSize = '0.75rem';
                
                removeButton.addEventListener('click', () => {
                    robotState.tasks.splice(index, 1);
                    updateTaskList();
                    addLogEntry(`Removed task ${index + 1} from queue`, 'info');
                });
                
                taskItem.appendChild(removeButton);
                taskList.appendChild(taskItem);
            });
        }
        
        // Save settings
        function saveSettings() {
            const reconnectInterval = document.getElementById('reconnect-interval').value;
            const movementSpeed = document.getElementById('movement-speed').value;
            const topicUpdateRate = document.getElementById('topic-update-rate').value;
            const robotSecretInput = document.getElementById('robot-secret').value;
            const autoReconnect = document.getElementById('auto-reconnect').checked;
            const enableLogging = document.getElementById('enable-logging').checked;
            
            // Save to local storage
            localStorage.setItem('reconnectInterval', reconnectInterval);
            localStorage.setItem('movementSpeed', movementSpeed);
            localStorage.setItem('topicUpdateRate', topicUpdateRate);
            localStorage.setItem('autoReconnect', autoReconnect);
            localStorage.setItem('enableLogging', enableLogging);
            
            // Update robot secret if provided
            if (robotSecretInput) {
                localStorage.setItem('robotSecret', robotSecretInput);
            }
            
            addLogEntry('Settings saved', 'info');
        }
        
        // Load settings
        function loadSettings() {
            const reconnectInterval = localStorage.getItem('reconnectInterval');
            const movementSpeed = localStorage.getItem('movementSpeed');
            const topicUpdateRate = localStorage.getItem('topicUpdateRate');
            const robotSecretSaved = localStorage.getItem('robotSecret');
            const autoReconnect = localStorage.getItem('autoReconnect');
            const enableLogging = localStorage.getItem('enableLogging');
            
            if (reconnectInterval) document.getElementById('reconnect-interval').value = reconnectInterval;
            if (movementSpeed) document.getElementById('movement-speed').value = movementSpeed;
            if (topicUpdateRate) document.getElementById('topic-update-rate').value = topicUpdateRate;
            if (robotSecretSaved) document.getElementById('robot-secret').value = robotSecretSaved;
            if (autoReconnect !== null) document.getElementById('auto-reconnect').checked = autoReconnect === 'true';
            if (enableLogging !== null) document.getElementById('enable-logging').checked = enableLogging === 'true';
        }
        
        // Reboot robot
        async function rebootRobot() {
            if (!confirm('Are you sure you want to reboot the robot?')) {
                return;
            }
            
            try {
                const ip = document.getElementById('robot-ip-input').value;
                const url = `http://${ip}:${robotPort}/services/reboot`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Secret ${robotSecret}`
                    }
                });
                
                if (response.ok) {
                    addLogEntry('Robot reboot command sent successfully', 'info');
                    return true;
                } else {
                    const errorText = await response.text();
                    addLogEntry(`Failed to reboot robot: ${response.status} ${errorText}`, 'error');
                    return false;
                }
            } catch (error) {
                addLogEntry(`Error sending reboot command: ${error.message}`, 'error');
                return false;
            }
        }
        
        // Add log entry
        function addLogEntry(message, level = 'info') {
            const enableLogging = document.getElementById('enable-logging').checked;
            if (!enableLogging && level !== 'error') {
                return;
            }
            
            const logContainer = document.getElementById('log-container');
            const timestamp = new Date().toLocaleTimeString();
            
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            logEntry.innerHTML = `
                <span class="log-time">[${timestamp}]</span>
                <span class="log-${level}">${message}</span>
            `;
            
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
            
            // Limit log entries to 100
            while (logContainer.children.length > 100) {
                logContainer.removeChild(logContainer.firstChild);
            }
        }
        
        // Clear logs
        function clearLogs() {
            document.getElementById('log-container').innerHTML = '';
            addLogEntry('Logs cleared', 'info');
        }
        
        // Resize canvases to fit their containers
        function resizeCanvases() {
            // Map canvas
            const mapContainer = document.querySelector('.map-container');
            mapCanvas.width = mapContainer.clientWidth;
            mapCanvas.height = mapContainer.clientHeight;
            
            // LiDAR canvas
            const lidarContainer = document.querySelector('.lidar-visualization');
            lidarCanvas.width = lidarContainer.clientWidth;
            lidarCanvas.height = lidarContainer.clientHeight;
            
            // Redraw
            drawMap();
            drawLidar();
        }
        
        // Poll robot status
        async function pollRobotStatus() {
            if (!robotState.connected) {
                return;
            }
            
            // Get maps list if not already loaded
            const mapSelect = document.getElementById('map-select');
            if (mapSelect.children.length <= 1) {
                getMaps();
            }
            
            // Process tasks if there are any
            processTaskQueue();
        }
        
        // Process task queue
        async function processTaskQueue() {
            if (robotState.tasks.length === 0 || robotState.state === 'moving' || robotState.state === 'mapping') {
                return;
            }
            
            // Get the first queued task
            const nextTask = robotState.tasks.find(task => task.status === 'queued');
            if (!nextTask) {
                return;
            }
            
            // Update task status
            nextTask.status = 'in_progress';
            updateTaskList();
            
            // Execute task based on type
            let result = false;
            switch (nextTask.type) {
                case 'move':
                    result = await createMoveAction(
                        nextTask.params.x,
                        nextTask.params.y,
                        nextTask.params.orientation
                    );
                    break;
                case 'elevator':
                    // Elevator tasks would be handled here
                    addLogEntry('Elevator control not implemented yet', 'warning');
                    break;
                case 'door':
                    // Door tasks would be handled here
                    addLogEntry('Door control not implemented yet', 'warning');
                    break;
                case 'wait':
                    // Wait task
                    addLogEntry(`Waiting for ${nextTask.params.waitTime} seconds`, 'info');
                    await new Promise(resolve => setTimeout(resolve, nextTask.params.waitTime * 1000));
                    result = { success: true };
                    break;
                case 'charge':
                    // Charge tasks would be handled here
                    addLogEntry('Charging control not implemented yet', 'warning');
                    break;
            }
            
            // Update task status based on result
            if (result && result.success) {
                nextTask.status = 'completed';
                addLogEntry(`Task ${nextTask.type} completed successfully`, 'info');
            } else {
                nextTask.status = 'failed';
                addLogEntry(`Task ${nextTask.type} failed: ${result ? result.error : 'Unknown error'}`, 'error');
            }
            
            updateTaskList();
        }
        
        // Load settings and initialize
        loadSettings();
        init();
    </script>
</body>
</html>"""

def print_banner():
    """Print installer banner"""
    print("=" * 60)
    print("Robot AI Installer")
    print("=" * 60)
    print("This script will set up a web-based robot control dashboard.")
    print("Version: 1.0.0")
    print("=" * 60)

def create_dashboard_file():
    """Create the dashboard HTML file"""
    logger.info("Creating dashboard file")
    
    try:
        # Create installation directory
        os.makedirs(INSTALL_DIR, exist_ok=True)
        
        # Save the dashboard HTML
        dashboard_path = os.path.join(INSTALL_DIR, "dashboard.html")
        with open(dashboard_path, "w", encoding="utf-8") as f:
            f.write(DASHBOARD_HTML)
        
        logger.info(f"Dashboard saved to: {dashboard_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to create dashboard file: {e}")
        
        # Try using a temporary directory instead
        try:
            temp_dir = tempfile.mkdtemp(prefix="robot-ai-")
            dashboard_path = os.path.join(temp_dir, "dashboard.html")
            with open(dashboard_path, "w", encoding="utf-8") as f:
                f.write(DASHBOARD_HTML)
            
            logger.info(f"Dashboard saved to temporary location: {dashboard_path}")
            return dashboard_path
        except Exception as e2:
            logger.error(f"Failed to create dashboard in temp directory: {e2}")
            return False

class DashboardHandler(SimpleHTTPRequestHandler):
    """HTTP request handler that serves the dashboard"""
    
    def __init__(self, *args, **kwargs):
        self.dashboard_path = kwargs.pop("dashboard_path", None)
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """Handle GET requests"""
        if self.path == '/' or self.path == '/index.html':
            self.path = '/dashboard.html'
        
        # Use parent's implementation
        return SimpleHTTPRequestHandler.do_GET(self)

def start_dashboard_server():
    """Start a web server to serve the dashboard"""
    logger.info(f"Starting dashboard server on port {WEB_PORT}")
    
    try:
        # Change directory to INSTALL_DIR if it exists, otherwise use current directory
        if os.path.exists(INSTALL_DIR):
            os.chdir(INSTALL_DIR)
        
        # Create server
        httpd = HTTPServer(("", WEB_PORT), DashboardHandler)
        
        # Run server in a separate thread
        server_thread = threading.Thread(target=httpd.serve_forever)
        server_thread.daemon = True
        server_thread.start()
        
        logger.info(f"Dashboard server started at: http://localhost:{WEB_PORT}/dashboard.html")
        return httpd
    except Exception as e:
        logger.error(f"Failed to start dashboard server: {e}")
        return None

def open_dashboard_in_browser():
    """Open the dashboard in a web browser"""
    logger.info("Opening dashboard in web browser")
    
    try:
        url = f"http://localhost:{WEB_PORT}/dashboard.html"
        webbrowser.open(url)
        logger.info(f"Dashboard opened in browser at: {url}")
        return True
    except Exception as e:
        logger.error(f"Failed to open dashboard in browser: {e}")
        logger.info(f"Please open this URL manually: http://localhost:{WEB_PORT}/dashboard.html")
        return False

def main():
    """Main installer function"""
    print_banner()
    
    # Create dashboard file
    result = create_dashboard_file()
    if not result:
        logger.error("Failed to create dashboard. Installation aborted.")
        return False
    
    # Start dashboard server
    server = start_dashboard_server()
    if not server:
        logger.error("Failed to start dashboard server. Installation aborted.")
        return False
    
    # Open dashboard in browser
    open_dashboard_in_browser()
    
    print("\nInstallation completed successfully!")
    print(f"Dashboard is now available at: http://localhost:{WEB_PORT}/dashboard.html")
    print("\nPress Ctrl+C to stop the server and exit")
    
    try:
        # Keep the script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down server...")
        server.shutdown()
        print("Server stopped. Goodbye!")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nInstallation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unhandled exception: {e}")
        sys.exit(1)