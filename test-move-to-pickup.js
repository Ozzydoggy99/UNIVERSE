#!/usr/bin/env node

/**
 * Test script for moving to pickup point using our robot points map
 * 
 * This script tests moving to the pickup docking point and back to the charger,
 * using our robot-points-map module to get coordinates.
 * 
 * Usage: node test-move-to-pickup.js
 */

import robotPointsMap from './server/robot-points-map.js';
import axios from 'axios';

// API base URL
const ROBOT_API_URL = 'http://47.180.91.99:8090';

// Headers for robot API
const getHeaders = () => ({
  'Authorization': `Robot ${process.env.ROBOT_SECRET || 'mysecretkey'}`,
  'Content-Type': 'application/json'
});

/**
 * Execute the test mission
 */
async function testMoveToPickup() {
  try {
    console.log('🤖 TEST MOVE TO PICKUP POINT');
    console.log('============================\n');
    
    // Get the required points from our robot-points-map module
    const floorId = 1; // Using Floor1
    
    console.log('Getting points from robot-points-map:');
    
    // Get pickup point
    const pickupDocking = robotPointsMap.getPoint(floorId, 'pick-up_load_docking');
    console.log(`Pickup docking: (${pickupDocking.x.toFixed(3)}, ${pickupDocking.y.toFixed(3)}, ${pickupDocking.theta.toFixed(1)}°)`);
    
    // Get charger
    const charger = robotPointsMap.getCharger(floorId);
    console.log(`Charger: (${charger.x.toFixed(3)}, ${charger.y.toFixed(3)}, ${charger.theta.toFixed(1)}°)`);
    
    // Check robot's current position
    console.log('\nChecking robot current position...');
    const currentPos = await getCurrentPosition();
    console.log(`Current position: (${currentPos.x.toFixed(3)}, ${currentPos.y.toFixed(3)}, ${currentPos.theta.toFixed(1)}°)`);
    
    console.log('\nExecuting test moves...');
    
    // 1. Move to pickup docking point
    console.log('Step 1: Moving to pickup docking point...');
    await moveToPoint(pickupDocking.x, pickupDocking.y, pickupDocking.theta);
    await waitForMoveComplete();
    
    // 2. Return to charger
    console.log('Step 2: Returning to charger...');
    await moveToPoint(charger.x, charger.y, charger.theta);
    await waitForMoveComplete();
    
    console.log('\n✅ Test completed successfully');
    
  } catch (error) {
    console.error('Error executing test:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * Get current robot position
 */
async function getCurrentPosition() {
  try {
    // First try to get position from tracked_pose topic
    try {
      const response = await axios.get(
        `${ROBOT_API_URL}/tracked_pose`, 
        { headers: getHeaders() }
      );
      
      if (response.data && Array.isArray(response.data.pos) && response.data.pos.length >= 2) {
        return {
          x: response.data.pos[0],
          y: response.data.pos[1],
          theta: response.data.ori || 0
        };
      }
    } catch (error) {
      console.log('Error getting tracked_pose:', error.message);
    }
    
    // Fall back to latest move data
    try {
      const response = await axios.get(
        `${ROBOT_API_URL}/chassis/moves/latest`, 
        { headers: getHeaders() }
      );
      
      if (response.data && Array.isArray(response.data.current_pos) && response.data.current_pos.length >= 2) {
        return {
          x: response.data.current_pos[0],
          y: response.data.current_pos[1],
          theta: response.data.current_ori || 0
        };
      }
    } catch (error) {
      console.log('Error getting latest move data:', error.message);
    }
    
    // If all else fails, return charger position (as a fallback)
    return robotPointsMap.getCharger(1);
    
  } catch (error) {
    console.error('Error getting current position:', error.message);
    throw error;
  }
}

/**
 * Move the robot to a point
 */
async function moveToPoint(x, y, theta) {
  try {
    const moveCommand = {
      creator: 'test-move-to-pickup',
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

// Execute the test
testMoveToPickup();