import WebSocket from 'ws';
import { demoCameraData } from './robot-api';

/**
 * Process camera-related WebSocket messages
 * This function will handle all camera-related WebSocket requests
 */
export function processCameraWebSocketMessage(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (data.type === 'get_robot_camera' && data.serialNumber) {
    console.log('Camera data requested for robot:', data.serialNumber);
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      console.log('Sent camera data for robot:', data.serialNumber);
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
      demoCameraData[data.serialNumber] = newCameraData;
      
      // Send the new camera data
      ws.send(JSON.stringify({
        type: 'camera',
        data: newCameraData
      }));
      console.log('Created and sent new camera data for robot:', data.serialNumber);
    }
  }
  else if (data.type === 'toggle_robot_camera' && data.serialNumber) {
    console.log('Toggle camera requested for robot:', data.serialNumber, 'enabled:', data.enabled);
    const camera = demoCameraData[data.serialNumber];
    if (camera) {
      camera.enabled = data.enabled !== undefined ? data.enabled : !camera.enabled;
      camera.timestamp = new Date().toISOString();
      
      // Update stream URL based on enabled state
      if (camera.enabled && !camera.streamUrl) {
        // Set appropriate stream URL based on robot serial number
        if (data.serialNumber === 'L382502104988is') {
          // Local robot
          camera.streamUrl = 'http://192.168.4.32:8080';
          
          // Send message to enable video topic
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'enable_topic',
              topic: '/rgb_cameras/front/video'
            }));
            console.log('Enabling front camera video topic for local robot');
          }
        } else if (data.serialNumber === 'L382502104987ir') {
          // Public accessible robot
          camera.streamUrl = 'https://8f50-47-180-91-99.ngrok-free.app';
          
          // Send message to enable video topic
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'enable_topic',
              topic: '/rgb_cameras/front/video'
            }));
            console.log('Enabling front camera video topic for public robot:', data.serialNumber);
          }
        } else if (data.serialNumber === 'AX923701583RT') {
          // AxBot 5000 Pro robot is removed as per user request
          camera.streamUrl = '';
        } else {
          camera.streamUrl = 'https://example.com/robot-stream-' + data.serialNumber + '.jpg';
        }
      } else if (!camera.enabled) {
        camera.streamUrl = '';
      }
      
      // Send updated camera data back
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      console.log('Toggled camera for robot:', data.serialNumber, 'to:', camera.enabled);
      
      // Broadcast to all other connected clients if we have them
      broadcastRobotUpdate(
        connectedClients.filter(client => client !== ws),
        'camera',
        data.serialNumber,
        camera
      );
    } else {
      sendError(ws, `No camera data for robot ${data.serialNumber}`);
    }
  }
}

function sendError(ws: WebSocket, message: string) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'error',
      message
    }));
  }
}

function broadcastRobotUpdate(clients: WebSocket[], updateType: string, serialNumber: string, data: any) {
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