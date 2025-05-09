/**
 * Test script for the Dynamic Workflow with Map 3 (Phil's Map)
 * 
 * This script tests the full bin pickup workflow specifically with the robot's actual Map 3
 */

const axios = require('axios');

// Robot API configuration
const ROBOT_API_URL = 'http://47.180.91.99:8090';
const ROBOT_API_KEY = process.env.ROBOT_SECRET || '';

// Headers for robot API requests
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-API-Key': ROBOT_API_KEY
  };
}

/**
 * Main function to test Map 3 workflow
 */
async function testMap3Workflow() {
  try {
    console.log('🚀 Starting Map 3 workflow test');
    
    // 1. First get the map points from our workflow endpoint
    console.log('📍 Step 1: Getting map information');
    const mapsResponse = await axios.get('http://localhost:5000/api/workflow/maps');
    const maps = mapsResponse.data.maps;
    
    if (!maps || maps.length === 0) {
      throw new Error('No maps found in workflow API');
    }
    
    // Find Floor 1 (which corresponds to Map 3)
    const floor1 = maps.find(m => m.id === '1');
    if (!floor1) {
      throw new Error('Floor 1 not found in workflow API');
    }
    
    console.log('✅ Found Floor 1 (Phil\'s Map):');
    console.log(`   Name: ${floor1.name}`);
    console.log(`   Map ID: ${floor1.mapId}`);
    console.log(`   Has Charger: ${floor1.hasCharger}`);
    console.log(`   Has Dropoff: ${floor1.hasDropoff}`);
    console.log(`   Has Pickup: ${floor1.hasPickup}`);
    console.log(`   Shelf Points: ${floor1.shelfPoints.length}`);
    
    if (floor1.shelfPoints.length === 0) {
      throw new Error('No shelf points found on Floor 1');
    }
    
    // Get the first shelf point for our workflow
    const shelfPoint = floor1.shelfPoints[0];
    console.log(`✅ Found shelf point: ${shelfPoint.displayName} (${shelfPoint.id})`);
    console.log(`   Coordinates: (${shelfPoint.x}, ${shelfPoint.y}), Orientation: ${shelfPoint.ori}`);
    
    // 2. Get current robot state
    console.log('\n📍 Step 2: Checking current robot status');
    try {
      const poseResponse = await axios.get(`${ROBOT_API_URL}/tracked_pose`, { headers: getHeaders() });
      console.log(`✅ Robot current position: (${poseResponse.data.x}, ${poseResponse.data.y})`);
    } catch (error) {
      console.log(`⚠️ Warning: Could not get robot position: ${error.message}`);
    }
    
    try {
      const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers: getHeaders() });
      console.log(`✅ Robot battery: ${batteryResponse.data.percentage}%`);
    } catch (error) {
      console.log(`⚠️ Warning: Could not get battery status: ${error.message}`);
    }
    
    // 3. Print out the test workflow details (don't execute yet)
    console.log('\n📍 Step 3: Workflow configuration for test:');
    console.log(`   Service Type: laundry`);
    console.log(`   Operation Type: pickup`);
    console.log(`   Floor ID: ${floor1.id}`);
    console.log(`   Shelf ID: ${shelfPoint.id}`);
    
    console.log('\n🔍 To execute this workflow, run:');
    console.log(`curl -X POST -H "Content-Type: application/json" -d '{
  "serviceType": "laundry", 
  "operationType": "pickup", 
  "floorId": "${floor1.id}", 
  "shelfId": "${shelfPoint.id}"
}' http://localhost:5000/api/workflow/pickup`);

    // 4. Ask for confirmation
    console.log('\n⚠️ This script only prints the configuration. To actually run the workflow, execute the curl command above.');
    
  } catch (error) {
    console.error('❌ Error testing Map 3 workflow:', error.message);
  }
}

// Run the test
testMap3Workflow();