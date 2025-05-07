// Test script for mission runner (CommonJS format)
require('dotenv').config();

// Import the mission runner module
const missionRunner = require('./server/backend/mission-runner');

// Sample request
const testRequest = {
  uiMode: "pickup",
  shelfId: "145",
};

async function testMissionRunner() {
  try {
    console.log("Starting test mission...");
    const result = await missionRunner.runMission(testRequest);
    console.log("Mission completed successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error running mission:", error);
  }
}

testMissionRunner();