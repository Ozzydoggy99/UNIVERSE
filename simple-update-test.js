// Simple Robot AI Update Test
import axios from 'axios';

// Robot connection details
const ROBOT_IP = "192.168.25.25";
const ROBOT_PORT = 8090;
const ROBOT_SECRET = "your-secret-key-here"; // Replace with actual secret

// Execute a command on the robot
async function executeCommand(command) {
  try {
    console.log(`Executing command: ${command}`);
    
    const response = await axios({
      method: 'post',
      url: `http://${ROBOT_IP}:${ROBOT_PORT}/api/command`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Secret ${ROBOT_SECRET}`
      },
      data: { command },
      timeout: 5000 // 5 second timeout
    });
    
    return response.data.output || '';
  } catch (error) {
    console.error(`Command error: ${error.message}`);
    return null;
  }
}

async function runTest() {
  console.log('=== Simple Robot AI Update Test ===');
  console.log(`Robot: ${ROBOT_IP}:${ROBOT_PORT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');
  
  // Check if modules exist by searching for them
  console.log('Checking for Robot AI modules...');
  const findResult = await executeCommand('find /storage -name "robot-ai-*.py" 2>/dev/null | head -5');
  
  if (findResult) {
    console.log('\n✅ Found Robot AI modules:');
    console.log(findResult);
  } else {
    console.log('\n❌ No Robot AI modules found in standard locations.');
    console.log('Checking alternate locations...');
    
    // Check content URIs
    const contentResult = await executeCommand('ls -la /sdcard/Documents/modules/ 2>/dev/null');
    
    if (contentResult && contentResult.includes('robot-ai')) {
      console.log('\n✅ Found Robot AI modules in /sdcard/Documents/modules/');
      console.log(contentResult);
    } else {
      console.log('\n❌ No modules found in alternate locations.');
    }
  }
  
  // Check if processes are running
  console.log('\nChecking for running processes...');
  const processResult = await executeCommand('ps -ef | grep -i "robot-ai" | grep -v grep');
  
  if (processResult) {
    console.log('\n✅ Robot AI processes are running:');
    console.log(processResult);
  } else {
    console.log('\n❌ No Robot AI processes are running.');
  }
  
  // Try sending a basic WebSocket message
  console.log('\nSending test WebSocket message...');
  const wsTestResult = await executeCommand('echo \'{"op":"subscribe","topic":"/updates/status"}\' | nc -w 1 localhost 8090');
  
  if (wsTestResult) {
    console.log('\nWebSocket test result:');
    console.log(wsTestResult);
  }
  
  console.log('\n=== Test Complete ===');
}

runTest().catch(error => {
  console.error(`Test error: ${error.message}`);
});