// Script to check if Robot AI modules are properly installed
import axios from 'axios';
import fs from 'fs';

// Configuration
const ROBOT_IP = process.env.ROBOT_IP || "192.168.25.25";
const ROBOT_PORT = process.env.ROBOT_PORT || 8090;
const ROBOT_SECRET = process.env.ROBOT_SECRET || "";

// Common module locations to check
const MODULE_LOCATIONS = [
  "/storage/emulated/0/Documents/modules/robot-ai-core.py",
  "/storage/emulated/0/Documents/modules/robot-ai-camera.py",
  "/storage/emulated/0/Documents/modules/robot-ai-map.py",
  "/storage/emulated/0/Documents/modules/robot-ai-updater.py",
  "/sdcard/Documents/modules/robot-ai-core.py", 
  "/sdcard/Documents/modules/robot-ai-camera.py",
  "/sdcard/Documents/modules/robot-ai-map.py",
  "/sdcard/Documents/modules/robot-ai-updater.py",
  "/data/local/tmp/robot-ai-core.py",
  "/data/local/tmp/robot-ai-camera.py",
  "/data/local/tmp/robot-ai-map.py",
  "/data/local/tmp/robot-ai-updater.py"
];

// Android content URIs to check
const CONTENT_URIS = [
  "content://com.android.providers.media.documents/document/documents_bucket%3Amodules%2Frobot-ai-core.py",
  "content://com.android.providers.media.documents/document/documents_bucket%3Amodules%2Frobot-ai-camera.py",
  "content://com.android.providers.media.documents/document/documents_bucket%3Amodules%2Frobot-ai-map.py",
  "content://com.android.providers.media.documents/document/documents_bucket%3Amodules%2Frobot-ai-updater.py"
];

// Check if a file exists on the robot
async function checkFile(path) {
  try {
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `ls -la ${path}`
      }
    });
    
    const result = response.data;
    if (result && result.output && !result.output.includes("No such file")) {
      console.log(`✅ File exists: ${path}`);
      console.log(`   Permissions: ${result.output.split('\n')[0]}`);
      return true;
    } else {
      console.log(`❌ File not found: ${path}`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking file ${path}: ${error.message}`);
    return false;
  }
}

// Check if a content URI exists on Android
async function checkContentUri(uri) {
  try {
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `cat ${uri}`
      }
    });
    
    if (response.data && response.data.output && response.data.output.includes("Robot AI")) {
      console.log(`✅ Content URI exists: ${uri}`);
      return true;
    } else {
      console.log(`❌ Content URI not found or not accessible: ${uri}`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking content URI ${uri}: ${error.message}`);
    return false;
  }
}

// Check if the modules service is running
async function checkService() {
  try {
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `ps -ef | grep "robot-ai" | grep -v grep`
      }
    });
    
    if (response.data && response.data.output && response.data.output.includes("python")) {
      console.log(`✅ Robot AI service is running`);
      console.log(`   Process info: ${response.data.output.trim()}`);
      return true;
    } else {
      console.log(`❌ Robot AI service is not running`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking service: ${error.message}`);
    return false;
  }
}

// Check for WebSocket connections
async function checkWebSocket() {
  try {
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `netstat -an | grep ESTABLISHED | grep ${ROBOT_PORT}`
      }
    });
    
    if (response.data && response.data.output && response.data.output.includes("ESTABLISHED")) {
      console.log(`✅ WebSocket connections established`);
      console.log(`   Connection info: ${response.data.output.trim()}`);
      return true;
    } else {
      console.log(`❌ No WebSocket connections found`);
      return false;
    }
  } catch (error) {
    console.error(`Error checking WebSocket: ${error.message}`);
    return false;
  }
}

// Send a command to the updater module
async function sendUpdateCommand(command = "status") {
  try {
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/ws`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        topic: "/updates/command",
        command: command
      }
    });
    
    console.log(`✅ Sent update command: ${command}`);
    console.log(`   Response: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    console.error(`Error sending update command: ${error.message}`);
    return false;
  }
}

// Run all checks
async function runChecks() {
  console.log("=== Checking Robot AI Module Installation ===");
  console.log(`Robot: ${ROBOT_IP}:${ROBOT_PORT}`);
  console.log("Time: " + new Date().toISOString());
  console.log("");
  
  console.log("=== Checking File System Paths ===");
  let filesFound = 0;
  for (const path of MODULE_LOCATIONS) {
    if (await checkFile(path)) {
      filesFound++;
    }
  }
  
  console.log("\n=== Checking Android Content URIs ===");
  let urisFound = 0;
  for (const uri of CONTENT_URIS) {
    if (await checkContentUri(uri)) {
      urisFound++;
    }
  }
  
  console.log("\n=== Checking Service Status ===");
  const serviceRunning = await checkService();
  
  console.log("\n=== Checking WebSocket Connections ===");
  const wsConnected = await checkWebSocket();
  
  if (filesFound > 0 || urisFound > 0) {
    console.log("\n✅ Robot AI modules are installed");
    
    if (serviceRunning) {
      console.log("✅ Robot AI service is running");
    } else {
      console.log("⚠️ Robot AI modules are installed but service is not running");
    }
    
    if (wsConnected) {
      console.log("✅ WebSocket connections are established");
    } else {
      console.log("⚠️ WebSocket connections not found");
    }
    
    // If everything is good, try to send a status command to the updater
    if (serviceRunning && wsConnected) {
      console.log("\n=== Checking Updater Module ===");
      await sendUpdateCommand("status");
    }
  } else {
    console.log("\n❌ No Robot AI modules found on the robot");
    console.log("Try running the installer again or check for permissions issues");
  }
}

// Run all checks
runChecks().catch(error => {
  console.error("Error running checks:", error);
});