// Execute Robot AI Installer Remotely
import axios from 'axios';

// Configuration
let ROBOT_IP = "192.168.25.25"; // Change to your robot's IP
const ROBOT_PORT = 8090;
let ROBOT_SECRET = "your-secret-key-here"; // Replace with your actual robot secret

// The installer path on the robot
const INSTALLER_PATH = "/storage/emulated/0/Download/robot-ai-single-file-installer.py";

async function executeInstaller() {
  console.log(`=== Remote Installer Execution ===`);
  console.log(`Robot: ${ROBOT_IP}:${ROBOT_PORT}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Installer path: ${INSTALLER_PATH}`);
  console.log('');
  
  try {
    // First check if the installer exists
    console.log('Checking if installer file exists...');
    const checkResult = await executeCommand(`ls -la ${INSTALLER_PATH}`);
    
    if (!checkResult || checkResult.includes('No such file')) {
      console.log(`❌ Installer not found at ${INSTALLER_PATH}`);
      console.log('Searching for installer in Downloads directory...');
      
      const findResult = await executeCommand('find /storage/emulated/0/Download -name "robot-ai-*.py" | head -1');
      
      if (findResult && findResult.trim()) {
        const installerPath = findResult.trim();
        console.log(`✅ Found installer at: ${installerPath}`);
        return executeInstallerFile(installerPath);
      } else {
        // Try alternate Downloads directory
        const altFindResult = await executeCommand('find /sdcard/Download -name "robot-ai-*.py" | head -1');
        
        if (altFindResult && altFindResult.trim()) {
          const installerPath = altFindResult.trim();
          console.log(`✅ Found installer at: ${installerPath}`);
          return executeInstallerFile(installerPath);
        } else {
          console.log('❌ Could not find installer in any Download directory');
          console.log('Please ensure the installer has been uploaded to the robot');
          return false;
        }
      }
    } else {
      console.log(`✅ Found installer at: ${INSTALLER_PATH}`);
      return executeInstallerFile(INSTALLER_PATH);
    }
  } catch (error) {
    console.error(`Error executing installer: ${error.message}`);
    return false;
  }
}

async function executeInstallerFile(installerPath) {
  console.log(`\nExecuting installer at ${installerPath}...`);
  console.log('This may take a minute or two to complete.');
  console.log('==================================================');
  
  try {
    // Execute the installer
    const result = await executeCommand(`python ${installerPath}`);
    
    if (result) {
      console.log(result);
      console.log('\n==================================================');
      console.log('✅ Installer command sent successfully');
      console.log('The installer is now running on the robot.');
      console.log('The modules will be installed to the appropriate directory.');
      console.log('The updater service will be configured to run on startup.');
      
      // Check if services are running after a short delay
      console.log('\nWaiting 10 seconds to check if services started...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const serviceCheck = await executeCommand('ps -ef | grep "robot-ai" | grep -v grep');
      if (serviceCheck) {
        console.log('\n✅ Robot AI services are now running:');
        console.log(serviceCheck);
      } else {
        console.log('\n⚠️ No Robot AI services detected yet');
        console.log('This may take some time. You can check again later with:');
        console.log('ps -ef | grep "robot-ai" | grep -v grep');
      }
      
      return true;
    } else {
      console.log('\n❌ No output received from installer command');
      console.log('The command may still be running in the background.');
      console.log('Check the robot logs for more information.');
      return false;
    }
  } catch (error) {
    console.error(`\n❌ Error executing installer: ${error.message}`);
    return false;
  }
}

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
      timeout: 60000 // 60 second timeout
    });
    
    return response.data.output || '';
  } catch (error) {
    console.error(`Command error: ${error.message}`);
    return null;
  }
}

// Get command line arguments for robot IP and secret
const args = process.argv.slice(2);
if (args.length >= 1) {
  // The first argument is the robot IP or serial
  const robotIpOrSerial = args[0];
  if (robotIpOrSerial.includes('.')) {
    // It's an IP address
    ROBOT_IP = robotIpOrSerial;
  }
}

if (args.length >= 2) {
  // The second argument is the robot secret
  ROBOT_SECRET = args[1];
}

// Run the installer execution
executeInstaller().then(success => {
  if (success) {
    console.log('\n✅ Remote installer execution complete');
    console.log('The Robot AI modules should now be installed and running.');
  } else {
    console.log('\n❌ Remote installer execution failed');
    console.log('Please check the error messages above for more information.');
  }
}).catch(error => {
  console.error(`\nFatal error: ${error.message}`);
});