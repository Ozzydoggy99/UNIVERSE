# Robot AI Package

## Overview

The Robot AI Package enhances your robot with advanced local intelligence capabilities, reducing latency and improving reliability by running AI components directly on the robot hardware.

## Features

- **IoT Integration**: Seamless communication with doors, elevators, and other devices using ESP-NOW protocol
- **Elevator Control**: Advanced multi-floor navigation with automatic elevator summoning
- **Local Processing**: Reduced latency for critical operations
- **Failover Protection**: Continue operation during network outages
- **Resource Optimization**: Efficient use of robot CPU and memory
- **Central Management**: Maintains connection to central management platform
- **Package Management**: Integration with robot's built-in App Store

## Installation Options

### Using Installer Script (Recommended)

The easiest way to install is using the provided installer script:

```bash
./robot-ai-installer.sh [OPTIONS]
```

Available options:
- `--test`: Run in test mode without making actual changes
- `--with-iot`: Install IoT integration for doors and other devices
- `--with-elevator`: Install elevator control module
- `--with-door`: Install auto door module
- `--from-app-store`: Install using the robot's built-in App Store (when available)

### Using Robot App Store

The Robot AI Package can also be installed using the robot's App Store API:

1. Refresh the package list:
```bash
curl -X POST http://<ROBOT_IP>:8090/app_store/services/refresh_store
```

2. Download the Robot AI package:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"packages": ["robot_ai"]}' \
  http://<ROBOT_IP>:8090/app_store/services/download_packages
```

3. Install the downloaded package:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"packages": ["robot_ai"]}' \
  http://<ROBOT_IP>:8090/app_store/services/install_packages
```

## Configuration

After installation, the Robot AI configuration file is located at:
```
/etc/robot-ai/config.json
```

You can modify this file to change settings such as:
- Server connection details
- Module settings
- Resource limits
- Logging configuration

## Checking Status

Check if the Robot AI service is running:
```bash
systemctl status robot-ai
```

View logs:
```bash
tail -f /var/log/robot-ai.log
```

Access the web interface:
```
http://<ROBOT_IP>:8090/robot-ai/
```

## Troubleshooting

If you encounter any issues:

1. Check the logs for errors:
```bash
tail -f /var/log/robot-ai.log
```

2. Restart the service:
```bash
systemctl restart robot-ai
```

3. Check resource usage:
```bash
top -p $(pgrep -f robot-ai-node.py)
```

4. If necessary, follow the factory reset procedure in:
```
/etc/robot-ai/FACTORY_RESET_GUIDE.md
```

## Uninstalling

To uninstall the Robot AI package:
```bash
/opt/robot-ai/uninstall.sh
```

## Compatibility

- Works with AX robot firmware version 2.5.0 and above
- Requires developer mode for full functionality
- Compatible with all IoT devices using ESP-NOW protocol
- Supports all elevator models in the compatibility list