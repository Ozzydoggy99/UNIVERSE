#!/usr/bin/env node

/**
 * Robot Points Map Checker
 * 
 * This script checks the points map for the robot and verifies that points
 * are correctly defined according to our naming convention.
 * 
 * Usage: node check-robot-points.js
 */

import robotPointsMap from './server/robot-points-map.js';
import axios from 'axios';

// Use our local API
const API_BASE_URL = 'http://localhost:5000';

/**
 * Check API-defined points against our hard-coded map
 */
async function checkApiPoints() {
  try {
    // Get map data from API
    const response = await axios.get(`${API_BASE_URL}/api/robot/maps`);
    console.log('🗺️ Robot Maps from API');
    console.log('===================');
    
    if (response.data && response.data.length > 0) {
      console.log(`Found ${response.data.length} maps:`);
      
      for (const map of response.data) {
        console.log(`\nMap: ${map.map_name || map.name || 'Unnamed'} (ID: ${map.id})`);
        
        try {
          // Get points for this map
          const pointsResponse = await axios.get(`${API_BASE_URL}/api/robot/maps/${map.id}/points`);
          const overlaysData = JSON.parse(pointsResponse.data.overlays || '{"features":[]}');
          
          // Get only point features
          const points = overlaysData.features.filter(f => f.geometry.type === 'Point');
          
          console.log(`Found ${points.length} points on this map.`);
          
          // Check each point in our map against the API
          if (map.map_name === 'Floor1') {
            console.log('\nVerifying points against our stored map...');
            
            // Get all points from our floor 1
            const floor1Points = robotPointsMap.floors[1].points;
            
            // Track which points were found
            const foundPoints = {};
            
            // Check each API point against our map
            points.forEach(point => {
              const name = point.properties.name;
              if (!name) return;
              
              if (floor1Points[name]) {
                const storedPoint = floor1Points[name];
                const apiX = point.geometry.coordinates[0];
                const apiY = point.geometry.coordinates[1];
                const apiTheta = parseFloat(point.properties.yaw || '0');
                
                const xMatch = Math.abs(storedPoint.x - apiX) < 0.001;
                const yMatch = Math.abs(storedPoint.y - apiY) < 0.001;
                const thetaMatch = Math.abs(storedPoint.theta - apiTheta) < 0.1;
                
                foundPoints[name] = true;
                
                if (xMatch && yMatch && thetaMatch) {
                  console.log(`✅ ${name} found with matching coordinates`);
                } else {
                  console.log(`⚠️ ${name} found but coordinates don't match:`);
                  console.log(`   Stored: (${storedPoint.x.toFixed(3)}, ${storedPoint.y.toFixed(3)}, ${storedPoint.theta.toFixed(1)}°)`);
                  console.log(`   API: (${apiX.toFixed(3)}, ${apiY.toFixed(3)}, ${apiTheta.toFixed(1)}°)`);
                }
              }
            });
            
            // Check for missing points in API
            const missingPoints = Object.keys(floor1Points).filter(name => !foundPoints[name]);
            if (missingPoints.length > 0) {
              console.log('\n❌ Points in our map that are missing from API:');
              missingPoints.forEach(name => {
                const point = floor1Points[name];
                console.log(`   ${name}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.theta.toFixed(1)}°)`);
              });
            }
          }
        } catch (error) {
          console.error(`Error getting points for map ${map.id}:`, error.message);
        }
      }
    } else {
      console.log('No maps found from API.');
    }
    
    return true;
  } catch (error) {
    console.error('Error checking API points:', error.message);
    return null;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🤖 ROBOT POINTS MAP CHECK');
  console.log('=======================\n');
  
  const floorIds = robotPointsMap.getFloorIds();
  console.log(`Available floors in our map: ${floorIds.join(', ')}`);
  
  for (const floorId of floorIds) {
    const mapId = robotPointsMap.getMapId(floorId);
    console.log(`\n--- FLOOR ${floorId} (Map ID: ${mapId}) ---`);
    
    // Get shelf points
    const shelfPointNames = robotPointsMap.getShelfPointNames(floorId);
    
    console.log(`Defined shelf points: ${shelfPointNames.length}`);
    shelfPointNames.forEach(name => {
      console.log(`- ${name} (shelf number: ${robotPointsMap.getShelfNumber(name)})`);
    });
    
    // Check special points
    try {
      const pickupPoint = robotPointsMap.getPoint(floorId, 'pick-up_load');
      console.log(`\nPickup point: (${pickupPoint.x.toFixed(3)}, ${pickupPoint.y.toFixed(3)}, ${pickupPoint.theta.toFixed(1)}°)`);
    } catch (error) {
      console.log('\nPickup point not defined for this floor.');
    }
    
    try {
      const dropoffPoint = robotPointsMap.getPoint(floorId, 'drop-off_load');
      console.log(`Dropoff point: (${dropoffPoint.x.toFixed(3)}, ${dropoffPoint.y.toFixed(3)}, ${dropoffPoint.theta.toFixed(1)}°)`);
    } catch (error) {
      console.log('Dropoff point not defined for this floor.');
    }
    
    try {
      const charger = robotPointsMap.getCharger(floorId);
      console.log(`Charger: (${charger.x.toFixed(3)}, ${charger.y.toFixed(3)}, ${charger.theta.toFixed(1)}°)`);
    } catch (error) {
      console.log('Charger not defined for this floor.');
    }
  }
  
  console.log('\n--- CHECKING POINTS FROM API ---');
  await checkApiPoints();
  
  console.log('\n✅ Points check complete');
}

// Run the main function
main().catch(error => {
  console.error('Error running points check:', error);
});