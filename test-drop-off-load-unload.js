/**
 * Test script to verify the fix for drop-off_load and drop-off_load_docking points
 * 
 * This script tests the toUnloadPoint action for both regular shelf points
 * and the special drop-off points to verify that the rack_area_id is correctly
 * extracted and used in both cases.
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Points to test
const TEST_POINTS = [
  '104_load',           // Regular shelf point
  '104_load_docking',   // Regular shelf docking point
  'drop-off_load',      // Special hyphenated point
  'drop-off_load_docking' // Special hyphenated docking point
];

/**
 * Test the toUnloadPoint action for a point
 */
async function testToUnloadPoint(pointId) {
  console.log(`\n----- Testing toUnloadPoint for: ${pointId} -----`);
  
  try {
    const response = await axios.post(`${API_BASE_URL}/robot/test-unload-action`, {
      pointId
    });
    
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error(`Error testing ${pointId}:`, error.response ? error.response.data : error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('=== TESTING UNLOAD POINT ACTION WITH VARIOUS POINT IDs ===');
  
  for (const pointId of TEST_POINTS) {
    const result = await testToUnloadPoint(pointId);
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${pointId} - rack_area_id: ${result.rackAreaId}`);
    } else {
      console.log(`❌ FAILED: ${pointId} - ${result.error || 'Unknown error'}`);
    }
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Test script error:', err);
});