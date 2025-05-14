/**
 * Enhanced test script for testing the toUnloadPoint action with verbose logging
 * 
 * This script will test the toUnloadPoint action with both regular shelf points
 * and the special drop-off point with hyphenated ID to verify that rack_area_id
 * extraction is working correctly in both cases.
 */

import axios from 'axios';
import fs from 'fs';

// Helper function to log both to console and file
function log(message) {
  console.log(message);
  fs.appendFileSync('unload-point-test.log', message + '\n');
}

async function testUnloadPoint() {
  try {
    log('==================================================');
    log('TESTING TOUNLOADPOINT ACTION - ' + new Date().toISOString());
    log('==================================================');
    
    // Clear the log file
    if (fs.existsSync('unload-point-test.log')) {
      fs.unlinkSync('unload-point-test.log');
    }
    
    // First, test a regular shelf point (e.g., 104_load)
    log('\n----- TESTING SHELF POINT (104_load) -----');
    const shelfPayload = {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: '104_load',
        // Short timeout for testing
        maxRetries: 3
      }
    };
    log('Request payload: ' + JSON.stringify(shelfPayload, null, 2));
    
    try {
      const shelfResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', shelfPayload);
      log('Shelf point test response: ' + JSON.stringify(shelfResponse.data, null, 2));
    } catch (error) {
      log('ERROR with shelf point test: ' + error.message);
      if (error.response) {
        log('Response status: ' + error.response.status);
        log('Response data: ' + JSON.stringify(error.response.data, null, 2));
      }
    }
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then, test the drop-off point
    log('\n----- TESTING DROP-OFF POINT (drop-off_load) -----');
    const dropOffPayload = {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: 'drop-off_load',
        // Short timeout for testing
        maxRetries: 3
      }
    };
    log('Request payload: ' + JSON.stringify(dropOffPayload, null, 2));
    
    try {
      const dropOffResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', dropOffPayload);
      log('Drop-off point test response: ' + JSON.stringify(dropOffResponse.data, null, 2));
    } catch (error) {
      log('ERROR with drop-off point test: ' + error.message);
      if (error.response) {
        log('Response status: ' + error.response.status);
        log('Response data: ' + JSON.stringify(error.response.data, null, 2));
      }
    }
    
    log('\nTest completed!');
  } catch (error) {
    log('Error in test: ' + error.message);
  }
}

// Execute the test
(async () => {
  await testUnloadPoint();
})();