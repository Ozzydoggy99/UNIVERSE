/**
 * Robot WebSocket Connection Test
 * 
 * This script tests the WebSocket connection between your robot and the server
 * by connecting to the WebSocket endpoint and sending various message types.
 */

import { WebSocket } from 'ws';

// Server configuration - Change this to your actual server URL if needed
const SERVER_URL = 'ws://localhost:5000/ws/robot';

// Test robot configuration
const TEST_ROBOT = {
  serialNumber: "TEST-ROBOT-002",
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

// Test messages to send
const testMessages = [
  {
    name: "Robot Registration",
    data: {
      type: "register",
      serialNumber: TEST_ROBOT.serialNumber,
      model: TEST_ROBOT.model
    }
  },
  {
    name: "Status Update",
    data: {
      type: "status_update",
      status: {
        battery: 92,
        status: "active",
        mode: "test"
      }
    }
  },
  {
    name: "Position Update",
    data: {
      type: "position_update",
      position: {
        x: 100,
        y: 200,
        z: 0,
        orientation: 180,
        speed: 0
      }
    }
  },
  {
    name: "Sensor Update",
    data: {
      type: "sensor_update",
      sensors: {
        temperature: 25.4,
        humidity: 65,
        proximity: [50, 75, 100, 85],
        battery: 92
      }
    }
  },
  {
    name: "Task Request",
    data: {
      type: "get_task"
    }
  }
];

// Run the WebSocket tests
function runTests() {
  printMessage("\n🤖 ROBOT WEBSOCKET CONNECTION TEST 🤖\n", colors.bright + colors.cyan);
  printInfo(`Connecting to WebSocket server: ${SERVER_URL}`);
  printInfo(`Test robot: ${TEST_ROBOT.serialNumber} (${TEST_ROBOT.model})\n`);
  
  // Connect to the WebSocket server
  const ws = new WebSocket(SERVER_URL);
  
  // Track the current test message index
  let currentMessageIndex = 0;
  
  // Set up connection handlers
  ws.on('open', () => {
    printSuccess("WebSocket connection established");
    
    // Send the first message (registration)
    sendNextMessage();
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      printInfo("Received response:");
      console.log(message);
      
      // Check response type
      if (message.type === 'error') {
        printError(`Error from server: ${message.message}`);
      } else {
        printSuccess(`Message received: ${message.type}`);
      }
      
      // Send the next message after a delay
      if (currentMessageIndex < testMessages.length) {
        setTimeout(sendNextMessage, 1000);
      } else {
        // All messages sent, close the connection
        printSuccess("\nAll test messages sent successfully!");
        setTimeout(() => {
          ws.close();
        }, 1000);
      }
    } catch (error) {
      printError("Error parsing message:");
      console.error(error);
    }
  });
  
  ws.on('close', () => {
    printInfo("WebSocket connection closed");
    printMessage("\n📊 TEST COMPLETED\n", colors.bright + colors.yellow);
  });
  
  ws.on('error', (error) => {
    printError("WebSocket error:");
    console.error(error);
  });
  
  // Function to send the next test message
  function sendNextMessage() {
    if (currentMessageIndex < testMessages.length) {
      const testMessage = testMessages[currentMessageIndex];
      printInfo(`\nSending test message: ${testMessage.name}`);
      console.log(testMessage.data);
      
      ws.send(JSON.stringify(testMessage.data));
      currentMessageIndex++;
    }
  }
}

// Run the tests
runTests();