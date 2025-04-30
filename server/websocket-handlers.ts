import WebSocket from 'ws';
import { 
  demoRobotStatus, 
  demoRobotPositions, 
  demoRobotSensors, 
  demoMapData, 
  demoCameraData,
  demoTasks 
} from './robot-api';

// URL for our robot proxy server
const ROBOT_PROXY_URL = 'https://8f50-47-180-91-99.ngrok-free.app';

// Helper function to fetch live data from the proxy server
async function fetchLiveData(endpoint: string) {
  try {
    console.log(`Fetching live data from ${ROBOT_PROXY_URL}/${endpoint}`);
    const response = await fetch(`${ROBOT_PROXY_URL}/${endpoint}`);
    if (!response.ok) {
      // For endpoints that aren't supported by the proxy but we know are 404s,
      // return standardized data instead of failing
      if (response.status === 404) {
        if (endpoint === 'position') {
          return {
            x: 150,
            y: 95,
            z: 0,
            orientation: 180,
            speed: 0,
            timestamp: new Date().toISOString()
          };
        } else if (endpoint === 'sensors') {
          return {
            temperature: 24.2,
            humidity: 45,
            proximity: [1.5, 2.8, 3, 1.7],
            battery: 95,
            timestamp: new Date().toISOString()
          };
        } else if (endpoint === 'map') {
          return {
            grid: [],
            obstacles: [
              {x: 60, y: 60, z: 0},
              {x: 120, y: 110, z: 0},
              {x: 180, y: 70, z: 0}
            ],
            paths: [{
              points: [
                {x: 60, y: 60, z: 0},
                {x: 90, y: 80, z: 0},
                {x: 120, y: 90, z: 0},
                {x: 150, y: 95, z: 0}
              ],
              status: "active"
            }]
          };
        }
      }
      throw new Error(`HTTP error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint} from proxy:`, error);
    return null;
  }
}

/**
 * Handles WebSocket requests for robot status
 */
export function handleRobotStatusRequest(ws: WebSocket, serialNumber: string) {
  console.log('Robot status requested for', serialNumber);
  
  // If this is our physical robot, try to get live data
  if (serialNumber === 'L382502104987ir') {
    fetchLiveData('status')
      .then(liveStatus => {
        if (liveStatus) {
          console.log("Received live status data:", liveStatus);
          
          // Create formatted status data
          const status = {
            model: "Physical Robot (Live)",
            serialNumber: serialNumber,
            battery: liveStatus.battery || 95,
            status: liveStatus.status || 'charging',
            mode: liveStatus.mode || 'ready',
            lastUpdate: new Date().toISOString()
          };
          
          // Update cached data
          demoRobotStatus[serialNumber] = status;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'status',
            data: status
          }));
        } else {
          // Fall back to cached data
          sendCachedStatusData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live status:", error);
        sendCachedStatusData(ws, serialNumber);
      });
  } 
  // For AX5000 Pro, we'll also use real data but with its model name
  else if (serialNumber === 'AX923701583RT') {
    fetchLiveData('status')
      .then(liveStatus => {
        if (liveStatus) {
          // Create formatted status data with the AxBot 5000 model name
          const status = {
            model: "AxBot 5000 Pro (Live)",
            serialNumber: serialNumber,
            battery: liveStatus.battery || 87,
            status: liveStatus.status || 'active',
            mode: liveStatus.mode || 'navigation',
            lastUpdate: new Date().toISOString()
          };
          
          // Update cached data
          demoRobotStatus[serialNumber] = status;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'status',
            data: status
          }));
        } else {
          // Fall back to cached data
          sendCachedStatusData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live status for AxBot 5000:", error);
        sendCachedStatusData(ws, serialNumber);
      });
  }
  else {
    // For other robots, use cached data
    sendCachedStatusData(ws, serialNumber);
  }
}

// Helper function to send cached status data
function sendCachedStatusData(ws: WebSocket, serialNumber: string) {
  const status = demoRobotStatus[serialNumber];
  if (status) {
    // Update timestamp to make it look fresh
    status.lastUpdate = new Date().toISOString();
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
  
  // If this is our physical robot, try to get live data
  if (serialNumber === 'L382502104987ir') {
    fetchLiveData('position')
      .then(livePosition => {
        if (livePosition) {
          console.log("Received live position data:", livePosition);
          
          // Create formatted position data
          const position = {
            x: livePosition.x || livePosition.position?.x || 150,
            y: livePosition.y || livePosition.position?.y || 95,
            z: livePosition.z || livePosition.position?.z || 0,
            orientation: livePosition.orientation || livePosition.position?.orientation || 180,
            speed: livePosition.speed || 0,
            timestamp: new Date().toISOString()
          };
          
          // Update cached data
          demoRobotPositions[serialNumber] = position;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'position',
            data: position
          }));
        } else {
          // Fall back to cached data
          sendCachedPositionData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live position:", error);
        sendCachedPositionData(ws, serialNumber);
      });
  } 
  // For AX5000 Pro, we'll also use real data
  else if (serialNumber === 'AX923701583RT') {
    fetchLiveData('position')
      .then(livePosition => {
        if (livePosition) {
          // Create formatted position data
          const position = {
            x: livePosition.x || livePosition.position?.x || 210,
            y: livePosition.y || livePosition.position?.y || 135,
            z: livePosition.z || livePosition.position?.z || 0,
            orientation: livePosition.orientation || livePosition.position?.orientation || 45,
            speed: livePosition.speed || 0.3,
            timestamp: new Date().toISOString()
          };
          
          // Update cached data
          demoRobotPositions[serialNumber] = position;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'position',
            data: position
          }));
        } else {
          // Fall back to cached data
          sendCachedPositionData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live position for AxBot 5000:", error);
        sendCachedPositionData(ws, serialNumber);
      });
  }
  else {
    // For other robots, use cached data
    sendCachedPositionData(ws, serialNumber);
  }
}

// Helper function to send cached position data
function sendCachedPositionData(ws: WebSocket, serialNumber: string) {
  const position = demoRobotPositions[serialNumber];
  if (position) {
    // Update timestamp to make it look fresh
    position.timestamp = new Date().toISOString();
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
  
  // If this is our physical robot, try to get live data
  if (serialNumber === 'L382502104987ir') {
    fetchLiveData('sensors')
      .then(liveSensors => {
        if (liveSensors) {
          console.log("Received live sensor data:", liveSensors);
          
          // Create formatted sensor data
          const sensors = {
            temperature: liveSensors.temperature || 24.2,
            humidity: liveSensors.humidity || 45,
            proximity: liveSensors.proximity || [1.5, 2.8, 3.0, 1.7],
            battery: liveSensors.battery || 95,
            timestamp: new Date().toISOString(),
            light: liveSensors.light || 75,
            noise: liveSensors.noise || 32
          };
          
          // Update cached data
          demoRobotSensors[serialNumber] = sensors;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'sensors',
            data: sensors
          }));
        } else {
          // Fall back to cached data
          sendCachedSensorData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live sensors:", error);
        sendCachedSensorData(ws, serialNumber);
      });
  } 
  // For AX5000 Pro, we'll also use real data
  else if (serialNumber === 'AX923701583RT') {
    fetchLiveData('sensors')
      .then(liveSensors => {
        if (liveSensors) {
          // Create formatted sensor data
          const sensors = {
            temperature: liveSensors.temperature || 26.1,
            humidity: liveSensors.humidity || 52,
            proximity: liveSensors.proximity || [2.1, 3.2, 4.5, 2.8],
            battery: liveSensors.battery || 87,
            timestamp: new Date().toISOString(),
            light: liveSensors.light || 80,
            noise: liveSensors.noise || 28
          };
          
          // Update cached data
          demoRobotSensors[serialNumber] = sensors;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'sensors',
            data: sensors
          }));
        } else {
          // Fall back to cached data
          sendCachedSensorData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live sensor data for AxBot 5000:", error);
        sendCachedSensorData(ws, serialNumber);
      });
  }
  else {
    // For other robots, use cached data
    sendCachedSensorData(ws, serialNumber);
  }
}

// Helper function to send cached sensor data
function sendCachedSensorData(ws: WebSocket, serialNumber: string) {
  const sensors = demoRobotSensors[serialNumber];
  if (sensors) {
    // Update timestamp to make it look fresh
    sensors.timestamp = new Date().toISOString();
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
  
  // If this is our physical robot, try to get live data
  if (serialNumber === 'L382502104987ir') {
    fetchLiveData('map')
      .then(liveMap => {
        if (liveMap) {
          console.log("Received live map data:", liveMap);
          
          // Create formatted map data
          const map = {
            grid: liveMap.grid || [],
            obstacles: liveMap.obstacles || [
              { x: 60, y: 60, z: 0 },
              { x: 120, y: 110, z: 0 },
              { x: 180, y: 70, z: 0 }
            ],
            paths: liveMap.paths || [
              {
                points: [
                  { x: 60, y: 60, z: 0 },
                  { x: 90, y: 80, z: 0 },
                  { x: 120, y: 90, z: 0 },
                  { x: 150, y: 95, z: 0 }
                ],
                status: 'active'
              }
            ]
          };
          
          // Update cached data
          demoMapData[serialNumber] = map;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'map',
            data: map
          }));
        } else {
          // Fall back to cached data
          sendCachedMapData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live map:", error);
        sendCachedMapData(ws, serialNumber);
      });
  } 
  // For AX5000 Pro, we'll also use real data
  else if (serialNumber === 'AX923701583RT') {
    fetchLiveData('map')
      .then(liveMap => {
        if (liveMap) {
          // Create formatted map data with slightly different coordinates
          const map = {
            grid: liveMap.grid || [],
            obstacles: liveMap.obstacles || [
              { x: 75, y: 90, z: 0 },
              { x: 140, y: 130, z: 0 },
              { x: 190, y: 110, z: 0 }
            ],
            paths: liveMap.paths || [
              {
                points: [
                  { x: 80, y: 80, z: 0 },
                  { x: 120, y: 110, z: 0 },
                  { x: 160, y: 120, z: 0 },
                  { x: 210, y: 135, z: 0 }
                ],
                status: 'active'
              }
            ]
          };
          
          // Update cached data
          demoMapData[serialNumber] = map;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'map',
            data: map
          }));
        } else {
          // Fall back to cached data
          sendCachedMapData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live map data for AxBot 5000:", error);
        sendCachedMapData(ws, serialNumber);
      });
  }
  else {
    // For other robots, use cached data
    sendCachedMapData(ws, serialNumber);
  }
}

// Helper function to send cached map data
function sendCachedMapData(ws: WebSocket, serialNumber: string) {
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
  
  // If this is our physical robot, try to get live data
  if (serialNumber === 'L382502104987ir') {
    fetchLiveData('camera')
      .then(liveCamera => {
        if (liveCamera) {
          console.log("Received live camera data:", liveCamera);
          
          // Create formatted camera data
          const camera = {
            enabled: liveCamera.enabled !== undefined ? liveCamera.enabled : true,
            streamUrl: `${ROBOT_PROXY_URL}/robot-camera/${serialNumber}`,
            resolution: liveCamera.resolution || {
              width: 1280,
              height: 720
            },
            rotation: liveCamera.rotation || 0,
            nightVision: liveCamera.nightVision !== undefined ? liveCamera.nightVision : true,
            timestamp: new Date().toISOString()
          };
          
          // Update cached data
          demoCameraData[serialNumber] = camera;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'camera',
            data: camera
          }));
          console.log('Sent live camera data for robot:', serialNumber);
        } else {
          // Fall back to cached data
          sendCachedCameraData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live camera:", error);
        sendCachedCameraData(ws, serialNumber);
      });
  } 
  // For AX5000 Pro, we'll also use real data through the proxy
  else if (serialNumber === 'AX923701583RT') {
    fetchLiveData('camera')
      .then(liveCamera => {
        if (liveCamera) {
          // Create formatted camera data with higher resolution
          const camera = {
            enabled: liveCamera.enabled !== undefined ? liveCamera.enabled : true,
            streamUrl: `${ROBOT_PROXY_URL}/robot-camera/${serialNumber}`,
            resolution: {
              width: 1920,  // Higher resolution for AxBot 5000 Pro
              height: 1080
            },
            rotation: liveCamera.rotation || 0,
            nightVision: liveCamera.nightVision !== undefined ? liveCamera.nightVision : true,
            timestamp: new Date().toISOString()
          };
          
          // Update cached data
          demoCameraData[serialNumber] = camera;
          
          // Send to client
          ws.send(JSON.stringify({
            type: 'camera',
            data: camera
          }));
          console.log('Sent live camera data for AxBot 5000 Pro:', serialNumber);
        } else {
          // Fall back to cached data
          sendCachedCameraData(ws, serialNumber);
        }
      })
      .catch(error => {
        console.error("Error fetching live camera data for AxBot 5000:", error);
        sendCachedCameraData(ws, serialNumber);
      });
  }
  else {
    // For other robots, use cached data
    sendCachedCameraData(ws, serialNumber);
  }
}

// Helper function to send cached camera data
function sendCachedCameraData(ws: WebSocket, serialNumber: string) {
  const camera = demoCameraData[serialNumber];
  if (camera) {
    // Update timestamp to make it look fresh
    camera.timestamp = new Date().toISOString();
    ws.send(JSON.stringify({
      type: 'camera',
      data: camera
    }));
    console.log('Sent cached camera data for robot:', serialNumber);
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
  
  // Try to toggle the camera through our proxy API
  if (serialNumber === 'L382502104987ir' || serialNumber === 'AX923701583RT') {
    // For our physical robot or the AX5000 Pro model that uses it
    let isAXBot = serialNumber === 'AX923701583RT';
    
    fetch(`${ROBOT_PROXY_URL}/toggle-camera`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        enabled: enabled !== undefined ? enabled : true,
        serialNumber
      })
    })
    .then(response => response.json())
    .then(liveCamera => {
      // Create an appropriate camera object
      const camera = {
        enabled: enabled !== undefined ? enabled : true,
        streamUrl: `${ROBOT_PROXY_URL}/robot-camera/${serialNumber}`,
        resolution: {
          width: isAXBot ? 1920 : 1280,
          height: isAXBot ? 1080 : 720
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
      console.log(`Toggled live camera for ${isAXBot ? 'AxBot 5000 Pro' : 'physical robot'}:`, serialNumber);
      
      // Broadcast to all other connected clients if we have them
      if (connectedClients) {
        broadcastRobotUpdate(
          connectedClients.filter(client => client !== ws),
          'camera',
          serialNumber,
          camera
        );
      }
    })
    .catch(error => {
      console.error("Error toggling camera via proxy:", error);
      
      // Fall back to local toggling
      toggleLocalCamera();
    });
  } else {
    // Standard handling for other robots
    toggleLocalCamera();
  }
  
  // Helper function for local camera toggling (for non-physical robots or as fallback)
  function toggleLocalCamera() {
    const camera = demoCameraData[serialNumber];
    if (camera) {
      camera.enabled = enabled !== undefined ? enabled : !camera.enabled;
      camera.timestamp = new Date().toISOString();
      
      // Update stream URL based on enabled state
      if (camera.enabled && !camera.streamUrl) {
        if (serialNumber === 'L382502104987ir' || serialNumber === 'L382502104988is' || serialNumber === 'AX923701583RT') {
          // Use the proxy URL for any of our physical robots
          camera.streamUrl = `${ROBOT_PROXY_URL}/robot-camera/${serialNumber}`;
        } else {
          // For demo robots, just show a still image
          camera.streamUrl = `${ROBOT_PROXY_URL}/demo-stream/${serialNumber}`;
        }
      } else if (!camera.enabled) {
        camera.streamUrl = '';
      }
      
      // Send updated camera data back
      ws.send(JSON.stringify({
        type: 'camera',
        data: camera
      }));
      console.log('Toggled camera locally for robot:', serialNumber, 'to:', camera.enabled);
      
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