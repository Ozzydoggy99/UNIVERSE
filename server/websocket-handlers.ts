import WebSocket from 'ws';
import { 
  demoRobotStatus, 
  demoRobotPositions, 
  demoRobotSensors, 
  demoMapData, 
  demoCameraData,
  demoTasks 
} from './robot-api';

/**
 * Handles WebSocket requests for robot status
 */
export function handleRobotStatusRequest(ws: WebSocket, serialNumber: string) {
  console.log('Robot status requested for', serialNumber);
  const status = demoRobotStatus[serialNumber];
  if (status) {
    ws.send(JSON.stringify({
      type: 'status',
      data: status
    }));
  } else {
    sendError(ws, `No status data for robot ${serialNumber}`);
  }
}

/**
 * Handles WebSocket requests for robot position
 */
export function handleRobotPositionRequest(ws: WebSocket, serialNumber: string) {
  console.log('Robot position requested for', serialNumber);
  const position = demoRobotPositions[serialNumber];
  if (position) {
    ws.send(JSON.stringify({
      type: 'position',
      data: position
    }));
  } else {
    sendError(ws, `No position data for robot ${serialNumber}`);
  }
}

/**
 * Handles WebSocket requests for robot sensor data
 */
export function handleRobotSensorRequest(ws: WebSocket, serialNumber: string) {
  console.log('Robot sensor data requested for', serialNumber);
  const sensors = demoRobotSensors[serialNumber];
  if (sensors) {
    ws.send(JSON.stringify({
      type: 'sensors',
      data: sensors
    }));
  } else {
    sendError(ws, `No sensor data for robot ${serialNumber}`);
  }
}

/**
 * Handles WebSocket requests for robot map data
 */
export function handleRobotMapRequest(ws: WebSocket, serialNumber: string) {
  console.log('Robot map data requested for', serialNumber);
  const map = demoMapData[serialNumber];
  if (map) {
    ws.send(JSON.stringify({
      type: 'map',
      data: map
    }));
  } else {
    sendError(ws, `No map data for robot ${serialNumber}`);
  }
}

/**
 * Handles WebSocket requests for robot camera data
 */
export function handleRobotCameraRequest(ws: WebSocket, serialNumber: string) {
  console.log('Camera data requested for robot:', serialNumber);
  const camera = demoCameraData[serialNumber];
  if (camera) {
    ws.send(JSON.stringify({
      type: 'camera',
      data: camera
    }));
    console.log('Sent camera data for robot:', serialNumber);
  } else {
    // If no camera data exists for this robot, create a default entry
    const newCameraData = {
      enabled: false,
      streamUrl: '',
      resolution: {
        width: 1280,
        height: 720
      },
      rotation: 0,
      nightVision: false,
      timestamp: new Date().toISOString()
    };
    
    // Save the new camera data
    demoCameraData[serialNumber] = newCameraData;
    
    // Send the new camera data
    ws.send(JSON.stringify({
      type: 'camera',
      data: newCameraData
    }));
    console.log('Created and sent new camera data for robot:', serialNumber);
  }
}

/**
 * Handles WebSocket requests to toggle robot camera
 */
export function handleToggleRobotCamera(ws: WebSocket, serialNumber: string, enabled?: boolean, connectedClients?: WebSocket[]) {
  console.log('Toggle camera requested for robot:', serialNumber, 'enabled:', enabled);
  const camera = demoCameraData[serialNumber];
  if (camera) {
    camera.enabled = enabled !== undefined ? enabled : !camera.enabled;
    camera.timestamp = new Date().toISOString();
    
    // Update stream URL based on enabled state
    if (camera.enabled && !camera.streamUrl) {
      // Use the real robot IP for our physical robot
      if (serialNumber === 'L382502104988is') {
        camera.streamUrl = 'http://192.168.4.32:8080/stream';
      } else {
        camera.streamUrl = 'https://example.com/robot-stream-' + serialNumber + '.jpg';
      }
    } else if (!camera.enabled) {
      camera.streamUrl = '';
    }
    
    // Send updated camera data back
    ws.send(JSON.stringify({
      type: 'camera',
      data: camera
    }));
    console.log('Toggled camera for robot:', serialNumber, 'to:', camera.enabled);
    
    // Broadcast to all other connected clients if we have them
    if (connectedClients) {
      broadcastRobotUpdate(
        connectedClients.filter(client => client !== ws),
        'camera',
        serialNumber,
        camera
      );
    }
  } else {
    sendError(ws, `No camera data for robot ${serialNumber}`);
  }
}

/**
 * Helper function to send error messages
 */
export function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message
    }));
  }
}

/**
 * Helper function to broadcast updates to all connected clients
 */
export function broadcastRobotUpdate(clients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  const update = JSON.stringify({
    type: `robot_${updateType}_update`,
    serialNumber,
    data
  });
  
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(update);
    }
  });
}