// test-local-dropoff.js - Test script for the local dropoff endpoint
import axios from 'axios';

async function testLocalDropoff() {
  try {
    console.log('🤖 Testing local dropoff functionality...');
    
    // Sample data points for testing
    // In a real scenario, these would be fetched from the robot map or database
    const testData = {
      shelf: {
        id: 'SHELF-101',
        name: 'Storage Shelf 101',
        x: 10.5,
        y: 15.2,
        ori: 1.57, // ~90 degrees
        floorId: 'F1'
      },
      pickup: {
        id: 'PICKUP-A',
        name: 'Pickup Station A',
        x: 5.8,
        y: 20.3,
        ori: 0, 
        floorId: 'F1'
      },
      standby: {
        id: 'STANDBY-1',
        name: 'Standby Position 1',
        x: 3.0,
        y: 3.0,
        ori: 0,
        floorId: 'F1'
      }
    };
    
    // Make request to the local dropoff endpoint
    console.log(`📤 Sending test data: ${JSON.stringify(testData, null, 2)}`);
    const response = await axios.post('http://localhost:3000/robots/assign-task/local/dropoff', testData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Local dropoff test successful!');
    console.log(`📊 Response: ${JSON.stringify(response.data, null, 2)}`);
    console.log(`⏱️ Task completed in ${response.data.duration}ms`);
    
  } catch (error) {
    console.error('❌ Local dropoff test failed:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`📄 Response data: ${JSON.stringify(error.response.data, null, 2)}`);
      console.error(`🔢 Status code: ${error.response.status}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('❓ No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error(`🐛 Error: ${error.message}`);
    }
  }
}

// Execute the test
testLocalDropoff();