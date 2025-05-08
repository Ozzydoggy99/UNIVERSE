/**
 * Test script to pick up a bin from zone 104 and drop it at the Drop-off point
 */
import axios from 'axios';

async function testPickupFrom104() {
  console.log('🤖 Sending robot to pick up bin from zone 104 and drop at the Drop-off point...');
  
  try {
    // First step: Move to 104, pick up the bin
    const pickupResponse = await axios.post('http://localhost:5000/api/robots/assign-task/local-pickup', {
      shelf: {
        id: "104", 
        x: -16.329171529605446, 
        y: 6.419632917129547, 
        ori: 0
      },
      pickup: {
        id: "Drop-off", 
        x: -3.067094531843395, 
        y: 2.5788015960870325, 
        ori: 0
      },
      standby: {
        id: "Desk", 
        x: 0.09001154779753051, 
        y: 4.615265033436344, 
        ori: 0
      }
    });

    console.log('✅ Pickup task started!');
    console.log(pickupResponse.data);
    
    // Store the mission ID to check status later
    const missionId = pickupResponse.data.missionId;
    
    // Wait for mission to complete before returning
    if (missionId) {
      console.log(`Mission ID: ${missionId} - Waiting for completion...`);
      await waitForMissionComplete(missionId);
    }

  } catch (error) {
    console.error('❌ Error sending pickup task:', error.response?.data || error.message);
  }
}

async function waitForMissionComplete(missionId, maxRetries = 120) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      const response = await axios.get(`http://localhost:5000/api/missions/active`);
      const activeMissions = response.data;
      
      // If our mission is no longer active, it's complete
      const ourMission = activeMissions.find(m => m.id === missionId);
      if (!ourMission) {
        // Check the mission status to verify it completed successfully
        const allMissionsResponse = await axios.get(`http://localhost:5000/api/missions`);
        const completedMission = allMissionsResponse.data.find(m => m.id === missionId);
        
        if (completedMission) {
          console.log(`Mission ${missionId} completed with status: ${completedMission.status}`);
          return;
        }
        
        console.log(`Mission ${missionId} no longer active`);
        return;
      }
      
      // Still running, print status
      console.log(`Mission status: ${ourMission.status}, currently on step ${ourMission.currentStepIndex + 1}/${ourMission.steps.length}`);
      
    } catch (error) {
      console.error('Error checking mission status:', error.message);
    }
    
    // Wait 1 second between checks
    await new Promise(resolve => setTimeout(resolve, 1000));
    retries++;
  }
  
  console.log('Exceeded maximum wait time for mission completion');
}

// Run the test
testPickupFrom104();