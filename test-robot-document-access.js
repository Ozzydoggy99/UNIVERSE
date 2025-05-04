import fetch from 'node-fetch';
import 'dotenv/config';

// Server information
const robotIP = '192.168.4.31';
const robotPort = 8090;
const robotAPIUrl = `http://${robotIP}:${robotPort}`;
const robotSecret = process.env.ROBOT_SECRET;

// Paths to check
const possiblePaths = [
  '/app/Documents/modules',
  '/Documents/modules',
  '/data/Documents/modules',
  '/home/robot/Documents/modules',
  '/opt/Documents/modules',
  '/Documents',
  '/home/robot/Documents'
];

async function executeCommand(command) {
  console.log(`Executing command: ${command}`);
  
  try {
    const response = await fetch(`${robotAPIUrl}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${robotSecret}`
      },
      body: JSON.stringify({
        command: command
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error executing command:`, error.message);
    return { error: error.message };
  }
}

async function testPaths() {
  for (const path of possiblePaths) {
    console.log(`\nChecking path: ${path}`);
    
    // First check if the directory exists
    const dirCheckResult = await executeCommand(`test -d "${path}" && echo "exists" || echo "not exists"`);
    console.log(`Directory check result:`, dirCheckResult);
    
    if (dirCheckResult.stdout?.trim() === 'exists') {
      console.log(`Directory ${path} exists. Checking contents...`);
      
      // List directory contents
      const listResult = await executeCommand(`ls -la "${path}" | head -n 20`);
      console.log(`Directory listing:`, listResult);
      
      // Try to find Python files
      const pythonFilesResult = await executeCommand(`find "${path}" -name "*.py" -type f | head -n 5`);
      console.log(`Python files:`, pythonFilesResult);
    }
  }
}

// Try to directly check specific files
async function checkSpecificFiles() {
  console.log("\nChecking specific files:");
  
  const specificFiles = [
    '/app/Documents/modules/core.py',
    '/app/Documents/modules/camera.py',
    '/Documents/modules/core.py',
    '/Documents/modules/camera.py',
  ];
  
  for (const file of specificFiles) {
    const fileCheckResult = await executeCommand(`test -f "${file}" && echo "exists" || echo "not exists"`);
    console.log(`File ${file}: ${fileCheckResult.stdout?.trim()}`);
    
    if (fileCheckResult.stdout?.trim() === 'exists') {
      // Get file info
      const fileInfoResult = await executeCommand(`stat "${file}"`);
      console.log(`File info:`, fileInfoResult);
      
      // Try to read first few lines
      const fileContentResult = await executeCommand(`head -n 10 "${file}"`);
      console.log(`File content (first 10 lines):`, fileContentResult);
    }
  }
}

// Check if the robot has a 'find' command
async function checkRobotCommands() {
  console.log("\nChecking available commands on robot:");
  
  const commands = ['find', 'ls', 'grep', 'stat', 'file'];
  
  for (const cmd of commands) {
    const cmdCheckResult = await executeCommand(`which ${cmd} 2>/dev/null || echo "not available"`);
    console.log(`Command ${cmd}: ${cmdCheckResult.stdout?.trim()}`);
  }
}

// Get robot system information
async function getRobotInfo() {
  console.log("\nGetting robot system information:");
  
  const commands = [
    'uname -a',
    'df -h | grep -v tmpfs',
    'find /app -type d -maxdepth 2 | sort'
  ];
  
  for (const cmd of commands) {
    const infoResult = await executeCommand(cmd);
    console.log(`${cmd}:`, infoResult);
  }
}

async function main() {
  if (!robotSecret) {
    console.error('ERROR: ROBOT_SECRET not found in environment variables');
    return 1;
  }
  
  console.log("Testing robot connection...");
  const testResult = await executeCommand('echo "Connection test successful"');
  console.log("Connection test result:", testResult);
  
  if (testResult.stdout) {
    await checkRobotCommands();
    await getRobotInfo();
    await testPaths();
    await checkSpecificFiles();
  }
  
  return 0;
}

main().catch(console.error);