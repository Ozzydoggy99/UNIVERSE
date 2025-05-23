/**
 * Update Point Coordinates Script
 * 
 * This script fetches the latest point coordinates from the robot
 * and updates our test scripts with the new coordinates.
 */

import { getRobotMaps, fetchMapData } from './robot-map-api.js';
import { DEFAULT_ROBOT_SERIAL } from './robot-constants.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updatePointCoordinates() {
  try {
    console.log('Fetching latest point coordinates from robot...');
    
    // Get all maps
    const { maps } = await getRobotMaps(DEFAULT_ROBOT_SERIAL);
    if (!maps || !Array.isArray(maps) || maps.length === 0) {
      console.error('No maps found from robot API');
      return;
    }
    
    // Find the main map (ID 4) or use the first available map
    const mainMap = maps.find(m => m.id === 4) || maps[0];
    console.log(`Using map: ${mainMap.name} (${mainMap.id})`);
    
    // Get detailed map data
    const mapData = await fetchMapData(String(mainMap.id), DEFAULT_ROBOT_SERIAL);
    if (!mapData || !mapData.overlays) {
      console.error('No overlay data found in map');
      return;
    }
    
    // Parse overlays
    let overlays;
    try {
      overlays = typeof mapData.overlays === 'string' 
        ? JSON.parse(mapData.overlays) 
        : mapData.overlays;
    } catch (e) {
      console.error('Failed to parse overlays JSON:', e);
      return;
    }
    
    // Extract points
    const features = overlays.features || [];
    const points = features
      .filter(f => f.geometry?.type === 'Point' && f.properties?.id)
      .map(f => ({
        id: f.properties.id,
        x: f.geometry.coordinates[0],
        y: f.geometry.coordinates[1],
        theta: f.properties.orientation || 0
      }));
    
    console.log(`Found ${points.length} points on the map`);
    
    // Update robot-points-map.js
    const pointsMapPath = path.join(__dirname, 'robot-points-map.js');
    let pointsMapContent = await fs.readFile(pointsMapPath, 'utf-8');
    
    // Update each point's coordinates
    for (const point of points) {
      const pointId = point.id;
      const regex = new RegExp(`'${pointId}':\\s*{[^}]*}`, 'g');
      const replacement = `'${pointId}': {
          x: ${point.x},
          y: ${point.y},
          theta: ${point.theta}
        }`;
      
      if (pointsMapContent.match(regex)) {
        pointsMapContent = pointsMapContent.replace(regex, replacement);
        console.log(`Updated coordinates for point ${pointId}`);
      } else {
        console.log(`Point ${pointId} not found in robot-points-map.js`);
      }
    }
    
    // Write updated content back to file
    await fs.writeFile(pointsMapPath, pointsMapContent);
    console.log('Successfully updated point coordinates in robot-points-map.js');
    
  } catch (error) {
    console.error('Error updating point coordinates:', error);
  }
}

// Run the update
updatePointCoordinates(); 