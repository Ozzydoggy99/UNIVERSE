// Simple test script for the local pickup endpoint
import axios from 'axios';

async function testLocalPickup() {
  try {
    console.log('🤖 Testing local pickup endpoint...');
    
    const response = await axios.post('http://localhost:5000/robots/assign-task/local', {
      shelf: {
        id: 'B12',
        x: 12.5,
        y: 24.3,
        ori: 0.75
      },
      pickup: {
        id: 'P4',
        x: 8.2,
        y: 15.7,
        ori: 1.57
      },
      standby: {
        id: 'S1',
        x: 5.0,
        y: 5.0,
        ori: 0
      }
    });
    
    console.log('✅ Test successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Test failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testLocalPickup();