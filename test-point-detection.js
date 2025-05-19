/**
 * Test script for point ID detection and handling
 * 
 * This script tests our point-id-handler module to verify it can
 * properly handle different point ID formats like "110_load"
 */

const { normalizePointId, getPointCoordinates, getRackAreaId } = require('./server/point-id-handler');

// Test points to verify
const testPoints = [
  '110',
  '110_load',
  '110_load_docking',
  '110_docking',
  'Drop-off_Load',
  'dropoff'
];

// Test the normalizePointId function
console.log('Testing normalizePointId function:');
testPoints.forEach(pointId => {
  const normalized = normalizePointId(pointId);
  console.log(`  ${pointId} -> ${normalized}`);
});
console.log();

// Test the getPointCoordinates function
console.log('Testing getPointCoordinates function:');
testPoints.forEach(pointId => {
  const coords = getPointCoordinates(pointId);
  console.log(`  ${pointId} -> ${coords ? `(${coords.x}, ${coords.y}, ${coords.theta})` : 'Not found'}`);
});
console.log();

// Test the getRackAreaId function
console.log('Testing getRackAreaId function:');
testPoints.forEach(pointId => {
  const rackAreaId = getRackAreaId(pointId);
  console.log(`  ${pointId} -> ${rackAreaId}`);
});

console.log('\nDirect test for 110_load point:');
const specificPoint = '110_load';
const coords = getPointCoordinates(specificPoint);
console.log(`Point ${specificPoint} coordinates: ${coords ? `(${coords.x}, ${coords.y}, ${coords.theta})` : 'Not found'}`);

// Test the rack area ID extraction specifically for 110_load
const rackAreaId = getRackAreaId(specificPoint);
console.log(`Rack area ID for ${specificPoint}: ${rackAreaId}`);

console.log('\nTest completed!');