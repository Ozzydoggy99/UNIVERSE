// Script to test map point fetching specifically
import axios from 'axios';
import 'dotenv/config';

const ROBOT_API_URL = "http://47.180.91.99:8090";
const ROBOT_SECRET = process.env.ROBOT_SECRET;

async function testMapPointFetching() {
  if (!ROBOT_SECRET) {
    console.error("❌ ERROR: Missing ROBOT_SECRET environment variable");
    return;
  }

  try {
    console.log("🔍 Testing map point retrieval...");
    
    // 1. Fetch all maps first
    console.log(`Fetching maps from ${ROBOT_API_URL}/maps`);
    const mapsRes = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: { "x-api-key": ROBOT_SECRET }
    });
    const maps = mapsRes.data || [];
    
    console.log(`Found ${maps.length} maps:`);
    maps.forEach((map, i) => {
      console.log(`Map ${i+1}: ID=${map.uid || map.id}, Name=${map.name || map.map_name || "Unknown"}`);
    });
    
    if (!maps.length) {
      console.error("❌ No maps found!");
      return;
    }
    
    // Use the first map
    const activeMap = maps[0];
    const mapId = activeMap.uid || activeMap.id;
    
    // 2. Next, let's check what endpoints are available through the maps API
    // Different robots might use slightly different API structures
    
    // Try different map API endpoints
    try {
      console.log(`\nTrying to fetch map details via ${ROBOT_API_URL}/maps/${mapId}`);
      const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Success! Map details:", JSON.stringify(mapDetailRes.data, null, 2).substring(0, 200) + "...");
    } catch (error) {
      console.error(`❌ Error fetching map details from /maps/${mapId}:`, error.message);
    }
    
    // Try alternate endpoint structure
    try {
      console.log(`\nTrying alternate endpoint: ${ROBOT_API_URL}/map/${mapId}`);
      const altMapRes = await axios.get(`${ROBOT_API_URL}/map/${mapId}`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Success! Map details from alternate endpoint:", 
        JSON.stringify(altMapRes.data, null, 2).substring(0, 200) + "...");
    } catch (error) {
      console.error(`❌ Error fetching map details from /map/${mapId}:`, error.message);
    }
    
    // Try getting map points specifically
    try {
      console.log(`\nTrying to fetch map points via ${ROBOT_API_URL}/maps/${mapId}/points`);
      const pointsRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}/points`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Success! Map points:", JSON.stringify(pointsRes.data, null, 2));
    } catch (error) {
      console.error(`❌ Error fetching map points from /maps/${mapId}/points:`, error.message);
    }
    
    // Try getting POIs specifically (Points of Interest)
    try {
      console.log(`\nTrying to fetch POIs via ${ROBOT_API_URL}/maps/${mapId}/pois`);
      const poisRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}/pois`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Success! Map POIs:", JSON.stringify(poisRes.data, null, 2));
    } catch (error) {
      console.error(`❌ Error fetching POIs from /maps/${mapId}/pois:`, error.message);
    }
    
    // Try getting map details to see if points/overlays are included there
    try {
      console.log(`\nTrying to fetch map details to extract points from overlays...`);
      const mapDetailRes = await axios.get(`${ROBOT_API_URL}/maps/${mapId}`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      
      const mapData = mapDetailRes.data;
      if (mapData && typeof mapData === 'object') {
        console.log("Map data properties:", Object.keys(mapData));
        
        // Check if overlays exist and try to parse them
        if (mapData.overlays) {
          console.log("Overlays found! Attempting to parse...");
          try {
            const overlays = JSON.parse(mapData.overlays);
            console.log("Overlays structure:", JSON.stringify(overlays, null, 2).substring(0, 200) + "...");
            
            if (overlays.features && Array.isArray(overlays.features)) {
              const points = overlays.features.filter(f => 
                f.geometry && f.geometry.type === 'Point');
              console.log(`Found ${points.length} point features in overlays`);
              
              // Print first few points
              points.slice(0, 3).forEach((p, i) => {
                console.log(`Point ${i+1}:`, JSON.stringify(p, null, 2));
              });
            }
          } catch (parseError) {
            console.error("Failed to parse overlays JSON:", parseError.message);
          }
        } else {
          console.log("No overlays found in map data");
        }
        
        // Check for points property
        if (mapData.points) {
          console.log("Points found directly in map data!");
          console.log("Points:", JSON.stringify(mapData.points, null, 2));
        }
      }
    } catch (error) {
      console.error(`❌ Error fetching and analyzing map details:`, error.message);
    }
    
    console.log("\nTest completed!");
    
  } catch (error) {
    console.error("❌ Error during test:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
  }
}

// Run the test
testMapPointFetching().catch(console.error);