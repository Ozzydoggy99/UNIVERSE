/**
 * Robot WebSocket Client Example
 * 
 * This script demonstrates how to connect your physical robot to the server
 * using WebSockets for real-time communication. WebSockets provide a more
 * efficient way to communicate compared to REST API calls, especially for
 * frequent updates like position and sensor data.
 * 
 * Instructions:
 * 1. Replace the ROBOT_CONFIG values with your robot's details
 * 2. The SERVER_URL should point to your deployed application
 * 3. Run this script on the machine that controls your robot
 * 4. Adapt the sendStatusUpdate, sendPositionUpdate, and sendSensorUpdate 
 *    functions to read actual data from your robot's sensors
 */

// This is an ES module
import { WebSocket } from 'ws';

// Configuration - Using your actual robot's details
const ROBOT_CONFIG = {
  serialNumber: "L382502104988is",  // Your robot's serial number
  model: "RobotChassis"             // Your robot's model
};

// Server configuration - Change this to your actual server URL
// Example: const SERVER_URL = 'wss://your-app-name.replit.app/api/ws/robot';
const SERVER_URL = 'ws://localhost:5000/api/ws/robot';

// Global websocket connection
let ws = null;
let isConnected = false;
let isRegistered = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000; // 5 seconds

// Connect to the WebSocket server
function connectWebSocket() {
  console.log(`Connecting to ${SERVER_URL}...`);
  
  try {
    ws = new WebSocket(SERVER_URL);
    
    ws.on('open', () => {
      console.log('WebSocket connection established');
      isConnected = true;
      reconnectAttempts = 0;
      
      // Register the robot with the server
      registerRobot();
      
      // Start sending updates
      startSendingUpdates();
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        console.log('Received message:', message);
        
        // Handle different message types
        if (message.type === 'registered') {
          console.log('Robot registered successfully with the server');
          isRegistered = true;
          
          if (message.assignment) {
            console.log('Robot is assigned to template:', message.assignment);
          }
        } else if (message.type === 'error') {
          console.error('Error from server:', message.message);
        } else if (message.type === 'status_updated') {
          console.log('Status update confirmed');
        } else if (message.type === 'position_updated') {
          console.log('Position update confirmed');
        } else if (message.type === 'sensors_updated') {
          console.log('Sensor data update confirmed');
        } else if (message.type === 'task_info') {
          console.log('Current task:', message.task);
        }
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket connection closed');
      isConnected = false;
      isRegistered = false;
      
      // Try to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Reconnecting in ${RECONNECT_DELAY/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.error('Maximum reconnection attempts reached. Giving up.');
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  } catch (error) {
    console.error('Error creating WebSocket connection:', error);
  }
}

// Register the robot with the server
function registerRobot() {
  if (!isConnected) return;
  
  console.log('Registering robot with server...');
  ws.send(JSON.stringify({
    type: 'register',
    serialNumber: ROBOT_CONFIG.serialNumber,
    model: ROBOT_CONFIG.model
  }));
}

// Collect and send robot status data
function sendStatusUpdate() {
  if (!isConnected || !isRegistered) return;
  
  // In a real implementation, you would get this data from your robot
  const statusData = {
    type: 'status_update',
    status: {
      battery: 85, // Battery percentage
      status: 'active', // Current status: 'active', 'idle', 'charging', 'error'
      mode: 'autonomous', // Current mode: 'autonomous', 'manual', 'sleep'
    }
  };
  
  console.log('Sending status update...');
  ws.send(JSON.stringify(statusData));
}

// Collect and send robot position data
function sendPositionUpdate() {
  if (!isConnected || !isRegistered) return;
  
  // In a real implementation, you would get this data from your robot's sensors
  const positionData = {
    type: 'position_update',
    position: {
      x: 120, // X coordinate
      y: 80,  // Y coordinate
      z: 0,   // Z coordinate (height)
      orientation: 90, // Degrees (0-359)
      speed: 0.5 // Current speed
    }
  };
  
  console.log('Sending position update...');
  ws.send(JSON.stringify(positionData));
}

// Collect and send robot sensor data
function sendSensorUpdate() {
  if (!isConnected || !isRegistered) return;
  
  // In a real implementation, you would get this data from your robot's sensors
  const sensorData = {
    type: 'sensor_update',
    sensors: {
      temperature: 22.5, // Temperature in Celsius
      humidity: 45,      // Humidity percentage
      proximity: [100, 120, 80, 90], // Proximity sensors data (distances in cm)
      battery: 85       // Battery percentage
    }
  };
  
  console.log('Sending sensor update...');
  ws.send(JSON.stringify(sensorData));
}

// Request current task from server
function requestTask() {
  if (!isConnected || !isRegistered) return;
  
  console.log('Requesting current task...');
  ws.send(JSON.stringify({
    type: 'get_task'
  }));
}

// Start sending regular updates
function startSendingUpdates() {
  // Send initial updates
  setTimeout(() => {
    sendStatusUpdate();
    sendPositionUpdate();
    sendSensorUpdate();
    requestTask();
  }, 1000);
  
  // Set up regular updates
  setInterval(sendStatusUpdate, 10000);  // Update status every 10 seconds
  setInterval(sendPositionUpdate, 2000); // Update position every 2 seconds
  setInterval(sendSensorUpdate, 5000);   // Update sensors every 5 seconds
  setInterval(requestTask, 30000);       // Request task every 30 seconds
}

// Main function
function main() {
  console.log('Starting robot WebSocket client...');
  console.log('Robot configuration:', ROBOT_CONFIG);
  console.log('Server URL:', SERVER_URL);
  
  // Connect to the WebSocket server
  connectWebSocket();
  
  // Set up signal handlers for graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (ws) {
      ws.close();
    }
    process.exit(0);
  });
}

// Run the client
main();