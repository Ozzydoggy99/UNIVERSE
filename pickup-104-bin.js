// pickup-104-bin.js - Send robot to pick up bin from zone 104 and deliver to Drop-off
import axios from 'axios';

async function pickup104Bin() {
  console.log('🤖 Sending robot to pick up bin from zone 104 and deliver to Drop-off point...');
  
  try {
    // First, log robot position before starting
    console.log('Getting current robot position...');
    const positionResponse = await axios.get('http://localhost:5000/api/robot/position');
    console.log('Current position:', positionResponse.data);
    
    // Send pickup command using the correct endpoint
    console.log('Sending pickup command...');
    const response = await axios.post('http://localhost:5000/robots/assign-task/local', {
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
    
    console.log('✅ Response from server:', response.data);
    
    // Check active missions
    const missionsResponse = await axios.get('http://localhost:5000/api/missions/active');
    console.log('Active missions:', missionsResponse.data);
    
    // Extract mission ID if available
    const missionId = response.data?.missionId;
    if (missionId) {
      console.log(`Monitoring mission ${missionId}...`);
      monitorMission(missionId);
    } else {
      console.log('No mission ID returned. Cannot monitor progress.');
    }
    
  } catch (error) {
    console.error('❌ Error sending pickup command:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

async function monitorMission(missionId) {
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 180) { // Monitor for up to 3 minutes
    try {
      const missionsResponse = await axios.get('http://localhost:5000/api/missions/active');
      const activeMissions = missionsResponse.data;
      
      const mission = activeMissions.find(m => m.id === missionId);
      if (!mission) {
        // Mission is no longer active, check if completed
        const allMissionsResponse = await axios.get('http://localhost:5000/api/missions');
        const completedMission = allMissionsResponse.data.find(m => m.id === missionId);
        
        if (completedMission) {
          console.log(`✅ Mission ${missionId} completed with status: ${completedMission.status}`);
          
          // Log detailed step information
          console.log('Mission steps:');
          completedMission.steps.forEach((step, index) => {
            console.log(`  Step ${index + 1}: ${step.type} - ${step.completed ? 'COMPLETED' : 'INCOMPLETE'}`);
            if (step.errorMessage) {
              console.log(`    Error: ${step.errorMessage}`);
            }
          });
        } else {
          console.log(`❓ Mission ${missionId} is no longer active but not found in mission history`);
        }
        
        completed = true;
      } else {
        // Mission is still active
        console.log(`Mission status: ${mission.status}, on step ${mission.currentStepIndex + 1}/${mission.steps.length}`);
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    } catch (error) {
      console.error('Error checking mission status:', error.message);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  if (!completed) {
    console.log('⚠️ Monitoring timed out. Mission may still be in progress.');
  }
}

// Execute the pickup
pickup104Bin();