# Universal Robot Management Interface

An advanced robot management platform designed for real-time control, monitoring, and task assignment of autonomous housekeeping robots using live local APIs.

## Features

- TypeScript for robust backend routing and API management
- Comprehensive demo mode with fallback data handling
- Dynamic robot control and status monitoring endpoints
- Advanced error handling and authentication mechanisms
- Flexible storage and retrieval of robot and game state
- WebSocket integration for real-time robot communication
- Multi-robot coordination for optimized task management
- Elevator integration for multi-floor navigation

## Connecting Your Robot

This platform provides two methods to connect your physical robot to the admin interface:

### Method 1: REST API

Use the provided `robot-client.js` script as a starting point. This example demonstrates how to:

1. Register your robot with the system
2. Send status updates (battery, operational status)
3. Send position updates (coordinates, orientation)
4. Send sensor data (temperature, proximity, etc.)
5. Retrieve task assignments

To use:

```bash
# Install required dependencies
npm install axios

# Configure your robot details in the script
# Edit ROBOT_CONFIG in robot-client.js

# Run the client
node robot-client.js
```

### Method 2: WebSocket (Recommended)

For more efficient real-time communication, use the WebSocket interface with the provided `robot-ws-client.js` script. This method:

1. Maintains a persistent connection for efficiency
2. Reduces latency for real-time updates
3. Enables bidirectional communication
4. Automatically handles reconnection

To use:

```bash
# Install required dependencies
npm install ws

# Configure your robot details in the script
# Edit ROBOT_CONFIG in robot-ws-client.js

# Run the client
node robot-ws-client.js
```

## API Documentation

### Robot Registration Endpoint

```
POST /api/robots/register
```

Request body:
```json
{
  "serialNumber": "YOUR_ROBOT_SERIAL",
  "model": "YOUR_ROBOT_MODEL",
  "templateId": 1  // Optional: ID of template to assign
}
```

### Status Update Endpoint

```
POST /api/robots/status/:serialNumber
```

Request body:
```json
{
  "battery": 85,
  "status": "active",
  "mode": "autonomous"
}
```

### Position Update Endpoint

```
POST /api/robots/position/:serialNumber
```

Request body:
```json
{
  "x": 120,
  "y": 80,
  "z": 0,
  "orientation": 90,
  "speed": 0.5
}
```

### Sensor Update Endpoint

```
POST /api/robots/sensors/:serialNumber
```

Request body:
```json
{
  "temperature": 22.5,
  "humidity": 45,
  "proximity": [100, 120, 80, 90],
  "battery": 85
}
```

## WebSocket Communication Protocol

### Connection

Connect to: `ws://your-server-url/ws/robot`

### Messages

#### Registration
```json
{
  "type": "register",
  "serialNumber": "YOUR_ROBOT_SERIAL",
  "model": "YOUR_ROBOT_MODEL"
}
```

#### Status Update
```json
{
  "type": "status_update",
  "status": {
    "battery": 85,
    "status": "active",
    "mode": "autonomous"
  }
}
```

#### Position Update
```json
{
  "type": "position_update",
  "position": {
    "x": 120,
    "y": 80,
    "z": 0,
    "orientation": 90,
    "speed": 0.5
  }
}
```

#### Sensor Update
```json
{
  "type": "sensor_update",
  "sensors": {
    "temperature": 22.5,
    "humidity": 45,
    "proximity": [100, 120, 80, 90],
    "battery": 85
  }
}
```

#### Task Request
```json
{
  "type": "get_task"
}
```

## Integration with Elevator Systems

The platform includes WebSocket endpoints for elevator integration:

```
ws://your-server-url/ws/elevator
```

This allows robots to:
- Request elevator access
- Update elevator status
- Manage queue position
- Load appropriate maps when changing floors