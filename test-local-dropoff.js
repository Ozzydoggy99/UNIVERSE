// test-local-dropoff.js
import axios from 'axios';

// Set a longer timeout for axios requests
axios.defaults.timeout = 10000;

async function testLocalDropoff() {
  try {
    console.log('Testing LOCAL DROPOFF workflow...');
    
    // Create a test dropoff mission
    const testMission = {
      mode: 'dropoff',
      shelf: { id: 'dropoff-shelf', x: 15, y: 25, ori: 0 },
      pickup: { id: 'dropoff-point', x: 35, y: 45, ori: 0 },  // Changed from dropoff to pickup to match endpoint
      standby: { id: 'dropoff-standby', x: 55, y: 65, ori: 0 }
    };
    
    console.log('Creating a LOCAL DROPOFF mission...');
    const response = await axios.post('http://localhost:5000/api/robots/assign-task/local-dropoff', testMission);
    
    console.log('Response:', response.data);
    
    if (response.data.missionId) {
      console.log(`Mission created with ID: ${response.data.missionId}`);
      
      // Wait a bit and then check mission status
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const missionResponse = await axios.get(`http://localhost:5000/api/missions/${response.data.missionId}`);
      console.log('Mission status:', JSON.stringify(missionResponse.data, null, 2));
    }
    
    console.log('LOCAL DROPOFF test completed successfully');
  } catch (error) {
    console.error('Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testLocalDropoff();