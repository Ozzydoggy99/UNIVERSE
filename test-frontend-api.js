/**
 * Test script for frontend API issues
 * 
 * This script directly tests the frontend API call mechanisms using the same code
 * as used in the frontend, to identify any issues with how it's calling the backend.
 */

import axios from 'axios';

// Simulate the frontend API call with the exact same parameters
async function testFrontendApiCall() {
  try {
    console.log('Testing frontend API call mechanism...');
    
    // Define test parameters (same as would be used in the UI)
    const testParams = {
      operationType: 'pickup',
      floorId: 'Floor1',
      shelfId: '104_load'
    };
    
    console.log('Frontend params:', testParams);
    
    // Make the API call exactly as the frontend would
    console.log('Making API call to /api/simplified-workflow/execute...');
    const response = await axios.post('/api/simplified-workflow/execute', testParams);
    
    console.log('API response:', response.data);
    console.log('✅ Frontend API call succeeded!');
    
  } catch (error) {
    console.error('❌ Frontend API call failed:');
    
    if (error.response) {
      console.error(`Server responded with status ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request details:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    console.error('Full error:', error);
  }
}

// Run the test
testFrontendApiCall();