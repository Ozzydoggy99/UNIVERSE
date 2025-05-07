import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const ROBOT_API_URL = "http://47.180.91.99:8090"; // Live robot IP
const ROBOT_SECRET = process.env.ROBOT_SECRET || ""; // API key from environment

async function testPoseEndpoint() {
  try {
    console.log("Testing the /chassis/pose endpoint for actual position data");
    
    const res = await axios.get(`${ROBOT_API_URL}/chassis/pose`, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    console.log("Response:");
    console.log(JSON.stringify(res.data, null, 2));

    // Check if the response contains actual position data
    const hasPositionData = 
      res.data && 
      (Array.isArray(res.data.position) || 
       (typeof res.data.x !== 'undefined' && typeof res.data.y !== 'undefined'));
    
    if (hasPositionData) {
      console.log("\n✅ The endpoint provides actual position data");
      
      if (Array.isArray(res.data.position)) {
        console.log(`Position: x=${res.data.position[0]}, y=${res.data.position[1]}`);
      } else {
        console.log(`Position: x=${res.data.x}, y=${res.data.y}`);
      }
      
      if (typeof res.data.orientation !== 'undefined' || typeof res.data.ori !== 'undefined') {
        console.log(`Orientation: ${res.data.orientation || res.data.ori}`);
      }
    } else {
      console.log("\n❌ The endpoint doesn't provide actual position data");
      console.log("It only provides the help and sample command information");
    }

  } catch (err: any) {
    if (err.response) {
      console.error(`Error ${err.response.status}:`, err.response.data);
    } else {
      console.error("Unexpected error:", err.message);
    }
  }
}

testPoseEndpoint();