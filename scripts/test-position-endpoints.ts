import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const ROBOT_API_URL = "http://47.180.91.99:8090"; // Live robot IP
const ROBOT_SECRET = process.env.ROBOT_SECRET || ""; // API key from environment

// List of potential position-related endpoints to test
const positionEndpoints = [
  "/position",
  "/tracked_pose",
  "/chassis/position",
  "/location",
  "/chassis/location",
  "/pose",
  "/current_pose",
  "/chassis/pose",
  "/chassis/current_pose",
  "/chassis/status"
];

async function testEndpoint(endpoint: string) {
  try {
    console.log(`Testing endpoint: ${endpoint}`);
    
    const res = await axios.get(`${ROBOT_API_URL}${endpoint}`, {
      headers: { "x-api-key": ROBOT_SECRET },
      timeout: 5000 // 5 second timeout
    });

    console.log(`✅ Success (${res.status}):`);
    console.log(JSON.stringify(res.data, null, 2));
    return true;
  } catch (err: any) {
    if (err.response) {
      console.error(`❌ Error ${err.response.status} for ${endpoint}`);
      // Only show detailed error for 404s if it's short
      if (err.response.status === 404 && 
          typeof err.response.data === 'string' && 
          err.response.data.length < 100) {
        console.error(err.response.data);
      }
    } else if (err.code === 'ECONNABORTED') {
      console.error(`⏱️ Timeout for ${endpoint}`);
    } else {
      console.error(`❌ Error for ${endpoint}:`, err.message);
    }
    return false;
  }
}

async function runTests() {
  console.log("=".repeat(50));
  console.log(`Testing position endpoints on ${ROBOT_API_URL}`);
  console.log("=".repeat(50));
  
  const results: Record<string, boolean> = {};
  
  for (const endpoint of positionEndpoints) {
    results[endpoint] = await testEndpoint(endpoint);
    console.log("-".repeat(50)); // Separator between tests
  }
  
  console.log("\nSUMMARY:");
  for (const [endpoint, success] of Object.entries(results)) {
    console.log(`${success ? '✅' : '❌'} ${endpoint}`);
  }
}

runTests();