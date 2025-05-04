// Verify Robot AI Updater via WebSocket
import WebSocket from 'ws';

// Configuration
const ROBOT_IP = "192.168.25.25";
const ROBOT_PORT = 8090;
const ROBOT_SECRET = "your-secret-key-here"; // Replace with actual secret

// Connect to robot WebSocket
function connectToRobot() {
  console.log(`Connecting to robot WebSocket at ${ROBOT_IP}:${ROBOT_PORT}...`);
  
  const ws = new WebSocket(`ws://${ROBOT_IP}:${ROBOT_PORT}/ws`);
  
  ws.on('open', () => {
    console.log('WebSocket connection established!');
    
    // Subscribe to updater topics
    const subscribeMsg = JSON.stringify({
      op: "subscribe",
      topics: ["/updates/status"]
    });
    ws.send(subscribeMsg);
    console.log('Subscribed to /updates/status topic');
    
    // Send status command to updater
    setTimeout(() => {
      const commandMsg = JSON.stringify({
        topic: "/updates/command",
        command: "status"
      });
      ws.send(commandMsg);
      console.log('Sent status command to updater');
      
      // Set a timeout to close the connection if no response
      setTimeout(() => {
        console.log('No response received within timeout period');
        ws.close();
      }, 10000); // 10 second timeout
    }, 1000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received message:');
      console.log(JSON.stringify(message, null, 2));
      
      // Check if this is an update status message
      if (message.topic === "/updates/status") {
        console.log('\n=== Updater Status ===');
        
        // Extract useful information
        const status = message.data.status;
        console.log(`Status: ${status}`);
        
        if (status === "status" && message.data.data) {
          const moduleData = message.data.data;
          console.log(`Update state: ${moduleData.update_state}`);
          console.log(`Modules directory: ${moduleData.modules_dir}`);
          
          if (moduleData.modules) {
            console.log('\nInstalled modules:');
            for (const [moduleName, moduleInfo] of Object.entries(moduleData.modules)) {
              console.log(`- ${moduleName}: version ${moduleInfo.version}`);
            }
          }
          
          // Success - we've verified the updater is working
          console.log('\n✅ Updater module is installed and responding');
        } else if (status === "updates_available") {
          console.log('\nAvailable updates:');
          for (const update of message.data.updates) {
            console.log(`- ${update.module}: version ${update.version}`);
          }
        }
        
        // Close the connection after receiving a status response
        setTimeout(() => {
          ws.close();
        }, 500);
      }
    } catch (error) {
      console.error(`Error processing message: ${error.message}`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error: ${error.message}`);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
  
  return ws;
}

// Run the verification
console.log("=== Verifying Robot AI Updater ===");
console.log(`Robot: ${ROBOT_IP}:${ROBOT_PORT}`);
console.log("Time: " + new Date().toISOString());
console.log("");

const connection = connectToRobot();

// Set a timeout for the entire verification process
setTimeout(() => {
  console.log("Verification process completed (timeout)");
  process.exit(0);
}, 15000); // 15 second timeout