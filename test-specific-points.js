// Test script to find if specific named points exist
import axios from 'axios';
import 'dotenv/config';

const ROBOT_API_URL = "http://47.180.91.99:8090";
const ROBOT_SECRET = process.env.ROBOT_SECRET;

async function testSpecificPoints() {
  if (!ROBOT_SECRET) {
    console.error("❌ ERROR: Missing ROBOT_SECRET environment variable");
    return;
  }

  try {
    console.log("🔍 Testing specific robot points...");
    
    // Try to get robot positions API
    console.log("Testing positions endpoint...");
    try {
      const positionsRes = await axios.get(`${ROBOT_API_URL}/positions`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Found positions:", positionsRes.data);
      
      // If we have positions, try to parse and use them
      if (Array.isArray(positionsRes.data) && positionsRes.data.length > 0) {
        const positions = positionsRes.data;
        console.log(`Found ${positions.length} positions`);
        
        positions.forEach((pos, i) => {
          console.log(`Position ${i+1}:`, pos);
        });
        
        // Check if they have names like "pickup" or "dropoff"
        const pickup = positions.find(p => 
          (p.name || "").toLowerCase().includes("pick") || 
          (p.id || "").toLowerCase().includes("pick"));
        
        const dropoff = positions.find(p => 
          (p.name || "").toLowerCase().includes("drop") || 
          (p.id || "").toLowerCase().includes("drop"));
          
        if (pickup) console.log("✅ Found pickup point:", pickup);
        if (dropoff) console.log("✅ Found dropoff point:", dropoff);
      }
    } catch (error) {
      console.error("❌ Error with positions endpoint:", error.message);
    }
    
    // Try POIs (Points of Interest) endpoint
    console.log("\nTesting POIs endpoint...");
    try {
      const poisRes = await axios.get(`${ROBOT_API_URL}/pois`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Found POIs:", poisRes.data);
      
      // If we have POIs, try to use them
      if (Array.isArray(poisRes.data) && poisRes.data.length > 0) {
        const pois = poisRes.data;
        console.log(`Found ${pois.length} POIs`);
        
        pois.forEach((poi, i) => {
          console.log(`POI ${i+1}:`, poi);
        });
        
        // Check if they have names like "pickup" or "dropoff"
        const pickup = pois.find(p => 
          (p.name || "").toLowerCase().includes("pick") || 
          (p.id || "").toLowerCase().includes("pick"));
        
        const dropoff = pois.find(p => 
          (p.name || "").toLowerCase().includes("drop") || 
          (p.id || "").toLowerCase().includes("drop"));
          
        if (pickup) console.log("✅ Found pickup POI:", pickup);
        if (dropoff) console.log("✅ Found dropoff POI:", dropoff);
      }
    } catch (error) {
      console.error("❌ Error with POIs endpoint:", error.message);
    }
    
    // Try to get locations API
    console.log("\nTesting locations endpoint...");
    try {
      const locationsRes = await axios.get(`${ROBOT_API_URL}/locations`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Found locations:", locationsRes.data);
      
      // If we have locations, try to parse and use them
      if (Array.isArray(locationsRes.data) && locationsRes.data.length > 0) {
        const locations = locationsRes.data;
        console.log(`Found ${locations.length} locations`);
        
        locations.forEach((loc, i) => {
          console.log(`Location ${i+1}:`, loc);
        });
        
        // Check if they have names like "pickup" or "dropoff"
        const pickup = locations.find(p => 
          (p.name || "").toLowerCase().includes("pick") || 
          (p.id || "").toLowerCase().includes("pick"));
        
        const dropoff = locations.find(p => 
          (p.name || "").toLowerCase().includes("drop") || 
          (p.id || "").toLowerCase().includes("drop"));
          
        if (pickup) console.log("✅ Found pickup location:", pickup);
        if (dropoff) console.log("✅ Found dropoff location:", dropoff);
      }
    } catch (error) {
      console.error("❌ Error with locations endpoint:", error.message);
    }
    
    // Last resort: Check if "points" is a top-level API endpoint
    console.log("\nTesting points endpoint...");
    try {
      const pointsRes = await axios.get(`${ROBOT_API_URL}/points`, {
        headers: { "x-api-key": ROBOT_SECRET }
      });
      console.log("✅ Found points:", pointsRes.data);
      
      // If we have points, try to parse and use them
      if (Array.isArray(pointsRes.data) && pointsRes.data.length > 0) {
        const points = pointsRes.data;
        console.log(`Found ${points.length} points`);
        
        // Print first few points
        points.slice(0, 5).forEach((p, i) => {
          console.log(`Point ${i+1}:`, p);
        });
        
        // Check if they have names like "pickup" or "dropoff"
        const pickup = points.find(p => 
          (p.name || "").toLowerCase().includes("pick") || 
          (p.id || "").toLowerCase().includes("pick"));
        
        const dropoff = points.find(p => 
          (p.name || "").toLowerCase().includes("drop") || 
          (p.id || "").toLowerCase().includes("drop"));
          
        if (pickup) console.log("✅ Found pickup point:", pickup);
        if (dropoff) console.log("✅ Found dropoff point:", dropoff);
      }
    } catch (error) {
      console.error("❌ Error with points endpoint:", error.message);
    }
    
    // Final test: Try to get information about specific points
    console.log("\nChecking for specific named points...");
    const specialPoints = ["pickup", "pick-up", "dropoff", "drop-off", "charging", "desk"];
    
    for (const pointName of specialPoints) {
      try {
        console.log(`Checking if '${pointName}' exists...`);
        const pointRes = await axios.get(`${ROBOT_API_URL}/points/${pointName}`, {
          headers: { "x-api-key": ROBOT_SECRET }
        });
        console.log(`✅ Found point '${pointName}':`, pointRes.data);
      } catch (error) {
        console.error(`❌ Point '${pointName}' not found:`, error.message);
      }
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
testSpecificPoints().catch(console.error);