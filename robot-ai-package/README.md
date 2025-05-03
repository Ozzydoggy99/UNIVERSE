# Robot AI Package

## Overview
The Robot AI Package enhances your robot with advanced autonomous capabilities including:
- Map visualization and management
- Intelligent robot movement and navigation
- Elevator operations
- Door access control
- Live camera integration
- Task queue management
- Web-based dashboard interface

Version: 1.0.0

## Installation Methods

### Method 1: Web Dashboard Approach (Recommended)
The simplest approach is to use the web dashboard, which requires no installation:

1. Download the `dashboard.html` file to your computer
2. Open this file in your web browser
3. Enter your robot's IP address (default: 192.168.4.31)
4. Click "Connect"

The web dashboard will connect directly to your robot's API and provide full control capabilities.

### Method 2: Manual Installation (Advanced)
If you have direct access to your robot's file system, you can install the complete package:

1. Copy the entire package to your robot
2. Run the installation script:
   ```
   python3 install.py
   ```
3. Access the dashboard at: http://localhost:8080/dashboard.html

## Modules

### Core Module
The main module that manages robot control and coordinates all other modules.
- Robot movement and navigation
- WebSocket connection management
- State tracking and monitoring

### Camera Module
Provides enhanced camera functionality for your robot.
- Live video streaming
- Camera feed processing
- Multi-camera support

### Map Module
Manages map visualization and navigation features.
- Map loading and rendering
- Position tracking
- Path planning visualization

### Door Module
Enables automatic door control.
- Door detection
- ESP-NOW communication with door controllers
- Automatic door opening along planned routes

### Elevator Module
Provides multi-floor navigation capabilities.
- Elevator detection and control
- Floor selection
- Automatic entry and exit

### Task Queue Module
Manages sequences of robot tasks.
- FIFO task queue
- Task prioritization
- Scheduled operations

## Usage

### Robot Connection
To connect to your robot, ensure you know its IP address and have the secret key.
The default connection settings are:
- Robot IP: 192.168.4.31
- Robot Port: 8090

### Moving the Robot
The web dashboard provides intuitive controls for robot movement:
1. Load a map using the "Maps" dropdown
2. Set an initial pose if needed
3. Use the "Movement Controls" section to specify coordinates
4. Click "Move to Position"

### Camera Control
Control and view live feeds from the robot's cameras:
1. Select the camera source (front, back, or depth)
2. Adjust quality and frame rate settings
3. Enable auto-refresh for continuous updates

### LiDAR Visualization
View and control the LiDAR visualization:
1. Adjust the display range and point size
2. Toggle obstacle and intensity visualization
3. Use the refresh button to update the visualization

### Task Management
Create and manage sequences of tasks:
1. Select a task type (move, elevator, door, wait, charge)
2. Enter the required parameters for the selected task
3. Click "Add Task" to add to the queue
4. Tasks will be executed in sequence

## Troubleshooting

### Connection Issues
- Verify the robot is powered on and connected to the network
- Check that you're using the correct IP address and port
- Ensure you have the correct robot secret key

### Movement Problems
- Check if the robot is in automatic control mode
- Verify that a map has been loaded
- Ensure the target position is within the accessible area of the map

### Camera Feed Issues
- Try refreshing the camera feed
- Reduce the quality setting if the connection is slow
- Try switching to a different camera

## Support
For assistance with the Robot AI Package, please contact support.