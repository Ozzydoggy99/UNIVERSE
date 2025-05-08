// Test script for the main assign-task endpoint
import axios from 'axios';

async function testAssignTask() {
  try {
    console.log('🤖 Testing assign task endpoint...');
    
    const response = await axios.post('http://localhost:5000/robots/assign-task', {
      mode: 'pickup',
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
      dropoff: {
        id: 'D3',
        x: 10.1,
        y: 18.9,
        ori: 0.5
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

testAssignTask();