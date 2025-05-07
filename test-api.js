// Direct API test for robot movement
// Run with: node test-api.js

import axios from 'axios';
import 'dotenv/config';

const ROBOT_API_URL = "http://47.180.91.99:8090";
const ROBOT_SECRET = process.env.ROBOT_SECRET;

async function moveRobot() {
  if (!ROBOT_SECRET) {
    console.error("ERROR: Missing ROBOT_SECRET environment variable");
    return;
  }

  console.log("Testing direct robot movement...");
  
  try {
    // Test 1: Check if we can get map points
    console.log("1. Testing map points retrieval...");
    const mapRes = await axios.get(`${ROBOT_API_URL}/maps`, {
      headers: { "x-api-key": ROBOT_SECRET }
    });
    console.log(`Retrieved ${mapRes.data.length} maps`);
    
    // Test 2: Try a direct movement command
    console.log("2. Testing robot movement...");
    const moveRes = await axios.post(`${ROBOT_API_URL}/chassis/moves`, 
      {
        action: "navigate_to",
        target_x: -11.939641939591183,
        target_y: 6.311538684826701
      },
      {
        headers: { "x-api-key": ROBOT_SECRET }
      }
    );
    
    console.log("Robot movement API response:", moveRes.data);
    console.log("Test completed successfully!");
    
  } catch (error) {
    console.error("Error during test:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
      console.error("Response status:", error.response.status);
    }
  }
}

moveRobot();