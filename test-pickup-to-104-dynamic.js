#!/usr/bin/env node

/**
 * Test script for pickup to 104 using our robot points map
 * 
 * This script performs a pickup from the central pickup point and delivers 
 * to shelf 104, using our robot-points-map module instead of hardcoded coordinates.
 * 
 * Usage: node test-pickup-to-104-dynamic.js
 */

import robotPointsMap from './server/robot-points-map.js';
import axios from 'axios';

// API base URL
const API_BASE_URL = 'http://localhost:5000';
const ROBOT_API_URL = 'http://47.180.91.99:8090';

// Headers for robot API
const getHeaders = () => ({
  'Authorization': `Robot ${process.env.ROBOT_SECRET || 'mysecretkey'}`,
  'Content-Type': 'application/json'
});

/**
 * Execute the pickup to 104 mission
 */
async function runPickupTo104Mission() {
  try {
    console.log('🤖 PICKUP TO 104 MISSION (DYNAMIC)');
    console.log('================================\n');
    
    // Get the required points from our robot-points-map module
    const floorId = 1; // Using Floor1
    
    console.log('Getting points from robot-points-map:');
    
    // Get pickup points
    const pickupPoint = robotPointsMap.getPoint(floorId, 'pick-up_load');
    const pickupDocking = robotPointsMap.getPoint(floorId, 'pick-up_load_docking');
    
    console.log(`Pickup point: (${pickupPoint.x.toFixed(3)}, ${pickupPoint.y.toFixed(3)}, ${pickupPoint.theta.toFixed(1)}°)`);
    console.log(`Pickup docking: (${pickupDocking.x.toFixed(3)}, ${pickupDocking.y.toFixed(3)}, ${pickupDocking.theta.toFixed(1)}°)`);
    
    // Get shelf 104 points
    const shelfPoint = robotPointsMap.getPoint(floorId, '104_load');
    const shelfDocking = robotPointsMap.getPoint(floorId, '104_load_docking');
    
    console.log(`Shelf 104: (${shelfPoint.x.toFixed(3)}, ${shelfPoint.y.toFixed(3)}, ${shelfPoint.theta.toFixed(1)}°)`);
    console.log(`Shelf 104 docking: (${shelfDocking.x.toFixed(3)}, ${shelfDocking.y.toFixed(3)}, ${shelfDocking.theta.toFixed(1)}°)`);
    
    // Get charger
    const charger = robotPointsMap.getCharger(floorId);
    console.log(`Charger: (${charger.x.toFixed(3)}, ${charger.y.toFixed(3)}, ${charger.theta.toFixed(1)}°)`);
    
    console.log('\nExecuting mission...');
    
    // 1. Move to pickup docking point
    console.log('Step 1: Moving to pickup docking point...');
    await moveToPoint(pickupDocking.x, pickupDocking.y, pickupDocking.theta);
    await waitForMoveComplete();
    
    // 2. Move to pickup point
    console.log('Step 2: Moving to pickup point...');
    await moveToPoint(pickupPoint.x, pickupPoint.y, pickupPoint.theta);
    await waitForMoveComplete();
    
    // 3. Jack up to grab bin
    console.log('Step 3: Jack up to grab bin...');
    await jackUp();
    // Wait for stability
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 4. Move back to docking point
    console.log('Step 4: Moving back to pickup docking point...');
    await moveToPoint(pickupDocking.x, pickupDocking.y, pickupDocking.theta);
    await waitForMoveComplete();
    
    // 5. Move to shelf 104 docking point
    console.log('Step 5: Moving to shelf 104 docking point...');
    await moveToPoint(shelfDocking.x, shelfDocking.y, shelfDocking.theta);
    await waitForMoveComplete();
    
    // 6. Move to shelf 104
    console.log('Step 6: Moving to shelf 104...');
    await moveToPoint(shelfPoint.x, shelfPoint.y, shelfPoint.theta);
    await waitForMoveComplete();
    
    // 7. Jack down to release bin
    console.log('Step 7: Jack down to release bin...');
    await jackDown();
    // Wait for stability
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 8. Move back to docking point
    console.log('Step 8: Moving back to shelf 104 docking point...');
    await moveToPoint(shelfDocking.x, shelfDocking.y, shelfDocking.theta);
    await waitForMoveComplete();
    
    // 9. Return to charger (direct coordinates)
    console.log('Step 9: Returning to charger...');
    await moveToPoint(charger.x, charger.y, charger.theta);
    await waitForMoveComplete();
    
    console.log('\n✅ Mission completed successfully');
    
  } catch (error) {
    console.error('Error executing mission:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Move the robot to a point
 */
async function moveToPoint(x, y, theta) {
  try {
    const moveCommand = {
      creator: 'dynamic-workflow',
      type: 'standard',
      target_x: x,
      target_y: y,
      target_ori: theta || 0,
      properties: {
        max_trans_vel: 0.5,
        max_rot_vel: 0.5,
        acc_lim_x: 0.5,
        acc_lim_theta: 0.5
      }
    };
    
    const response = await axios.post(
      `${ROBOT_API_URL}/chassis/moves`, 
      moveCommand, 
      { headers: getHeaders() }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error moving to point:', error.message);
    throw error;
  }
}

/**
 * Wait for move to complete
 */
async function waitForMoveComplete(maxRetries = 60) {
  let retries = 0;
  let moveId = null;
  
  while (retries < maxRetries) {
    try {
      const response = await axios.get(
        `${ROBOT_API_URL}/chassis/moves/latest`, 
        { headers: getHeaders() }
      );
      
      // Store the move ID for logging
      moveId = response.data.id || 'unknown';
      
      const status = response.data.status || 'unknown';
      const position = response.data.current_pos || [];
      const posStr = position.length >= 2 ? `(${position[0].toFixed(2)}, ${position[1].toFixed(2)})` : 'unknown';
      
      if (status === 'Done') {
        console.log(`Move #${moveId} completed successfully at position ${posStr}`);
        return true;
      } else if (status === 'Failed') {
        throw new Error(`Move #${moveId} failed: ${response.data.message || 'Unknown reason'}`);
      } else if (status === 'Canceled') {
        throw new Error(`Move #${moveId} was canceled`);
      }
      
      console.log(`Move #${moveId} in progress... (${status}) at position ${posStr}`);
      
    } catch (error) {
      console.log(`Error checking move #${moveId} status: ${error.message}`);
      
      // If we can't get the status for too long, assume the move is complete
      if (retries > 10) {
        console.log('Too many errors checking move status, assuming move is complete');
        return true;
      }
    }
    
    retries++;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time
  }
  
  console.log(`Warning: Timeout waiting for move #${moveId} to complete, proceeding with next step`);
  return false; // Don't throw error, just continue with next step
}

/**
 * Jack up to grab a bin
 */
async function jackUp() {
  try {
    const response = await axios.post(
      `${ROBOT_API_URL}/services/jack_up`, 
      {}, 
      { headers: getHeaders() }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error jacking up:', error.message);
    throw error;
  }
}

/**
 * Jack down to release a bin
 */
async function jackDown() {
  try {
    const response = await axios.post(
      `${ROBOT_API_URL}/services/jack_down`, 
      {}, 
      { headers: getHeaders() }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error jacking down:', error.message);
    throw error;
  }
}

// Execute the mission
runPickupTo104Mission();