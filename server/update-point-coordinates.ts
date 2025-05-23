/**
 * Update Point Coordinates Script
 * 
 * This script fetches the latest point coordinates from the robot
 * and updates our map adapter with the new coordinates.
 */

import { getRobotMaps, fetchMapData } from './robot-map-api';
import { DEFAULT_ROBOT_SERIAL } from './robot-constants';
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
      .filter((f: any) => f.geometry?.type === 'Point' && f.properties?.id)
      .map((f: any) => ({
        id: f.properties.id,
        x: f.geometry.coordinates[0],
        y: f.geometry.coordinates[1],
        theta: f.properties.orientation || 0
      }));
    
    console.log(`Found ${points.length} points on the map`);
    
    // Update map-adapter.ts
    const mapAdapterPath = path.join(__dirname, 'map-adapter.ts');
    let mapAdapterContent = await fs.readFile(mapAdapterPath, 'utf-8');
    
    // Update each point's coordinates in the floors object
    for (const point of points) {
      const pointId = point.id;
      const regex = new RegExp(`'${pointId}':\\s*{[^}]*}`, 'g');
      const replacement = `'${pointId}': {
          x: ${point.x},
          y: ${point.y},
          theta: ${point.theta}
        }`;
      
      if (mapAdapterContent.match(regex)) {
        mapAdapterContent = mapAdapterContent.replace(regex, replacement);
        console.log(`Updated coordinates for point ${pointId}`);
      } else {
        console.log(`Point ${pointId} not found in map-adapter.ts`);
      }
    }
    
    // Write updated content back to file
    await fs.writeFile(mapAdapterPath, mapAdapterContent);
    console.log('Successfully updated point coordinates in map-adapter.ts');
    
  } catch (error) {
    console.error('Error updating point coordinates:', error);
  }
}

// Run the update
updatePointCoordinates(); 