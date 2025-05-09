/**
 * Test script to call jack_down and return-to-charger endpoints
 * 
 * This script provides a simple way to test the robot's jack_down operation
 * and the functionality to return the robot to its charging station.
 * 
 * Usage:
 *   - node test-jack-down.js jack-down     (to lower the robot's jack)
 *   - node test-jack-down.js return-charger (to return robot to charging station)
 * 
 * Notes:
 *   - The jack_down operation is typically used after arriving at a dropoff point, not at the charger
 *   - Return-to-charger will cancel any currently running missions for safety
 */
import axios from 'axios';

async function testJackDown() {
  try {
    console.log('Sending request to jack down the robot...');
    
    const response = await axios.post('http://localhost:5000/api/robot/jack_down');
    
    console.log('Jack down response:', response.data);
  } catch (error) {
    console.error('Error jacking down robot:', error.response?.data || error.message);
  }
}

async function testReturnToCharger() {
  try {
    console.log('Sending request to return robot to charger...');
    
    const response = await axios.post('http://localhost:5000/api/robot/return-to-charger');
    
    console.log('Return to charger response:', response.data);
  } catch (error) {
    console.error('Error returning robot to charger:', error.response?.data || error.message);
  }
}

// Call the function for the command line argument
if (process.argv[2] === 'jack-down') {
  testJackDown();
} else if (process.argv[2] === 'return-charger') {
  testReturnToCharger();
} else {
  console.log('Usage: node test-jack-down.js [jack-down|return-charger]');
}