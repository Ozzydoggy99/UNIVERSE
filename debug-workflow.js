/**
 * Simple script to test the dynamic workflow system by executing individual steps
 * This script helps debug our fixes for the toUnloadPoint action
 */

import axios from 'axios';
import fs from 'fs';

async function debugWorkflow() {
  console.log('Debugging dynamic workflow system...');
  
  try {
    // Test the drop-off point with our fixed code
    console.log('\n=== Testing drop-off_load point ===');
    const response = await axios.post('http://localhost:5000/api/dynamic-workflow/execute-step', {
      robotId: 'L382502104987ir',
      actionId: 'toUnloadPoint',
      params: {
        pointId: 'drop-off_load',
        maxRetries: 3
      }
    });
    
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    console.log('\nDebug complete!');
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the debug function
(async () => {
  await debugWorkflow();
})();