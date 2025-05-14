/**
 * Test script for testing the toUnloadPoint action
 * 
 * This script tests both regular shelf points and the drop-off location
 * to verify that the rack_area_id is correctly extracted in both cases
 */

const axios = require('axios');

async function testUnloadPoint() {
  try {
    console.log('Testing toUnloadPoint action...');
    
    // First, test a regular shelf point (e.g., 104_load)
    console.log('\n--- Testing shelf point (104_load) ---');
    const shelfResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: '104_load'
      }
    });
    
    console.log('Shelf point test response:', shelfResponse.data);
    
    // Then, test the drop-off point
    console.log('\n--- Testing drop-off point (drop-off_load) ---');
    const dropOffResponse = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: 'drop-off_load'
      }
    });
    
    console.log('Drop-off point test response:', dropOffResponse.data);
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing toUnloadPoint action:', error.response?.data || error.message);
  }
}

testUnloadPoint();