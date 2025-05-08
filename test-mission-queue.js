// test-mission-queue.js
import axios from 'axios';

async function testMissionQueue() {
  try {
    console.log('Testing mission queue system...');
    
    // Create a test mission with shelf, pickup and standby points
    const testMission = {
      mode: 'pickup',
      shelf: { id: 'test-shelf', x: 10, y: 20, ori: 0 },
      pickup: { id: 'test-pickup', x: 30, y: 40, ori: 0 },
      standby: { id: 'test-standby', x: 50, y: 60, ori: 0 }
    };
    
    console.log('Creating a test mission...');
    const response = await axios.post('http://localhost:5000/robots/assign-task/local', testMission);
    
    console.log('Response:', response.data);
    
    if (response.data.missionId) {
      console.log(`Mission created with ID: ${response.data.missionId}`);
      
      // Wait a bit and then check mission status
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const missionResponse = await axios.get(`http://localhost:5000/api/missions/${response.data.missionId}`);
      console.log('Mission status:', missionResponse.data);
      
      // Get all active missions
      const activeMissionsResponse = await axios.get('http://localhost:5000/api/missions/active');
      console.log(`There are ${activeMissionsResponse.data.length} active missions`);
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testMissionQueue();