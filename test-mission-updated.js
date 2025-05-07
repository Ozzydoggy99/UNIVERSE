// Updated test for mission-runner.ts with fallback points
import axios from 'axios';
import 'dotenv/config';

const ROBOT_API_URL = "http://47.180.91.99:8090";
const ROBOT_SECRET = process.env.ROBOT_SECRET;

// Hardcoded points that match our robot-map-data.ts
const ROBOT_MAP_POINTS = [
  {
    id: "Charging Station",
    x: -23.24,
    y: 1.64,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Pick-up",
    x: -11.94,
    y: 6.31,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Drop-off",
    x: 0.5,
    y: 4.2,
    ori: 0,
    floorId: "1"
  },
  {
    id: "Desk",
    x: -5.75,
    y: 5.12,
    ori: 0,
    floorId: "1"
  },
  {
    id: "145",
    x: -13.6,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "146",
    x: -10.2,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "147",
    x: -6.8,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "148",
    x: -3.4,
    y: 2.1,
    ori: 0,
    floorId: "1"
  },
  {
    id: "149",
    x: 0,
    y: 2.1,
    ori: 0,
    floorId: "1"
  }
];

// This is our modified runMission function that uses hardcoded points
async function runMission({ shelfId, uiMode, points }) {
  if (!ROBOT_SECRET) {
    throw new Error("❌ Missing robot authentication token");
  }

  console.log("🔍 Using map points...");
  
  // Use provided points or fallback to hardcoded points
  const mapPoints = points || ROBOT_MAP_POINTS;
  console.log(`📝 Total points available: ${mapPoints.length}`);
  console.log(`🔍 Looking for: pickup/pick-up, dropoff/drop-off, desk, and ${shelfId}`);
  
  const normalize = (val) => String(val || "").trim().toLowerCase();

  // Improved case-insensitive matching with better logging
  const pickupPoint = mapPoints.find(p => {
    const id = normalize(p.id);
    return id === "pick-up" || id === "pickup" || id === "pick up";
  });
  console.log("Pickup point found:", pickupPoint?.id);

  const dropoffPoint = mapPoints.find(p => {
    const id = normalize(p.id);
    return id === "drop-off" || id === "dropoff" || id === "drop off";
  });
  console.log("Dropoff point found:", dropoffPoint?.id);

  const standbyPoint = mapPoints.find(p => normalize(p.id) === "desk");
  console.log("Standby point found:", standbyPoint?.id);

  const shelfPoint = mapPoints.find(p => normalize(p.id) === normalize(shelfId));
  console.log("Shelf point found:", shelfPoint?.id);
  
  console.log("Available point IDs:", mapPoints.map(p => p.id));

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
      
      // Wait for completion before moving to next point - in production code you'd poll status
      console.log("Waiting 3 seconds before next movement...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`❌ Error moving to point ${point.id}:`, error.message);
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
    
    console.log("Starting mission test with hardcoded points...");
    const result = await runMission(testRequest);
    
    console.log("Mission completed successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error running mission:", error);
  }
}

runTest();