// Test script for mission runner
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { runMission } from './server/backend/mission-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Sample request
const testRequest = {
  uiMode: "pickup",
  shelfId: "145",
};

async function testMissionRunner() {
  try {
    console.log("Starting test mission...");
    const result = await runMission(testRequest);
    console.log("Mission completed successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error running mission:", error);
  }
}

testMissionRunner();