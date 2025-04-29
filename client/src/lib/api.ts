import { apiRequest } from "@/lib/queryClient";
import { RobotStatus, RobotPosition, RobotSensorData, CameraData } from "@/types/robot";

// API endpoint configurations
const API_URL = import.meta.env.VITE_AXBOT_API_URL || "/api/axbot";
const API_KEY = import.meta.env.VITE_AXBOT_API_KEY || "";

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
      const response = await apiRequest("GET", `/api/robots/status/${serialNumber}`);
      return await response.json();
    } catch (error) {
      console.error(`Error fetching status for robot ${serialNumber}:`, error);
      throw error;
    }
  } else {
    // Use the general API endpoint
    const response = await apiRequest("GET", `${API_URL}/status`);
    return response.json();
  }
}

// Robot Position
export async function getRobotPosition(serialNumber?: string): Promise<RobotPosition> {
  // If serial number is provided, fetch that specific robot's position
  if (serialNumber) {
    try {
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
    const response = await apiRequest("GET", `/api/robots/camera/${serialNumber}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching camera data for robot ${serialNumber}:`, error);
    throw error;
  }
}

export async function toggleRobotCamera(serialNumber: string, enabled: boolean): Promise<CameraData> {
  try {
    const response = await apiRequest("POST", `/api/robots/camera/${serialNumber}/toggle`, { enabled });
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
  currentTask: "Waiting for commands",
  destination: { x: 120, y: 80, z: 0 },
  distanceToTarget: 0
};

const fallbackSensorData: RobotSensorData = {
  temperature: 23.5,
  humidity: 48,
  proximity: 100,
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
