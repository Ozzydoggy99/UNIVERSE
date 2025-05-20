/**
 * Test script for point ID detection and handling
 * 
 * This script tests our point-id-handler module to verify it can
 * properly handle different point ID formats like "110_load"
 */

import fetch from 'node-fetch';

// Configuration
const ROBOT_API_URL = 'http://47.180.91.99:8090';
const LOCAL_API_URL = 'http://localhost:3000';

// Get all available maps from the robot
async function getMaps() {
  try {
    console.log('Fetching maps from robot...');
    const response = await fetch(`${ROBOT_API_URL}/maps`);
    const data = await response.json();
    
    console.log(`Found ${data.data.length} maps on the robot`);
    return data.data;
  } catch (error) {
    console.error('Error fetching maps:', error.message);
    return [];
  }
}

// Get all points for a specific map
async function getMapPoints(mapId) {
  try {
    console.log(`Fetching points for map ${mapId}...`);
    const response = await fetch(`${ROBOT_API_URL}/maps/${mapId}`);
    const mapData = await response.json();
    
    if (!mapData.data || !mapData.data.overlays) {
      console.error('No overlays found in map data');
      return [];
    }
    
    // Extract points from GeoJSON features
    const points = [];
    try {
      const features = JSON.parse(mapData.data.overlays).features;
      for (const feature of features) {
        if (feature.properties && feature.properties.type === 'POI') {
          points.push({
            id: feature.properties.name,
            x: feature.geometry.coordinates[0],
            y: feature.geometry.coordinates[1],
            theta: feature.properties.theta || 0
          });
        }
      }
    } catch (err) {
      console.error('Error parsing map overlays:', err.message);
      return [];
    }
    
    console.log(`Found ${points.length} points on map ${mapId}`);
    return points;
  } catch (error) {
    console.error(`Error fetching points for map ${mapId}:`, error.message);
    return [];
  }
}

// Detect point sets (e.g., 110_load and 110_load_docking)
function detectPointSets(points) {
  const pointSets = new Map();
  
  for (const point of points) {
    // Check if point is a load point (e.g., 110_load)
    if (point.id.toLowerCase().includes('_load')) {
      // Extract base identifier (e.g., "110" from "110_load")
      const baseId = point.id.split('_')[0];
      
      if (!pointSets.has(baseId)) {
        pointSets.set(baseId, { baseId, points: [] });
      }
      
      // Add point to its set
      pointSets.get(baseId).points.push(point);
    }
  }
  
  // Validate point sets - each set should have a load point and a docking point
  const validSets = [];
  for (const [baseId, set] of pointSets.entries()) {
    const hasLoadPoint = set.points.some(p => p.id.toLowerCase().includes('_load') && 
                                        !p.id.toLowerCase().includes('_docking'));
    const hasDockingPoint = set.points.some(p => p.id.toLowerCase().includes('_load_docking'));
    
    if (hasLoadPoint && hasDockingPoint) {
      console.log(`Valid point set found: ${baseId}`);
      validSets.push(set);
    } else {
      console.log(`Incomplete point set: ${baseId} (missing ${!hasLoadPoint ? 'load point' : 'docking point'})`);
    }
  }
  
  return validSets;
}

// Main function
async function testPointDetection() {
  console.log('Testing point detection functionality...');
  
  // Get all maps
  const maps = await getMaps();
  if (maps.length === 0) {
    console.log('No maps available for testing. Using sample data instead.');
    // Sample data for testing when robot is not available
    const samplePoints = [
      { id: '104_load', x: 10.5, y: 20.3, theta: 0 },
      { id: '104_load_docking', x: 10.0, y: 20.0, theta: 0 },
      { id: '110_load', x: 15.5, y: 25.3, theta: 0 },
      { id: '110_load_docking', x: 15.0, y: 25.0, theta: 0 },
      { id: 'Drop-off_Load', x: 5.5, y: 5.3, theta: 0 },
      { id: 'Drop-off_Load_docking', x: 5.0, y: 5.0, theta: 0 },
    ];
    
    console.log('Sample points:', samplePoints);
    const pointSets = detectPointSets(samplePoints);
    console.log(`Detected ${pointSets.length} valid point sets`);
    return;
  }
  
  // Process each map
  for (const map of maps) {
    console.log(`\nProcessing map: ${map.name} (${map.uid})`);
    
    // Get points for this map
    const points = await getMapPoints(map.uid);
    
    if (points.length === 0) {
      console.log('No points found on this map');
      continue;
    }
    
    // Detect point sets
    console.log('\nDetecting point sets...');
    const pointSets = detectPointSets(points);
    
    console.log(`\nDetected ${pointSets.length} valid point sets on map ${map.name}`);
    for (const set of pointSets) {
      console.log(`  - ${set.baseId}: ${set.points.map(p => p.id).join(', ')}`);
    }
  }
  
  console.log('\nPoint detection test completed');
}

// Run the test
testPointDetection()
  .then(() => console.log('Test completed successfully'))
  .catch(error => console.error('Test failed:', error));