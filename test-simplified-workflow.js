/**
 * Test script for simplified workflow execution
 * 
 * This script directly tests the backend API for simplified workflow execution,
 * allowing us to verify the communication path without going through the frontend.
 */

import axios from 'axios';

async function testSimplifiedWorkflow() {
  try {
    console.log('Starting simplified workflow test...');
    
    // Parameters for a pickup operation
    const testParams = {
      operationType: 'pickup',
      floorId: 'Floor1',
      shelfId: '104_load'
    };
    
    // Send the request to the API
    console.log(`Sending request to execute simplified workflow with params:`, testParams);
    const response = await axios.post('http://localhost:5000/api/simplified-workflow/execute', testParams);
    
    console.log('Response received:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // If we got a mission ID, we can try to monitor its progress
    if (response.data.missionId && response.data.missionId !== 'unknown' && response.data.missionId !== 'error') {
      console.log(`Successfully created mission with ID: ${response.data.missionId}`);
      
      // Simple monitoring - check mission status a few times
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        try {
          const missionResponse = await axios.get(`http://localhost:5000/api/missions/${response.data.missionId}`);
          console.log(`Mission status (attempt ${attempts}/${maxAttempts}):`, missionResponse.data);
        } catch (monitorError) {
          console.error('Error monitoring mission:', monitorError.message);
        }
      }
    }
    
    console.log('Test completed successfully');
    
  } catch (error) {
    console.error('Error executing simplified workflow:');
    
    if (error.response) {
      // The request was made and the server responded with an error status
      console.error(`Server responded with status ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Response headers:', error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request
      console.error('Error setting up request:', error.message);
    }
  }
}

// Execute the test
testSimplifiedWorkflow();