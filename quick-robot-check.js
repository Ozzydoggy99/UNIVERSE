// Quick Robot Module Check
import axios from 'axios';

// Configuration
const ROBOT_IP = "192.168.25.25"; 
const ROBOT_PORT = 8090;
const ROBOT_SECRET = "your-secret-key-here"; // Replace with actual secret

// Primary module location to check
const PRIMARY_MODULE_PATH = "/storage/emulated/0/Documents/modules/";

// Check if a directory exists and list its contents
async function checkDirectory(path) {
  try {
    console.log(`Checking directory ${path}...`);
    
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `ls -la ${path}`
      },
      timeout: 5000 // 5 second timeout
    });
    
    console.log("Directory listing result:");
    console.log(response.data.output || "No output");
    
    return response.data.output;
  } catch (error) {
    console.error(`Error checking directory: ${error.message}`);
    return null;
  }
}

// Check if modules are running
async function checkRunningModules() {
  try {
    console.log("Checking for running modules...");
    
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: {
        command: `ps -ef | grep "robot-ai" | grep -v grep`
      },
      timeout: 5000 // 5 second timeout
    });
    
    console.log("Process check result:");
    console.log(response.data.output || "No processes found");
    
    return response.data.output;
  } catch (error) {
    console.error(`Error checking processes: ${error.message}`);
    return null;
  }
}

// Run the check
async function runCheck() {
  console.log("=== Quick Robot AI Module Check ===");
  console.log(`Robot: ${ROBOT_IP}:${ROBOT_PORT}`);
  console.log("Time: " + new Date().toISOString());
  console.log("");
  
  // First check the Documents directory structure
  await checkDirectory("/storage/emulated/0/Documents/");
  
  // Then check the modules directory
  const modulesDirOutput = await checkDirectory(PRIMARY_MODULE_PATH);
  
  // Check for running processes
  const processOutput = await checkRunningModules();
  
  // Print summary
  console.log("\n=== Check Summary ===");
  if (modulesDirOutput && modulesDirOutput.includes("robot-ai")) {
    console.log("✅ Robot AI modules appear to be installed");
  } else {
    console.log("❌ Robot AI modules not found in primary location");
  }
  
  if (processOutput && processOutput.includes("python")) {
    console.log("✅ Robot AI processes are running");
  } else {
    console.log("❌ No Robot AI processes found running");
  }
}

// Run the quick check
runCheck().catch(error => {
  console.error("Error running check:", error);
});