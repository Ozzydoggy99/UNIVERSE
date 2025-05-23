import 'dotenv/config';
import axios from 'axios';
import { ROBOT_API_URL, ROBOT_SECRET } from './robot-constants.js';

console.log('Starting return to charger test...');

// API headers for authentication
const headers = {
  'Content-Type': 'application/json',
  'x-api-key': ROBOT_SECRET
};

// Known charger coordinates from the codebase
const chargerPosition = {
  x: 0.03443853667262486,
  y: 0.4981316698765672,
  ori: 266.11
};

async function returnToCharger() {
  console.log('🔋 Starting return to charger operation...');
  
  try {
    // METHOD 1: Try the dedicated return_to_charger service first
    console.log('METHOD 1: Using dedicated return_to_charger service...');
    try {
      const response = await axios.post(`${ROBOT_API_URL}/services/return_to_charger`, {}, { headers });
      console.log('✅ Return to charger command sent successfully via services endpoint');
      return true;
    } catch (error: any) {
      console.log('Service endpoint failed, trying next method...', error.message);
    }

    // METHOD 2: Use the charge move type with known coordinates
    console.log('METHOD 2: Using charge move type with known coordinates...');
    try {
      const chargeCommand = {
        creator: 'test-script',
        type: 'charge',            // Special move type for charger return
        target_x: chargerPosition.x,
        target_y: chargerPosition.y,
        target_z: 0,
        target_ori: chargerPosition.ori,
        target_accuracy: 0.05,     // 5cm accuracy required for docking
        charge_retry_count: 5,     // Number of retries for docking
        properties: {
          max_trans_vel: 0.2,      // Slower speed for more accurate docking
          max_rot_vel: 0.3,        // Maximum rotational velocity (rad/s)
          acc_lim_x: 0.5,          // Acceleration limit in x
          acc_lim_theta: 0.5       // Angular acceleration limit
        }
      };

      const response = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargeCommand, { headers });
      const moveId = response.data.id;
      console.log(`Charge command sent - move ID: ${moveId}`);

      // Poll the move status until completion
      let moveComplete = false;
      let attempts = 0;
      const maxRetries = 180; // 3 minutes at 1 second intervals

      while (!moveComplete && attempts < maxRetries) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
        const moveStatus = statusResponse.data.state;
        
        console.log(`Current move status: ${moveStatus}`);
        
        if (moveStatus === 'succeeded') {
          moveComplete = true;
          console.log('✅ Robot has successfully reached charging station');
          return true;
        } else if (moveStatus === 'failed' || moveStatus === 'cancelled') {
          throw new Error(`Move failed or was cancelled. Status: ${moveStatus}`);
        }
      }

      if (!moveComplete) {
        throw new Error('Return to charger timed out');
      }
    } catch (error: any) {
      console.log('Charge move failed:', error.message);
    }

    // METHOD 3: Try the basic charge endpoint
    console.log('METHOD 3: Using basic charge endpoint...');
    try {
      await axios.post(`${ROBOT_API_URL}/charge`, {}, { headers });
      console.log('✅ Return to charger command sent via charge endpoint');
      return true;
    } catch (error: any) {
      console.log('Charge endpoint failed:', error.message);
    }

    throw new Error('All return to charger methods failed');
  } catch (error: any) {
    console.error('❌ ERROR returning to charger:', error.message);
    return false;
  }
}

// Execute the test
returnToCharger().then(success => {
  if (success) {
    console.log('✅ Return to charger test completed successfully');
  } else {
    console.log('❌ Return to charger test failed');
  }
}).catch(error => {
  console.error('❌ Unhandled error:', error.message);
}); 