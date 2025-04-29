import { WebSocket } from 'ws';
import { demoCameraData } from './robot-api';

/**
 * Process camera-related WebSocket messages
 * This function will handle all camera-related WebSocket requests
 */
export function processCameraWebSocketMessage(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  // Camera data request
  if (data.type === 'get_robot_camera' && data.serialNumber) {
    console.log('Camera data requested for robot:', data.serialNumber);
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      console.log('Sent camera data for robot:', data.serialNumber);
      return true; // Message was processed
    } else {
      // Create default camera data for this robot
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
      demoCameraData[data.serialNumber] = newCameraData;
      
      // Send the new camera data
      ws.send(JSON.stringify({
        type: 'camera',
        data: newCameraData
      }));
      console.log('Created and sent new camera data for robot:', data.serialNumber);
      return true; // Message was processed
    }
  }
  
  // Toggle camera enabled state
  else if (data.type === 'toggle_robot_camera' && data.serialNumber) {
    console.log('Toggle camera requested for robot:', data.serialNumber, 'enabled:', data.enabled);
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      camera.enabled = data.enabled !== undefined ? data.enabled : !camera.enabled;
      camera.timestamp = new Date().toISOString();
      
      // Update stream URL based on enabled state
      if (camera.enabled && !camera.streamUrl) {
        camera.streamUrl = 'https://example.com/robot-stream-' + data.serialNumber + '.jpg';
      } else if (!camera.enabled) {
        camera.streamUrl = '';
      }
      
      // Send updated camera data back
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      console.log('Toggled camera for robot:', data.serialNumber, 'to:', camera.enabled);
      
      // Broadcast to all other connected clients
      broadcastRobotUpdate(
        connectedClients.filter(client => client !== ws),
        'camera',
        data.serialNumber,
        camera
      );
      return true; // Message was processed
    } else {
      sendError(ws, `No camera data for robot ${data.serialNumber}`);
      return true; // Message was processed
    }
  }
  
  // Not a camera-related message
  return false;
}

// Helper function to send error message
function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({
    type: 'error',
    message: message
  }));
}

// Helper function to broadcast robot updates to connected clients
function broadcastRobotUpdate(connectedClients: WebSocket[], updateType: string, serialNumber: string, data: any) {
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: updateType,
        data: data
      }));
    }
  });
}