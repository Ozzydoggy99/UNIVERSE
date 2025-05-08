// Simple test script for 104 pickup to Drop-off task
import axios from 'axios';

async function pickup104Task() {
  try {
    console.log('🤖 Sending robot to pick up bin from zone 104 and deliver to Drop-off point...');
    
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
    
    // Wait for 5 seconds, then check active missions
    console.log('Checking active missions in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const activeMissions = await axios.get('http://localhost:5000/api/missions/active');
    console.log('Active missions:', JSON.stringify(activeMissions.data, null, 2));
    
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

pickup104Task();