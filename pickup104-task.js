// Task script to pick up bin from zone 104 and deliver to Drop-off point
import axios from 'axios';

async function pickup104Task() {
  try {
    console.log('🤖 Sending robot to pick up bin from zone 104 and deliver to Drop-off point...');
    
    // Notice the URL has no "/api" prefix - this matches the working test script
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
    
    console.log('✅ Task sent successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    // Check for mission ID and monitor it
    if (response.data && response.data.missionId) {
      const missionId = response.data.missionId;
      console.log(`Mission ID: ${missionId}`);
      
      // Monitor the mission execution
      console.log("Monitoring mission status...");
      await monitorMission(missionId);
    } else {
      console.log("⚠️ No mission ID returned");
    }
    
  } catch (error) {
    console.error('❌ Task failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

// Function to monitor the mission's progress
async function monitorMission(missionId, maxAttempts = 60) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Check if the mission is still active
      const activeMissionsResponse = await axios.get('http://localhost:5000/api/missions/active');
      const activeMissions = activeMissionsResponse.data;
      
      // Find our mission in the active missions list
      const ourMission = activeMissions.find(m => m.id === missionId);
      
      if (ourMission) {
        // Mission is still active, log its current state
        console.log(`Mission status: ${ourMission.status}`);
        console.log(`Current step: ${ourMission.currentStepIndex + 1}/${ourMission.steps.length}`);
        console.log(`Step type: ${ourMission.steps[ourMission.currentStepIndex].type}`);
        
        if (ourMission.steps[ourMission.currentStepIndex].errorMessage) {
          console.error(`❌ Error in current step: ${ourMission.steps[ourMission.currentStepIndex].errorMessage}`);
        }
      } else {
        // Mission is no longer active, check if it completed
        const allMissionsResponse = await axios.get('http://localhost:5000/api/missions');
        const completedMission = allMissionsResponse.data.find(m => m.id === missionId);
        
        if (completedMission) {
          console.log(`Mission completed with status: ${completedMission.status}`);
          
          // Log each step's outcome
          completedMission.steps.forEach((step, index) => {
            const status = step.completed ? '✅' : (step.errorMessage ? '❌' : '⏸️');
            console.log(`  ${status} Step ${index + 1}: ${step.type} ${step.params ? `to ${step.params.label || ''}` : ''}`);
            if (step.errorMessage) {
              console.error(`    Error: ${step.errorMessage}`);
            }
          });
          
          return;
        } else {
          console.log("Mission no longer active and not found in completed missions");
          return;
        }
      }
    } catch (error) {
      console.error('Error checking mission status:', error.message);
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }
  
  console.log("Monitoring timed out, but mission may still be in progress");
}

// Execute the task
pickup104Task();