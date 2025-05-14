/**
 * Test script for the new pickup-104 workflow using correct AutoXing API endpoints
 * 
 * This script calls our new endpoint that uses the mission queue system
 * with the proper AutoXing API endpoints.
 */

import axios from 'axios';

async function testPickup104Workflow() {
  console.log('Testing new pickup-104 workflow with correct AutoXing API endpoints...');
  
  try {
    // Call our new endpoint
    const response = await axios.post('http://localhost:5000/api/workflow/pickup-104');
    
    console.log('Response:', response.data);
    
    if (response.data.success) {
      console.log(`✅ Success! Mission created with ID: ${response.data.missionId}`);
      console.log('The mission queue system will process this mission automatically.');
      console.log('Check the server logs for mission execution details.');
    } else {
      console.log(`❌ Failed: ${response.data.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

// Execute the test
testPickup104Workflow().catch(err => {
  console.error('Test execution failed:', err.message);
});