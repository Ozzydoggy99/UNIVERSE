/**
 * Test script to verify our critical rack_area_id fix 
 * 
 * This script will directly test how we're handling the rack_area_id parameter
 * using the exact point ID instead of a generic prefix
 */
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

async function testRackAreaFix() {
  try {
    console.log('=== TESTING RACK AREA ID FIX FOR toUnloadPoint ACTION ===');
    
    // Test with drop-off_load point, checking logged rackAreaId value
    console.log('\n1. Testing with drop-off_load to check exact point ID is used as rack_area_id...');
    
    // We'll check the logs to see what rack_area_id is set to
    const response = await axios.post(`${API_BASE_URL}/api/dynamic-workflow/execute-step`, {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: 'drop-off_load',
        maxRetries: 3
      }
    });
    
    console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
    console.log('✅ Check the logs to confirm exact point ID "drop-off_load" was used as rack_area_id');
    
  } catch (error) {
    console.error('Error in test:', 
      error.response ? error.response.data : error.message);
  }
}

// Run the test
testRackAreaFix().catch(err => {
  console.error('Script error:', err);
});