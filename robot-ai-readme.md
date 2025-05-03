# Robot AI Package

A comprehensive AI package designed to enhance your robot's capabilities with advanced automation, multi-floor navigation, camera integration, and more.

## Features

### Core Functions
- **Complete Robot Control**: Full control over robot movement, mapping, and navigation
- **Real-time Map Visualization**: Advanced map visualization with overlays for walls, doors, and regions
- **Live Camera Streaming**: Real-time camera feed access and processing
- **Multi-floor Navigation**: Seamless elevator integration for navigating between floors
- **Automatic Door Control**: Integrated door detection and control for seamless navigation
- **Task Queue Management**: FIFO queue system for managing multiple robot tasks

### Integration Capabilities
- **ESP-NOW Protocol**: Communication with IoT devices including doors and elevators
- **WebSocket Integration**: Real-time data streaming from robot sensors
- **Camera Feed Processing**: Access and process camera data with visual annotations
- **App Store Integration**: Access to additional modules through the robot app store

### Advanced Features
- **LiDAR Visualization**: Real-time visualization of LiDAR point cloud data
- **Elevator Control**: Complete multi-floor navigation with elevator communication
- **Cargo Handling**: Support for jack up/down operations for cargo handling
- **Path Planning**: Advanced route planning and obstacle avoidance
- **Service Health Monitoring**: Proactive monitoring of critical robot services

## Installation

### Prerequisites
- Robot running supported firmware
- Python 3.7 or higher
- Network connectivity to the robot

### Installation Steps

1. Download the installer script:
```
wget https://example.com/robot-ai-installer.sh
```

2. Make the script executable:
```
chmod +x robot-ai-installer.sh
```

3. Run the installer with your robot's details:
```
sudo ./robot-ai-installer.sh --robot-ip 192.168.25.25 --robot-sn L382502104987ir
```

### Command Line Options
- `--robot-ip IP`: Robot IP address (default: 192.168.25.25)
- `--robot-port PORT`: Robot port (default: 8090)
- `--robot-sn SN`: Robot serial number
- `--install-dir DIR`: Installation directory (default: /opt/robot-ai)
- `--dev-mode`: Enable developer mode
- `--component COMP`: Install specific component (core,map,camera,elevator,door,tasks)
- `--help`: Show help message

## Module Documentation

### Core Module
The central control system that coordinates all other modules.

```python
# Example usage
from robot_ai_core import RobotAI

# Initialize with robot IP
robot = RobotAI(robot_ip="192.168.25.25")

# Connect to robot
await robot.connect()

# Control robot movement
await robot.create_move_action(target_x=1.5, target_y=2.0)
```

### Map Visualization
Provides advanced map visualization capabilities including overlays for walls, doors, and navigable regions.

```python
# Example usage
from robot_ai_map_visualizer import MapVisualizer

# Initialize with robot IP
visualizer = MapVisualizer(robot_ip="192.168.25.25")

# Fetch current map
await visualizer.fetch_current_map()

# Render map with overlays
map_image = visualizer.render_map_with_overlays(
    include_robot=True, 
    include_path=True, 
    include_point_cloud=True
)
```

### Camera Module
Provides access to the robot's cameras with real-time streaming and image processing.

```python
# Example usage
from robot_ai_camera_module import CameraModule, CameraType, CameraFormat

# Initialize with robot IP
camera = CameraModule(robot_ip="192.168.25.25")

# Start front camera stream
await camera.start_camera_stream(CameraType.FRONT, CameraFormat.JPEG)

# Capture a frame
frame = camera.capture_frame(CameraType.FRONT)
```

### Elevator Controller
Manages multi-floor navigation using elevators.

```python
# Example usage
from robot_ai_elevator_controller import ElevatorController

# Initialize with robot IP and SN
controller = ElevatorController(
    robot_ip="192.168.25.25",
    robot_sn="L382502104987ir"
)

# Register an elevator
controller.register_elevator(
    elevator_id="main_elevator",
    mac_address="30:AE:A4:1F:38:B1",
    floors=[1, 2, 3, 4, 5],
    location={...},  # Floor-specific locations
    waiting_points={...},  # Floor-specific waiting points
    orientation={...}  # Floor-specific orientations
)

# Navigate to a different floor
await controller.navigate_to_floor("main_elevator", target_floor=3)
```

### Door Controller
Handles automatic door control for seamless navigation.

```python
# Example usage
from robot_ai_door_module import DoorController

# Initialize with robot IP and SN
controller = DoorController(
    robot_ip="192.168.25.25",
    robot_sn="L382502104987ir"
)

# Register a door
controller.register_door(
    door_id="main_entrance",
    mac_address="30:AE:A4:1F:38:C2",
    polygon=[...]  # Door position polygon
)

# Request a door to open
await controller.request_door_open("main_entrance")
```

### Task Queue Manager
Provides a FIFO queue system for managing robot tasks.

```python
# Example usage
from robot_ai_task_queue import TaskQueueManager, TaskType, TaskPriority

# Initialize with robot IP
manager = TaskQueueManager(robot_ip="192.168.25.25")

# Create a move task
task_id = await manager.create_task(
    task_type=TaskType.MOVE,
    params={
        "target_x": 1.0,
        "target_y": 2.0
    },
    priority=TaskPriority.NORMAL
)

# Get task status
status = manager.get_task_status(task_id)
```

## WebSocket Topics

The Robot AI package supports subscribing to various WebSocket topics for real-time data:

### Robot Status Topics
- `/tracked_pose`: Current robot position and orientation
- `/battery_state`: Battery status including charge level
- `/planning_state`: Current movement state and action
- `/wheel_state`: Wheel control mode and emergency stop status
- `/slam/state`: Position reliability and quality
- `/alerts`: System alerts and warnings

### Sensor Data Topics
- `/scan_matched_points2`: LiDAR point cloud data
- `/map`: Current map data
- `/maps/5cm/1hz`: Low-resolution obstacle map
- `/maps/1cm/1hz`: High-resolution obstacle map
- `/detailed_battery_state`: Advanced battery diagnostics
- `/jack_state`: Jack device state and position

### Camera Topics
- `/rgb_cameras/front/video`: Front camera H264 video stream
- `/rgb_cameras/back/video`: Back camera H264 video stream
- `/rgb_cameras/front/compressed`: Front camera JPEG images
- `/rgb_cameras/back/compressed`: Back camera JPEG images
- `/depth_camera/downward/image`: Depth camera images

## Troubleshooting

### Connection Issues
- Ensure the robot is powered on and connected to the network
- Verify the correct IP address is being used
- Check that the robot's API is accessible at `http://<robot-ip>:8090/device_info`

### Module Errors
- Check the log files in the installation directory's `logs` folder
- Ensure all required dependencies are installed
- Verify the robot has the necessary permissions to perform requested actions

### Camera Stream Problems
- Ensure the camera is available and not in use by another process
- Try switching to a different camera format (H264 vs JPEG)
- Check network bandwidth for streaming capabilities

### Elevator Navigation Issues
- Verify the elevator's MAC address is correct
- Ensure the robot has permission to control the elevator
- Check that elevator floor positions are correctly defined

## API Reference

For detailed API documentation, see the module-specific documentation files:
- [Core Module API](docs/core-api.md)
- [Map Visualization API](docs/map-api.md)
- [Camera Module API](docs/camera-api.md)
- [Elevator Controller API](docs/elevator-api.md)
- [Door Controller API](docs/door-api.md)
- [Task Queue API](docs/task-api.md)

## License

This software is provided for use with compatible robots only. All rights reserved.

## Support

For support, please contact the robot manufacturer or authorized support channels.