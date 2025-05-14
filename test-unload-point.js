/**
 * Test script for testing the toUnloadPoint action
 * 
 * This script tests both regular shelf points and the drop-off location
 * to verify that the rack_area_id is correctly extracted in both cases
 */

import axios from 'axios';

async function testUnloadPoint() {
  try {
    console.log('Testing toUnloadPoint action...');
    
    // First, test a regular shelf point (e.g., 104_load)
    console.log('\n--- Testing shelf point (104_load) ---');
    const shelfPayload = {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: '104_load'
      }
    };
    console.log('Request payload:', JSON.stringify(shelfPayload, null, 2));
    
    const shelfResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', shelfPayload);
    
    console.log('Shelf point test response:', JSON.stringify(shelfResponse.data, null, 2));
    
    // Then, test the drop-off point
    console.log('\n--- Testing drop-off point (drop-off_load) ---');
    const dropOffPayload = {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: 'drop-off_load'
      }
    };
    console.log('Request payload:', JSON.stringify(dropOffPayload, null, 2));
    
    const dropOffResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', dropOffPayload);
    
    console.log('Drop-off point test response:', JSON.stringify(dropOffResponse.data, null, 2));
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing toUnloadPoint action:', error.response?.data || error.message);
  }
}

// Self-executing async function for ESM
(async () => {
  await testUnloadPoint();
})();