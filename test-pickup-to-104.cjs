/**
 * Test script to pick up a bin from the main pickup point (Pick-up_Load)
 * and deliver it to the 104 point (104_Load)
 * 
 * This script uses the correct pickup point (Pick-up_Load) rather than the Drop-off_Load point.
 */
const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE = 'http://localhost:5000/api';

// Helper function to log test output
function logMessage(message) {
  console.log(message);
  // Also append to a log file for later review
  fs.appendFileSync('pickup-to-104-test.log', `${new Date().toISOString()} - ${message}\n`);
}

async function testPickupTo104() {
  try {
    logMessage('🚀 Starting test: Pickup from main pickup point to 104 workflow...');
    
    // Use the specific pickup-to-104 workflow we created exactly for this purpose
    const response = await axios.post(`${API_BASE}/pickup-to-104/workflow`);
    
    if (!response.data.success) {
      throw new Error(`Failed to start workflow: ${response.data.error}`);
    }
    
    const missionId = response.data.missionId;
    logMessage(`✅ Workflow started with mission ID: ${missionId}`);
    logMessage(`Total workflow steps: ${response.data.steps}`);
    
    logMessage('This workflow will:');
    logMessage('1. Go to pickup docking point (Pick-up_Load_docking)');
    logMessage('2. Align with rack at pickup point (Pick-up_Load)');
    logMessage('3. Jack up to grab bin');
    logMessage('4. Go to 104 docking point (104_Load_docking)');
    logMessage('5. Move to 104 point (104_Load) for precise dropoff');
    logMessage('6. Jack down to release bin');
    logMessage('7. Move away from 104 for safety');
    logMessage('8. (Optional) Return to charger if available');
    
    logMessage('❗ IMPORTANT: The mission is now in progress on the robot.');
    logMessage('❗ Test complete. The robot will continue executing the workflow.');
    logMessage('❗ If you need to stop the robot for any reason, use the emergency stop button or cancel the mission via the API.');
    
  } catch (error) {
    logMessage(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

// Run the test
testPickupTo104();