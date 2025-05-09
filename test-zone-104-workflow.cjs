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
    
    // Make the API call to start the workflow
    const response = await axios.post(`${API_BASE_URL}/robots/workflows/zone-104`);
    
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
      const response = await axios.get(`${API_BASE_URL}/missions/${missionId}`);
      const mission = response.data;
      
      if (mission.status === 'completed') {
        console.log(`✅ Mission ${missionId} completed successfully!`);
        completed = true;
      } else if (mission.status === 'failed') {
        throw new Error(`Mission ${missionId} failed: ${mission.errorMessage || 'Unknown error'}`);
      } else {
        // Calculate progress
        const totalSteps = mission.steps.length;
        const completedSteps = mission.steps.filter(s => s.completed).length;
        const progress = Math.round((completedSteps / totalSteps) * 100);
        
        console.log(`⏳ Mission in progress: ${progress}% complete (${completedSteps}/${totalSteps} steps) - Status: ${mission.status}`);
        
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