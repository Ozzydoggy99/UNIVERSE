/**
 * Test script to verify our fix for the point_id vs pointId issue
 */
const axios = require('axios');

async function testToUnloadPointAction() {
  console.log('Testing to_unload_point action with different parameter formats...');
  
  try {
    // First test with snake_case (point_id)
    console.log('\nTest 1: Using snake_case parameters (point_id)');
    const snakeCaseResponse = await axios.post('http://localhost:5000/api/test-step-execution', {
      stepType: 'to_unload_point',
      params: {
        point_id: '104_load',
        rack_area_id: '104_load',
        x: -15.88,
        y: 6.768,
        ori: 0
      }
    });
    console.log('Response:', snakeCaseResponse.data);
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Then test with camelCase (pointId)
    console.log('\nTest 2: Using camelCase parameters (pointId)');
    const camelCaseResponse = await axios.post('http://localhost:5000/api/test-step-execution', {
      stepType: 'to_unload_point',
      params: {
        pointId: '104_load',
        rackAreaId: '104_load',
        x: -15.88,
        y: 6.768,
        ori: 0
      }
    });
    console.log('Response:', camelCaseResponse.data);
    
    console.log('\nBoth formats should work now!');
  } catch (error) {
    console.error('Error during test:', error.response?.data || error.message);
  }
}

testToUnloadPointAction();
