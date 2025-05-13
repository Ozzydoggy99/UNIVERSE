#!/usr/bin/env node

/**
 * Robot Status Checker
 * 
 * This script checks the current status of the robot, including:
 * - Connection status
 * - Battery level
 * - Charging status
 * - Current position
 * - Current map
 * - Active tasks or missions
 * 
 * Usage: node check-robot-status.js
 */

import axios from 'axios';

// Use our local API
const API_BASE_URL = 'http://localhost:5000';

/**
 * Check robot connection status
 */
async function checkRobotConnection() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/robot/status`);
    console.log('🤖 Robot Connection Status');
    console.log('=======================');
    console.log(`Connected: ${response.data.connected ? '✅' : '❌'}`);
    console.log(`Serial: ${response.data.serial}`);
    console.log(`Battery: ${response.data.battery}%`);
    console.log(`Timestamp: ${response.data.timestamp}`);
    return response.data;
  } catch (error) {
    console.error('Error checking robot connection:', error.message);
    return null;
  }
}

/**
 * Check robot charging status
 */
async function checkRobotChargingStatus() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/robot/charging-status`);
    console.log('\n🔋 Robot Charging Status');
    console.log('=======================');
    console.log(`Charging: ${response.data.charging ? '✅' : '❌'}`);
    console.log(`Battery: ${response.data.batteryLevel || 'Unknown'}%`);
    
    // Show details from different sources
    console.log('\nCharging status from all sources:');
    response.data.details.forEach(source => {
      console.log(`- ${source.source}: ${source.charging ? '✅' : '❌'} ${source.batteryLevel ? `(${source.batteryLevel}%)` : ''} ${source.error ? `(Error: ${source.error})` : ''}`);
    });
    
    return response.data;
  } catch (error) {
    console.error('Error checking robot charging status:', error.message);
    return null;
  }
}

/**
 * Check robot position
 */
async function checkRobotPosition() {
  try {
    // Check WebSocket connection first
    try {
      const wsResponse = await axios.get(`${API_BASE_URL}/api/robot/websocket-status`);
      console.log('\n📍 Robot WebSocket Status');
      console.log('=======================');
      console.log(`WebSocket Connected: ${wsResponse.data.connected ? '✅' : '❌'}`);
      console.log(`Last Message: ${wsResponse.data.lastMessageTime || 'Never'}`);
      
      if (wsResponse.data.position) {
        console.log('\n📍 Robot Position (via WebSocket)');
        console.log('===============================');
        console.log(`X: ${wsResponse.data.position.x.toFixed(3)}`);
        console.log(`Y: ${wsResponse.data.position.y.toFixed(3)}`);
        console.log(`Orientation: ${wsResponse.data.position.orientation.toFixed(1)}°`);
        console.log(`Map: ${wsResponse.data.position.mapId || 'Unknown'}`);
        console.log(`Updated: ${wsResponse.data.position.timestamp || 'Unknown'}`);
      }
    } catch (wsError) {
      console.log('\n❌ WebSocket status check failed:', wsError.message);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking robot position:', error.message);
    return null;
  }
}

/**
 * Check robot active tasks
 */
async function checkRobotTasks() {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/robot-tasks`);
    
    console.log('\n📋 Robot Tasks');
    console.log('==============');
    
    if (response.data && response.data.length > 0) {
      console.log(`Found ${response.data.length} tasks:`);
      
      response.data.forEach((task, index) => {
        console.log(`\nTask #${index + 1}:`);
        console.log(`- ID: ${task.id}`);
        console.log(`- Type: ${task.type}`);
        console.log(`- Status: ${task.status}`);
        console.log(`- Created: ${new Date(task.createdAt).toLocaleString()}`);
        console.log(`- Updated: ${new Date(task.updatedAt).toLocaleString()}`);
        
        if (task.progress) {
          console.log(`- Progress: ${task.progress.toFixed(1)}%`);
        }
      });
    } else {
      console.log('No active tasks found.');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error checking robot tasks:', error.message);
    return null;
  }
}

/**
 * Main function to run all checks
 */
async function main() {
  console.log('🤖 ROBOT STATUS CHECK');
  console.log('=====================\n');
  
  await checkRobotConnection();
  await checkRobotChargingStatus();
  await checkRobotPosition();
  await checkRobotTasks();
  
  console.log('\n✅ Status check complete');
}

// Run the main function
main().catch(error => {
  console.error('Error running status check:', error);
});