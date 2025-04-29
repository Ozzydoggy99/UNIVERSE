/**
 * Robot Integration Client Example
 * 
 * This is a sample script to demonstrate how to connect your physical robot
 * to the web application. You can use this as a reference for integrating
 * your own robot control software.
 * 
 * Instructions:
 * 1. Replace the ROBOT_CONFIG values with your robot's details
 * 2. The SERVER_URL should point to your deployed application
 * 3. Run this script on the machine that controls your robot
 * 4. Adapt the updateRobotStatus, updatePosition, and updateSensors functions
 *    to read actual data from your robot's sensors
 */

const axios = require('axios');

// Configuration - Replace these with your actual robot's details
const ROBOT_CONFIG = {
  serialNumber: "ROBOT123",  // Your robot's serial number
  model: "YourModel", // Your robot's model
  templateId: 1  // Optional: The template ID to assign to your robot (if you have one)
};

// Server configuration - Change this to your actual server URL
// Example: const SERVER_URL = 'https://your-app-name.replit.app';
const SERVER_URL = 'http://localhost:5000';

// Initialize the robot with the server
async function registerRobot() {
  try {
    console.log('Registering robot with server...');
    const response = await axios.post(`${SERVER_URL}/api/robots/register`, {
      serialNumber: ROBOT_CONFIG.serialNumber,
      model: ROBOT_CONFIG.model,
      templateId: ROBOT_CONFIG.templateId
    });
    
    console.log('Robot registered successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error registering robot:', error.response?.data || error.message);
    throw error;
  }
}

// Update robot status (battery, operational status, etc.)
async function updateRobotStatus() {
  try {
    // In a real implementation, you would get this data from your robot
    const statusData = {
      battery: 85, // Battery percentage
      status: 'active', // Current status: 'active', 'idle', 'charging', 'error'
      mode: 'autonomous', // Current mode: 'autonomous', 'manual', 'sleep'
    };
    
    console.log('Updating robot status...');
    const response = await axios.post(`${SERVER_URL}/api/robots/status/${ROBOT_CONFIG.serialNumber}`, statusData);
    console.log('Status updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating robot status:', error.response?.data || error.message);
  }
}

// Update robot position
async function updatePosition() {
  try {
    // In a real implementation, you would get this data from your robot's sensors
    const positionData = {
      x: 120, // X coordinate
      y: 80,  // Y coordinate
      z: 0,   // Z coordinate (height)
      orientation: 90, // Degrees (0-359)
      speed: 0.5 // Current speed
    };
    
    console.log('Updating robot position...');
    const response = await axios.post(`${SERVER_URL}/api/robots/position/${ROBOT_CONFIG.serialNumber}`, positionData);
    console.log('Position updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating robot position:', error.response?.data || error.message);
  }
}

// Update robot sensor data
async function updateSensors() {
  try {
    // In a real implementation, you would get this data from your robot's sensors
    const sensorData = {
      temperature: 22.5, // Temperature in Celsius
      humidity: 45,      // Humidity percentage
      proximity: [100, 120, 80, 90], // Proximity sensors data (distances in cm)
      battery: 85       // Battery percentage
    };
    
    console.log('Updating robot sensor data...');
    const response = await axios.post(`${SERVER_URL}/api/robots/sensors/${ROBOT_CONFIG.serialNumber}`, sensorData);
    console.log('Sensor data updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating sensor data:', error.response?.data || error.message);
  }
}

// Get robot's current template assignment
async function getRobotAssignment() {
  try {
    console.log('Getting robot template assignment...');
    const response = await axios.get(`${SERVER_URL}/api/robot-assignments/by-serial/${ROBOT_CONFIG.serialNumber}`);
    console.log('Robot assignment:', response.data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('Robot is not assigned to any template');
      return null;
    }
    console.error('Error getting robot assignment:', error.response?.data || error.message);
  }
}

// Main function to run the example
async function main() {
  try {
    console.log('Starting robot integration client...');
    console.log('Robot configuration:', ROBOT_CONFIG);
    console.log('Server URL:', SERVER_URL);
    
    // Register the robot first
    await registerRobot();
    
    // Get current assignment
    await getRobotAssignment();
    
    // Set up regular updates
    console.log('Starting regular updates...');
    
    // Update status every 10 seconds
    setInterval(updateRobotStatus, 10000);
    
    // Update position every 2 seconds
    setInterval(updatePosition, 2000);
    
    // Update sensor data every 5 seconds
    setInterval(updateSensors, 5000);
    
    console.log('Robot client is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Run the client
main();