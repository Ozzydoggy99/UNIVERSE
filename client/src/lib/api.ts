import { apiRequest } from "@/lib/queryClient";
import { RobotStatus, RobotPosition, RobotSensorData, CameraData } from "@/types/robot";

// API endpoint configurations
const API_URL = import.meta.env.VITE_AXBOT_API_URL || "/api/axbot";
const API_KEY = import.meta.env.VITE_AXBOT_API_KEY || "";

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
          console.log(`Trying to connect to robot via proxy at ${ROBOT_PROXY_URL}/device/info`);
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/device/info`);
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            console.log('Received robot data from proxy:', robotData);
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              model: robotData.model || robotData.device?.model || "L382502104987ir",
              serialNumber: robotData.serialNumber || robotData.device?.sn || serialNumber,
              battery: robotData.battery || 95,
              status: robotData.status || "online",
              operationalStatus: robotData.operationalStatus || "ready",
              uptime: robotData.uptime || "Connected via proxy",
              messages: [
                { timestamp: new Date().toISOString(), text: "Connected to physical robot via proxy" }
              ]
            };
          }
        } catch (proxyError) {
          console.warn('Failed to get data from proxy, falling back to API:', proxyError);
        }
      }
      
      // Fall back to the regular API
      const response = await apiRequest(`/api/robots/status/${serialNumber}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching status for robot ${serialNumber}:`, error);
      throw error;
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
          console.log(`Trying to connect to robot position via proxy at ${ROBOT_PROXY_URL}/position`);
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/position`);
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            console.log('Received robot position data from proxy:', robotData);
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              x: robotData.x || robotData.position?.x || 150,
              y: robotData.y || robotData.position?.y || 95,
              z: robotData.z || robotData.position?.z || 0,
              orientation: robotData.orientation || robotData.position?.orientation || 180,
              speed: robotData.speed || 0,
              timestamp: robotData.timestamp || new Date().toISOString(),
              currentTask: "Connected via proxy",
              destination: { x: 0, y: 0, z: 0 },
              distanceToTarget: 0
            };
          }
        } catch (proxyError) {
          console.warn('Failed to get position data from proxy, falling back to API:', proxyError);
        }
      }
      
      // Fall back to the regular API
      const response = await apiRequest("GET", `/api/robots/position/${serialNumber}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching position for robot ${serialNumber}:`, error);
      throw error;
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest("GET", `${API_URL}/position`);
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
          console.log(`Trying to connect to robot sensors via proxy at ${ROBOT_PROXY_URL}/sensors`);
          const proxyResponse = await fetch(`${ROBOT_PROXY_URL}/sensors`);
          if (proxyResponse.ok) {
            const robotData = await proxyResponse.json();
            console.log('Received robot sensor data from proxy:', robotData);
            
            // Convert from robot's format to our application's format
            // Adjust this mapping based on the actual robot API response
            return {
              temperature: robotData.temperature || 24.2,
              humidity: robotData.humidity || 45,
              proximity: robotData.proximity || [1.5, 2.8, 3, 1.7],
              battery: robotData.battery || 95,
              timestamp: robotData.timestamp || new Date().toISOString(),
              light: 75,
              noise: 30
            };
          }
        } catch (proxyError) {
          console.warn('Failed to get sensor data from proxy, falling back to API:', proxyError);
        }
      }
      
      // Fall back to the regular API
      const response = await apiRequest("GET", `/api/robots/sensors/${serialNumber}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching sensor data for robot ${serialNumber}:`, error);
      throw error;
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest("GET", `${API_URL}/sensors`);
    return response.json();
  }
}

// Robot Controls
export async function startRobot() {
  const response = await apiRequest("POST", `${API_URL}/control/start`);
  return response.json();
}

export async function stopRobot() {
  const response = await apiRequest("POST", `${API_URL}/control/stop`);
  return response.json();
}

export async function pauseRobot() {
  const response = await apiRequest("POST", `${API_URL}/control/pause`);
  return response.json();
}

export async function homeRobot() {
  const response = await apiRequest("POST", `${API_URL}/control/home`);
  return response.json();
}

export async function calibrateRobot() {
  const response = await apiRequest("POST", `${API_URL}/control/calibrate`);
  return response.json();
}

export async function moveRobot(direction: 'forward' | 'backward' | 'left' | 'right', speed: number) {
  const response = await apiRequest("POST", `${API_URL}/control/move`, { direction, speed });
  return response.json();
}

export async function stopMovement() {
  const response = await apiRequest("POST", `${API_URL}/control/move/stop`);
  return response.json();
}

export async function setSpeed(speed: number) {
  const response = await apiRequest("POST", `${API_URL}/control/speed`, { speed });
  return response.json();
}

export async function sendCustomCommand(command: string) {
  const response = await apiRequest("POST", `${API_URL}/control/custom`, { command });
  return response.json();
}

// Map Functions
export async function getMapData(serialNumber?: string) {
  // If serial number is provided, fetch that specific robot's map data
  if (serialNumber) {
    try {
      const response = await apiRequest("GET", `/api/robots/map/${serialNumber}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching map data for robot ${serialNumber}:`, error);
      throw error;
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest("GET", `${API_URL}/map`);
    return response.json();
  }
}

// Camera Functions
export async function getRobotCameraData(serialNumber: string): Promise<CameraData> {
  try {
    // First try to get data from the proxy server if it's configured
    if (ROBOT_CAMERA_URL) {
      try {
        console.log(`Trying to connect to robot camera via proxy at ${ROBOT_CAMERA_URL}/${serialNumber}`);
        const proxyResponse = await fetch(`${ROBOT_CAMERA_URL}/${serialNumber}`);
        if (proxyResponse.ok) {
          console.log('Received robot camera data from proxy');
          
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
            timestamp: new Date().toISOString()
          };
        }
      } catch (proxyError) {
        console.warn('Failed to get camera data from proxy, falling back to API:', proxyError);
      }
    }
    
    // Fall back to the regular API
    const response = await apiRequest("GET", `/api/robots/camera/${serialNumber}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching camera data for robot ${serialNumber}:`, error);
    throw error;
  }
}

export async function toggleRobotCamera(serialNumber: string, enabled: boolean): Promise<CameraData> {
  try {
    const response = await apiRequest("POST", `/api/robots/camera/${serialNumber}`, { enabled });
    return await response.json();
  } catch (error) {
    console.error(`Error toggling camera for robot ${serialNumber}:`, error);
    throw error;
  }
}

// Fallback data for when the API is unavailable
const fallbackStatus: RobotStatus = {
  model: "AxBot 2000",
  serialNumber: "AX-2000-DEMO",
  battery: 85,
  status: "online",
  mode: "idle",
  lastUpdate: new Date().toISOString(),
  operationalStatus: "idle",
  uptime: "1d 4h 32m",
  messages: [
    { timestamp: new Date().toISOString(), text: "System running in demo mode" }
  ]
};

const fallbackPosition: RobotPosition = {
  x: 120,
  y: 80,
  z: 0,
  orientation: 90,
  speed: 0,
  timestamp: new Date().toISOString(),
  currentTask: "Waiting for commands",
  destination: { x: 120, y: 80, z: 0 },
  distanceToTarget: 0
};

const fallbackSensorData: RobotSensorData = {
  temperature: 23.5,
  humidity: 48,
  proximity: [100, 120, 150, 90],
  battery: 85,
  timestamp: new Date().toISOString(),
  light: 75,
  noise: 32
};

const fallbackMapData = {
  grid: [],
  obstacles: [
    { x: 50, y: 50, z: 0 },
    { x: 150, y: 100, z: 0 }
  ],
  paths: [
    { 
      points: [
        { x: 10, y: 10, z: 0 },
        { x: 100, y: 100, z: 0 }
      ],
      status: "completed"
    }
  ]
};

export async function refreshAllData() {
  try {
    const statusPromise = getRobotStatus().catch(() => fallbackStatus);
    const positionPromise = getRobotPosition().catch(() => fallbackPosition);
    const sensorPromise = getRobotSensorData().catch(() => fallbackSensorData);
    const mapPromise = getMapData().catch(() => fallbackMapData);
    
    return await Promise.all([statusPromise, positionPromise, sensorPromise, mapPromise]);
  } catch (error) {
    console.error("Error in refreshAllData:", error);
    // Return fallback data if anything goes wrong
    return [fallbackStatus, fallbackPosition, fallbackSensorData, fallbackMapData];
  }
}
