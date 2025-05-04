import fetch from 'node-fetch';
import 'dotenv/config';

async function checkRobotFile(path) {
  const robotSerialNumber = 'L382502104987ir';
  const robotSecret = process.env.ROBOT_SECRET;
  
  if (!robotSecret) {
    console.error('ERROR: ROBOT_SECRET not found in environment variables');
    return;
  }
  
  const robotApiUrl = 'http://192.168.4.31:8090';
  
  try {
    const response = await fetch(`${robotApiUrl}/services/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${robotSecret}`
      },
      body: JSON.stringify({
        command: `test -f ${path} && echo "File exists: ${path}" || echo "File does not exist: ${path}"`
      })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(result.stdout?.trim() || 'No output');
    
    return result;
  } catch (error) {
    console.error(`Error checking file ${path}:`, error.message);
  }
}

// List of paths to check
const pathsToCheck = [
  '/tmp/robot-ai-core.py',
  '/tmp/start-robot-ai.sh',
  '/tmp/robot-ai-status.txt',
  '/home/robot/robot-ai/core.py',
  '/home/robot/robot-ai/camera.py',
  '/home/robot/robot-ai/map.py',
  '/home/robot/ai/core.py'
];

// Check all paths
async function checkAllPaths() {
  for (const path of pathsToCheck) {
    console.log(`Checking: ${path}`);
    await checkRobotFile(path);
    console.log('---');
  }
}

// Add more paths to check
pathsToCheck.push(
  '/tmp/ai/core.py',
  '/tmp/ai/camera.py',
  '/tmp/ai/map.py',
  '/tmp/robot-ai/core.py',
  '/tmp/robot/core.py',
  '/ai/core.py',
  '/robot/core.py',
  '/home/robot/core.py',
  '/robot-ai-core.py'
);

checkAllPaths();