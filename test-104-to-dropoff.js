#!/usr/bin/env node

/**
 * Test script to pick up a bin from 104 and deliver it to the dropoff point
 * 
 * This script executes a workflow that:
 * 1. Moves to 104 docking point
 * 2. Aligns with 104 rack
 * 3. Jacks up to grab bin
 * 4. Moves to dropoff docking
 * 5. Aligns with dropoff rack
 * 6. Jacks down to release bin
 * 7. Returns to charger
 */

import axios from 'axios';

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

async function test104toDropoff() {
  try {
    console.log('🚀 Starting 104 to Dropoff workflow...');
    
    // Execute the shelf-to-central workflow with 104 as the pickup shelf
    const response = await axios.post(`${API_BASE_URL}/workflow/execute`, {
      templateId: 'shelf-to-central',
      inputs: {
        pickupShelf: '104'
      }
    });
    
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
      console.log('8. (Optional) Return to charger if available');
      console.log('❗ IMPORTANT: The mission is now in progress on the robot.');
      console.log('❗ Test complete. The robot will continue executing the workflow.');
    } else {
      console.error(`❌ Error: ${response.data.error}`);
    }
  } catch (error) {
    console.error('❌ Error executing 104 to Dropoff workflow:', error.message);
    if (error.response) {
      console.error('Error details:', error.response.data);
    }
  }
}

// Execute the test
test104toDropoff();