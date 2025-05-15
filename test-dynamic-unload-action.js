/**
 * Test script for the toUnloadPoint action in the dynamic workflow
 * 
 * This script tests the toUnloadPoint action specifically for drop-off points
 * in the dynamic workflow implementation.
 */

const axios = require('axios');

// API base URL
const API_BASE_URL = 'http://localhost:5000';

// Test both regular shelf points and drop-off points
const TEST_POINTS = [
  '104_load',           // Regular shelf point
  'drop-off_load'       // Special hyphenated point
];

/**
 * Test the toUnloadPoint action by directly calling the execute-step endpoint
 */
async function testDynamicUnloadPoint(pointId) {
  console.log(`\n----- Testing toUnloadPoint via Dynamic Workflow for: ${pointId} -----`);
  
  try {
    // This calls the dynamic workflow's executeWorkflowStep function
    const payload = {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: pointId,
        // Short timeout for testing
        maxRetries: 3
      }
    };
    
    console.log('Request payload:', JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      `${API_BASE_URL}/api/dynamic-workflow/execute-step`, 
      payload
    );
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error(`Error testing ${pointId}:`, 
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    return { 
      success: false, 
      error: error.response ? error.response.data : error.message 
    };
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('=== TESTING DYNAMIC WORKFLOW UNLOAD POINT ACTION ===');
  
  for (const pointId of TEST_POINTS) {
    const result = await testDynamicUnloadPoint(pointId);
    
    if (result.success) {
      console.log(`✅ SUCCESS: ${pointId}`);
    } else {
      console.log(`❌ FAILED: ${pointId} - ${result.error?.message || JSON.stringify(result.error)}`);
    }
  }
}

// Run the tests
runTests().catch(err => {
  console.error('Test script error:', err);
});