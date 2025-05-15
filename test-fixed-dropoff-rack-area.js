/**
 * Special test script to verify our critical fix for dropoff rack_area_id
 * 
 * This script tests the to_unload_point action specifically for drop-off points
 * to verify our fix for using consistent rack_area_id values.
 * 
 * Script simulates a simplified workflow to test only the drop-off operation.
 */
import axios from 'axios';

// API Constants
const API_BASE_URL = 'http://localhost:5000/api';

// Test the to_unload_point action with a specific target
async function testToUnloadPoint(pointId) {
  try {
    console.log(`🔍 TESTING to_unload_point with point: ${pointId}`);
    
    // Create a simplified workflow that only tests the to_unload_point action
    const response = await axios.post(`${API_BASE_URL}/simplified-workflow/execute`, {
      operationType: 'dropoff',
      floorId: '4',
      shelfId: pointId
    });
    
    console.log(`✅ Workflow created successfully with mission ID: ${response.data.missionId}`);
    console.log(`ℹ️ Response: ${JSON.stringify(response.data)}`);
    
    // The workflow will execute in the background through the mission queue
    console.log('▶️ The workflow is now executing. Check robot-dynamic-workflow.log for details.');
    console.log('▶️ Also check mission queue logs in the server output.');
    
    return response.data;
  } catch (error) {
    console.error('❌ Error testing to_unload_point:', error.response?.data || error.message);
    throw error;
  }
}

// Main function to run tests
async function runTests() {
  try {
    console.log('🚀 Starting to_unload_point action test with fixed rack_area_id handling');
    
    // Test with drop-off_load to verify it uses consistent rack_area_id
    console.log('\n📋 TEST 1: Using drop-off_load point');
    await testToUnloadPoint('drop-off_load');
    
    console.log('\n📋 ALL TESTS DISPATCHED');
    console.log('Check robot-dynamic-workflow.log for detailed execution logs.');
    console.log('The workflow will continue executing in the background.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the tests
runTests();