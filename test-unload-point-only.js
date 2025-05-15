/**
 * Test script to test only the toUnloadPoint action with our fixes
 */
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000';

async function testToUnloadPointActionOnly() {
  try {
    console.log('=== TESTING FIXED toUnloadPoint ACTION ONLY ===');
    
    // Test with an actual load point (correct)
    console.log('\n1. Testing with correct load point "drop-off_load"...');
    await testUnloadPoint('drop-off_load');
    
    // Test with a docking point (should fail with our new validation)
    console.log('\n2. Testing with docking point "drop-off_load_docking" (should fail)...');
    await testUnloadPoint('drop-off_load_docking');
    
    console.log('\nTest completed');
    
  } catch (error) {
    console.error('Error in main test:', 
      error.response ? error.response.data : error.message);
  }
}

async function testUnloadPoint(pointId) {
  try {
    console.log(`Executing toUnloadPoint with pointId: ${pointId}`);
    
    const response = await axios.post(`${API_BASE_URL}/api/dynamic-workflow/execute-step`, {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: pointId,
        maxRetries: 3  // Low value to make tests quick
      }
    });
    
    console.log(`✅ Success with ${pointId}:`, JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log(`❌ Error with ${pointId} (this is expected for docking points):`, 
      error.response ? error.response.data.error : error.message);
    return false;
  }
}

// Run the test
testToUnloadPointActionOnly().catch(err => {
  console.error('Script error:', err);
});