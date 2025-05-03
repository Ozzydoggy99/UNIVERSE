# Robot AI Package

## Overview

The Robot AI Package is an advanced enhancement system for your robot, bringing intelligent, autonomous capabilities that improve navigation, map visualization, obstacle avoidance, multi-floor operations, and much more.

**Version:** 1.0.0  
**Author:** AI Assistant

## Features

- **Enhanced Navigation** - Smarter path planning and obstacle avoidance
- **Real-time Map Visualization** - Advanced map rendering and interactive displays
- **Multi-Camera Support** - Live video streaming and frame processing
- **Elevator Integration** - Seamless multi-floor navigation
- **Door Control** - Automatic door detection and control via ESP-NOW
- **Task Queue System** - Prioritized FIFO task management
- **Self-Update Mechanism** - Automatic updates and maintenance

## System Requirements

- Robot with ROS-based control system
- Python 3.6 or higher
- Network connectivity to the robot
- At least 100MB of free disk space
- 256MB of RAM

## Installation

### Standard Installation

1. Download the Robot AI Package zip file
2. Extract the contents to a temporary directory
3. Run the installation script:

```bash
cd robot-ai-package
python3 install.py --robot-ip YOUR_ROBOT_IP --robot-sn YOUR_ROBOT_SERIAL
```

### Development Mode Installation

For development or testing without system-wide installation:

```bash
python3 install.py --robot-ip YOUR_ROBOT_IP --robot-sn YOUR_ROBOT_SERIAL --dev-mode
```

### Installation Options

The installer supports several command-line options:

- `--robot-ip` - Specify the robot's IP address (default: 127.0.0.1)
- `--robot-port` - Specify the robot's port (default: 8090)
- `--robot-sn` - Specify the robot's serial number
- `--use-ssl` - Enable SSL for connections to the robot
- `--no-systemd` - Skip installing as a systemd service
- `--dev-mode` - Install in development mode (local directory, no systemd)
- `--uninstall` - Uninstall the Robot AI Package

## Usage

After installation, the Robot AI system will automatically start. It connects to your robot and enhances its capabilities without requiring any changes to existing robot software.

### Web Interface

The Robot AI provides a web interface accessible at:

```
http://<robot-ip>:8080
```

### Monitoring

To check the status of the Robot AI service:

```bash
sudo systemctl status robot-ai
```

### Log Files

Log files are stored in the `/var/log/robot-ai/` directory and can be viewed with:

```bash
cat /var/log/robot-ai/robot-ai.log
```

## Features in Detail

### Enhanced Navigation

The Robot AI improves path planning by analyzing the current map and avoiding obstacles more efficiently. It implements:

- A* path planning with smoothing
- Dynamic obstacle avoidance
- Optimized waypoint reduction

### Map Visualization

Advanced map processing enhances the visualization of maps with:

- High-resolution rendering
- LiDAR data overlay
- Path visualization
- Robot position tracking

### Camera Integration

The camera module provides:

- Real-time video streaming
- Frame capture and processing
- Multi-camera support
- Frame annotation capabilities

### Elevator Integration

For multi-floor navigation, the elevator controller handles:

- Moving to and waiting for elevators
- Automatic floor detection
- ESP-NOW or API-based elevator control
- Coordinated entry and exit operations

### Door Control

The door controller:

- Detects when doors are needed on the robot's path
- Communicates with doors via ESP-NOW protocol
- Automatically requests door opening when approaching

### Task Queue

The task queue system provides:

- Priority-based FIFO processing
- Task dependencies and ordering
- Task persistence across restarts
- Comprehensive task monitoring

## Configuration

Configuration files are located in `/etc/robot-ai/config.json`. You can edit this file to customize the Robot AI behavior:

```json
{
  "robot_ip": "192.168.1.100",
  "robot_port": 8090,
  "robot_sn": "L382502104987ir",
  "use_ssl": false,
  "version": "1.0.0",
  "installed_at": 1684512345.67
}
```

## Troubleshooting

### Connection Issues

If the Robot AI can't connect to your robot:

1. Verify the robot IP and port in the configuration
2. Ensure the robot is powered on and on the same network
3. Check firewall settings that might block connections
4. Verify the robot's WebSocket server is running

### Startup Problems

If the Robot AI service doesn't start:

1. Check log files in `/var/log/robot-ai/`
2. Verify the robot serial number in the configuration
3. Ensure Python and dependencies are correctly installed
4. Try starting manually: `/opt/robot-ai/start.sh`

## Uninstallation

To uninstall the Robot AI Package:

```bash
python3 install.py --uninstall
```

## License

This software is proprietary and is licensed for use only on authorized robots.

## Support

For support and assistance, please contact the robot manufacturer or authorized distributors.