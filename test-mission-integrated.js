// Integrated test for mission-runner.ts functionality
// Uses direct API calls to ensure our implementation works correctly
import axios from 'axios';
import 'dotenv/config';

const ROBOT_API_URL = "http://47.180.91.99:8090";
const ROBOT_SECRET = process.env.ROBOT_SECRET;

// Duplicate key functions from mission-runner.ts to test them directly
async function fetchRobotMapPoints() {
  console.log(`🔍 Fetching points from ${ROBOT_API_URL}/maps...`);
  
  const response = await axios.get(`${ROBOT_API_URL}/maps`, {
    headers: { "x-api-key": ROBOT_SECRET },
  });
  
  // Extracting the first map
  const maps = response.data || [];
  if (!maps.length) {
    throw new Error("❌ No maps found");
  }
  
  console.log(`📊 Found ${maps.length} maps`);
  
  // Get the first map
  const map = maps[0];
  const mapId = map.uid;
  
  console.log(`📋 Using map: ${map.name} (ID: ${mapId})`);
  
  // Get map details including points
  const mapDetailsResponse = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, {
    headers: { "x-api-key": ROBOT_SECRET },
  });
  
  const mapDetails = mapDetailsResponse.data;
  const points = mapDetails.points || [];
  
  // Extract floor ID from map name if available (naming convention: floor_X_mapname)
  const floorMatch = map.name.match(/floor[_\s]*(\d+)/i);
  const floorId = floorMatch ? floorMatch[1] : "1";  // Default to "1" if no floor number in map name
  
  // Add floor ID to all points
  const pointsWithFloor = points.map(point => ({
    ...point,
    floorId
  }));
  
  console.log(`🔢 Found ${pointsWithFloor.length} points on floor ${floorId}`);
  
  return pointsWithFloor;
}

async function runMission({ shelfId, uiMode, points }) {
  if (!ROBOT_SECRET) {
    throw new Error("❌ Missing robot authentication token");
  }

  console.log("🔍 Fetching robot map points...");
  let allPoints = [];
  
  // Use manually provided points if available (mainly for testing)
  if (points?.length) {
    console.log(`⚠️ Using ${points.length} manually provided points`);
    allPoints = points;
  } else {
    // Otherwise fetch from the robot
    allPoints = await fetchRobotMapPoints();
  }

  // Log points for debugging
  console.log("Map points:", allPoints.map(p => `${p.id} (${p.x}, ${p.y})`));

  // Normalize point IDs to handle string vs number inconsistencies
  const normalizeId = (id) => String(id || "").trim().toLowerCase();
  
  // Find specific points needed for the mission
  const pickupPoint = allPoints.find(p => {
    const id = normalizeId(p.id);
    return id === "pick-up" || id === "pickup" || id === "pick up";
  });
  console.log("Pickup point found:", pickupPoint?.id);

  const dropoffPoint = allPoints.find(p => {
    const id = normalizeId(p.id);
    return id === "drop-off" || id === "dropoff" || id === "drop off";
  });
  console.log("Dropoff point found:", dropoffPoint?.id);

  const standbyPoint = allPoints.find(p => normalizeId(p.id) === "desk");
  console.log("Standby point found:", standbyPoint?.id);

  const shelfPoint = allPoints.find(p => normalizeId(p.id) === normalizeId(shelfId));
  console.log("Shelf point found:", shelfPoint?.id);
  
  if (!pickupPoint || !dropoffPoint || !standbyPoint || !shelfPoint) {
    throw new Error(`❌ One or more required points not found. Looking for: pick-up, drop-off, desk, and ${shelfId}`);
  }

  const steps = uiMode === "pickup"
    ? [pickupPoint, shelfPoint, standbyPoint]
    : [shelfPoint, dropoffPoint, standbyPoint];

  console.log(`🚀 Starting ${uiMode} mission for ${shelfId}`);
  
  // Execute each movement sequentially using the navigate_to action
  const results = [];
  
  for (const point of steps) {
    console.log(`🔄 Moving to point: ${point.id} (${point.x}, ${point.y})`);
    try {
      const moveResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, 
        {
          action: "navigate_to",
          target_x: point.x,
          target_y: point.y
        },
        {
          headers: { "x-api-key": ROBOT_SECRET },
        }
      );
      
      results.push({
        point: point.id,
        status: "success",
        data: moveResponse.data
      });
      
      // Wait for completion before moving to next point
      // In a real app, you might want to poll the robot's status instead
      console.log("Waiting 3 seconds before next movement...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Error moving to point ${point.id}:`, error);
      results.push({
        point: point.id,
        status: "error",
        error: error.message || String(error)
      });
      // Continue with the next point even if this one failed
    }
  }

  return {
    mission: `${uiMode}-${shelfPoint.id}-${Date.now()}`,
    status: "completed",
    steps: results
  };
}

// Run the test
async function runTest() {
  try {
    // Sample request matching the expected format in mission-routes.ts
    const testRequest = {
      uiMode: "pickup", // either "pickup" or "dropoff"
      shelfId: "145",   // target point ID
    };
    
    console.log("Starting integrated mission test...");
    const result = await runMission(testRequest);
    
    console.log("Mission completed successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error running mission:", error);
  }
}

runTest();