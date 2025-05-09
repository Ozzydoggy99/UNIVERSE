import express from 'express';
import axios from 'axios';
import { ROBOT_API_URL, getAuthHeaders } from './robot-constants';

/**
 * Direct implementation of charger docking using 'charge' move type
 * Created to test and verify that the robot can properly return to and dock with the charger
 */
export function registerChargerDockingRoutes(app: express.Express) {
  const headers = getAuthHeaders();
  
  // Execute direct charger docking - uses the known charger coordinates
  app.post('/api/robot/dock-with-charger', async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CHARGER-DIRECT] Received direct charger docking request`);
    
    try {
      // Use the known charger location from the map
      // This is the location reported in the logs: Charging Station_docking (0.03443853667262486, 0.4981316698765672) with orientation 266.11
      const chargerPosition = {
        x: 0.03443853667262486,
        y: 0.4981316698765672,
        ori: 266.11
      };
      
      // Cancel any current moves first
      console.log(`[${timestamp}] [CHARGER-DIRECT] Cancelling any current moves first`);
      try {
        await axios.patch(`${ROBOT_API_URL}/chassis/moves/current`, { 
          state: 'cancelled' 
        }, { headers });
        console.log(`[${timestamp}] [CHARGER-DIRECT] Successfully cancelled any current moves`);
      } catch (error: any) {
        console.log(`[${timestamp}] [CHARGER-DIRECT] Warning: Couldn't cancel current move: ${error.message}`);
        // Continue anyway - the error might just be that there's no current move
      }
      
      // Wait for any cancellation to complete
      console.log(`[${timestamp}] [CHARGER-DIRECT] Waiting for move cancellation to take effect...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Create the 'charge' move with all required parameters
      console.log(`[${timestamp}] [CHARGER-DIRECT] Creating 'charge' move to charger at (${chargerPosition.x}, ${chargerPosition.y}), orientation: ${chargerPosition.ori}`);
      
      // This is the payload for a charger docking move
      // Key points:
      // 1. Must use "charge" type (not "standard")
      // 2. Must include charge_retry_count
      // 3. Must use exact coordinates and orientation
      const chargePayload = {
        creator: "web_interface",
        type: "charge",
        target_x: chargerPosition.x,
        target_y: chargerPosition.y,
        target_z: 0,
        target_ori: chargerPosition.ori,
        target_accuracy: 0.05,  // 5cm accuracy required for docking
        charge_retry_count: 5,   // Increased from 3 to 5 retries
        properties: {
          max_trans_vel: 0.2,  // Slower speed for more accurate docking
          max_rot_vel: 0.2,
          acc_lim_x: 0.2,
          acc_lim_theta: 0.2,
          planning_mode: "directional"
        }
      };
      
      console.log(`[${timestamp}] [CHARGER-DIRECT] Sending charge command with payload:`, JSON.stringify(chargePayload));
      
      // Execute the charge move
      const chargeResponse = await axios.post(`${ROBOT_API_URL}/chassis/moves`, chargePayload, { headers });
      const moveId = chargeResponse.data.id;
      
      console.log(`[${timestamp}] [CHARGER-DIRECT] Charge command sent - move ID: ${moveId}`);
      console.log(`[${timestamp}] [CHARGER-DIRECT] Response data:`, JSON.stringify(chargeResponse.data));
      
      // Wait a moment and then check charging status
      setTimeout(async () => {
        try {
          // Check multiple times to see if the robot has docked properly
          const checkChargingStatus = async (attempt: number = 1, maxAttempts: number = 5) => {
            const currentTime = new Date().toISOString();
            console.log(`[${currentTime}] [CHARGER-DIRECT] Checking charging status (attempt ${attempt}/${maxAttempts})...`);
            
            try {
              // Check move status first
              const moveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
              const moveState = moveResponse.data;
              
              console.log(`[${currentTime}] [CHARGER-DIRECT] Move (ID: ${moveId}) status: ${moveState.state}`);
              
              // If the move failed, check the reason
              if (moveState.state === 'failed') {
                console.log(`[${currentTime}] [CHARGER-DIRECT] ❌ Charge move FAILED. Reason: ${moveState.fail_reason_str}`);
                console.log(`[${currentTime}] [CHARGER-DIRECT] Failure details: ${moveState.fail_message}`);
              }
              
              // Check if charging regardless of move status (could be charging even if move "failed")
              try {
                const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers });
                const batteryState = batteryResponse.data;
                
                console.log(`[${currentTime}] [CHARGER-DIRECT] Battery state: ${JSON.stringify(batteryState)}`);
                
                if (batteryState && batteryState.is_charging) {
                  console.log(`[${currentTime}] [CHARGER-DIRECT] ✅ SUCCESS! Robot is now CHARGING. Battery level: ${batteryState.percentage}%`);
                  return true; // Successfully charging
                } else {
                  console.log(`[${currentTime}] [CHARGER-DIRECT] ⚠️ Robot is NOT charging`);
                  
                  // If we've reached max attempts, give up
                  if (attempt >= maxAttempts) {
                    console.log(`[${currentTime}] [CHARGER-DIRECT] ❌ Failed to dock with charger after ${maxAttempts} attempts`);
                    return false;
                  }
                  
                  // Try again after a delay if we haven't reached max attempts
                  console.log(`[${currentTime}] [CHARGER-DIRECT] Will check again in 10 seconds...`);
                  setTimeout(() => checkChargingStatus(attempt + 1, maxAttempts), 10000);
                }
              } catch (batteryError: any) {
                console.log(`[${currentTime}] [CHARGER-DIRECT] Error checking battery state: ${batteryError.message}`);
                
                // If we've reached max attempts, give up
                if (attempt >= maxAttempts) {
                  console.log(`[${currentTime}] [CHARGER-DIRECT] ❌ Failed to verify charging status after ${maxAttempts} attempts`);
                  return false;
                }
                
                // Try again after a delay
                console.log(`[${currentTime}] [CHARGER-DIRECT] Will check again in 10 seconds...`);
                setTimeout(() => checkChargingStatus(attempt + 1, maxAttempts), 10000);
              }
            } catch (moveError: any) {
              console.log(`[${currentTime}] [CHARGER-DIRECT] Error checking move status: ${moveError.message}`);
              
              // If we've reached max attempts, give up
              if (attempt >= maxAttempts) {
                console.log(`[${currentTime}] [CHARGER-DIRECT] ❌ Failed to verify move status after ${maxAttempts} attempts`);
                return false;
              }
              
              // Try again after a delay
              console.log(`[${currentTime}] [CHARGER-DIRECT] Will check again in 10 seconds...`);
              setTimeout(() => checkChargingStatus(attempt + 1, maxAttempts), 10000);
            }
          };
          
          // Wait 10 seconds first for the robot to have a chance to start moving
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Start checking the charging status
          checkChargingStatus();
        } catch (error: any) {
          console.log(`[${timestamp}] [CHARGER-DIRECT] Could not verify charging status: ${error.message}`);
        }
      }, 1000);
      
      // Return success to the caller immediately
      return res.status(200).json({
        success: true,
        message: 'Direct charger docking initiated',
        moveId,
        chargerPosition
      });
    } catch (error: any) {
      const errorMessage = `Error initiating charger docking: ${error.message}`;
      console.error(`[${timestamp}] [CHARGER-DIRECT] ${errorMessage}`);
      
      if (error.response) {
        console.error(`[${timestamp}] [CHARGER-DIRECT] Response error:`, JSON.stringify(error.response.data));
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        details: error.response?.data || {}
      });
    }
  });
  
  console.log('✅ Registered direct charger docking route: /api/robot/dock-with-charger');
}