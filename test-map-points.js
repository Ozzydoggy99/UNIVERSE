#!/usr/bin/env node

/**
 * Test script for the robot points map
 * 
 * This script uses our robotPointsMap module to test that all expected
 * points are correctly defined and can be accessed.
 */

import robotPointsMap from './server/robot-points-map.js';

console.log('=== ROBOT POINTS MAP TEST ===');

// Test getting floor IDs
const floorIds = robotPointsMap.getFloorIds();
console.log(`Available floors: ${floorIds.join(', ')}`);

// Process each floor
for (const floorId of floorIds) {
  const mapId = robotPointsMap.getMapId(floorId);
  console.log(`\n--- FLOOR ${floorId} (Map ID: ${mapId}) ---`);
  
  // Test getting charger coordinates
  try {
    const charger = robotPointsMap.getCharger(floorId);
    console.log(`Charger location: (${charger.x.toFixed(3)}, ${charger.y.toFixed(3)}, ${charger.theta.toFixed(1)}°)`);
  } catch (error) {
    console.log(`No charger on floor ${floorId}: ${error.message}`);
  }
  
  // Test getting shelf points
  try {
    const shelfPointNames = robotPointsMap.getShelfPointNames(floorId);
    console.log(`\nShelf points (${shelfPointNames.length}):`);
    
    for (const pointName of shelfPointNames) {
      const point = robotPointsMap.getPoint(floorId, pointName);
      console.log(`  ${pointName}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
      
      // Also test the docking point
      const dockingPointName = robotPointsMap.getDockingPointName(pointName);
      const dockingPoint = robotPointsMap.getPoint(floorId, dockingPointName);
      console.log(`    Docking: ${dockingPointName}: (${dockingPoint.x.toFixed(3)}, ${dockingPoint.y.toFixed(3)}, ${dockingPoint.theta.toFixed(1)}°)`);
      
      // Test getting shelf number
      const shelfNumber = robotPointsMap.getShelfNumber(pointName);
      console.log(`    Shelf number: ${shelfNumber}`);
    }
  } catch (error) {
    console.log(`Error getting shelf points: ${error.message}`);
  }
  
  // Test getting special points (pickup and dropoff)
  try {
    console.log('\nSpecial points:');
    
    // Pickup
    const pickupPoint = robotPointsMap.getPoint(floorId, 'pick-up_load');
    console.log(`  pick-up_load: (${pickupPoint.x.toFixed(3)}, ${pickupPoint.y.toFixed(3)}, ${pickupPoint.theta.toFixed(1)}°)`);
    
    const pickupDockingPoint = robotPointsMap.getPoint(floorId, 'pick-up_load_docking');
    console.log(`    Docking: pick-up_load_docking: (${pickupDockingPoint.x.toFixed(3)}, ${pickupDockingPoint.y.toFixed(3)}, ${pickupDockingPoint.theta.toFixed(1)}°)`);
    
    // Dropoff
    const dropoffPoint = robotPointsMap.getPoint(floorId, 'drop-off_load');
    console.log(`  drop-off_load: (${dropoffPoint.x.toFixed(3)}, ${dropoffPoint.y.toFixed(3)}, ${dropoffPoint.theta.toFixed(1)}°)`);
    
    const dropoffDockingPoint = robotPointsMap.getPoint(floorId, 'drop-off_load_docking');
    console.log(`    Docking: drop-off_load_docking: (${dropoffDockingPoint.x.toFixed(3)}, ${dropoffDockingPoint.y.toFixed(3)}, ${dropoffDockingPoint.theta.toFixed(1)}°)`);
  } catch (error) {
    console.log(`Error getting special points: ${error.message}`);
  }
}

console.log('\n=== TEST COMPLETE ===');