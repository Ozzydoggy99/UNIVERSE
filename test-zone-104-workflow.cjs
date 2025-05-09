/**
 * Test script to run the Zone 104 complete workflow
 * This uses the specialized route that handles pickup and dropoff in one API call
 * with the new point naming convention
 */
const axios = require('axios');

// API Constants
const API_BASE_URL = 'http://localhost:5000/api';

async function testZone104Workflow() {
  try {
    console.log('🚀 Starting Zone 104 complete workflow (pickup and dropoff)...');
    
    // Make the API call to start the workflow using the new dynamic workflow system
    const response = await axios.post(`${API_BASE_URL}/workflow/pickup`, {
      serviceType: 'laundry',
      operationType: 'pickup',
      floorId: '3',  // Using Map 3 by default
      shelfId: '104_Load'  // Using the standard naming convention
    });
    
    if (response.data && response.data.success) {
      console.log(`✅ Workflow started successfully! Mission ID: ${response.data.missionId}`);
      console.log(`- Steps: ${response.data.steps}`);
      console.log(`- Duration (planning): ${response.data.duration}ms`);
      
      // Monitor the mission
      await monitorMission(response.data.missionId);
    } else {
      console.error('❌ Failed to start zone-104 workflow:', response.data);
    }
  } catch (error) {
    console.error('❌ Error executing zone-104 workflow:', error.response?.data || error.message);
  }
}

async function monitorMission(missionId, maxRetries = 120) {
  console.log(`Monitoring mission ${missionId}...`);
  
  let completed = false;
  let attempt = 0;
  
  while (!completed && attempt < maxRetries) {
    attempt++;
    
    try {
      const response = await axios.get(`${API_BASE_URL}/workflow/${missionId}`);
      const mission = response.data;
      
      const workflow = mission.workflow;
      if (workflow.status === 'completed') {
        console.log(`✅ Workflow ${missionId} completed successfully!`);
        completed = true;
      } else if (workflow.status === 'failed') {
        throw new Error(`Workflow ${missionId} failed: ${workflow.error || 'Unknown error'}`);
      } else {
        // Calculate progress
        const totalSteps = workflow.totalSteps;
        const currentStep = workflow.currentStep;
        const progress = Math.round((currentStep / totalSteps) * 100);
        
        console.log(`⏳ Workflow in progress: ${progress}% complete (Step ${currentStep}/${totalSteps}) - Status: ${workflow.status}`);
        
        // Wait 5 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`Error checking mission status: ${error.message}`);
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!completed) {
    throw new Error(`Timed out monitoring mission ${missionId} after ${maxRetries} attempts`);
  }
  
  return true;
}

// Run the test
testZone104Workflow();