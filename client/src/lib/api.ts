import { apiRequest } from "@/lib/queryClient";
import { RobotStatus, RobotPosition, RobotSensorData } from "@/types/robot";

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
export async function getRobotStatus(): Promise<RobotStatus> {
  const response = await apiRequest("GET", `${API_URL}/status`);
  return response.json();
}

// Robot Position
export async function getRobotPosition(): Promise<RobotPosition> {
  const response = await apiRequest("GET", `${API_URL}/position`);
  return response.json();
}

// Robot Sensor Data
export async function getRobotSensorData(): Promise<RobotSensorData> {
  const response = await apiRequest("GET", `${API_URL}/sensors`);
  return response.json();
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
export async function getMapData() {
  const response = await apiRequest("GET", `${API_URL}/map`);
  return response.json();
}

export async function refreshAllData() {
  const statusPromise = getRobotStatus();
  const positionPromise = getRobotPosition();
  const sensorPromise = getRobotSensorData();
  const mapPromise = getMapData();
  
  return Promise.all([statusPromise, positionPromise, sensorPromise, mapPromise]);
}
