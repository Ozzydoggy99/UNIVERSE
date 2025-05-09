/**
 * Test script to pick up a bin from the pickup point and deliver it to a shelf point
 * This is the reverse of the shelf-to-dropoff workflow
 */
const axios = require('axios');
const fs = require('fs');

// Configuration
const API_BASE = 'http://localhost:5000/api';
const ROBOT_SECRET = process.env.ROBOT_SECRET || 'test_robot_secret';

// Logging function for debugging
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync('robot-test-logs.log', logMessage);
  console.log(message);
}

async function testPickupToShelf() {
  try {
    logToFile('🚀 Starting Pickup to Shelf workflow (pickup → shelf → return to charger)...');
    
    // Step 1: Fetch available maps and points to find the best shelf point
    logToFile('Fetching available maps and points...');
    const mapsResponse = await axios.get(`${API_BASE}/workflow/maps`);
    
    if (!mapsResponse.data.success) {
      throw new Error('Failed to get maps: ' + mapsResponse.data.error);
    }
    
    const maps = mapsResponse.data.maps;
    if (!maps || maps.length === 0) {
      throw new Error('No maps found');
    }
    
    // Find Map 3 (or any map with shelf points)
    const map = maps.find(m => m.id === '3' || (m.shelfPoints && m.shelfPoints.length > 0));
    if (!map) {
      throw new Error('Could not find suitable map with shelf points');
    }
    
    logToFile(`Using map: ${map.id} (${map.name || 'Unnamed Map'})`);
    
    // Find a shelf point to use for dropoff
    if (!map.shelfPoints || map.shelfPoints.length === 0) {
      throw new Error(`No shelf points found on map ${map.id}`);
    }
    
    const shelfPoint = map.shelfPoints[0];
    logToFile(`Using shelf point: ${shelfPoint.id} (Shelf 1)`);
    
    // Step 2: Start the workflow
    logToFile('Starting workflow for pickup → shelf...');
    const response = await axios.post(`${API_BASE}/workflow/dropoff`, {
      serviceType: 'laundry',
      operationType: 'dropoff', // This is required - "dropoff" means pickup → shelf
      floorId: map.id,
      shelfId: shelfPoint.id
    });
    
    if (!response.data.success) {
      throw new Error('Failed to start workflow: ' + response.data.error);
    }
    
    const workflowId = response.data.workflowId;
    logToFile(`✅ Workflow started with ID: ${workflowId}`);
    
    // Step 3: Monitor the workflow until completion
    let completed = false;
    let status = 'in-progress';
    let currentStep = 0;
    let totalSteps = 8;
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (120 * 5 seconds)
    
    logToFile('📍 Monitoring workflow progress...');
    
    while (!completed && attempts < maxAttempts) {
      attempts++;
      
      try {
        const statusResponse = await axios.get(`${API_BASE}/workflow/status/${workflowId}`);
        
        if (statusResponse.data.success) {
          status = statusResponse.data.status;
          currentStep = statusResponse.data.currentStep || currentStep;
          totalSteps = statusResponse.data.totalSteps || totalSteps;
          
          const progressPct = Math.round((currentStep / totalSteps) * 100);
          logToFile(`📊 Workflow progress: ${progressPct}% (Step ${currentStep}/${totalSteps}) - Status: ${status}`);
          
          if (status === 'completed') {
            completed = true;
            logToFile('✅ Workflow completed successfully!');
            break;
          } else if (status === 'failed') {
            throw new Error(`Workflow failed: ${statusResponse.data.error || 'Unknown error'}`);
          }
        }
      } catch (statusError) {
        logToFile(`Error checking workflow status: ${statusError.message}`);
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    if (!completed) {
      throw new Error('Workflow timed out after maximum attempts');
    }
    
    logToFile('🎉 Test completed successfully! The bin has been moved from the pickup point to the shelf point.');
    
  } catch (error) {
    logToFile(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

// Run the test
testPickupToShelf();