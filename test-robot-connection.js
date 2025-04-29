/**
 * Robot Connection Test Script
 * 
 * This script tests the connectivity between your robot and the server
 * by running through a sequence of API calls to verify that each endpoint
 * is working correctly.
 */

import axios from 'axios';

// Server configuration
const SERVER_URL = 'http://localhost:5000';

// Test robot configuration
const TEST_ROBOT = {
  serialNumber: "TEST-ROBOT-001",
  model: "TestBot 3000"
};

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

// Print a colored message
function printMessage(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// Print a success message
function printSuccess(message) {
  printMessage("✅ " + message, colors.green);
}

// Print an error message
function printError(message) {
  printMessage("❌ " + message, colors.red);
}

// Print an info message
function printInfo(message) {
  printMessage("ℹ️ " + message, colors.cyan);
}

// 1. Test robot registration
async function testRobotRegistration() {
  printInfo("Testing robot registration...");
  try {
    const response = await axios.post(`${SERVER_URL}/api/robots/register`, {
      serialNumber: TEST_ROBOT.serialNumber,
      model: TEST_ROBOT.model
    });
    
    printSuccess("Robot registration successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Robot registration failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 2. Test status update
async function testStatusUpdate() {
  printInfo("Testing status update...");
  try {
    const statusData = {
      battery: 92,
      status: "active",
      mode: "test"
    };
    
    const response = await axios.post(`${SERVER_URL}/api/robots/status/${TEST_ROBOT.serialNumber}`, statusData);
    
    printSuccess("Status update successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Status update failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 3. Test position update
async function testPositionUpdate() {
  printInfo("Testing position update...");
  try {
    const positionData = {
      x: 100,
      y: 200,
      z: 0,
      orientation: 180,
      speed: 0
    };
    
    const response = await axios.post(`${SERVER_URL}/api/robots/position/${TEST_ROBOT.serialNumber}`, positionData);
    
    printSuccess("Position update successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Position update failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 4. Test sensor update
async function testSensorUpdate() {
  printInfo("Testing sensor update...");
  try {
    const sensorData = {
      temperature: 25.4,
      humidity: 65,
      proximity: [50, 75, 100, 85],
      battery: 92
    };
    
    const response = await axios.post(`${SERVER_URL}/api/robots/sensors/${TEST_ROBOT.serialNumber}`, sensorData);
    
    printSuccess("Sensor update successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Sensor update failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 5. Test getting robot status
async function testGetStatus() {
  printInfo("Testing status retrieval...");
  try {
    const response = await axios.get(`${SERVER_URL}/api/robots/status/${TEST_ROBOT.serialNumber}`);
    
    printSuccess("Status retrieval successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Status retrieval failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 6. Test getting robot position
async function testGetPosition() {
  printInfo("Testing position retrieval...");
  try {
    const response = await axios.get(`${SERVER_URL}/api/robots/position/${TEST_ROBOT.serialNumber}`);
    
    printSuccess("Position retrieval successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Position retrieval failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// 7. Test getting robot sensor data
async function testGetSensors() {
  printInfo("Testing sensor data retrieval...");
  try {
    const response = await axios.get(`${SERVER_URL}/api/robots/sensors/${TEST_ROBOT.serialNumber}`);
    
    printSuccess("Sensor data retrieval successful:");
    console.log(response.data);
    return true;
  } catch (error) {
    printError("Sensor data retrieval failed:");
    console.error(error.response?.data || error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  printMessage("\n🤖 ROBOT CONNECTION TEST SUITE 🤖\n", colors.bright + colors.cyan);
  printInfo(`Testing connection to server: ${SERVER_URL}`);
  printInfo(`Test robot: ${TEST_ROBOT.serialNumber} (${TEST_ROBOT.model})\n`);
  
  let results = {};
  
  try {
    // Run tests in sequence
    results.registration = await testRobotRegistration();
    console.log(); // Empty line
    
    results.statusUpdate = await testStatusUpdate();
    console.log();
    
    results.positionUpdate = await testPositionUpdate();
    console.log();
    
    results.sensorUpdate = await testSensorUpdate();
    console.log();
    
    results.getStatus = await testGetStatus();
    console.log();
    
    results.getPosition = await testGetPosition();
    console.log();
    
    results.getSensors = await testGetSensors();
    console.log();
    
    // Print summary
    printMessage("\n📊 TEST RESULTS SUMMARY:\n", colors.bright + colors.yellow);
    
    let allPassed = true;
    Object.entries(results).forEach(([test, passed]) => {
      if (passed) {
        printSuccess(`${test}: PASSED`);
      } else {
        printError(`${test}: FAILED`);
        allPassed = false;
      }
    });
    
    console.log();
    if (allPassed) {
      printSuccess("ALL TESTS PASSED! Your robot connection is working correctly.");
    } else {
      printError("SOME TESTS FAILED. Please check the error messages above.");
    }
  } catch (error) {
    printError("An unexpected error occurred during testing:");
    console.error(error);
  }
}

// Run the tests
runTests();