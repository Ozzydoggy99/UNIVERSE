import { checkForBin, getBinDetectionStatus } from './bin-detection';

async function testBinDetection() {
  try {
    // Test coordinates - adjust these based on your robot's environment
    const testPoints = [
      { x: -8.029, y: 6.704, pointId: '115_load' },  // Real-world unload point
      { x: -2.847, y: 2.311, pointId: '050_load' },  // Real-world shelf point
      { x: -1.887, y: 2.311, pointId: '050_load_docking' }  // Real-world docking point
    ];

    console.log('Starting bin detection tests...\n');

    // Test basic bin detection
    for (const point of testPoints) {
      console.log(`\nTesting point ${point.pointId} (${point.x}, ${point.y}):`);
      
      // Test simple detection
      const hasBin = await checkForBin(point.x, point.y, point.pointId);
      console.log(`Basic detection result: ${hasBin ? 'Bin found' : 'No bin found'}`);
      
      // Test detailed status
      const status = await getBinDetectionStatus(point.x, point.y, point.pointId);
      console.log('Detailed status:', {
        detected: status.detected,
        confidence: status.confidence.toFixed(2),
        method: status.method
      });
    }

    console.log('\nAll tests completed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the tests
testBinDetection(); 