/**
 * Comprehensive test for the toUnloadPoint action
 * 
 * This script directly tests both regular shelf points and drop-off points
 * to verify our rack_area_id extraction fixes are working correctly.
 * 
 * The script also logs detailed information about the commands sent to the robot API.
 */

import axios from 'axios';
import fs from 'fs';

// Configuration
const API_BASE_URL = 'http://localhost:5000';
const LOG_FILE = 'unload-point-test.log';

// Clean log file
fs.writeFileSync(LOG_FILE, '');

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Write to log file
  fs.appendFileSync(LOG_FILE, logMessage);
  
  // Also output to console
  console.log(message);
}

/**
 * Test the toUnloadPoint action for both regular and drop-off points
 */
async function testUnloadOperations() {
  log('=== TESTING TO-UNLOAD-POINT ACTION WITH FIXED RACK_AREA_ID EXTRACTION ===');
  
  // Test with regular shelf point first
  await testRegularShelfPoint();
  
  // Wait a bit between tests
  log('Waiting 3 seconds before next test...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test with drop-off point
  await testDropOffPoint();
  
  log('\nAll tests completed. Check the log file for detailed results.');
}

/**
 * Test the toUnloadPoint action with a regular shelf point
 */
async function testRegularShelfPoint() {
  log('\n--- TEST 1: Regular Shelf Point ---');
  
  const pointId = '104_load';
  log(`Testing toUnloadPoint action with regular shelf point: ${pointId}`);
  
  try {
    // Call the API endpoint directly
    const response = await axios.post(`${API_BASE_URL}/api/execute-step`, {
      actionId: 'toUnloadPoint',
      params: {
        pointId
      }
    });
    
    log(`✅ Regular shelf point test SUCCESS: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    log(`❌ Regular shelf point test FAILED: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

/**
 * Test the toUnloadPoint action with a drop-off point
 */
async function testDropOffPoint() {
  log('\n--- TEST 2: Drop-off Point ---');
  
  const pointId = 'drop-off_load';
  log(`Testing toUnloadPoint action with drop-off point: ${pointId}`);
  
  try {
    // Call the API endpoint directly
    const response = await axios.post(`${API_BASE_URL}/api/execute-step`, {
      actionId: 'toUnloadPoint',
      params: {
        pointId
      }
    });
    
    log(`✅ Drop-off point test SUCCESS: ${JSON.stringify(response.data)}`);
    return true;
  } catch (error) {
    log(`❌ Drop-off point test FAILED: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

// Run the test
testUnloadOperations().catch(error => {
  log(`❌ Unexpected error: ${error.message}`);
});