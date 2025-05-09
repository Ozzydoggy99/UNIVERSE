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
        charge_retry_count: 3,
        properties: {
          max_trans_vel: 0.3,  // Slower speed for more accurate docking
          max_rot_vel: 0.3,
          acc_lim_x: 0.3,
          acc_lim_theta: 0.3,
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
          // Wait a bit for charging to potentially start
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Check move status first
          const moveResponse = await axios.get(`${ROBOT_API_URL}/chassis/moves/${moveId}`, { headers });
          console.log(`[${timestamp}] [CHARGER-DIRECT] Move status: ${moveResponse.data.state}`);
          
          // Check if charging
          const batteryResponse = await axios.get(`${ROBOT_API_URL}/battery_state`, { headers });
          const batteryState = batteryResponse.data;
          
          if (batteryState && batteryState.is_charging) {
            console.log(`[${timestamp}] [CHARGER-DIRECT] ✅ SUCCESS! Robot is now CHARGING`);
          } else {
            console.log(`[${timestamp}] [CHARGER-DIRECT] ⚠️ WARNING: Robot may not be charging properly`);
            console.log(`[${timestamp}] [CHARGER-DIRECT] Battery state: ${JSON.stringify(batteryState)}`);
          }
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