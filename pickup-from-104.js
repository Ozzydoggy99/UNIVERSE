#!/usr/bin/env node

/**
 * Script to perform a pickup from zone 104 and delivery to the Drop-off point
 * This script calls the direct API endpoint for 104 pickup
 */
import axios from 'axios';

// API Constants
const API_BASE_URL = 'http://localhost:5000/api';

async function pickupFrom104() {
  try {
    console.log('🚀 Starting Pickup from 104 to main dropoff workflow...');
    
    // Call the appropriate workflow endpoint
    const response = await axios.post(`${API_BASE_URL}/pickup-from-104/workflow`);
    
    if (response.data.success) {
      console.log(`✅ Workflow started with mission ID: ${response.data.missionId}`);
      console.log(`Total workflow steps: ${response.data.steps}`);
      console.log('This workflow will:');
      console.log('1. Go to 104 docking point (104_load_docking)');
      console.log('2. Align with rack at 104 point (104_load)');
      console.log('3. Jack up to grab bin');
      console.log('4. Go to dropoff docking point (drop-off_load_docking)');
      console.log('5. Align with rack at dropoff point (drop-off_load)');
      console.log('6. Jack down to release bin');
      console.log('7. Move away from dropoff for safety');
      console.log('8. Return to charger');
      console.log('❗ IMPORTANT: The mission is now in progress on the robot.');
    } else {
      console.error(`❌ Error: ${response.data.error}`);
    }
  } catch (error) {
    console.error('❌ Error executing pickup from 104 workflow:', error.message);
    
    // Check if endpoint exists
    try {
      console.log('Checking available workflow endpoints...');
      const apiResponse = await axios.get(`${API_BASE_URL}/workflow/templates`);
      console.log('Available workflow templates:', apiResponse.data);
    } catch (error) {
      console.log('Unable to fetch workflow templates:', error.message);
    }
  }
}

// Execute the task
pickupFrom104();