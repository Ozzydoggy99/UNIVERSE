/**
 * Test script to pick up a bin from zone 104 and deliver it to the Drop-off point
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ES modules don't have __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to log messages to a file
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  // Use current working directory - works in Replit
  const logPath = path.resolve(process.cwd(), 'robot-mission-log.json');
  fs.appendFileSync(logPath, logMessage);
}

// Main function to pickup a bin from zone 104
async function pickup104Zone() {
  try {
    logToFile("🤖 Sending robot to pick up bin from zone 104 and deliver to Drop-off point...");
    
    // Zone 104 coordinates: x=-16.329, y=6.419 (from map data)
    // Drop-off coordinates: x=-3.067, y=2.578 (from map data)
    
    // Define mission data
    const missionData = {
      // The target shelf at zone 104 where the bin is located
      shelf: {
        id: "zone-104",
        x: -16.329,
        y: 6.419,
        ori: 0
      },
      // The pickup point - same as shelf in this case
      pickup: {
        id: "zone-104-bin",
        x: -16.329,
        y: 6.419,
        ori: 0
      },
      // The drop-off point where the bin should be delivered
      standby: {
        id: "drop-off",
        x: -3.067,
        y: 2.578,
        ori: 0
      }
    };
    
    // Try both endpoint versions (with and without /api prefix)
    let response;
    try {
      // First try with /api prefix
      logToFile("Attempting to use endpoint with /api prefix...");
      response = await axios.post('http://localhost:5000/api/robots/assign-task/local', missionData);
    } catch (error) {
      // Fallback to version without /api prefix
      logToFile("Fallback to endpoint without /api prefix...");
      response = await axios.post('http://localhost:5000/robots/assign-task/local', missionData);
    }

    logToFile("✅ Task sent successfully!");
    logToFile(JSON.stringify(response.data, null, 2));
    
    // If the mission has an ID, monitor its status
    if (response.data && response.data.missionId) {
      const missionId = response.data.missionId;
      logToFile(`📊 Tracking mission ID: ${missionId}...`);
      await monitorMission(missionId);
    } else {
      logToFile("⚠️ No mission ID returned");
    }
    
  } catch (error) {
    logToFile(`❌ Error sending task: ${error.message}`);
    if (error.response) {
      logToFile(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Monitor mission progress
async function monitorMission(missionId, maxRetries = 120) {
  let retries = 0;
  let completed = false;
  
  logToFile(`Starting mission monitoring for ID: ${missionId}`);
  
  while (!completed && retries < maxRetries) {
    try {
      const response = await axios.get(`http://localhost:5000/api/missions/${missionId}`);
      const mission = response.data;
      
      const completedSteps = mission.steps.filter(step => step.status === 'completed').length;
      const totalSteps = mission.steps.length;
      
      logToFile(`Mission progress: ${completedSteps}/${totalSteps} steps completed`);
      
      if (mission.status === 'completed') {
        logToFile(`✅ Mission completed successfully!`);
        completed = true;
        break;
      } else if (mission.status === 'failed') {
        logToFile(`❌ Mission failed: ${mission.error || 'Unknown error'}`);
        break;
      }
      
      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
      retries++;
      
    } catch (error) {
      logToFile(`Error monitoring mission: ${error.message}`);
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
      retries++;
    }
  }
  
  if (!completed && retries >= maxRetries) {
    logToFile(`⚠️ Monitoring timed out after ${maxRetries} attempts`);
  }
  
  return completed;
}

// Execute the main function
pickup104Zone();