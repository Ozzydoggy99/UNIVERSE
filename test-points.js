import robotPointsMap from './server/map-adapter.js';

// Test getting points
console.log('Testing point retrieval...');

// Get all floor IDs
const floorIds = robotPointsMap.getFloorIds();
console.log('Floor IDs:', floorIds);

// For each floor, get all shelf points
for (const floorId of floorIds) {
  console.log(`\nFloor ${floorId}:`);
  
  // Get map ID
  const mapId = robotPointsMap.getMapId(floorId);
  console.log(`Map ID: ${mapId}`);
  
  // Get all shelf points
  const shelfPoints = robotPointsMap.getShelfPointNames(floorId);
  console.log('Shelf Points:', shelfPoints);
  
  // For each shelf point, get its coordinates and docking point
  for (const shelfPoint of shelfPoints) {
    try {
      const point = robotPointsMap.getPoint(floorId, shelfPoint);
      const shelfNumber = robotPointsMap.getShelfNumber(shelfPoint);
      const dockingPoint = robotPointsMap.getDockingPointName(shelfPoint);
      const dockingCoords = robotPointsMap.getPoint(floorId, dockingPoint);
      
      console.log(`\nShelf ${shelfNumber}:`);
      console.log(`  Load Point: ${shelfPoint}`);
      console.log(`  Load Coordinates: x=${point.x.toFixed(3)}, y=${point.y.toFixed(3)}, theta=${point.theta.toFixed(2)}`);
      console.log(`  Docking Point: ${dockingPoint}`);
      console.log(`  Docking Coordinates: x=${dockingCoords.x.toFixed(3)}, y=${dockingCoords.y.toFixed(3)}, theta=${dockingCoords.theta.toFixed(2)}`);
    } catch (error) {
      console.error(`Error getting point ${shelfPoint}:`, error.message);
    }
  }
}

// Test point sets
console.log('\nTesting point sets...');
const pointSets = robotPointsMap.getPointSets();
console.log('Point Sets:', pointSets);

// Test display names
console.log('\nTesting display names...');
for (const set of pointSets) {
  const displayName = robotPointsMap.getDisplayName(set.loadPoint);
  const technicalId = robotPointsMap.getTechnicalIdFromDisplay(displayName);
  console.log(`Load Point: ${set.loadPoint}`);
  console.log(`Display Name: ${displayName}`);
  console.log(`Technical ID: ${technicalId}`);
  console.log('---');
} 