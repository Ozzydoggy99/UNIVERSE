/**
 * Test script to verify our fix for the to_unload_point action in the mission-queue system
 * 
 * This script tests both regular shelf points and the drop-off location
 * to verify that the rack_area_id is correctly extracted in both cases.
 * 
 * Usage: node test-unload-fix.js
 */

import axios from 'axios';

// Configuration
const API_BASE_URL = 'http://localhost:5000';

async function testUnloadFix() {
  console.log('=== Testing to_unload_point with fixed rack_area_id handling ===');
  
  // Test the fix with a regular shelf point
  try {
    const shelfResponse = await axios.post(`${API_BASE_URL}/api/workflows/execute`, {
      workflowType: 'central-to-shelf',
      params: {
        shelfId: '104' // Use shelf ID 104 as our test case
      }
    });
    
    console.log(`✅ Regular shelf point workflow submitted successfully: ${JSON.stringify(shelfResponse.data)}`);
  } catch (error) {
    console.error('❌ Error with shelf point workflow:', error.response?.data || error.message);
  }
  
  // Wait a bit to avoid overwhelming the system
  console.log('Waiting 5 seconds before next test...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test the fix with drop-off point
  try {
    const dropoffResponse = await axios.post(`${API_BASE_URL}/api/workflows/execute`, {
      workflowType: 'shelf-to-central',
      params: {
        shelfId: '104' // This will use the drop-off point for final delivery
      }
    });
    
    console.log(`✅ Drop-off point workflow submitted successfully: ${JSON.stringify(dropoffResponse.data)}`);
  } catch (error) {
    console.error('❌ Error with drop-off point workflow:', error.response?.data || error.message);
  }
  
  console.log('\nTest complete. Check the server logs for detailed execution information.');
}

// Run the test
testUnloadFix().catch(error => {
  console.error('Unexpected error:', error);
});