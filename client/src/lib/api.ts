import { apiRequest } from "@/lib/queryClient";
import { RobotStatus, RobotPosition, RobotSensorData, CameraData, LidarData } from "@/types/robot";

// API endpoint configurations
const API_URL = import.meta.env.VITE_AXBOT_API_URL || "/api/axbot";
const API_KEY = import.meta.env.VITE_AXBOT_API_KEY || "";
const ROBOT_SECRET = import.meta.env.VITE_ROBOT_SECRET || "";

// Proxy server URLs for direct robot connection
const ROBOT_PROXY_URL = import.meta.env.VITE_ROBOT_PROXY_URL || "";
const ROBOT_CAMERA_URL = import.meta.env.VITE_ROBOT_CAMERA_URL || "";

// Authentication
export async function authenticate(apiKey: string, apiEndpoint: string) {
  const response = await fetch(`/api/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey, apiEndpoint }),
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Authentication failed");
  }

  return response.json();
}

// Robot Status
export async function getRobotStatus(serialNumber?: string): Promise<RobotStatus> {
  // If serial number is provided, fetch that specific robot's status
  if (serialNumber) {
    try {
      // First try to get data from the proxy server if it's configured
      if (ROBOT_PROXY_URL) {
        try {
          // Skip logging to reduce console noise
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/device/info`, {
            headers: {
              'Secret': ROBOT_SECRET
            }
          });
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              model: robotData.model || robotData.device?.model || "L382502104987ir",
              serialNumber: robotData.serialNumber || robotData.device?.sn || serialNumber,
              battery: robotData.battery || 95,
              status: robotData.status || "online",
              operationalStatus: robotData.operationalStatus || "ready",
              uptime: robotData.uptime || "Connected via proxy",
              connectionStatus: 'connected',
              messages: [
                { timestamp: new Date().toISOString(), text: "Connected to physical robot via proxy" }
              ]
            };
          }
        } catch (proxyError) {
          // Skip log for better UI experience
        }
      }
      
      // Fall back to the regular API
      try {
        const response = await apiRequest(`/api/robots/status/${serialNumber}`);
        
        // Check if response is OK before parsing
        if (!response.ok) {
          return {
            model: "AxBot Physical Robot",
            serialNumber: serialNumber,
            battery: 0,
            status: "offline",
            operationalStatus: "error",
            connectionStatus: "error",
            uptime: "Disconnected",
            messages: [
              { timestamp: new Date().toISOString(), text: "Connection error" }
            ]
          };
        }
        
        const data = await response.json();
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        // Return a minimal status with connection error without console noise
        return {
          model: "AxBot Physical Robot",
          serialNumber: serialNumber,
          battery: 0,
          status: "offline",
          operationalStatus: "error",
          connectionStatus: "error",
          uptime: "Disconnected",
          messages: [
            { timestamp: new Date().toISOString(), text: "Connection error" }
          ]
        };
      }
    } catch (error) {
      // Return fallback data without throwing
      return {
        model: "AxBot Physical Robot",
        serialNumber: serialNumber,
        battery: 0,
        status: "offline",
        operationalStatus: "error",
        connectionStatus: "error",
        uptime: "Disconnected",
        messages: [
          { timestamp: new Date().toISOString(), text: "Connection error" }
        ]
      };
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest(`${API_URL}/status`);
    return response.json();
  }
}

// Robot Position
export async function getRobotPosition(serialNumber?: string): Promise<RobotPosition> {
  // If serial number is provided, fetch that specific robot's position
  if (serialNumber) {
    try {
      // First try to get data from the proxy server if it's configured
      if (ROBOT_PROXY_URL) {
        try {
          // Skip logging to reduce console noise
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/position`, {
            headers: {
              'Secret': ROBOT_SECRET
            }
          });
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              x: robotData.x || robotData.position?.x || 0,
              y: robotData.y || robotData.position?.y || 0,
              z: robotData.z || robotData.position?.z || 0,
              orientation: robotData.orientation || robotData.position?.orientation || 0,
              speed: robotData.speed || 0,
              timestamp: robotData.timestamp || new Date().toISOString(),
              connectionStatus: 'connected',
              currentTask: "Connected via proxy",
              destination: { x: 0, y: 0, z: 0 },
              distanceToTarget: 0
            };
          }
        } catch (proxyError) {
          // Skip log for better UI experience
        }
      }
      
      // Fall back to the regular API
      try {
        const response = await apiRequest(`/api/robots/position/${serialNumber}`);
        
        // Check if response is OK before parsing
        if (!response.ok) {
          return {
            x: 0,
            y: 0,
            z: 0,
            orientation: 0,
            speed: 0,
            timestamp: new Date().toISOString(),
            connectionStatus: "error",
            currentTask: "Disconnected",
            destination: { x: 0, y: 0, z: 0 },
            distanceToTarget: 0
          };
        }
        
        const data = await response.json();
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        // Return error state without console noise
        return {
          x: 0,
          y: 0,
          z: 0,
          orientation: 0,
          speed: 0,
          timestamp: new Date().toISOString(),
          connectionStatus: "error",
          currentTask: "Disconnected",
          destination: { x: 0, y: 0, z: 0 },
          distanceToTarget: 0
        };
      }
    } catch (error) {
      // Return fallback without throwing
      return {
        x: 0,
        y: 0,
        z: 0,
        orientation: 0,
        speed: 0,
        timestamp: new Date().toISOString(),
        connectionStatus: "error",
        currentTask: "Disconnected",
        destination: { x: 0, y: 0, z: 0 },
        distanceToTarget: 0
      };
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest(`${API_URL}/position`);
    return response.json();
  }
}

// Robot Sensor Data
export async function getRobotSensorData(serialNumber?: string): Promise<RobotSensorData> {
  // If serial number is provided, fetch that specific robot's sensor data
  if (serialNumber) {
    try {
      // First try to get data from the proxy server if it's configured
      if (ROBOT_PROXY_URL) {
        try {
          // Skip logging to reduce console noise
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/sensors`, {
            headers: {
              'Secret': ROBOT_SECRET
            }
          });
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              temperature: robotData.temperature || 0,
              humidity: robotData.humidity || 0,
              proximity: robotData.proximity || [],
              battery: robotData.battery || 0,
              timestamp: robotData.timestamp || new Date().toISOString(),
              connectionStatus: 'connected',
              light: robotData.light || 0,
              noise: robotData.noise || 0,
              // These fields need to be included for compatibility
              charging: robotData.charging || false,
              power_supply_status: robotData.power_supply_status || 'unknown'
            };
          }
        } catch (proxyError) {
          // Skip log for better UI experience
        }
      }
      
      // Fall back to the regular API
      try {
        const response = await apiRequest(`/api/robots/sensors/${serialNumber}`);
        
        // Check if response is OK before parsing
        if (!response.ok) {
          return {
            temperature: 0,
            humidity: 0,
            proximity: [],
            battery: 0,
            timestamp: new Date().toISOString(),
            connectionStatus: "error",
            light: 0,
            noise: 0,
            charging: false,
            power_supply_status: 'unknown'
          };
        }
        
        const data = await response.json();
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        // Return error state without console noise
        return {
          temperature: 0,
          humidity: 0,
          proximity: [],
          battery: 0,
          timestamp: new Date().toISOString(),
          connectionStatus: "error",
          light: 0,
          noise: 0,
          charging: false,
          power_supply_status: 'unknown'
        };
      }
    } catch (error) {
      // Return fallback without throwing
      return {
        temperature: 0,
        humidity: 0,
        proximity: [],
        battery: 0,
        timestamp: new Date().toISOString(),
        connectionStatus: "error",
        light: 0,
        noise: 0,
        charging: false,
        power_supply_status: 'unknown'
      };
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest(`${API_URL}/sensors`);
    return response.json();
  }
}

// Robot Controls
export async function startRobot() {
  const response = await apiRequest(`${API_URL}/control/start`, { method: 'POST' });
  return response.json();
}

export async function stopRobot() {
  const response = await apiRequest(`${API_URL}/control/stop`, { method: 'POST' });
  return response.json();
}

export async function pauseRobot() {
  const response = await apiRequest(`${API_URL}/control/pause`, { method: 'POST' });
  return response.json();
}

export async function homeRobot() {
  const response = await apiRequest(`${API_URL}/control/home`, { method: 'POST' });
  return response.json();
}

export async function calibrateRobot() {
  const response = await apiRequest(`${API_URL}/control/calibrate`, { method: 'POST' });
  return response.json();
}

export async function moveRobot(direction: 'forward' | 'backward' | 'left' | 'right', speed: number) {
  const response = await apiRequest(`${API_URL}/control/move`, { 
    method: 'POST', 
    data: { direction, speed } 
  });
  return response.json();
}

export async function stopMovement() {
  const response = await apiRequest(`${API_URL}/control/move/stop`, { method: 'POST' });
  return response.json();
}

export async function setSpeed(speed: number) {
  const response = await apiRequest(`${API_URL}/control/speed`, { 
    method: 'POST', 
    data: { speed }
  });
  return response.json();
}

export async function sendCustomCommand(command: string) {
  const response = await apiRequest(`${API_URL}/control/custom`, { 
    method: 'POST', 
    data: { command }
  });
  return response.json();
}

// Map Functions
export async function getMapData(serialNumber?: string) {
  // If serial number is provided, fetch that specific robot's map data
  if (serialNumber) {
    try {
      // Add the Secret header which is required for robot API endpoints
      const headers = {
        'Secret': ROBOT_SECRET
      };
      
      const response = await apiRequest(`/api/robots/map/${serialNumber}`, { headers });
      
      // Check if response is OK before parsing
      if (!response.ok) {
        return {
          grid: [],
          obstacles: [],
          paths: [],
          connectionStatus: 'error'
        };
      }
      
      const data = await response.json();
      
      // Add connection status to the returned data
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      // Return a minimal map with connectionStatus 'error' without console noise
      return {
        grid: [],
        obstacles: [],
        paths: [],
        connectionStatus: 'error'
      };
    }
  } else {
    // Use the general API endpoint
    try {
      const response = await apiRequest(`${API_URL}/map`);
      
      // Check if response is OK before parsing
      if (!response.ok) {
        return {
          grid: [],
          obstacles: [],
          paths: [],
          connectionStatus: 'error'
        };
      }
      
      const data = await response.json();
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      // Return error status without console noise
      return {
        grid: [],
        obstacles: [],
        paths: [],
        connectionStatus: 'error'
      };
    }
  }
}

// Camera Functions
export async function getRobotCameraData(serialNumber: string): Promise<CameraData> {
  try {
    // First try to get data from the proxy server if it's configured
    if (ROBOT_CAMERA_URL) {
      try {
        // Skip logging to reduce console noise
        const proxyResponse = await fetch(`${ROBOT_CAMERA_URL}/${serialNumber}`, {
          headers: {
            'Secret': ROBOT_SECRET
          }
        });
        if (proxyResponse.ok) {
          // Return camera data with the proxy stream URL
          return {
            enabled: true,
            streamUrl: `${ROBOT_CAMERA_URL}/${serialNumber}`,
            resolution: {
              width: 1280,
              height: 720
            },
            rotation: 0,
            nightVision: true,
            timestamp: new Date().toISOString(),
            connectionStatus: 'connected'
          };
        }
      } catch (proxyError) {
        // Skip log for better UI experience
      }
    }
    
    // Fall back to the regular API
    try {
      const response = await apiRequest(`/api/robots/camera/${serialNumber}`);
      
      // Check if response is OK before parsing
      if (!response.ok) {
        return {
          enabled: false,
          streamUrl: '',
          resolution: {
            width: 0,
            height: 0
          },
          rotation: 0,
          nightVision: false,
          timestamp: new Date().toISOString(),
          connectionStatus: "error"
        };
      }
      
      const data = await response.json();
      
      // Add connection status to the result
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (apiError) {
      // Return error state without console noise
      return {
        enabled: false,
        streamUrl: '',
        resolution: {
          width: 0,
          height: 0
        },
        rotation: 0,
        nightVision: false,
        timestamp: new Date().toISOString(),
        connectionStatus: "error"
      };
    }
  } catch (error) {
    // Return fallback without throwing
    return {
      enabled: false,
      streamUrl: '',
      resolution: {
        width: 0,
        height: 0
      },
      rotation: 0,
      nightVision: false,
      timestamp: new Date().toISOString(),
      connectionStatus: "error"
    };
  }
}

export async function toggleRobotCamera(serialNumber: string, enabled: boolean): Promise<CameraData> {
  try {
    const response = await apiRequest(`/api/robots/camera/${serialNumber}`, { 
      method: 'POST', 
      data: { enabled }
    });
    
    // Check if response is OK before parsing
    if (!response.ok) {
      return {
        enabled: false,
        streamUrl: '',
        resolution: {
          width: 0,
          height: 0
        },
        rotation: 0,
        nightVision: false,
        timestamp: new Date().toISOString(),
        connectionStatus: "error"
      };
    }
    
    const data = await response.json();
    return {
      ...data,
      connectionStatus: 'connected'
    };
  } catch (error) {
    // Return error state without console noise
    return {
      enabled: false,
      streamUrl: '',
      resolution: {
        width: 0,
        height: 0
      },
      rotation: 0,
      nightVision: false,
      timestamp: new Date().toISOString(),
      connectionStatus: "error"
    };
  }
}

// LiDAR data
export async function getLidarData(serialNumber: string): Promise<LidarData> {
  try {
    const response = await apiRequest(`/api/robots/lidar/${serialNumber}`, {
      headers: {
        'Secret': ROBOT_SECRET
      }
    });
    
    // Check if response is OK before parsing
    if (!response.ok) {
      return {
        ranges: [],
        angle_min: 0,
        angle_max: 0,
        angle_increment: 0,
        range_min: 0,
        range_max: 0,
        timestamp: new Date().toISOString(),
        connectionStatus: "error"
      };
    }
    
    const data = await response.json();
    
    // Add connection status to the result
    return {
      ...data,
      connectionStatus: 'connected'
    };
  } catch (error) {
    // Return error state without console noise
    return {
      ranges: [],
      angle_min: 0,
      angle_max: 0,
      angle_increment: 0,
      range_min: 0,
      range_max: 0,
      timestamp: new Date().toISOString(),
      connectionStatus: "error"
    };
  }
}

// Refresh all robot data with graceful error handling
export async function refreshAllData() {
  try {
    // For the serial number, we'll use the pre-configured physical robot serial
    const physicalRobotSerial = "L382502104987ir";
    
    // Each of these functions now has built-in error handling and won't throw
    const statusPromise = getRobotStatus(physicalRobotSerial);
    const positionPromise = getRobotPosition(physicalRobotSerial);
    const sensorPromise = getRobotSensorData(physicalRobotSerial);
    const mapPromise = getMapData(physicalRobotSerial);
    const lidarPromise = getLidarData(physicalRobotSerial);
    const cameraPromise = getRobotCameraData(physicalRobotSerial);
    
    // Promise.all won't reject if individual promises don't throw
    return await Promise.all([
      statusPromise, 
      positionPromise, 
      sensorPromise, 
      mapPromise, 
      lidarPromise,
      cameraPromise
    ]);
  } catch (error) {
    // This should never be reached now, but just in case
    return [
      // Status with error
      {
        model: "AxBot",
        serialNumber: "L382502104987ir",
        battery: 0,
        status: "offline",
        connectionStatus: "error",
        uptime: "Disconnected",
        messages: [{ timestamp: new Date().toISOString(), text: "Connection error" }]
      },
      // Position with error
      {
        x: 0, y: 0, z: 0, orientation: 0,
        connectionStatus: "error",
        timestamp: new Date().toISOString()
      },
      // Sensor data with error
      {
        temperature: 0,
        battery: 0,
        humidity: 0,
        proximity: [],
        connectionStatus: "error",
        timestamp: new Date().toISOString(),
        charging: false,
        power_supply_status: 'unknown'
      },
      // Map data with error
      {
        grid: [],
        obstacles: [],
        paths: [],
        connectionStatus: "error"
      },
      // LiDAR data with error
      {
        ranges: [],
        angle_min: 0,
        angle_max: 0,
        angle_increment: 0,
        range_min: 0,
        range_max: 0,
        timestamp: new Date().toISOString(),
        connectionStatus: "error"
      },
      // Camera data with error
      {
        enabled: false,
        streamUrl: '',
        resolution: { width: 0, height: 0 },
        rotation: 0,
        nightVision: false,
        timestamp: new Date().toISOString(),
        connectionStatus: "error"
      }
    ];
  }
}
