import WebSocket from 'ws';

// Only support our single physical robot
const PHYSICAL_ROBOT_SERIAL = 'L382502104987ir';
const ROBOT_API_URL = 'http://8f50-47-180-91-99.ngrok-free.app';

/**
 * Process camera-related WebSocket messages
 * This function will handle all camera-related WebSocket requests
 */
export function processCameraWebSocketMessage(data: any, ws: WebSocket, connectedClients: WebSocket[]) {
  if (data.type === 'get_robot_camera' && data.serialNumber) {
    console.log('Camera data requested for robot:', data.serialNumber);
    
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      sendError(ws, `Camera not available for robot ${data.serialNumber}`);
      return;
    }
    
    // Create camera data with live information
    const cameraData = {
      enabled: true,
      streamUrl: `${ROBOT_API_URL}/robot-camera/${data.serialNumber}`,
      resolution: {
        width: 1280,
        height: 720
      },
      rotation: 0,
      nightVision: true,
      timestamp: new Date().toISOString()
    };
    
    // Send data back to the client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: cameraData
      }));
      console.log('Sent camera data for robot:', data.serialNumber);
    }
    
    // Also broadcast to all connected clients
    broadcastRobotUpdate(connectedClients, 'camera', data.serialNumber, cameraData);
  }
  else if (data.type === 'toggle_robot_camera' && data.serialNumber) {
    console.log('Toggle camera requested for robot:', data.serialNumber, 'enabled:', data.enabled);
    
    // Only support our physical robot
    if (data.serialNumber !== PHYSICAL_ROBOT_SERIAL) {
      sendError(ws, `Camera not available for robot ${data.serialNumber}`);
      return;
    }
    
    // Create camera data with the updated state
    const cameraData = {
      enabled: data.enabled !== undefined ? data.enabled : true,
      streamUrl: data.enabled === false ? '' : `${ROBOT_API_URL}/robot-camera/${data.serialNumber}`,
      resolution: {
        width: 1280,
        height: 720
      },
      rotation: 0,
      nightVision: true,
      timestamp: new Date().toISOString()
    };
    
    // Here you would actually send a command to the robot to enable/disable the camera
    // For now, we just pretend we did and return the updated state
    
    // Send updated camera data back to the client
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'camera',
        data: cameraData
      }));
      console.log('Toggled camera for robot:', data.serialNumber, 'to:', cameraData.enabled);
    }
    
    // Also broadcast to all other connected clients
    broadcastRobotUpdate(
      connectedClients.filter(client => client !== ws),
      'camera',
      data.serialNumber,
      cameraData
    );
    
    // If camera is enabled, try to enable the video topic on the robot
    if (cameraData.enabled) {
      try {
        // Send message to enable video topic
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'enable_topic',
            topic: '/rgb_cameras/front/video'
          }));
          console.log('Enabling front camera video topic for robot:', data.serialNumber);
        }
      } catch (error) {
        console.error('Error enabling camera topic:', error);
      }
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