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
  
  // ALWAYS use the physical robot data for the AxBot 5000 Pro
  let status;
  if (serialNumber === 'AX923701583RT') {
    // Use the data from the physical robot, but keep the AxBot model information
    const physicalRobotData = demoRobotStatus['L382502104987ir'];
    if (physicalRobotData) {
      status = {
        ...physicalRobotData,
        model: "AxBot 5000 Pro",
        serialNumber: 'AX923701583RT',
        lastUpdate: new Date().toISOString()
      };
    }
  } else {
    status = demoRobotStatus[serialNumber];
  }
  
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
  
  // Use live data for AxBot 5000 Pro
  let position;
  if (serialNumber === 'AX923701583RT') {
    // Use the data from the physical robot
    const physicalRobotData = demoRobotPositions['L382502104987ir'];
    if (physicalRobotData) {
      position = {
        ...physicalRobotData,
        timestamp: new Date().toISOString()
      };
    }
  } else {
    position = demoRobotPositions[serialNumber];
  }
  
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
  
  // Use live data for AxBot 5000 Pro
  let sensors;
  if (serialNumber === 'AX923701583RT') {
    // Use the data from the physical robot
    const physicalRobotData = demoRobotSensors['L382502104987ir'];
    if (physicalRobotData) {
      sensors = {
        ...physicalRobotData,
        // Only change battery to match the AxBot's battery level
        battery: demoRobotStatus['AX923701583RT']?.battery || physicalRobotData.battery,
        timestamp: new Date().toISOString()
      };
    }
  } else {
    sensors = demoRobotSensors[serialNumber];
  }
  
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
  
  // Use live data for AxBot 5000 Pro
  let map;
  if (serialNumber === 'AX923701583RT') {
    // Use the data from the physical robot
    const physicalRobotMap = demoMapData['L382502104987ir'];
    if (physicalRobotMap) {
      map = physicalRobotMap;
    }
  } else {
    map = demoMapData[serialNumber];
  }
  
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
  
  // Always use the real live camera feed for AxBot 5000 Pro
  let camera;
  if (serialNumber === 'AX923701583RT') {
    // Use the real physical robot's camera feed with AxBot's resolution
    const physicalRobotCamera = demoCameraData['L382502104987ir'];
    if (physicalRobotCamera) {
      camera = {
        enabled: true,
        streamUrl: 'http://47.180.91.99:8080/stream', // Physical robot's stream
        resolution: {
          width: 1920,  // Higher resolution for AxBot 5000 Pro
          height: 1080
        },
        rotation: 0,
        nightVision: true,
        timestamp: new Date().toISOString()
      };
    }
  } else {
    camera = demoCameraData[serialNumber];
  }
  
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
  
  // Special handling for AxBot 5000 Pro - always use real robot data
  if (serialNumber === 'AX923701583RT') {
    // Always use the physical robot camera feed for AxBot 5000 Pro
    const camera = {
      enabled: enabled !== undefined ? enabled : true,
      streamUrl: 'http://47.180.91.99:8080/stream', // Always use the physical robot's stream
      resolution: {
        width: 1920,
        height: 1080
      },
      rotation: 0,
      nightVision: true,
      timestamp: new Date().toISOString()
    };
    
    // Update the camera data
    demoCameraData[serialNumber] = camera;
    
    // Send the camera data
    ws.send(JSON.stringify({
      type: 'camera',
      data: camera
    }));
    console.log('Set live camera for AxBot 5000 Pro:', serialNumber);
    
    // Broadcast to all other connected clients if we have them
    if (connectedClients) {
      broadcastRobotUpdate(
        connectedClients.filter(client => client !== ws),
        'camera',
        serialNumber,
        camera
      );
    }
    return;
  }
  
  // Standard handling for other robots
  const camera = demoCameraData[serialNumber];
  if (camera) {
    camera.enabled = enabled !== undefined ? enabled : !camera.enabled;
    camera.timestamp = new Date().toISOString();
    
    // Update stream URL based on enabled state
    if (camera.enabled && !camera.streamUrl) {
      // Use the real robot IP for either physical robot
      if (serialNumber === 'L382502104987ir' || serialNumber === 'L382502104988is') {
        camera.streamUrl = 'http://47.180.91.99:8080/stream'; // Always use port-forwarded URL
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