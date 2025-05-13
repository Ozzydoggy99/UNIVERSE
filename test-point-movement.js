#!/usr/bin/env node

/**
 * Test movement between points using our robot-points-map
 * 
 * This script uses our existing API endpoints which have proper error handling
 * to test movement between different points on the map.
 * 
 * Usage: node test-point-movement.js [destination]
 *   where destination can be: pickup, dropoff, 104, 112, 115, or charger
 */

import robotPointsMap from './server/robot-points-map.js';
import axios from 'axios';

// API base URL (use our local API which has proper error handling)
const API_BASE_URL = 'http://localhost:5000';

/**
 * Execute the test movement
 */
async function testPointMovement() {
  try {
    // Get destination from command line
    const destination = process.argv[2] || 'pickup';
    const validDestinations = ['pickup', 'dropoff', '104', '112', '115', 'charger'];
    
    if (!validDestinations.includes(destination)) {
      console.error(`Invalid destination: ${destination}`);
      console.error(`Valid destinations are: ${validDestinations.join(', ')}`);
      process.exit(1);
    }
    
    console.log(`🤖 TEST MOVE TO ${destination.toUpperCase()}`);
    console.log('=================================\n');
    
    // Get the required points from our robot-points-map module
    const floorId = 1; // Using Floor1
    
    console.log('Getting point information from robot-points-map:');
    
    let pointName, pointType;
    
    // Determine the target point based on the specified destination
    if (destination === 'pickup') {
      pointName = 'pick-up_load_docking';
      pointType = 'pickup docking';
    } else if (destination === 'dropoff') {
      pointName = 'drop-off_load_docking';
      pointType = 'dropoff docking';
    } else if (destination === 'charger') {
      // Special case for charger
      const charger = robotPointsMap.getCharger(floorId);
      console.log(`Charger coordinates: (${charger.x.toFixed(3)}, ${charger.y.toFixed(3)}, ${charger.theta.toFixed(1)}°)`);
      
      console.log('\nSending robot to charger...');
      await moveRobotToCharger();
      console.log('Command sent successfully!');
      console.log('\nNote: Check robot status on the physical robot to confirm arrival.');
      return;
    } else {
      // For numbered shelves (104, 112, 115)
      pointName = `${destination}_load_docking`;
      pointType = `shelf ${destination} docking`;
    }
    
    // Get the target point coordinates
    const point = robotPointsMap.getPoint(floorId, pointName);
    console.log(`${pointType} coordinates: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
    
    // Check robot status
    console.log('\nChecking robot status...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/robot/status`);
    console.log(`Robot connected: ${statusResponse.data.connected ? 'Yes' : 'No'}`);
    console.log(`Battery level: ${statusResponse.data.battery}%`);
    
    // Move the robot to the target point
    console.log(`\nSending robot to ${pointType}...`);
    await moveRobotToPoint(point.x, point.y, point.theta);
    
    console.log('Command sent successfully!');
    console.log('\nNote: Check robot status on the physical robot to confirm arrival.');
    
  } catch (error) {
    console.error('Error executing test:', error.message);
  }
}

/**
 * Move the robot to a specific point
 */
async function moveRobotToPoint(x, y, theta) {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/robot/move`, {
      x,
      y,
      orientation: theta
    });
    
    return response.data;
  } catch (error) {
    console.error('Error moving robot:', error.message);
    throw error;
  }
}

/**
 * Send the robot to the charger
 */
async function moveRobotToCharger() {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/robot/dock-with-charger`);
    return response.data;
  } catch (error) {
    console.error('Error sending robot to charger:', error.message);
    throw error;
  }
}

// Execute the test
testPointMovement();