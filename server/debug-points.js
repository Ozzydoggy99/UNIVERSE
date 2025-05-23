/**
 * Debug Points Script
 * 
 * This script shows the actual points we're getting from the robot
 * through our new map sync service.
 */

import { startMapSync, getCurrentMapData } from './map-sync-service.js';

async function debugPoints() {
  try {
    console.log('Starting map sync service...');
    await startMapSync();
    
    // Wait a moment for the sync to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the current map data
    const mapData = getCurrentMapData();
    
    console.log('\nCurrent Maps:');
    console.log(JSON.stringify(mapData.maps, null, 2));
    
    console.log('\nPoints by Map:');
    for (const [mapId, points] of Object.entries(mapData.points)) {
      console.log(`\nMap ${mapId} Points:`);
      console.log(JSON.stringify(points, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the debug
debugPoints(); 