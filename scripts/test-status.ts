import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const ROBOT_API_URL = "http://47.180.91.99:8090"; // Live robot IP
const ROBOT_SECRET = process.env.ROBOT_SECRET || ""; // API key from environment

async function testStatus() {
  try {
    console.log(`Testing chassis status API at ${ROBOT_API_URL}`);
    
    const res = await axios.get(`${ROBOT_API_URL}/chassis/status`, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    console.log("✅ Robot Status Response:");
    console.log(JSON.stringify(res.data, null, 2));
    
    // Check specific properties to confirm what we receive
    if (res.data) {
      console.log("\nPosition data available:");
      console.log(`x: ${typeof res.data.x !== 'undefined' ? 'Yes' : 'No'}`);
      console.log(`y: ${typeof res.data.y !== 'undefined' ? 'Yes' : 'No'}`);
      console.log(`state: ${typeof res.data.state !== 'undefined' ? 'Yes' : 'No'}`);
    }
  } catch (err: any) {
    if (err.response) {
      console.error(`❌ Error ${err.response.status}:`, err.response.data);
    } else {
      console.error("❌ Unexpected error:", err.message);
    }
  }
}

// Also test the moves/latest endpoint
async function testLatestMove() {
  try {
    console.log(`\nTesting latest move API at ${ROBOT_API_URL}`);
    
    const res = await axios.get(`${ROBOT_API_URL}/chassis/moves/latest`, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    console.log("✅ Latest Move Response:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error(`❌ Error ${err.response.status}:`, err.response.data);
    } else {
      console.error("❌ Unexpected error:", err.message);
    }
  }
}

// Also test the standard position endpoint
async function testPosition() {
  try {
    console.log(`\nTesting position API at ${ROBOT_API_URL}`);
    
    const res = await axios.get(`${ROBOT_API_URL}/position`, {
      headers: { "x-api-key": ROBOT_SECRET },
    });

    console.log("✅ Position Response:");
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    if (err.response) {
      console.error(`❌ Error ${err.response.status}:`, err.response.data);
    } else {
      console.error("❌ Unexpected error:", err.message);
    }
  }
}

// Run all tests
async function runAllTests() {
  await testStatus();
  await testLatestMove();
  await testPosition();
}

runAllTests();