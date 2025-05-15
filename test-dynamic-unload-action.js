/**
 * Test script for the toUnloadPoint action in the dynamic workflow
 * 
 * This script tests the toUnloadPoint action specifically for drop-off points
 * in the dynamic workflow implementation.
 */

import axios from 'axios';
import fs from 'fs';

// Configuration
const API_BASE_URL = 'http://localhost:5000';
const LOG_FILE = 'unload-point-test.log';

// Clean log file
if (fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, '');
}

/**
 * Test the toUnloadPoint action by directly calling the execute-step endpoint
 */
async function testDynamicUnloadPoint(pointId) {
  console.log(`Testing toUnloadPoint action with point: ${pointId}`);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/execute-step`, {
      actionId: 'toUnloadPoint',
      params: { pointId }
    });

    console.log(`✅ API Response (${pointId}):`, JSON.stringify(response.data));
    return response.data;
  } catch (error) {
    console.error(`❌ Error testing ${pointId}:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('=== TESTING UNLOAD POINT ACTION WITH DYNAMIC WORKFLOW ===');
  
  // Test different point types
  const testPoints = [
    // Regular shelf points
    '104_load',
    '115_load',
    // Special drop-off points
    'drop-off_load',
    'Drop-off_Load' // testing with different casing
  ];
  
  // Run tests sequentially
  for (const pointId of testPoints) {
    console.log(`\n--- Testing point: ${pointId} ---`);
    await testDynamicUnloadPoint(pointId);
    
    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== TESTS COMPLETED ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Unexpected error during tests:', error);
});