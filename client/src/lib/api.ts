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
        console.log(`Fetching status from API: /api/robots/status/${serialNumber}`);
        const response = await fetch(`/api/robots/status/${serialNumber}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        // Check if response is OK before parsing
        if (!response.ok) {
          console.error(`Error fetching status: ${response.status} ${response.statusText}`);
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
        console.log('Status data retrieved successfully');
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        console.error('Error in status fetch:', apiError);
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
    console.log(`Fetching general status from: ${API_URL}/status`);
    try {
      const response = await fetch(`${API_URL}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET || ''
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching general status: ${response.status} ${response.statusText}`);
        return {
          model: "AxBot Physical Robot",
          serialNumber: "unknown",
          battery: 0,
          status: "offline",
          operationalStatus: "error",
          uptime: "Disconnected",
          connectionStatus: "error",
          messages: [{ timestamp: new Date().toISOString(), text: "Connection error" }]
        };
      }
      
      console.log('General status data retrieved successfully');
      const data = await response.json();
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      console.error('Error in general status fetch:', error);
      return {
        model: "AxBot Physical Robot",
        serialNumber: "unknown",
        battery: 0,
        status: "offline",
        operationalStatus: "error",
        uptime: "Disconnected",
        connectionStatus: "error",
        messages: [{ timestamp: new Date().toISOString(), text: "Connection error" }]
      };
    }
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
        console.log(`Fetching position from API: /api/robots/position/${serialNumber}`);
        const response = await fetch(`/api/robots/position/${serialNumber}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        // Check if response is OK before parsing
        if (!response.ok) {
          console.error(`Error fetching position: ${response.status} ${response.statusText}`);
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
        console.log('Position data retrieved successfully');
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        console.error('Error in position fetch:', apiError);
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
    console.log(`Fetching general position data from: ${API_URL}/position`);
    try {
      const response = await fetch(`${API_URL}/position`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET || ''
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching general position data: ${response.status} ${response.statusText}`);
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
      
      console.log('General position data retrieved successfully');
      const data = await response.json();
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      console.error('Error in general position fetch:', error);
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
        console.log(`Fetching sensor data from API: /api/robots/sensors/${serialNumber}`);
        const response = await fetch(`/api/robots/sensors/${serialNumber}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        
        // Check if response is OK before parsing
        if (!response.ok) {
          console.error(`Error fetching sensor data: ${response.status} ${response.statusText}`);
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
        console.log('Sensor data retrieved successfully');
        
        // Add connection status to the result
        return {
          ...data,
          connectionStatus: 'connected'
        };
      } catch (apiError) {
        console.error('Error in sensor data fetch:', apiError);
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
    console.log(`Fetching general sensor data from: ${API_URL}/sensors`);
    try {
      const response = await fetch(`${API_URL}/sensors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET || ''
        }
      });
      
      if (!response.ok) {
        console.error(`Error fetching general sensor data: ${response.status} ${response.statusText}`);
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
      
      console.log('General sensor data retrieved successfully');
      const data = await response.json();
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      console.error('Error in general sensor data fetch:', error);
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
  }
}

// Robot Controls
export async function startRobot() {
  console.log('Sending start command to robot');
  try {
    const response = await fetch(`${API_URL}/control/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Start robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in start robot fetch:', error);
    throw error;
  }
}

export async function stopRobot() {
  console.log('Sending stop command to robot');
  try {
    const response = await fetch(`${API_URL}/control/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Stop robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in stop robot fetch:', error);
    throw error;
  }
}

export async function pauseRobot() {
  console.log('Sending pause command to robot');
  try {
    const response = await fetch(`${API_URL}/control/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Pause robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in pause robot fetch:', error);
    throw error;
  }
}

export async function homeRobot() {
  console.log('Sending home command to robot');
  try {
    const response = await fetch(`${API_URL}/control/home`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Home robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in home robot fetch:', error);
    throw error;
  }
}

export async function calibrateRobot() {
  console.log('Sending calibrate command to robot');
  try {
    const response = await fetch(`${API_URL}/control/calibrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Calibrate robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in calibrate robot fetch:', error);
    throw error;
  }
}

export async function moveRobot(direction: 'forward' | 'backward' | 'left' | 'right', speed: number) {
  console.log(`Sending move ${direction} command to robot with speed ${speed}`);
  try {
    const response = await fetch(`${API_URL}/control/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      },
      body: JSON.stringify({ direction, speed })
    });
    console.log('Move robot response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in move robot fetch:', error);
    throw error;
  }
}

export async function stopMovement() {
  console.log('Sending stop movement command to robot');
  try {
    const response = await fetch(`${API_URL}/control/move/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      }
    });
    console.log('Stop movement response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in stop movement fetch:', error);
    throw error;
  }
}

export async function setSpeed(speed: number) {
  console.log(`Sending set speed command to robot with speed ${speed}`);
  try {
    const response = await fetch(`${API_URL}/control/speed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      },
      body: JSON.stringify({ speed })
    });
    console.log('Set speed response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in set speed fetch:', error);
    throw error;
  }
}

export async function sendCustomCommand(command: string) {
  console.log(`Sending custom command to robot: ${command}`);
  try {
    const response = await fetch(`${API_URL}/control/custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      },
      body: JSON.stringify({ command })
    });
    console.log('Custom command response:', response);
    return await response.json();
  } catch (error) {
    console.error('Error in custom command fetch:', error);
    throw error;
  }
}

// Map Functions
export async function getMapData(serialNumber?: string) {
  console.log(`Getting map data for serial: ${serialNumber || 'general'}`);
  // If serial number is provided, fetch that specific robot's map data
  if (serialNumber) {
    try {
      // Add the Secret header which is required for robot API endpoints
      const headers = {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      };
      
      console.log(`Fetching map data from: /api/robots/map/${serialNumber}`);
      const response = await fetch(`/api/robots/map/${serialNumber}`, { 
        method: 'GET',
        headers 
      });
      
      // Check if response is OK before parsing
      if (!response.ok) {
        console.error(`Error fetching map data: ${response.status} ${response.statusText}`);
        return {
          grid: [],
          obstacles: [],
          paths: [],
          connectionStatus: 'error'
        };
      }
      
      const data = await response.json();
      console.log('Map data retrieved successfully');
      
      // Add connection status to the returned data
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      console.error('Error in getMapData fetch:', error);
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
      console.log(`Fetching general map data from: ${API_URL}/map`);
      const response = await fetch(`${API_URL}/map`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET || ''
        }
      });
      
      // Check if response is OK before parsing
      if (!response.ok) {
        console.error(`Error fetching general map data: ${response.status} ${response.statusText}`);
        return {
          grid: [],
          obstacles: [],
          paths: [],
          connectionStatus: 'error'
        };
      }
      
      const data = await response.json();
      console.log('General map data retrieved successfully');
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (error) {
      console.error('Error in getMapData general fetch:', error);
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
  console.log(`Getting camera data for serial: ${serialNumber}`);
  try {
    // First try to get data from the proxy server if it's configured
    if (ROBOT_CAMERA_URL) {
      try {
        console.log(`Attempting to fetch camera data from proxy: ${ROBOT_CAMERA_URL}/${serialNumber}`);
        const proxyResponse = await fetch(`${ROBOT_CAMERA_URL}/${serialNumber}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Secret': ROBOT_SECRET || ''
          }
        });
        if (proxyResponse.ok) {
          console.log('Camera proxy connection successful');
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
        console.error('Error connecting to camera proxy:', proxyError);
      }
    }
    
    // Fall back to the regular API
    try {
      console.log(`Fetching camera data from API: /api/robots/camera/${serialNumber}`);
      const response = await fetch(`/api/robots/camera/${serialNumber}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Secret': ROBOT_SECRET || ''
        }
      });
      
      // Check if response is OK before parsing
      if (!response.ok) {
        console.error(`Error fetching camera data: ${response.status} ${response.statusText}`);
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
      console.log('Camera data retrieved successfully');
      
      // Add connection status to the result
      return {
        ...data,
        connectionStatus: 'connected'
      };
    } catch (apiError) {
      console.error('Error in camera data fetch:', apiError);
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
    console.error('Unexpected error in camera data fetch:', error);
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
  console.log(`Toggling camera for serial: ${serialNumber} to ${enabled ? 'enabled' : 'disabled'}`);
  try {
    const response = await fetch(`/api/robots/camera/${serialNumber}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || ''
      },
      body: JSON.stringify({ enabled })
    });
    
    // Check if response is OK before parsing
    if (!response.ok) {
      console.error(`Error toggling camera: ${response.status} ${response.statusText}`);
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
    console.log('Camera toggle successful');
    return {
      ...data,
      connectionStatus: 'connected'
    };
  } catch (error) {
    console.error('Error in camera toggle fetch:', error);
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
  console.log(`Getting LiDAR data for serial: ${serialNumber}`);
  try {
    // Always use cache busting to ensure we get fresh data
    // This is critical for consistency across all devices
    const timestamp = new Date().getTime();
    // Explicitly request the /scan_matched_points2 topic with correct formatting
    const preferredTopic = '/scan_matched_points2';
    const url = `/api/robots/lidar/${serialNumber}?_nocache=${timestamp}&_preferTopic=${encodeURIComponent(preferredTopic)}`;
    console.log(`Fetching LiDAR data from: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Secret': ROBOT_SECRET || '',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Preferred-Topic': preferredTopic // Explicitly request this topic
      }
    });
    
    // Check if response is OK before parsing
    if (!response.ok) {
      console.error(`Error fetching LiDAR data: ${response.status} ${response.statusText}`);
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
    console.log('LiDAR data retrieved successfully');
    
    // Add connection status to the result and force a new timestamp
    // to ensure React recognizes the change in data
    return {
      ...data,
      connectionStatus: 'connected',
      timestamp: new Date().toISOString() // Force a timestamp update to trigger re-renders
    };
  } catch (error) {
    console.error('Error in getLidarData fetch:', error);
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
        model: "AxBot Physical Robot",
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
